import { createTRPCRouter, protectedProcedure } from "../trpc";

export const miscRouter = createTRPCRouter({
	getVersion: protectedProcedure.query(async ({ ctx }) => {
		const pkg = await import("~/../package.json");

		return {
			version: pkg.version,
			lastUpdated: process.env.NEXT_PUBLIC_BUILD_TIME,
		};
	}),
});
