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

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
	const { session, user, invitations, org } = await getAuth();

	return {
		...opts,
		db,
		session,
		user,
		invitations,
		org,
		headers: opts.headers,
	};
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
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

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path, ctx }) => {
	const start = Date.now();
	const result = await next();
	const end = Date.now();

	Print.TRPC(path, end - start, {
		name: ctx.user.name ?? "no-name",
		id: ctx.user?.id ?? "no-id",
		session: ctx.session?.id ?? "no-session",
		ok: result.ok,
	});
	return result;
});

const errorMiddleware = t.middleware(async ({ next, path, ctx }) => {
	const result = await next();
	if (!result.ok) {
		Print.TRPCError(path, result.error, {
			name: ctx.user?.name ?? "no-name",
			id: ctx.user?.id ?? "no-id",
			session: ctx.session?.id ?? "no-session",
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
