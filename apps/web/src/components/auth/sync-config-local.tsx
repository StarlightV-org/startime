"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@mantine/hooks";
import { checkAccountConfig } from "~/lib/account-config";
import { useSession } from "~/provider/session-provider";

export function SyncConfigLocal() {
	const { user } = useSession();

	const [_, set] = useLocalStorage({
		key: "account_config",
		defaultValue: checkAccountConfig({}),
	});

	useEffect(() => {
		if (!user) return;
		set(checkAccountConfig(user.accountConfig));
	}, [user]);

	return null;
}
