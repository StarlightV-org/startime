import { TZDate } from "@date-fns/tz";
import { eventLogs } from "@startime/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
	getTimeRange,
	normalizeTimeZone,
	timeRangeValues,
	toDayString,
	toTimeString,
	type TimeRange,
} from "~/lib/time-range";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import z from "zod";

export { getTimeRange, type TimeRange } from "~/lib/time-range";

const timeRangeSchema = z.enum(timeRangeValues);

const millisecondsPerDay = 86_400_000;

function toDayNumber(day: string): number {
	return Math.floor(new Date(day).getTime() / millisecondsPerDay);
}

function getStreaks(activeDays: string[], today: string) {
	const days = [...new Set(activeDays.map(toDayNumber))].sort((a, b) => a - b);
	const activeDaySet = new Set(days);

	let currentStreak = 0;
	for (let day = toDayNumber(today); activeDaySet.has(day); day--) {
		currentStreak++;
	}

	let allTimeStreak = 0;
	let streak = 0;
	let previousDay: number | undefined;

	for (const day of days) {
		streak = previousDay === day - 1 ? streak + 1 : 1;
		allTimeStreak = Math.max(allTimeStreak, streak);
		previousDay = day;
	}

	return { currentStreak, allTimeStreak };
}

function getLocalDate(timeZone: string): string {
	const now = TZDate.tz(timeZone);

	return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join(
		"-",
	);
}

export const overviewRouter = createTRPCRouter({
	getActivity: protectedProcedure.input(timeRangeSchema).query(async ({ ctx, input }) => {
		const [start, end] = getTimeRange(input, ctx.user.timeZone, undefined, ctx.user.startOfWeek);
		const [startToday, endToday] = getTimeRange("thisDay", ctx.user.timeZone, undefined, ctx.user.startOfWeek);

		if (!startToday || !endToday) {
			throw new Error("Unable to determine the current day range");
		}

		const timeZone = normalizeTimeZone(ctx.user.timeZone);
		const activeDay = sql<string>`(${eventLogs.eventTime} at time zone ${timeZone})::date`;
		const rangeFilter = and(
			eq(eventLogs.userId, ctx.user.id),
			start ? gte(eventLogs.eventTime, start) : undefined,
			end ? lt(eventLogs.eventTime, end) : undefined,
		);
		const todayFilter = and(gte(eventLogs.eventTime, startToday), lt(eventLogs.eventTime, endToday));

		const [activityResult, activeDays] = await Promise.all([
			ctx.db
				.select({
					activeMinutes: sql<number>`count(distinct date_trunc('minute', ${eventLogs.eventTime}))`.mapWith(Number),
					activeMinutesToday: sql<number>`
						count(distinct date_trunc('minute', ${eventLogs.eventTime}))
						filter (where ${todayFilter})
					`.mapWith(Number),
				})
				.from(eventLogs)
				.where(rangeFilter),
			ctx.db.selectDistinct({ day: activeDay }).from(eventLogs).where(eq(eventLogs.userId, ctx.user.id)),
		]);

		const activity = activityResult[0];
		const { currentStreak, allTimeStreak } = getStreaks(
			activeDays.map(({ day }) => day),
			getLocalDate(timeZone),
		);

		return {
			timeTotal: toTimeString(activity?.activeMinutes ?? 0),
			timeToday: toTimeString(activity?.activeMinutesToday ?? 0),
			currentStreak: toDayString(currentStreak),
			allTimeStreak: toDayString(allTimeStreak),
		};
	}),
});
