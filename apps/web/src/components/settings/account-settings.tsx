"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
	const { user } = useSession();
	const router = useRouter();
	const [config, setConfig] = useState<AccountConfig>(() => getAccountConfig(user.accountConfig));
	const { mutate } = api.self.setConfigValue.useMutation({
		onSuccess: () => {
			router.refresh();
			toast.success("Settings saved", { id: "account-settings" });
		},
		onError: (error) => {
			toast.error("Unable to save settings", { id: "account-settings", description: error.message });
		},
	});

	const setLocalValue = (path: AccountConfigPath, value: unknown) => {
		setConfig((current) => setNestedValue(current, path, value as never));
	};

	const saveValue = (path: AccountConfigPath, value: unknown) => {
		setLocalValue(path, value);
		const input = setAccountConfigValueSchema.safeParse({ path, value });
		if (!input.success) {
			toast.error("Unable to save settings", {
				id: "account-settings",
				description: "This setting is not supported by the server yet.",
			});
			return;
		}
		mutate(input.data);
	};

	return <AutoConfigSettings config={config} onValueChange={setLocalValue} onValueCommit={saveValue} />;
}
