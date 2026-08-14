import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "@better-auth/passkey";

import { ENV } from "@startime/env";
import { db, users } from "@startime/db";
import * as schema from "@startime/db/schema";
import { organization } from "better-auth/plugins";
import { generateShortId } from "~/lib/utils";
import { eq } from "drizzle-orm";

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
		},
	},

	advanced: {
		database: {
			generateId: ({ size }) => generateShortId(size),
		},
	},

	user: {
		additionalFields: {
			organizationId: { type: "string", defaultValue: undefined },
		},
	},

	plugins: [
		// organization({
		// 	organizationLimit: 1,
		// 	allowUserToCreateOrganization: false,
		// 	cancelPendingInvitationsOnReInvite: true,
		// 	invitationLimit: 5,
		// 	membershipLimit: 10,

		// 	organizationHooks: {
		// 		// afterCreateOrganization: async ({ organization, user }) => {
		// 		// 	Print.Debug("afterCreateOrganization", { organization, user });
		// 		// 	await db.update(users).set({ organizationId: organization.id }).where(eq(users.id, user.id));
		// 		// },
		// 		afterCreateInvitation: async ({ invitation, organization, inviter }) => {
		// 			Print.Debug("afterCreateInvitation", { invitation, organization, inviter });
		// 		},

		// 		afterAcceptInvitation: async ({ user, organization }) => {
		// 			Print.Debug("afterAcceptInvitation", { user, organization });
		// 			await db.update(users).set({ organizationId: organization.id }).where(eq(users.id, user.id));
		// 			await db.delete(schema.invitations).where(eq(schema.invitations.email, user.email));
		// 		},
		// 		afterRemoveMember: async ({ user }) => {
		// 			Print.Debug("afterRemoveMember", { user });
		// 			await db.update(users).set({ organizationId: null }).where(eq(users.id, user.id));
		// 		},
		// 	},
		// }),
		passkey({
			advanced: {
				webAuthnChallengeCookie: "startime_webauthn_challenge",
			},
		}),
	],
});

export type Session = typeof auth.$Infer.Session;
