import type { SessionType } from "better-auth";
import { auth } from ".";
import { headers } from "next/headers";

export async function getAuth(): Promise<SessionType> {
	const data = await auth.api.getSession({
		headers: await headers(),
	});

	if (!data) {
		return { session: null, user: null } as unknown as SessionType;
	}

	return {
		...data,
	};
}

declare module "better-auth" {
	export type SessionType = typeof auth.$Infer.Session;
}
