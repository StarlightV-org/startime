import { sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { eventLogs } from "@startime/db";
import { and, eq, gte, lt } from "drizzle-orm";
import {
	startOfDay,
	endOfDay,
	subHours,
	subDays,
	startOfWeek,
	endOfWeek,
	endOfMonth,
	endOfYear,
	startOfMonth,
	startOfYear,
} from "date-fns/fp";
import z from "zod";

export type TimeRange =
	// The Past 24 hours
	| "past1"
	// The Past 7 days
	| "past7"
	// The Past 30 days
	| "past30"
	// The Past 90 days
	| "past90"
	// The Past 365 days
	| "past365"
	// This day
	| "thisDay"
	// This week
	| "thisWeek"
	// This month
	| "thisMonth"
	// This year
	| "thisYear"
	// All time
	| "allTime";

export function getTimeRange(timeRange: TimeRange): [Date, Date] | [null, null] {
	switch (timeRange) {
		case "past1":
			return [subDays(1, new Date()), new Date()];
		case "past7":
			return [subDays(7, new Date()), new Date()];
		case "past30":
			return [subDays(30, new Date()), new Date()];
		case "past90":
			return [subDays(90, new Date()), new Date()];
		case "past365":
			return [subDays(365, new Date()), new Date()];
		case "thisDay":
			return [startOfDay(new Date()), endOfDay(new Date())];
		case "thisWeek":
			return [startOfWeek(new Date()), endOfWeek(new Date())];
		case "thisMonth":
			return [startOfMonth(new Date()), endOfMonth(new Date())];
		case "thisYear":
			return [startOfYear(new Date()), endOfYear(new Date())];
		case "allTime":
			return [null, null];
	}
}

export const overviewRouter = createTRPCRouter({
	getTime: protectedProcedure.input(z.string() as z.ZodType<TimeRange>).query(async ({ ctx, input }) => {
		const [start, end] = getTimeRange(input);

		const activeMinutes = ctx.db.$with("active_minutes").as(
			ctx.db
				.selectDistinct({
					minute: sql<Date>`date_trunc('minute', ${eventLogs.eventTime})`.as("minute"),
				})
				.from(eventLogs)
				.where(
					and(
						eq(eventLogs.userId, ctx.user.id),
						start ? gte(eventLogs.eventTime, start) : undefined,
						end ? lt(eventLogs.eventTime, end) : undefined,
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

		if (!result) return null;

		const fullHours = Math.floor(result.activeMinutes / 60);
		const remainingMinutes = result.activeMinutes - fullHours * 60;

		return { fullHours, remainingMinutes };
	}),
});
