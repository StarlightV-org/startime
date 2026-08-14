import type { SessionType } from "better-auth";
import { auth } from ".";
import { headers } from "next/headers";

import { db } from "@startime/db";
import { checkAccountConfig, type AccountConfig } from "~/lib/account-config";

export async function getAuth(): Promise<SessionType> {
	const data = await auth.api.getSession({
		headers: await headers(),
	});

	if (!data) {
		return { session: null, user: null } as unknown as SessionType;
	}

	const [org, invitation, userData] = await Promise.allSettled([
		getUserOrg(data.user.id),
		getInvitation(data.user.email),
		db.query.users.findFirst({ where: (users, { eq }) => eq(users.id, data.user.id) }),
	]);

	const user = userData.status === "fulfilled" ? userData.value : undefined;
	const accountConfig = checkAccountConfig(user?.accountConfig);
	return {
		...data,
		org: org.status === "fulfilled" ? org.value : undefined,
		invitations: invitation.status === "fulfilled" ? invitation.value : [],
		user: {
			...(user ?? {}),
			...data.user,
			role: org.status === "fulfilled" ? (org.value.membership?.role ?? "member") : "member",
			accountConfig,
		},
	};
}

declare module "better-auth" {
	export type SessionType = typeof auth.$Infer.Session & {
		org: Awaited<ReturnType<typeof getUserOrg>> | undefined;
		invitations: Awaited<ReturnType<typeof getInvitation>> | [];
		user: {
			role: "member" | "admin" | "owner";
			accountConfig: AccountConfig;
		};
	};

	export type OrgType = NonNullable<SessionType["org"]>;
}

export async function getUserOrg(userId: string) {
	const data = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.id, userId),
		columns: {},
		with: {
			memberships: true,
			organization: {
				with: {
					invitations: {
						where: (invitations, { eq }) => eq(invitations.status, "pending"),
						with: {
							user: {
								columns: {
									email: false,
								},
							},
						},
					},
					members: {
						with: {
							user: {
								columns: {
									email: false,
								},
							},
						},
					},
				},
			},
		},
	});

	return {
		...data?.organization,
		membership: data?.memberships ? data?.memberships[0] : undefined,
		members: data?.organization?.members ?? [],
	};
}

export async function getInvitation(userEmail: string) {
	const data = await db.query.invitations.findMany({
		where: (invitations, { eq, and }) => and(eq(invitations.email, userEmail), eq(invitations.status, "pending")),
		with: {
			user: {
				columns: {
					email: false,
				},
			},
			organization: true,
		},
	});
	return data;
}
