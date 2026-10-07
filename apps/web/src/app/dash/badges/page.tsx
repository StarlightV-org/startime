import { Trans } from "@lingui/react/macro";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { GithubDark } from "~/components/ui/svgs/githubDark";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { fromHeader, resolveLocale } from "~/i18n/locales";
import { setRequestI18n } from "~/i18n/server";
import { getAuth } from "~/server/better-auth";
import TabSelect from "~/components/badges/tab-select";

import { chartTypes } from "@startime/db";
import { api } from "~/trpc/server";

export default async function BadgesPage() {
	const auth = await getAuth();
	await setRequestI18n(resolveLocale(auth.user.accountConfig.regional.lang, fromHeader(await headers())));

	for (const chartType of chartTypes) {
		await api.badges.listShareKeys.prefetch({ chartType });
	}

	return (
		<div className="flex w-full flex-col gap-4">
			<Card>
				<CardContent>
					<CardHeader>
						<CardTitle>
							<Trans>Badges</Trans>
						</CardTitle>
					</CardHeader>
					<CardDescription>
						<Trans>
							Embed Badges and other Widgets on other websites such as
							<GithubDark className="ml-1 inline-flex size-5 self-center pb-1" />
							GitHub
						</Trans>
					</CardDescription>
				</CardContent>
			</Card>
			<TabSelect />
		</div>
	);
}
