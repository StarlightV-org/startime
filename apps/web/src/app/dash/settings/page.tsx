import { AccountSettings, DataSettings, OrgSettings } from "~/components/settings";

export default function SettingsPage() {
	return (
		<div>
			<h1 className="p-4 text-2xl">Settings</h1>
			<div className="flex flex-col gap-4">
				<AccountSettings />
				<DataSettings />
				<OrgSettings />
			</div>
		</div>
	);
}
