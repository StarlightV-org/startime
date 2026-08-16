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
export function rankByActiveMinutes(values: TimedValue[]): RankedItem[] {
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
		.slice(0, 5);
}
