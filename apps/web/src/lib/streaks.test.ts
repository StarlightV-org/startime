import { describe, expect, test } from "bun:test";
import { getStreaks } from "./streaks";

describe("getStreaks", () => {
	test("preserves yesterday's active streak until the current day ends", () => {
		const activeDays = Array.from({ length: 25 }, (_, index) => {
			const date = new Date("2026-03-25T00:00:00.000Z");
			date.setUTCDate(date.getUTCDate() - index);
			return date.toISOString().slice(0, 10);
		});

		expect(getStreaks(activeDays, "2026-03-26")).toEqual({ currentStreak: 25, allTimeStreak: 25 });
	});

	test("extends the streak when an event is tracked today", () => {
		const activeDays = Array.from({ length: 26 }, (_, index) => {
			const date = new Date("2026-03-26T00:00:00.000Z");
			date.setUTCDate(date.getUTCDate() - index);
			return date.toISOString().slice(0, 10);
		});

		expect(getStreaks(activeDays, "2026-03-26")).toEqual({ currentStreak: 26, allTimeStreak: 26 });
	});

	test("returns zero after a completed inactive day", () => {
		expect(getStreaks(["2026-03-24"], "2026-03-26")).toEqual({ currentStreak: 0, allTimeStreak: 1 });
	});
});
