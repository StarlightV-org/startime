import { describe, expect, test } from "bun:test";
import { rankByActiveMinutes } from "./overview-ranking";

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
