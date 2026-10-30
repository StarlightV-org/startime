import { describe, expect, mock, test } from "bun:test";

// Bun does not run the Lingui compiler used by time-range's display labels.
mock.module("@lingui/core/macro", () => ({
	msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

const { badgeOptionsSchema, badgeQuerySchema, defaultBadgeOptions } = await import("./badge-options");

describe("calendar badge options", () => {
	for (const startOfWeek of ["monday", "sunday"] as const) {
		test(`preserves ${startOfWeek} in share key options`, () => {
			const options = defaultBadgeOptions(startOfWeek);
			expect(badgeOptionsSchema.parse(JSON.parse(JSON.stringify(options))).startOfWeek).toBe(startOfWeek);
		});

		test(`accepts ${startOfWeek} in preview parameters`, () => {
			expect(badgeQuerySchema.parse({ internal: "true", startOfWeek }).startOfWeek).toBe(startOfWeek);
		});
	}

	test("allows older options and queries without a start of week", () => {
		expect(badgeOptionsSchema.parse({ timeRange: "past90", inMinutes: false }).startOfWeek).toBeUndefined();
		expect(badgeQuerySchema.parse({ internal: "true" }).startOfWeek).toBeUndefined();
	});

	test("rejects unsupported days", () => {
		expect(badgeOptionsSchema.safeParse({ ...defaultBadgeOptions(), startOfWeek: "friday" }).success).toBe(false);
		expect(badgeQuerySchema.safeParse({ internal: "true", startOfWeek: "friday" }).success).toBe(false);
	});
});
