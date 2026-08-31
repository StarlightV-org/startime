const millisecondsPerDay = 86_400_000;

function toDayNumber(day: string): number {
	return Math.floor(new Date(day).getTime() / millisecondsPerDay);
}

export function getStreaks(activeDays: string[], today: string) {
	const days = [...new Set(activeDays.map(toDayNumber))].sort((a, b) => a - b);
	const activeDaySet = new Set(days);

	let currentStreak = 0;
	let currentDay = toDayNumber(today);
	if (!activeDaySet.has(currentDay)) {
		currentDay--;
	}

	for (; activeDaySet.has(currentDay); currentDay--) {
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
