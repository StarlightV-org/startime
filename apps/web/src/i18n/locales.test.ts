import { describe, expect, test } from "bun:test";
import { defaultLocale, fromHeader } from "./locales";

globalThis.Print = { Debug: () => {} } as typeof Print;

describe("fromHeader", () => {
	test("uses a later supported language range when earlier ranges are unsupported", () => {
		const header = new Headers({
			"Accept-Language": "fr-FR, fr;q=0.9, de;q=0.8",
		});

		expect(fromHeader(header)).toBe("de");
	});

	test("uses the supported range with the highest quality value", () => {
		const header = new Headers({
			"Accept-Language": "de;q=0.5, en-US;q=0.9",
		});

		expect(fromHeader(header)).toBe("en");
	});

	test("ignores rejected language ranges", () => {
		const header = new Headers({
			"Accept-Language": "de;q=0, fr-FR;q=0.8",
		});

		expect(fromHeader(header)).toBe(defaultLocale);
	});
});
