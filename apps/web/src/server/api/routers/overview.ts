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
import type { API } from "~/trpc/server";

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

export type OverviewTopElement = API["overview"]["getTop"]["editor"]["p1"];

export const overviewRouter = createTRPCRouter({
	getActivity: protectedProcedure.input(timeRangeSchema).query(async ({ ctx, input }) => {
		const regional = ctx.user.accountConfig.regional;
		const [start, end] = getTimeRange(input, regional.timeZone, undefined, regional.startOfWeek);
		const [startToday, endToday] = getTimeRange("thisDay", regional.timeZone, undefined, regional.startOfWeek);

		if (!startToday || !endToday) {
			throw new Error("Unable to determine the current day range");
		}

		const timeZone = normalizeTimeZone(regional.timeZone);
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

	getTop: protectedProcedure
		.input(
			z.object({
				timeRange: timeRangeSchema,
				filter: z.object({
					editor: z.string().or(z.literal("")),
					workspace: z.string().or(z.literal("")),
					language: z.string().or(z.literal("")),
					platform: z.string().or(z.literal("")),
				}),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { timeRange, filter } = input;
			Print.Debug("filter", filter);
			const regional = ctx.user.accountConfig.regional;
			const [start, end] = getTimeRange(timeRange, regional.timeZone, undefined, regional.startOfWeek);

			const where = and(
				eq(eventLogs.userId, ctx.user.id),
				start ? gte(eventLogs.eventTime, start) : undefined,
				end ? lt(eventLogs.eventTime, end) : undefined,
				filter.editor ? eq(eventLogs.editor, filter.editor) : undefined,
				filter.workspace ? eq(eventLogs.project, filter.workspace) : undefined,
				filter.language ? eq(eventLogs.language, filter.language) : undefined,
				filter.platform ? eq(eventLogs.platform, filter.platform) : undefined,
			);

			// Print.Debug("where", where?.getSQL());

			const events = await ctx.db
				.select({
					editor: eventLogs.editor,
					workspace: eventLogs.project,
					language: eventLogs.language,
					platform: eventLogs.platform,
				})
				.from(eventLogs)
				.where(where);

			const rankedItems = (values: string[]) => {
				const counts = new Map<string, number>();
				for (const value of values) {
					counts.set(value, (counts.get(value) ?? 0) + 1);
				}

				const totalEvents = values.length;
				const topItems = [...counts.entries()]
					.map(([value, eventCount]) => ({
						value,
						eventCount,
						percentage: totalEvents === 0 ? 0 : Number(((eventCount / totalEvents) * 100).toFixed(2)),
					}))
					.sort((a, b) => b.percentage - a.percentage || a.value.localeCompare(b.value))
					.slice(0, 5);
				const rankItem = (item: (typeof topItems)[number] | undefined) => ({
					value: item?.value ?? "",
					time: toTimeString(item?.eventCount ?? 0),
					percentage: item?.percentage ?? 0,
				});

				return {
					p1: rankItem(topItems[0]),
					p2: rankItem(topItems[1]),
					p3: rankItem(topItems[2]),
					p4: rankItem(topItems[3]),
					p5: rankItem(topItems[4]),
				};
			};

			return {
				editor: rankedItems(events.map((event) => event.editor)),
				workspace: rankedItems(events.map((event) => event.workspace)),
				language: rankedItems(events.map((event) => event.language)),
				platform: rankedItems(events.map((event) => event.platform)),
			};
		}),
});
