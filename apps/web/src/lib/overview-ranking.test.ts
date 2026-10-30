import { describe, expect, test } from "bun:test";
import { rankByActiveMinutes, rankBadgeLanguages } from "./overview-ranking";

describe("rankByActiveMinutes", () => {
	test("counts multiple logs in the same minute once", () => {
		const events = Array.from({ length: 18 }, (_, index) => ({
			value: "Obsidian",
			eventTime: new Date(`2026-01-01T12:0${Math.floor(index / 5)}:${String(index % 5).padStart(2, "0")}.000Z`),
		}));

		const [top] = rankByActiveMinutes(events);

		expect(top).toEqual({ value: "Obsidian", minutes: 4, percentage: 100 });
	});

	test("bases percentages on active minutes rather than log count", () => {
		const ranked = rankByActiveMinutes([
			{ value: "A", eventTime: new Date("2026-01-01T12:00:00.000Z") },
			{ value: "A", eventTime: new Date("2026-01-01T12:00:30.000Z") },
			{ value: "B", eventTime: new Date("2026-01-01T12:01:00.000Z") },
		]);

		expect(ranked).toEqual([
			{ value: "A", minutes: 1, percentage: 50 },
			{ value: "B", minutes: 1, percentage: 50 },
		]);
	});
});

describe("language badge proportions", () => {
	test("overlapping minutes have consistent slices while dashboard coverage stays unchanged", () => {
		const values = ["A", "B"].flatMap((value) =>
			[0, 1].map((minute) => ({ value, eventTime: new Date(Date.UTC(2026, 0, 1, 12, minute)) })),
		);
		expect(rankByActiveMinutes(values).map((item) => item.percentage)).toEqual([100, 100]);
		expect(rankBadgeLanguages(values)).toEqual([
			{ value: "A", minutes: 2, percentage: 50 },
			{ value: "B", minutes: 2, percentage: 50 },
		]);
	});
	test("Other preserves all language-minutes beyond the displayed top four", () => {
		const values = ["A", "B", "C", "D", "E", "F"].map((value) => ({ value, eventTime: new Date(0) }));
		const ranked = rankBadgeLanguages(values);
		expect(ranked).toHaveLength(5);
		expect(ranked[4]).toMatchObject({ value: "Other", minutes: 2 });
		expect(ranked.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100);
	});
	test("empty input is empty", () => expect(rankBadgeLanguages([])).toEqual([]));
});
