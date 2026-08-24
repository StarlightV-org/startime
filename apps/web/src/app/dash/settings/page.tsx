import { headers } from "next/headers";
import { AccountSettings, DataSettings, OrgSettings } from "~/components/settings";
import AuthSettings from "~/components/settings/auth-settings";
import { fromHeader, resolveLocale } from "~/i18n/locales";
import { setRequestI18n } from "~/i18n/server";
import { tryCatch } from "~/lib/utils";
import { getAuth } from "~/server/better-auth";
import { api } from "~/trpc/server";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ passkey?: string }> }) {
	const auth = await getAuth();
	const [{ data: imports }, { data: exports }, { data: passkeys = [] }, { data: apiKeys = [] }, { passkey }] =
		await Promise.all([
			tryCatch(api.self.listImports()),
			tryCatch(api.self.listExports()),
			tryCatch(api.self.listPasskeys()),
			tryCatch(api.self.listApiKeys()),
			searchParams,
			await setRequestI18n(resolveLocale(auth.user.accountConfig.regional.lang, fromHeader(await headers()))),
		]);

	return (
		<div>
			<h1 className="p-4 text-2xl">Settings</h1>
			<div className="flex flex-col gap-4">
				<OrgSettings />
				<AccountSettings />
				<AuthSettings passkeys={passkeys} promptForPasskey={passkey === "required"} apiKeys={apiKeys} />
				<DataSettings imports={imports!} exports={exports!} />
				{/*<Card>
					<CardContent>
						<code className="whitespace-pre-wrap">{JSON.stringify(auth, null, 2)}</code>
					</CardContent>
				</Card>*/}
			</div>
		</div>
	);
}


