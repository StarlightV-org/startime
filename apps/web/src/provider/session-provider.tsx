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
