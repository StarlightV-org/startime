"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "~/provider/session-provider";
import { api } from "~/trpc/react";

/** Keeps the persisted time zone and first weekday aligned with the signed-in browser. */
export function TimeZoneSync() {
	const { user, session } = useSession();
	const router = useRouter();
	const synchronizedUserId = useRef<string | null>(null);
	const { mutate } = api.self.updateSettings.useMutation({
		onSuccess: () => router.refresh(),
	});

	useEffect(() => {
		if (!session?.id || !user?.id || synchronizedUserId.current === user.id) {
			return;
		}

		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
			getWeekInfo?: () => { firstDay: number };
		};
		const startOfWeek = locale.getWeekInfo?.().firstDay === 7 ? "sunday" : "monday";
		const hasManualStartOfWeek = user.startOfWeek?.startsWith("manual-");
		if (!timeZone) return;

		synchronizedUserId.current = user.id;
		if (user.timeZone !== timeZone || (!hasManualStartOfWeek && user.startOfWeek !== startOfWeek)) {
			mutate({ timeZone, startOfWeek });
		}
	}, [mutate, session?.id, user?.id, user?.startOfWeek, user?.timeZone]);

	return null;
}
