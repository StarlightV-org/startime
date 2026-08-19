import { selfRouter } from "~/server/api/routers/self";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { orgRouter } from "./routers/org";
import { overviewRouter } from "./routers/overview";
import { miscRouter } from "./routers/misc";
import { publicStatsRouter } from "./routers/public-stats";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	misc: miscRouter,
	self: selfRouter,
	org: orgRouter,
	overview: overviewRouter,
	publicStats: publicStatsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
