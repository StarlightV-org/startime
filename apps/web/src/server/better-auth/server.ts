import type { SessionType } from "better-auth";
import { auth } from ".";
import { headers } from "next/headers";

import { db } from "@startime/db";

export async function getAuth(): Promise<SessionType> {
	const data = await auth.api.getSession({
		headers: await headers(),
	});

	if (!data) {
		return { session: null, user: null } as unknown as SessionType;
	}

	const [org, invitation] = await Promise.allSettled([getUserOrg(data.user), getInvitation(data.user)]);

	return {
		...data,
		org: org.status === "fulfilled" ? org.value : undefined,
		invitations: invitation.status === "fulfilled" ? invitation.value : undefined,
	};
}

declare module "better-auth" {
	export type SessionType = typeof auth.$Infer.Session & {
		org: Awaited<ReturnType<typeof getUserOrg>> | undefined;
		invitations: Awaited<ReturnType<typeof getInvitation>> | undefined;
	};
}

export async function getUserOrg(user: SessionType["user"]) {
	const data = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.id, user.id),
		columns: {},
		with: {
			organization: {
				with: {
					invitations: true,
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
	return data?.organization;
}

export async function getInvitation(user: SessionType["user"]) {
	const data = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.id, user.id),
		columns: {},
		with: {
			invitations: {
				with: {
					user: {
						columns: {
							email: false,
						},
					},
					organization: true,
				},
			},
		},
	});
	return data?.invitations;
}
