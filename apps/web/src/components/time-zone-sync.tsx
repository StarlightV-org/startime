"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "~/provider/session-provider";
import { api } from "~/trpc/react";

/** Keeps the persisted time zone and first weekday aligned with the signed-in browser. */
export function TimeZoneSync() {
	const { user, session } = useSession();
	const pathname = usePathname();
	const router = useRouter();
	const synchronizedUserId = useRef<string | null>(null);
	const { mutate } = api.self.syncSettings.useMutation({
		onSuccess: () =>
			window.setTimeout(() => {
				if (pathname === "/dash/settings") router.refresh();
			}, 1000),
	});

	useEffect(() => {
		if (!session?.id || !user?.id || synchronizedUserId.current === user.id) {
			return;
		}

		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (!timeZone) return;

		synchronizedUserId.current = user.id;
		if (user.accountConfig.regional.timeZone !== timeZone) {
			mutate({ timeZone });
		}
	}, [mutate, session?.id, user?.accountConfig.regional.timeZone, user?.id]);

	return null;
}
