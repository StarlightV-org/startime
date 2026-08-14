"use client";
import type { SessionType } from "better-auth";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import "@startime/print";
Print.Setup({ prefix: "TIME" });

const SessionContext = createContext<SessionType>({} as SessionType);

export function useSession() {
	const context = useContext(SessionContext);
	if (!context) {
		throw new Error("useSession must be used within a SessionProvider");
	}
	return context;
}

export function SessionProvider({ children, initialSession }: { children: ReactNode; initialSession: SessionType }) {
	// const { data: sessionActivity } = api.me.sessionActivity.useSubscription(undefined, {
	// 	enabled: !!initialSession?.session?.id && !!initialSession.session.twoFactorVerified,
	// });

	return <SessionContext.Provider value={initialSession}>{children}</SessionContext.Provider>;
}

const roleLevel = {
	member: 0,
	admin: 1,
	owner: 2,
} as const;

type Role = keyof typeof roleLevel;

export function useRole() {
	const { user } = useSession();

	return (role: Role) => {
		if (!user || !(user.role in roleLevel)) return false;

		return roleLevel[user.role as Role] >= roleLevel[role];
	};
}
