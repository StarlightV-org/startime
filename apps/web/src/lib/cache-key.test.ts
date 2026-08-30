import { describe, expect, test } from "bun:test";
import { cacheKey } from "./cache-key";

const cacheKeyInput = {
	orgId: "KEAP0119",
	timeRange: "past1",
	biggestUnit: "hour",
	filter: { editor: "", workspace: "", language: "", platform: "", user: "" },
};

const reorderedInput = {
	orgId: "KEAP0119",
	timeRange: "past1",
	biggestUnit: "hour",
	filter: { editor: "", language: "", platform: "", user: "", workspace: "" },
};

describe("cacheKey", () => {
	test("returns the same hash regardless of key order", () => {
		expect(cacheKey(reorderedInput)).toBe(cacheKey(cacheKeyInput));
	});

	test("returns a different hash when a value changes", () => {
		const changedInput = {
			...cacheKeyInput,
			filter: { ...cacheKeyInput.filter, editor: "Visual Studio Code" },
		};

		expect(cacheKey(changedInput)).not.toBe(cacheKey(cacheKeyInput));
	});
});
