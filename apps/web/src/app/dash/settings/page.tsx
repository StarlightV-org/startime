import { refresh } from "next/cache";
import { AccountSettings, DataSettings, OrgSettings } from "~/components/settings";
import { tryCatch } from "~/lib/utils";
import { api } from "~/trpc/server";

export default async function SettingsPage() {
	const { data: imports } = await tryCatch(api.self.listImports());

	return (
		<div>
			<h1 className="p-4 text-2xl">Settings</h1>
			<div className="flex flex-col gap-4">
				<AccountSettings />
				<DataSettings imports={imports!} />
				<OrgSettings />
			</div>
		</div>
	);
}
