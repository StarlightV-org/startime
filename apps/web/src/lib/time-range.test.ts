import { describe, expect, test } from "bun:test";
import { getTimeRange } from "./time-range";

describe("getTimeRange", () => {
	test("uses a rolling 24-hour window for past one day", () => {
		const [start, end] = getTimeRange("past1", "Europe/Berlin", new Date("2026-03-29T12:00:00.000Z"));

		expect(start?.toISOString()).toBe("2026-03-28T12:00:00.000Z");
		expect(end?.toISOString()).toBe("2026-03-29T12:00:00.000Z");
		expect(end!.getTime() - start!.getTime()).toBe(24 * 60 * 60 * 1000);
	});

	test("uses the 23-hour Berlin day at the start of daylight saving time", () => {
		const [start, end] = getTimeRange("thisDay", "Europe/Berlin", new Date("2026-03-29T12:00:00.000Z"));

		expect(start?.toISOString()).toBe("2026-03-28T23:00:00.000Z");
		expect(end?.toISOString()).toBe("2026-03-29T22:00:00.000Z");
		expect(end!.getTime() - start!.getTime()).toBe(23 * 60 * 60 * 1000);
	});

	test("uses the 25-hour Berlin day at the end of daylight saving time", () => {
		const [start, end] = getTimeRange("thisDay", "Europe/Berlin", new Date("2026-10-25T12:00:00.000Z"));

		expect(start?.toISOString()).toBe("2026-10-24T22:00:00.000Z");
		expect(end?.toISOString()).toBe("2026-10-25T23:00:00.000Z");
		expect(end!.getTime() - start!.getTime()).toBe(25 * 60 * 60 * 1000);
	});

	test("uses local calendar days rather than rolling 24-hour windows", () => {
		const [start, end] = getTimeRange("past7", "Europe/Berlin", new Date("2026-03-29T12:00:00.000Z"));

		expect(start?.toISOString()).toBe("2026-03-22T23:00:00.000Z");
		expect(end?.toISOString()).toBe("2026-03-29T22:00:00.000Z");
	});

	test("starts this week on Monday when the user preference is Monday", () => {
		const [start, end] = getTimeRange("thisWeek", "Europe/Berlin", new Date("2026-03-25T12:00:00.000Z"), "monday");

		expect(start?.toISOString()).toBe("2026-03-22T23:00:00.000Z");
		expect(end?.toISOString()).toBe("2026-03-29T22:00:00.000Z");
	});
});
