/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { db } from "@startime/db";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import z, { ZodError } from "zod";
import { getAuth } from "../better-auth";
import type { SessionType } from "better-auth";
import { PASSKEY_REGISTRATION_REQUIRED_CAUSE, REAUTH_REQUIRED_CAUSE } from "~/lib/reauth-util";
import { addSeconds } from "date-fns/fp";
import { op } from "~/lib/op";
import { setRequestI18n } from "~/i18n/server";
import { fromHeader, resolveLocale } from "~/i18n/locales";
import {
	__createRateLimitMiddleware as createRateLimitHandler,
	type RateLimitCause,
	RATE_LIMIT_CAUSE_VALUE,
	type RateLimitOptions,
} from "~/server/redis/rate-limit";

export const createTRPCContext = async (opts: { headers: Headers; source?: "http" | "server" }) => {
	const { session, user, invitations, org } = await getAuth();
	const i18n = await setRequestI18n(resolveLocale(user?.accountConfig?.regional.lang, fromHeader(opts.headers)));

	return {
		...opts,
		db,
		source: opts.source ?? "http",
		session,
		user,
		invitations,
		org,
		headers: opts.headers,
		i18n,
	};
};

export type TRPCContext = typeof createTRPCContext extends (opts: any) => Promise<infer T> ? T : never;

const t = initTRPC.context<typeof createTRPCContext>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError: error.cause instanceof ZodError ? z.treeifyError(error.cause) : null,
			},
		};
	},
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path, ctx }) => {
	const start = Date.now();
	const result = await next();
	const end = Date.now();

	const headers = ctx.headers;
	const ip = headers.get("CF-Connecting-IP") ?? headers.get("X-Forwarded-For") ?? headers.get("X-Real-IP") ?? "no-ip";

	Print.TRPC(path, end - start, {
		name: ctx.user?.name ?? "no-name",
		id: ctx.user?.id ?? "no-id",
		session: ctx.session?.id ?? "no-session",
		ok: result.ok,
		ip,
	});
	return result;
});

const errorMiddleware = t.middleware(async ({ next, path, ctx }) => {
	const result = await next();
	if (!result.ok) {
		Print.TRPCError(path, result.error, {
			name: ctx?.user?.name ?? "no-name",
			id: ctx?.user?.id ?? "no-id",
			session: ctx?.session?.id ?? "no-session",
		});
	}
	return result;
});

const FRESH_AUTH_MAX_AGE_SECONDS = 10;

export async function checkReauth(_auth: SessionType | null) {
	const auth = _auth ?? (await getAuth());
	// IF the user does not have a valid session, throw an error
	if (!auth.user?.id || !auth.session?.token) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	}

	const passkey = await db.query.passkeys.findFirst({
		where: (passkeys, { eq }) => eq(passkeys.userId, auth.user.id),
		columns: { id: true },
	});
	if (!passkey) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "A passkey is required before this action can be verified",
			cause: PASSKEY_REGISTRATION_REQUIRED_CAUSE,
		});
	}

	const sessionRow = await db.query.sessions.findFirst({
		where: (s, { eq }) => eq(s.token, auth.session?.token),
		columns: { lastAuthenticatedAt: true },
	});
	const lastAuth = sessionRow?.lastAuthenticatedAt ?? auth.session?.lastAuthenticatedAt;
	const cutoff = addSeconds(-FRESH_AUTH_MAX_AGE_SECONDS, new Date());

	if (!lastAuth || new Date(lastAuth) < cutoff) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Re-authentication required",
			cause: REAUTH_REQUIRED_CAUSE,
		});
	}
}

export type TrackMiddlewareOptions = {
	event: string;
	addInput?: boolean;
};

export const trackMiddleware = ({ event, addInput = true }: TrackMiddlewareOptions) =>
	t.middleware(async ({ next, ctx, input }) => {
		await op.track(event, {
			profileId: ctx.user.id,
			groups: [ctx.user.organizationId],
			...(addInput && input && typeof input === "object" ? input : {}),
		});

		return next();
	});

export const serverOnlyMiddleware = t.middleware(({ ctx, next, path }) => {
	if (ctx.source !== "server") {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `No procedure found on path "${path}"`,
		});
	}

	return next();
});

/**
 * Creates a rate limit middleware for use with protectedProcedure.
 * @example
 * revive: protectedProcedure
 *   .use(createRateLimitMiddleware({ cooldownMs: 30_000, bypassPermission: "ADMIN" }))
 *   .mutation(...)
 */
export const rateLimitMiddleware = (options: RateLimitOptions) =>
	t.middleware(createRateLimitHandler(options) as Parameters<typeof t.middleware>[0]);

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
	.use(timingMiddleware)
	.use(errorMiddleware)
	.use(({ ctx, next }) => {
		if (!ctx.session || !ctx.user.id) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
		}

		return next({
			ctx: {
				session: { ...ctx.session, user: ctx.user },
			},
		});
	});

export const reauthProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	// Fetch from DB - getSession may not include lastAuthenticatedAt
	await checkReauth({
		session: ctx.session,
		user: ctx.user,
		invitations: ctx.invitations,
		org: ctx.org,
	});

	return next({
		ctx: {
			session: { ...ctx.session, user: ctx.user },
		},
	});
});
