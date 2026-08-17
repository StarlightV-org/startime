import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "@better-auth/passkey";

import { ENV } from "@startime/env";
import { db } from "@startime/db";
import * as schema from "@startime/db/schema";
import { organization } from "better-auth/plugins";
import { generateShortId } from "~/lib/utils";

import { createAuthMiddleware } from "better-auth/api";
import { op } from "~/lib/op";

const allowedEmails = ENV.ALLOWED_EMAILS?.split(",");

export const auth = betterAuth({
	baseURL: ENV.BETTER_AUTH_URL,
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
			// redirectURI: "https://localhost:3000/api/auth/callback/github",
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
							message: "email-not-allowed",
						});
					}
				},
			},
		},
		session: {
			create: {
				after: async ({ userId }) => {
					const user = await db.query.users.findFirst({
						where: (users, { eq }) => eq(users.id, userId),
						with: {
							organization: true,
						},
					});

					if (!user) return;

					op.identify({
						profileId: user.id,
						avatar: user.image ?? undefined,
						firstName: user.name,
					});
					op.track("session-created", { profileId: user.id });

					if (user.organizationId) {
						op.upsertGroup({
							id: user.organizationId,
							type: "organization",
							name: user.organization!.name,
						});
						op.setGroup(user.organizationId);
					}
				},
			},
		},
	},

	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== "/passkey/verify-authentication") return;

			const newSession = ctx.context.newSession;
			if (newSession?.session.token) {
				await ctx.context.internalAdapter.updateSession(newSession.session.token, {
					lastAuthenticatedAt: new Date(),
				});
			}
		}),
	},

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

	session: {
		additionalFields: {
			lastAuthenticatedAt: { type: "date", defaultValue: undefined },
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
