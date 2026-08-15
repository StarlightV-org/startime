import { refresh } from "next/cache";
import { AccountSettings, DataSettings, OrgSettings } from "~/components/settings";
import { tryCatch } from "~/lib/utils";
import { api } from "~/trpc/server";

export default async function SettingsPage() {
	const [{ data: imports }, { data: exports }] = await Promise.all([
		tryCatch(api.self.listImports()),
		tryCatch(api.self.listExports()),
	]);

	return (
		<div>
			<h1 className="p-4 text-2xl">Settings</h1>
			<div className="flex flex-col gap-4">
				<OrgSettings />
				<AccountSettings />
				<DataSettings imports={imports!} exports={exports!} />
			</div>
		</div>
	);
}
