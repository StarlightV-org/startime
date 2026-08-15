import { AccountSettings, DataSettings, OrgSettings } from "~/components/settings";
import AuthSettings from "~/components/settings/auth-settings";
import { tryCatch } from "~/lib/utils";
import { api } from "~/trpc/server";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ passkey?: string }> }) {
	const [{ data: imports }, { data: exports }, { data: passkeys = [] }, { passkey }] = await Promise.all([
		tryCatch(api.self.listImports()),
		tryCatch(api.self.listExports()),
		tryCatch(api.self.listPasskeys()),
		searchParams,
	]);

	return (
		<div>
			<h1 className="p-4 text-2xl">Settings</h1>
			<div className="flex flex-col gap-4">
				<OrgSettings />
				<AccountSettings />
				<AuthSettings passkeys={passkeys} promptForPasskey={passkey === "required"} />
				<DataSettings imports={imports!} exports={exports!} />
			</div>
		</div>
	);
}
