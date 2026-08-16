import { TZDate } from "@date-fns/tz";
import { eventLogs } from "@startime/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { rankByActiveMinutes } from "~/lib/overview-ranking";
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

const biggestUnitSchema = z.enum(["hour", "day", "week"]).optional();
export type BiggestUnit = z.infer<typeof biggestUnitSchema>;

export const overviewRouter = createTRPCRouter({
	getActivity: protectedProcedure
		.input(
			z.object({
				timeRange: timeRangeSchema,
				biggestUnit: biggestUnitSchema,
			}),
		)
		.query(async ({ ctx, input }) => {
			const regional = ctx.user.accountConfig.regional;
			const [start, end] = getTimeRange(input.timeRange, regional.timeZone, undefined, regional.startOfWeek);
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
				timeTotal: toTimeString(activity?.activeMinutes ?? 0, input.biggestUnit),
				timeToday: toTimeString(activity?.activeMinutesToday ?? 0, input.biggestUnit),
				currentStreak: toDayString(currentStreak),
				allTimeStreak: toDayString(allTimeStreak),
			};
		}),

	getTop: protectedProcedure
		.input(
			z.object({
				timeRange: timeRangeSchema,
				biggestUnit: biggestUnitSchema,
				filter: z.object({
					editor: z.string().or(z.literal("")),
					workspace: z.string().or(z.literal("")),
					language: z.string().or(z.literal("")),
					platform: z.string().or(z.literal("")),
				}),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { timeRange, filter, biggestUnit } = input;
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
					eventTime: eventLogs.eventTime,
					editor: eventLogs.editor,
					workspace: eventLogs.project,
					language: eventLogs.language,
					platform: eventLogs.platform,
				})
				.from(eventLogs)
				.where(where);

			const rankedItems = (values: { value: string; eventTime: Date }[]) => {
				const topItems = rankByActiveMinutes(values);
				const rankItem = (item: (typeof topItems)[number] | undefined) => ({
					value: item?.value ?? "",
					time: toTimeString(item?.minutes ?? 0, biggestUnit),
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
				editor: rankedItems(events.map(({ editor, eventTime }) => ({ value: editor, eventTime }))),
				workspace: rankedItems(events.map(({ workspace, eventTime }) => ({ value: workspace, eventTime }))),
				language: rankedItems(events.map(({ language, eventTime }) => ({ value: language, eventTime }))),
				platform: rankedItems(events.map(({ platform, eventTime }) => ({ value: platform, eventTime }))),
			};
		}),
});
