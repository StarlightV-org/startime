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
