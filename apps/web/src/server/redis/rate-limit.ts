import { TRPCError } from "@trpc/server";
import type { SessionType } from "better-auth";
import { formatRetryAfter } from "~/lib/rateLimit";
import type Redis from "ioredis";
import { getRedis } from "./redis-client";
import { REAUTH_REQUIRED_CAUSE } from "~/lib/reauth-util";
import { ENV } from "@startime/env";
import type { TRPCContext } from "../api/trpc";

const RATE_LIMIT_CAUSE = "TOO_MANY_REQUESTS" as const;

/** v2: NX+PX cooldown keys only (TTL == cooldownMs). v1 used long PX TTL + Lua timestamps — do not reuse. */
const REDIS_RATE_LIMIT_PREFIX = "ratelimit:v1:";

function redisRateLimitKey(userId: string, resource: string): string {
	return `${REDIS_RATE_LIMIT_PREFIX}${userId}:${resource}`;
}

function isReauthError(error: unknown): boolean {
	const err = error as { cause?: string; code?: string; message?: string };
	return (
		err?.cause === REAUTH_REQUIRED_CAUSE ||
		(err?.code === "UNAUTHORIZED" && err?.message === "Re-authentication required")
	);
}

function isRateLimitingDisabled(): boolean {
	return ENV.DISABLE_RATE_LIMITING === true && ENV.NODE_ENV === "development";
}

export type RateLimitCause = {
	type: typeof RATE_LIMIT_CAUSE;
	retryAfterMs: number;
	description?: string;
	title?: string;
};

export type RateLimitOptions = {
	/** Minimum spacing between allowed requests for this procedure (milliseconds). Stored as Redis key TTL (`PX`). */
	cooldownMs: number;
	// bypassPermission?: "ADMIN" | PermissionString;
	resourceId?: string;
};

export type RateLimitCheckOptions = {
	/** ID of the user whose requests are being limited. */
	userId: string;
	/** Stable identifier for the route or operation being limited. */
	resource: string;
	/** Minimum spacing between allowed requests in milliseconds. */
	cooldownMs: number;
};

export type RateLimitCheckResult = { ok: true } | { ok: false; retryAfterMs: number };

export const RATE_LIMIT_CAUSE_VALUE = RATE_LIMIT_CAUSE;

/**
 * Cooldown gate: `SET key NX PX` only succeeds when no cooldown bucket exists.
 * On conflict, `PTTL` yields retry-after milliseconds.
 */
async function tryTakeCooldownSlot(redis: Redis, key: string, cooldownMs: number): Promise<RateLimitCheckResult> {
	const created = await redis.set(key, "1", "PX", cooldownMs, "NX");

	if (created === "OK") {
		return { ok: true };
	}

	let retryAfterMs = await redis.pttl(key);

	/** Remaining TTL must not exceed `cooldownMs` for NX+PX cooldown keys; `-1` is key without expiry (invalid here). */
	const pttlIsInconsistent = retryAfterMs > cooldownMs || retryAfterMs === -1;
	if (pttlIsInconsistent) {
		await redis.del(key);
		const healed = await redis.set(key, "1", "PX", cooldownMs, "NX");
		if (healed === "OK") {
			return { ok: true };
		}
		retryAfterMs = await redis.pttl(key);
	}

	if (retryAfterMs <= 0) {
		const retryCreate = await redis.set(key, "1", "PX", cooldownMs, "NX");
		if (retryCreate === "OK") {
			return { ok: true };
		}
		retryAfterMs = await redis.pttl(key);
	}

	const finalRetryAfterMs = Math.min(retryAfterMs > 0 ? retryAfterMs : cooldownMs, cooldownMs);

	return {
		ok: false,
		retryAfterMs: finalRetryAfterMs,
	};
}

/**
 * Attempts to reserve a per-user cooldown slot for a route or operation.
 * Redis errors are allowed to propagate so each caller can use its own error response.
 */
export async function checkRateLimit({
	userId,
	resource,
	cooldownMs,
}: RateLimitCheckOptions): Promise<RateLimitCheckResult> {
	if (isRateLimitingDisabled()) {
		return { ok: true };
	}

	const redis = getRedis();
	return tryTakeCooldownSlot(redis, redisRateLimitKey(userId, resource), cooldownMs);
}

async function clearRateLimit(userId: string, resource: string): Promise<void> {
	await getRedis().del(redisRateLimitKey(userId, resource));
}

/**
 * Creates a tRPC middleware for per-user, per-resource cooldown-based rate limiting.
 * Must be used with protectedProcedure (requires authenticated user).
 */
export function __createRateLimitMiddleware(options: RateLimitOptions) {
	const { cooldownMs, resourceId } = options;

	return async function rateLimitMiddleware(opts: { ctx: TRPCContext; path: string; next: () => Promise<unknown> }) {
		const { ctx, path, next } = opts;
		if (isRateLimitingDisabled()) return next();

		const session = ctx.session as (SessionType["session"] & { user?: SessionType["user"] }) | undefined;
		const user = session?.user ?? (ctx as { user?: SessionType["user"] }).user;
		const userId = user?.id;

		if (!userId) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
		}

		const { t } = ctx.i18n;

		const resource = resourceId ?? path;

		// if (bypassPermission && user && session) {
		// 	const auth: SessionType = { session, user };
		// 	const allowed = await hasPermission(bypassPermission, auth);
		// 	if (allowed) {
		// 		return next();
		// 	}
		// }

		let reserve: RateLimitCheckResult;
		try {
			reserve = await checkRateLimit({ userId, resource, cooldownMs });
		} catch {
			throw new TRPCError({
				code: "SERVICE_UNAVAILABLE",
				message: "Rate limiting temporarily unavailable",
			});
		}

		if (!reserve.ok) {
			const retryAfterMs = reserve.retryAfterMs;
			const err = new TRPCError({
				code: "TOO_MANY_REQUESTS",
				message: t("Too many requests. Please try again in {{retryAfter}}.", {
					retryAfter: formatRetryAfter(retryAfterMs),
				}),
				cause: {
					type: RATE_LIMIT_CAUSE,
					retryAfterMs,
					title: t("Too many requests"),
					description: t("Please try again in {{retryAfter}}.", { retryAfter: formatRetryAfter(retryAfterMs) }),
				} satisfies RateLimitCause,
			});
			(err as TRPCError & { retryAfterMs?: number }).retryAfterMs = retryAfterMs;
			throw err;
		}

		const result = await next();
		const failedResult = result as { ok?: boolean; error?: unknown };

		if (failedResult.ok === false && isReauthError(failedResult.error)) {
			try {
				await clearRateLimit(userId, resource);
			} catch {
				/* best-effort — TTL still expires */
			}
		}
		return result;
	};
}
