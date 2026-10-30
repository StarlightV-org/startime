export type TimedValue = {
	value: string;
	eventTime: Date;
};

export type RankedItem = {
	value: string;
	minutes: number;
	percentage: number;
};

/**
 * Groups event logs by value and counts each active minute once, matching the
 * Activity duration calculation.
 */
export function rankByActiveMinutes(values: TimedValue[], limit = 5): RankedItem[] {
	const minutesByValue = new Map<string, Set<number>>();
	const activeMinutes = new Set<number>();

	for (const { value, eventTime } of values) {
		const minute = Math.floor(eventTime.getTime() / 60_000);
		activeMinutes.add(minute);

		const valueMinutes = minutesByValue.get(value) ?? new Set<number>();
		valueMinutes.add(minute);
		minutesByValue.set(value, valueMinutes);
	}

	return [...minutesByValue.entries()]
		.map(([value, minutes]) => ({
			value,
			minutes: minutes.size,
			percentage: activeMinutes.size === 0 ? 0 : Number(((minutes.size / activeMinutes.size) * 100).toFixed(2)),
		}))
		.sort((a, b) => b.minutes - a.minutes || a.value.localeCompare(b.value))
		.slice(0, limit);
}

/** Badge slices and labels use the same denominator: all language-minutes.
 * Keep the dashboard's active-minute coverage percentages unchanged.
 * Include the remainder as Other so the donut never hides a denominator.
 */
export function rankBadgeLanguages(values: TimedValue[]): RankedItem[] {
	const ranked = rankByActiveMinutes(values, Infinity);
	const total = ranked.reduce((sum, item) => sum + item.minutes, 0);
	const visible = ranked.length > 5 ? ranked.slice(0, 4) : ranked;
	if (ranked.length > 5)
		visible.push({
			value: "Other",
			minutes: ranked.slice(4).reduce((sum, item) => sum + item.minutes, 0),
			percentage: 0,
		});
	return visible.map((item) => ({ ...item, percentage: total ? (item.minutes / total) * 100 : 0 }));
}
