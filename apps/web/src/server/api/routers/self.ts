import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

import { eventImports } from "@startime/db";
import { count, eq, and, or } from "drizzle-orm";

export const selfRouter = createTRPCRouter({
	listImports: protectedProcedure.query(async ({ ctx }) => {
		const imports = await ctx.db.query.eventImports.findMany({
			where: (imports, { eq, and }) => and(eq(imports.userId, ctx.user.id)),
			with: {
				importFile: true,
			},
			orderBy: (imports, { desc }) => desc(imports.updatedAt),
			limit: 5,
		});

		if (!imports) return { pendingImports: [], otherImports: [], totalCount: 0 };

		const totalCount = await ctx.db
			.select({ count: count(eventImports) })
			.from(eventImports)
			.where(
				and(
					eq(eventImports.userId, ctx.user.id),
					or(eq(eventImports.status, "failed"), eq(eventImports.status, "completed")),
				),
			);

		return {
			pendingImports: imports.filter((imports) => imports.status === "pending" || imports.status === "uploaded"),
			otherImports: imports
				.filter((imports) => imports.status !== "pending" && imports.status !== "uploaded")
				.sort((a, b) => {
					if (!a.updatedAt || !b.updatedAt) return 0;
					return b.updatedAt.getTime() - a.updatedAt.getTime();
				}),

			totalCount: totalCount?.[0]?.count ?? 0,
		};
	}),
});
