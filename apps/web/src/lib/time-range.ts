import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, addWeeks, addYears, startOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { subHours } from "date-fns/fp";
import { LucideAlignHorizontalJustifyCenter } from "lucide-react";
import type { BiggestUnit } from "~/server/api/routers/overview";

export const timeRangeValues = [
	"past1",
	"past7",
	"past30",
	"past90",
	"past365",
	"thisDay",
	"thisWeek",
	"thisMonth",
	"thisYear",
	"allTime",
] as const;

export type TimeRange = (typeof timeRangeValues)[number];
export type StartOfWeek = "monday" | "sunday" | "manual-monday" | "manual-sunday" | null | undefined;

const fallbackTimeZone = "UTC";

export function isValidTimeZone(timeZone: string): boolean {
	try {
		Intl.DateTimeFormat(undefined, { timeZone });
		return true;
	} catch {
		return false;
	}
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
	if (!timeZone || !isValidTimeZone(timeZone)) return fallbackTimeZone;

	return Intl.DateTimeFormat(undefined, { timeZone }).resolvedOptions().timeZone;
}

function toDate(date: Date): Date {
	return new Date(date.getTime());
}

function getWeekStartsOn(startOfWeek: StartOfWeek): 0 | 1 {
	return startOfWeek === "monday" || startOfWeek === "manual-monday" ? 1 : 0;
}

/**
 * Returns a half-open interval [startInclusive, endExclusive] using the user's
 * local calendar boundaries. `now` exists only to make time-sensitive tests
 * repeatable; production callers should omit it.
 */
export function getTimeRange(
	timeRange: TimeRange,
	timeZone: string | null | undefined = fallbackTimeZone,
	now: Date = new Date(),
	userStartOfWeek: StartOfWeek = "sunday",
): [Date, Date] | [null, null] {
	const zonedNow = TZDate.tz(normalizeTimeZone(timeZone), now);
	const dayStart = startOfDay(zonedNow);
	const nextDayStart = addDays(dayStart, 1);

	switch (timeRange) {
		// Rolling 24-hour window ending now.
		case "past1":
			return [toDate(subHours(24, zonedNow)), toDate(zonedNow)];
		// Last 7 local calendar days, including today.
		case "past7":
			return [toDate(addDays(dayStart, -6)), toDate(nextDayStart)];
		// Last 30 local calendar days, including today.
		case "past30":
			return [toDate(addDays(dayStart, -29)), toDate(nextDayStart)];
		// Last 90 local calendar days, including today.
		case "past90":
			return [toDate(addDays(dayStart, -89)), toDate(nextDayStart)];
		// Last 365 local calendar days, including today.
		case "past365":
			return [toDate(addDays(dayStart, -364)), toDate(nextDayStart)];
		// The current local calendar day.
		case "thisDay":
			return [toDate(dayStart), toDate(nextDayStart)];
		// The current local calendar week, using the user's selected first weekday.
		case "thisWeek": {
			const weekStart = startOfWeek(zonedNow, { weekStartsOn: getWeekStartsOn(userStartOfWeek) });
			return [toDate(weekStart), toDate(addWeeks(weekStart, 1))];
		}
		// The current local calendar month.
		case "thisMonth": {
			const monthStart = startOfMonth(zonedNow);
			return [toDate(monthStart), toDate(addMonths(monthStart, 1))];
		}
		// The current local calendar year.
		case "thisYear": {
			const yearStart = startOfYear(zonedNow);
			return [toDate(yearStart), toDate(addYears(yearStart, 1))];
		}
		// No boundary filters.
		case "allTime":
			return [null, null];
	}
}

export function toTimeString(minutes: number, biggestUnit?: BiggestUnit): string {
	if (biggestUnit === "day") {
		const fullDays = Math.floor(minutes / (60 * 24));
		const remainingHours = Math.floor((minutes - fullDays * (60 * 24)) / 60);
		const remainingMinutes = minutes - fullDays * (60 * 24) - remainingHours * 60;
		return [`${fullDays}d`, `${remainingHours}h`, `${remainingMinutes}m`]
			.filter((value) => value !== "0d" && value !== "0h" && value !== "0m")
			.join(" ");
	}
	if (biggestUnit === "week") {
		const fullWeeks = Math.floor(minutes / (60 * 24 * 7));
		const fullDays = Math.floor((minutes - fullWeeks * (60 * 24 * 7)) / (60 * 24));
		const remainingHours = Math.floor((minutes - fullWeeks * (60 * 24 * 7) - fullDays * (60 * 24)) / 60);
		const remainingMinutes = minutes - fullWeeks * (60 * 24 * 7) - fullDays * (60 * 24) - remainingHours * 60;
		return [`${fullWeeks}w`, `${fullDays}d`, `${remainingHours}h`, `${remainingMinutes}m`]
			.filter((value) => value !== "0w" && value !== "0d" && value !== "0h" && value !== "0m")
			.join(" ");
	}

	const fullHours = Math.floor(minutes / 60);
	const remainingMinutes = minutes - fullHours * 60;
	return [`${fullHours}h`, `${remainingMinutes}m`].filter((value) => value !== "0h" && value !== "0m").join(" ");
}
