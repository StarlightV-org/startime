import { TZDate } from "@date-fns/tz";
import { db, eventLogs } from "@startime/db";
import { addDays, differenceInCalendarWeeks, format, getDay, startOfWeek } from "date-fns";
import { and, eq, gte, lt, sql } from "drizzle-orm";

import type { AccountConfig } from "~/lib/account-config";
import { getTimeRange, normalizeTimeZone, toTimeString } from "~/lib/time-range";

export async function getDailyActivityForUser(userId: string, regional: AccountConfig["regional"]) {
	const timeZone = normalizeTimeZone(regional.timeZone);
	const [start, end] = getTimeRange("past365", timeZone, undefined, regional.startOfWeek);

	if (!start || !end) {
		throw new Error("Unable to determine the contribution calendar range");
	}

	const activeDay = sql<string>`(${eventLogs.eventTime} at time zone ${timeZone})::date`;
	const rows = await db
		.select({
			day: activeDay,
			numOfMin: sql<number>`count(distinct date_trunc('minute', ${eventLogs.eventTime}))`.mapWith(Number),
		})
		.from(eventLogs)
		.where(and(eq(eventLogs.userId, userId), gte(eventLogs.eventTime, start), lt(eventLogs.eventTime, end)))
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
}

export type DailyActivity = Awaited<ReturnType<typeof getDailyActivityForUser>>;
