/**
 * Run `build` or `dev` with `SKIP_VALIDATION=true` to skip env validation. This is especially useful
 * for Docker builds.
 */
import type { NextConfig } from "next";
import "@startime/env";
import "@startime/print";

const config: NextConfig = {
	output: "standalone",
	reactStrictMode: true,
	reactCompiler: true,
	typescript: {
		ignoreBuildErrors: true,
	},
	experimental: {
		typedEnv: true,
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
};

export default config;
