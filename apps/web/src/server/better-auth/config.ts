import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "@better-auth/passkey";

import { ENV } from "@startime/env";
import { db, users, sessions } from "@startime/db";
import * as schema from "@startime/db/schema";
import { organization } from "better-auth/plugins";
import { generateShortId } from "~/lib/utils";
import { eq } from "drizzle-orm";
import { createAuthMiddleware } from "better-auth/api";

const allowedEmails = ENV.ALLOWED_EMAILS?.split(",");

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg", // or "pg" or "mysql"
		usePlural: true,
		schema: schema,
	}),
	emailAndPassword: {
		enabled: false,
	},
	appName: "Startime",
	socialProviders: {
		github: {
			clientId: ENV.BETTER_AUTH_GITHUB_CLIENT_ID,
			clientSecret: ENV.BETTER_AUTH_GITHUB_CLIENT_SECRET,
			scope: ["user:email"],
			redirectURI: "https://localhost:3000/api/auth/callback/github",
			prompt: "select_account consent",
			// mapProfileToUser: async (data) => {
			// 	if (ENV.ALLOWED_EMAILS && !allowedEmails?.includes(data.email!)) {
			// 		throw new APIError("FORBIDDEN", {
			// 			cause: "email-not-allowed",
			// 			message: "email-not-allowed",
			// 		});
			// 	}

			// 	return data;
			// },
		},
	},

	databaseHooks: {
		user: {
			create: {
				before: async ({ email }) => {
					if (ENV.ALLOWED_EMAILS && !allowedEmails?.includes(email)) {
						throw new APIError("FORBIDDEN", {
							message: "email-not-allowed-1",
							cause: "email-not-allowed-2",
							code: "email-not-allowed-3",
						});
					}
				},
			},
		},
	},

	// hooks: {
	// 	before: createAuthMiddleware(async (ctx) => {
	// 		const data = ctx.context.returned as any;
	// 		Print.Debug("[data]", data);
	// 		// if (ctx.path === "/passkey/verify-registration") {
	// 		// 	const { user, session } = await getAuth();
	// 		// 	await ctx.context.internalAdapter.updateUser(user?.id, {
	// 		// 		registeredTwoFactor: true,
	// 		// 	});
	// 		// 	await ctx.context.internalAdapter.updateSession(session?.token, {
	// 		// 		twoFactorVerified: true,
	// 		// 		twoFactorMethod: "passkey",
	// 		// 		lastAuthenticatedAt: new Date(),
	// 		// 	});
	// 		// }
	// 		// if (ctx.path === "/passkey/verify-authentication") {
	// 		// 	const token = data.session?.token;
	// 		// 	if (
	// 		// 		["token-not-found", "account-locked", "account-inactive", "discord-api-error", "discord-auth-required"].includes(
	// 		// 			data.session?.token,
	// 		// 		)
	// 		// 	) {
	// 		// 		token && (await db.delete(sessions).where(eq(sessions.token, token)));
	// 		// 		throw new APIError("UNAUTHORIZED", {
	// 		// 			message: data.session?.token,
	// 		// 		});
	// 		// 	}

	// 		// 	await ctx.context.internalAdapter.updateSession(token, {
	// 		// 		twoFactorVerified: true,
	// 		// 		twoFactorMethod: "passkey",
	// 		// 		lastAuthenticatedAt: new Date(),
	// 		// 	});
	// 		// }
	// 		if (ctx.path.startsWith("/callback/:id")) {
	// 			const token = data?.session?.token;
	// 			if (token && ["account-inactive", "account-locked", "discord-api-error", "discord-auth-required"].includes(token)) {
	// 				await db.delete(sessions).where(eq(sessions.token, token));
	// 				return ctx.redirect(`/auth/signin?error=${token}`);
	// 			}
	// 		}
	// 	}),
	// },

	advanced: {
		database: {
			generateId: ({ size }) => generateShortId(size),
		},
	},
	logger: {
		level: "debug",
		log: Print,
	},
	onAPIError: {
		throw: false,
		onError: (error, ctx) => {
			Print.Error("[ON_API_ERROR]", error, ctx);
		},
	},

	user: {
		additionalFields: {
			organizationId: { type: "string", defaultValue: undefined },
		},
	},

	plugins: [
		passkey({
			advanced: {
				webAuthnChallengeCookie: "startime_webauthn_challenge",
			},
		}),
	],
});

export type Session = typeof auth.$Infer.Session;
