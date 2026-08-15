import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";
import "@startime/print";

export const ENV = createEnv({
	server: {
		DATABASE_URL: z.url(),
		REDIS_URL: z.url(),

		// BETTER AUTH
		BETTER_AUTH_SECRET: z.string(),
		BETTER_AUTH_URL: z.url(),
		BETTER_AUTH_GITHUB_CLIENT_ID: z.string(),
		BETTER_AUTH_GITHUB_CLIENT_SECRET: z.string(),

		// UPLOADTHING
		UPLOADTHING_TOKEN: z.string(),
		UPLOADTHING_APPID: z.string(),

		// INTERNAL SERVICES
		IMPORTER_URL: z.url(),
		IMPORTER_PORT: z.coerce.number().int().positive().default(3001),
		INTERNAL_SERVICE_SECRET: z.string().min(32),

		ALLOWED_EMAILS: z.string().optional(),

		// MISC
		FILE_HASH_KEY: z.string(),
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
		REDIS_URL: process.env.REDIS_URL,

		// BETTER AUTH
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
		BETTER_AUTH_GITHUB_CLIENT_ID: process.env.BETTER_AUTH_GITHUB_CLIENT_ID,
		BETTER_AUTH_GITHUB_CLIENT_SECRET: process.env.BETTER_AUTH_GITHUB_CLIENT_SECRET,

		// UPLOADTHING
		UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
		UPLOADTHING_APPID: process.env.UPLOADTHING_APPID,

		// INTERNAL SERVICES
		IMPORTER_URL: process.env.IMPORTER_URL,
		INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET,

		IMPORTER_PORT: process.env.IMPORTER_PORT,

		// MISC
		FILE_HASH_KEY: process.env.FILE_HASH_KEY,

		ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,

		// SUBSCRIPTIONS
		NEXT_PUBLIC_DISABLE_SUBSCRIPTIONS_IN_DEV: process.env.NEXT_PUBLIC_DISABLE_SUBSCRIPTIONS_IN_DEV === "true",
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
