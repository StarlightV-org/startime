import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const selfRouter = createTRPCRouter({
	lastLog: protectedProcedure.query(async ({ ctx }) => {}),
});
