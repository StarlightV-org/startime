import { TZDate } from "@date-fns/tz";
import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import {
	addDays,
	differenceInCalendarDays,
	differenceInCalendarWeeks,
	format,
	getDay,
	startOfDay,
	startOfWeek,
} from "date-fns";
import { eventLogs } from "@startime/db";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { rankByActiveMinutes } from "~/lib/overview-ranking";
import { getStreaks } from "~/lib/streaks";
import { getTimeRange, normalizeTimeZone, timeRangeValues, toTimeString } from "~/lib/time-range";
import { createTRPCRouter, protectedProcedure, serverOnlyMiddleware } from "~/server/api/trpc";
import z from "zod";
import type { API } from "~/trpc/server";
import { differenceInMinutes } from "date-fns/fp";

export { getTimeRange, type TimeRange } from "~/lib/time-range";

const timeRangeSchema = z.enum(timeRangeValues);

function getLocalDate(timeZone: string): string {
	const now = TZDate.tz(timeZone);

	return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join(
		"-",
	);
}

function toDayString(days: number, i18n: I18n): string {
	if (days === 1) return i18n._(msg`1 day`);
	return i18n._(msg`${days} days`);
}

export type OverviewTopElement = API["overview"]["getTop"]["editor"]["p1"];

const biggestUnitSchema = z.enum(["hour", "day", "week"]).optional();
export type BiggestUnit = z.infer<typeof biggestUnitSchema>;

