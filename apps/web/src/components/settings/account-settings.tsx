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
import z from "zod";

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
		Print.Debug("value", value, typeof value);
		setLocalValue(path, value);
		const input = setAccountConfigValueSchema.safeParse({ path, value });
		if (!input.success) {
			toast.error(t`Unable to save settings`, {
				id: "account-settings",
				description: t`This setting is not supported by the server yet.`,
			});
			Print.Warning(z.treeifyError(input.error).properties);
			return;
		}
		mutate(input.data);
	};

	return <AutoConfigSettings config={config} onValueChange={setLocalValue} onValueCommit={saveValue} />;
}
