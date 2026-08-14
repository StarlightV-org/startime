import { sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { eventLogs } from "@startime/db";
import { and, eq, gte, lt } from "drizzle-orm";
import { startOfDay, endOfDay } from "date-fns/fp";

export const overviewRouter = createTRPCRouter({
	getTotalTime: protectedProcedure.query(async ({ ctx }) => {
		Print.Time("getTotalTime");

		const activeMinutes = ctx.db.$with("active_minutes").as(
			ctx.db
				.selectDistinct({
					minute: sql<Date>`date_trunc('minute', ${eventLogs.eventTime})`.as("minute"),
				})
				.from(eventLogs)
				.where(
					and(
						eq(eventLogs.userId, ctx.user.id),
						gte(eventLogs.eventTime, startOfDay(new Date())),
						lt(eventLogs.eventTime, endOfDay(new Date())), // exclusive end avoids boundary double-counting
					),
				),
		);

		const [result] = await ctx.db
			.with(activeMinutes)
			.select({
				activeSeconds: sql<number>`count(*) * 60`.mapWith(Number),
				activeMinutes: sql<number>`count(*)`.mapWith(Number),
			})
			.from(activeMinutes);

		Print.Time("getTotalTime");

		if (!result) return null;

		const fullHours = Math.floor(result.activeMinutes / 60);
		const remainingMinutes = result.activeMinutes - fullHours * 60;

		return { fullHours, remainingMinutes };
	}),
});
