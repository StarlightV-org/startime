"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLingui } from "@lingui/react/macro";

import { AutoConfigSettings } from "./auto-config-settings";
import {
	getAccountConfig,
	setAccountConfigValueSchema,
	setNestedValue,
	type AccountConfig,
	type AccountConfigPath,
} from "~/lib/account-config";
import { useSession } from "~/provider/session-provider";
import { api } from "~/trpc/react";

export default function AccountSettings() {
	const { t } = useLingui();
	const { user } = useSession();
	const router = useRouter();
	const [config, setConfig] = useState<AccountConfig>(() => getAccountConfig(user.accountConfig));
	const { mutate } = api.self.setConfigValue.useMutation({
		onSuccess: () => {
			router.refresh();
			toast.success(t`Settings saved`, { id: "account-settings" });
		},
		onError: (error) => {
			toast.error(t`Unable to save settings`, { id: "account-settings", description: error.message });
		},
	});

	const setLocalValue = (path: AccountConfigPath, value: unknown) => {
		setConfig((current) => setNestedValue(current, path, value as never));
	};

	const saveValue = (path: AccountConfigPath, value: unknown) => {
		// if (path === "regional.lang" && (value === "en" || value === "de")) {
		// 	document.cookie = `startime_locale=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
		// }
		setLocalValue(path, value);
		const input = setAccountConfigValueSchema.safeParse({ path, value });
		if (!input.success) {
			toast.error(t`Unable to save settings`, {
				id: "account-settings",
				description: t`This setting is not supported by the server yet.`,
			});
			return;
		}
		mutate(input.data);
	};

	return <AutoConfigSettings config={config} onValueChange={setLocalValue} onValueCommit={saveValue} />;
}




