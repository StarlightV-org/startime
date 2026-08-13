/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
const config = {
	tailwindStylesheet: "./src/styles/globals.css",
	plugins: ["prettier-plugin-tailwindcss"],
	tabWidth: 1,
	useTabs: true,
	arrowParens: "always",
	printWidth: 120,
	endOfLine: "auto",
	bracketSpacing: true,
};

export default config;