export const overviewRouter = createTRPCRouter({
	getActivity: protectedProcedure
		.use(serverOnlyMiddleware)
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

			const [activityResult, activeDays, lastEvent] = await Promise.all([
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
				ctx.db.select().from(eventLogs).where(rangeFilter).orderBy(desc(eventLogs.eventTime)).limit(1),
			]);

			const activity = activityResult[0];
			const { currentStreak, allTimeStreak } = getStreaks(
				activeDays.map(({ day }) => day),
				getLocalDate(timeZone),
			);

			return {
				timeTotal: toTimeString(activity?.activeMinutes ?? 0, input.biggestUnit),
				timeToday: toTimeString(activity?.activeMinutesToday ?? 0, input.biggestUnit),
				currentStreak: toDayString(currentStreak, ctx.i18n),
				allTimeStreak: toDayString(allTimeStreak, ctx.i18n),
				lastEvent: lastEvent[0],
			};
		}),

	getDailyActivity: protectedProcedure.use(serverOnlyMiddleware).query(async ({ ctx }) => {
		const regional = ctx.user.accountConfig.regional;
		const timeZone = normalizeTimeZone(regional.timeZone);
		const [start, end] = getTimeRange("past365", timeZone, undefined, regional.startOfWeek);

		if (!start || !end) {
			throw new Error("Unable to determine the contribution calendar range");
		}

		const activeDay = sql<string>`(${eventLogs.eventTime} at time zone ${timeZone})::date`;
		const rows = await ctx.db
			.select({
				day: activeDay,
				numOfMin: sql<number>`count(distinct date_trunc('minute', ${eventLogs.eventTime}))`.mapWith(Number),
			})
			.from(eventLogs)
			.where(and(eq(eventLogs.userId, ctx.user.id), gte(eventLogs.eventTime, start), lt(eventLogs.eventTime, end)))
			// Refer to the projected date by ordinal so PostgreSQL does not receive
			// separate timezone parameters for SELECT, GROUP BY, and ORDER BY.
			.groupBy(sql`1`)
			.orderBy(sql`1`);

		const minutesByDay = new Map(rows.map(({ day, numOfMin }) => [day, numOfMin]));
		const weekStartsOn = regional.startOfWeek === "monday" ? 1 : 0;
		const firstDay = TZDate.tz(timeZone, start);
		const calendarStart = startOfWeek(firstDay, { weekStartsOn });

		return Array.from({ length: 365 }, (_, index) => {
			// Advance from the account-local start date so DST transitions preserve
			// one entry per local calendar day.
			const day = addDays(firstDay, index);
			const date = format(day, "yyyy-MM-dd");
			const numOfMin = minutesByDay.get(date) ?? 0;
			const codeTime = toTimeString(numOfMin);
			const displayDate = format(day, "EEEE, MMMM d, yyyy");
			const month = format(day, "MMM");

			return {
				date,
				numOfMin,
				week: differenceInCalendarWeeks(day, calendarStart, { weekStartsOn }),
				weekday: (getDay(day) - weekStartsOn + 7) % 7,
				codeTime,
				displayDate,
				month,
				label: `${codeTime} on ${displayDate}`,
			};
		});
	}),

	getTop: protectedProcedure
		.use(serverOnlyMiddleware)
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

	getDistribution: protectedProcedure
		.use(serverOnlyMiddleware)
		.input(z.object({ workspace: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			const regional = ctx.user.accountConfig.regional;
			const timeZone = normalizeTimeZone(regional.timeZone);
			const [start, end] = getTimeRange("past7", timeZone, undefined, regional.startOfWeek);

			if (!start || !end) {
				throw new Error("Unable to determine the distribution range");
			}

			const localEventTime = sql`(${eventLogs.eventTime} at time zone ${timeZone})`;
			const day = sql<string>`(${localEventTime})::date`;
			const minuteOfDay = sql<number>`
			(
				extract(hour from ${localEventTime})::int * 60
				+ extract(minute from ${localEventTime})::int
			)
		`.mapWith(Number);

			const rows = await ctx.db
				.select({
					day,
					minuteOfDay,
					count: sql<number>`count(distinct date_trunc('minute', ${eventLogs.eventTime}))`.mapWith(Number),
				})
				.from(eventLogs)
				.where(
					and(
						eq(eventLogs.userId, ctx.user.id),
						gte(eventLogs.eventTime, start),
						lt(eventLogs.eventTime, end),
						input.workspace ? eq(eventLogs.project, input.workspace) : undefined,
					),
				)

				.groupBy(sql`1`, sql`2`)
				.orderBy(sql`1`, sql`2`);

			const counts = new Map(rows.map(({ day, minuteOfDay, count }) => [`${day}:${minuteOfDay}`, count]));

			const firstDay = TZDate.tz(timeZone, start);
			const smoothingWindow = 20;
			const toDensity = (minutes: readonly number[]) =>
				minutes.map((_, index) => {
					const windowStart = Math.max(0, index - smoothingWindow);
					const windowEnd = Math.min(minutes.length, index + smoothingWindow + 1);
					const total = minutes.slice(windowStart, windowEnd).reduce((sum, count) => sum + count, 0);

					return { minuteOfDay: index, density: total / (windowEnd - windowStart) };
				});
			const series = Array.from({ length: 7 }, (_, dayIndex) => {
				const date = format(addDays(firstDay, dayIndex), "yyyy-MM-dd");
				const minutes = Array.from({ length: 24 * 60 }, (_, minuteOfDay) => counts.get(`${date}:${minuteOfDay}`) ?? 0);

				return { date, minutes };
			});
			const historicalDays = series.map(({ date, minutes }) => ({
				date,
				points: toDensity(minutes),
			}));
			const average = Array.from({ length: 24 * 60 }, (_, minuteOfDay) => {
				const meanSquare =
					historicalDays.reduce((sum, day) => sum + day.points[minuteOfDay]!.density ** 3, 0) / historicalDays.length;

				return { minuteOfDay, density: Math.sqrt(meanSquare) };
			});
			const now = TZDate.tz(timeZone);

			return {
				hasActivity: rows.length > 0,
				timeZone,
				historicalDates: historicalDays.map(({ date }) => date),
				historical: historicalDays.flatMap(({ date, points }) => points.map((point) => ({ ...point, date }))),
				average,
				currentTime: {
					minuteOfDay: now.getHours() * 60 + now.getMinutes(),
					label: format(now, "HH:mm"),
				},
			};
		}),

	getTrend: protectedProcedure
		.use(serverOnlyMiddleware)
		.input(
			z.object({
				timeRange: timeRangeSchema,
				biggestUnit: biggestUnitSchema,
			}),
		)
		.query(async ({ ctx, input }) => {
			const regional = ctx.user.accountConfig.regional;
			const timeZone = normalizeTimeZone(regional.timeZone);
			const [minimumStart, defaultEnd] = getTimeRange("past7", timeZone, undefined, regional.startOfWeek);
			let [start, end] = getTimeRange(input.timeRange, timeZone, undefined, regional.startOfWeek);

			if (!minimumStart || !defaultEnd) {
				throw new Error("Unable to determine the minimum trend range");
			}

			if (!end || end > defaultEnd) {
				end = defaultEnd;
			}

			if (!start) {
				const firstEvent = await ctx.db
					.select({ eventTime: eventLogs.eventTime })
					.from(eventLogs)
					.where(eq(eventLogs.userId, ctx.user.id))
					.orderBy(eventLogs.eventTime)
					.limit(1);
				start = firstEvent[0]?.eventTime
					? new Date(startOfDay(TZDate.tz(timeZone, firstEvent[0].eventTime)).getTime())
					: minimumStart;
			}

			const rangeDays = differenceInCalendarDays(TZDate.tz(timeZone, end), TZDate.tz(timeZone, start));
			if (rangeDays < 7) {
				start = minimumStart;
				end = defaultEnd;
			}

			const activeDay = sql<string>`(${eventLogs.eventTime} at time zone ${timeZone})::date`;
			const rows = await ctx.db
				.select({
					day: activeDay,
					minutes: sql<number>`count(distinct date_trunc('minute', ${eventLogs.eventTime}))`.mapWith(Number),
				})
				.from(eventLogs)
				.where(and(eq(eventLogs.userId, ctx.user.id), gte(eventLogs.eventTime, start), lt(eventLogs.eventTime, end)))
				.groupBy(sql`1`)
				.orderBy(sql`1`);

			const minutesByDay = new Map(rows.map(({ day, minutes }) => [day, minutes]));
			const dayCount = differenceInCalendarDays(TZDate.tz(timeZone, end), TZDate.tz(timeZone, start));
			const dailyTrend = Array.from({ length: dayCount }, (_, index) => {
				const day = addDays(TZDate.tz(timeZone, start), index);
				return { day, minutes: minutesByDay.get(format(day, "yyyy-MM-dd")) ?? 0 };
			});

			const groupSize = dayCount > 90 ? 2 : 1;
			return Array.from({ length: Math.ceil(dailyTrend.length / groupSize) }, (_, index) => {
				const days = dailyTrend.slice(index * groupSize, (index + 1) * groupSize);
				const minutes = days.reduce((total, day) => total + day.minutes, 0) / days.length;

				const roundedMinutes = Math.round(minutes);
				const hours = Number((roundedMinutes / 60).toFixed(2));

				return {
					date: format(days[0]!.day, "yyyy-MM-dd"),
					label: format(days[0]!.day, "dd.MM"),
					hours: hours,
					time: toTimeString(roundedMinutes, input.biggestUnit),
				};
			});
		}),
});
