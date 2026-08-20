/**
 * Run `build` or `dev` with `SKIP_VALIDATION=true` to skip env validation. This is especially useful
 * for Docker builds.
 */
import createMDX from "@next/mdx";
import { linguiMacroSwcPlugin } from "@lingui/swc-plugin/options";
import type { NextConfig } from "next";
import "@startime/env";
import "@startime/print";
import { ENV } from "@startime/env";

const withMDX = createMDX({
	options: {
		remarkPlugins: ["remark-gfm", "remark-github-blockquote-alert"],
	},
});

const config: NextConfig = {
	output: "standalone",
	pageExtensions: ["ts", "tsx", "mdx"],
	reactStrictMode: true,
	reactCompiler: true,
	typescript: {
		ignoreBuildErrors: true,
	},
	experimental: {
		typedEnv: true,
		swcPlugins: [linguiMacroSwcPlugin()],
	},
	skipTrailingSlashRedirect: true,
	devIndicators: {
		position: "top-right",
	},
	logging: {
		incomingRequests: {
			ignore: [/\/api\/trpc\//, /\/api\/push\/subscribe/],
		},
		fetches: {
			hmrRefreshes: false,
			fullUrl: true,
		},
		browserToTerminal: false,
	},
	typedRoutes: true,

	transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],

	env: {
		NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
	},
	rewrites: async () => {
		return [
			{
				source: "/script",
				destination: `https://openpanel.dev/op1.js`,
			},
		];
	},
};

export default withMDX(config);

