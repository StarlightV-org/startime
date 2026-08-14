import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

import { eventImports, users } from "@startime/db";
import { count, eq, and, or } from "drizzle-orm";
import { isValidTimeZone, normalizeTimeZone } from "~/lib/time-range";
import z from "zod";

const timeZoneSchema = z.string().trim().refine(isValidTimeZone, "Select a valid IANA time zone.");
const startOfWeekSchema = z.enum(["monday", "sunday"]);

export const selfRouter = createTRPCRouter({
	updateSettings: protectedProcedure
		.input(z.object({ timeZone: timeZoneSchema, startOfWeek: startOfWeekSchema }))
		.mutation(async ({ ctx, input }) => {
			const timeZone = normalizeTimeZone(input.timeZone);
			const [user] = await ctx.db.select({ startOfWeek: users.startOfWeek }).from(users).where(eq(users.id, ctx.user.id));
			const startOfWeek =
				user?.startOfWeek?.startsWith("manual-") && user.startOfWeek ? user.startOfWeek : input.startOfWeek;

			await ctx.db.update(users).set({ timeZone, startOfWeek }).where(eq(users.id, ctx.user.id));

			return { timeZone, startOfWeek };
		}),
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
