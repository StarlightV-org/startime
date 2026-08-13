import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";
import "@starlightv-org/print";

export const ENV = createEnv({
	server: {
		DATABASE_URL: z.url(),

		// BETTER AUTH
		BETTER_AUTH_SECRET: z.string(),
		BETTER_AUTH_URL: z.url(),
		BETTER_AUTH_GITHUB_CLIENT_ID: z.string(),
		BETTER_AUTH_GITHUB_CLIENT_SECRET: z.string(),

		// WSS AND WEB BACKEND token
		JWT_SECRET: z.string(),
	},

	/**
	 * The prefix that client-side variables must have. This is enforced both at
	 * a type-level and at runtime.
	 */
	clientPrefix: "NEXT_PUBLIC_",

	client: {
		NEXT_PUBLIC_BETTER_AUTH_URL: z.string(),
		NEXT_PUBLIC_DISABLE_SUBSCRIPTIONS_IN_DEV: z.boolean(),
	},

	/**
	 * What object holds the environment variables at runtime. This is usually
	 * `process.env` or `import.meta.env`.
	 */
	runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		DATABASE_URL: process.env.DATABASE_URL,

		// BETTER AUTH
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
		BETTER_AUTH_GITHUB_CLIENT_ID: process.env.BETTER_AUTH_GITHUB_CLIENT_ID,
		BETTER_AUTH_GITHUB_CLIENT_SECRET: process.env.BETTER_AUTH_GITHUB_CLIENT_SECRET,

		// SUBSCRIPTIONS
		NEXT_PUBLIC_DISABLE_SUBSCRIPTIONS_IN_DEV: process.env.NEXT_PUBLIC_DISABLE_SUBSCRIPTIONS_IN_DEV === "true",

		JWT_SECRET: process.env.JWT_SECRET,
	},

	emptyStringAsUndefined: true,
	shared: {
		NODE_ENV: z.enum(["development", "production"]),
	},

	skipValidation: process.env.SKIP_VALIDATION === "true",

	onValidationError(issues) {
		Print.Zod(issues as any);
		throw new Error("Validation error");
	},
});
