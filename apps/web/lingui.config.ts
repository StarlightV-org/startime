import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

export default defineConfig({
	sourceLocale: "en",
	locales: ["en", "de"],
	fallbackLocales: { default: "en" },

	format: formatter({ lineNumbers: true }),
	orderBy: "origin",
	catalogs: [
		{
			include: ["<rootDir>/src"],
			exclude: ["**/*.test.ts", "**/*.test.tsx"],
			path: "<rootDir>/src/locales/{locale}/messages",
		},
	],
});
