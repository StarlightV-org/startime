import { Trans } from "@lingui/react/macro";
import { formatDate } from "date-fns/format";
import { subSeconds } from "date-fns/fp";
import { CodeXmlIcon, ComputerIcon, FolderIcon, InfoIcon, PencilIcon } from "lucide-react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createLoader, parseAsString, type SearchParams } from "nuqs/server";

import EditOrg from "~/components/org/edit-org";
import { MemberList, ProjectList } from "~/components/org/org-components";
import { BiggestUnitSelect, Filter, TimeSelect, TopElement } from "~/components/overview";
import { RefetchOverviewButton } from "~/components/overview/client-overview";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { fromHeader, resolveLocale } from "~/i18n/locales";
import { setRequestI18n } from "~/i18n/server";
import { cacheKey } from "~/lib/cache-key";
import { getTimeRange, timeRangeValues, type TimeRange } from "~/lib/time-range";
import { tryCatch } from "~/lib/utils";
import type { BiggestUnit } from "~/server/api/routers/overview";
import { getAuth } from "~/server/better-auth";
import { withRedisCache } from "~/server/redis/cache";
import { api } from "~/trpc/server";

// Describe your search params, and reuse this in useQueryStates / createSerializer:
export const filter = {
	editor: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	workspace: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	language: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	platform: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	user: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
};
export const loadSearchParams = createLoader(filter);

const biggestUnitValues = ["hour", "day", "week"] as const satisfies readonly BiggestUnit[];

function parseTimeRange(value: string | undefined): TimeRange {
	return timeRangeValues.find((candidate) => candidate === value) ?? "past30";
}

function parseBiggestUnit(value: string | undefined): BiggestUnit {
	return biggestUnitValues.find((candidate) => candidate === value) ?? "hour";
}

export default async function OrgPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const { org, user: authUser } = await getAuth();
	if (!org?.id) redirect("/dash");
	const cookieManager = await cookies();
	await setRequestI18n(resolveLocale(authUser.accountConfig.regional.lang, fromHeader(await headers())));
	const { editor, workspace, language, platform, user } = await loadSearchParams(searchParams);

	const timeRange = parseTimeRange(cookieManager.get("startime_timeRange_org")?.value);
	const biggestUnit = parseBiggestUnit(cookieManager.get("startime_biggestUnit_org")?.value);
	const regional = authUser.accountConfig.regional;
	const [start, end] = getTimeRange(timeRange, regional.timeZone, undefined, regional.startOfWeek);

	const { data: projects, error: projectsError } = await tryCatch(api.org.projects.list());

	const topInput = {
		orgId: org.id,
		timeRange,
		biggestUnit,
		filter: {
			editor,
			workspace,
			language,
			platform,
			user,
		},
	};

	const cacheKeyString = `org:top:${org.id}:${cacheKey(topInput)}`;

	const [{ data: activity, error: activityError }, { data: top, error: topError }] = await Promise.all([
		tryCatch(
			withRedisCache(`org:activity:${org.id}:${cacheKey({ timeRange, biggestUnit })}`, 60, () =>
				api.org.getActivity({ timeRange, biggestUnit }),
			),
		),
		tryCatch(withRedisCache(cacheKeyString, 120, () => api.org.getTop(topInput))),
	]);

	projectsError && Print.Error("[ORG] Failed to load projects", projectsError);
	activityError && Print.Error("[ORG] Failed to load activity", activityError);
	topError && Print.Error("[ORG] Failed to load overview", topError);

	return (
		<div className="flex flex-col gap-5">
			<Card className="w-full">
				<CardContent className="flex items-center justify-between gap-5">
					<div className="flex items-center gap-5 align-baseline">
						<Avatar size="lg">
							<AvatarImage src={org?.logo!} alt={org?.name} />
							<AvatarFallback>
								<span>{org?.name?.slice(0, 2).toUpperCase()}</span>
							</AvatarFallback>
						</Avatar>
						<h1 className="text-2xl">{org?.name}</h1>
					</div>
					{(org.membership?.role === "admin" || org.membership?.role === "owner") && <EditOrg org={org} />}
				</CardContent>
			</Card>
			<Card>
				<CardContent>
					<CardHeader>
						<CardTitle className="flex items-center justify-between gap-2">
							<Trans>Time Range</Trans>
						</CardTitle>
					</CardHeader>
					<CardDescription className="flex flex-col justify-between">
						<div className="flex flex-row items-center gap-2">
							<TimeSelect timeRange={timeRange} cookieSuffix="org" />
							<BiggestUnitSelect biggestUnit={biggestUnit} cookieSuffix="org" />
							<Filter />
							{start && end && (
								<p className="text-xs text-muted-foreground">
									{formatDate(start, "yyyy-MM-dd")} - {formatDate(subSeconds(1, end), "yyyy-MM-dd")}
								</p>
							)}
						</div>
					</CardDescription>
				</CardContent>
			</Card>
			<Card>
				<CardContent>
					<CardHeader>
						<CardTitle>
							<Trans>Activity</Trans>
						</CardTitle>
					</CardHeader>
					<CardDescription className="grid grid-cols-2 divide-x divide-border">
						<div className="flex flex-col pr-4">
							<h3 className="text-sm text-sidebar-primary">
								<Trans>Time/Total</Trans>
							</h3>
							<p className="text-xl text-primary-foreground">{activityError ? "-" : (activity?.timeTotal ?? "-")}</p>
						</div>
						<div className="flex flex-col pl-4">
							<h3 className="text-sm text-sidebar-primary">
								<Trans>Time/Today</Trans>
							</h3>
							<p className="text-xl text-primary-foreground">{activityError ? "-" : (activity?.timeToday ?? "-")}</p>
						</div>
					</CardDescription>
				</CardContent>
			</Card>
			<Card>
				<CardContent>
					<CardHeader className="flex items-center justify-between">
						<CardTitle>
							<Trans>Top</Trans>
						</CardTitle>
						<div className="flex items-center">
							<RefetchOverviewButton />
							<Dialog>
								<DialogTrigger
									render={
										<Button variant="ghost" size="icon-sm">
											<InfoIcon className="size-4 cursor-pointer" />
										</Button>
									}
								/>
								<DialogContent>
									<Trans>
										<DialogTitle>What is shown</DialogTitle>
										<span className="text-sm text-pretty text-muted-foreground">
											In this section, only projects and time are shown, that users have assigned.
										</span>
									</Trans>
								</DialogContent>
							</Dialog>
						</div>
					</CardHeader>
					<CardDescription className="grid grid-cols-4 gap-x-2 divide-x divide-border">
						{topError && (
							<p className="col-span-4 text-sm text-destructive">
								<Trans>Unable to load organization statistics.</Trans>
							</p>
						)}
						<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
							<div className="flex items-center gap-2">
								<PencilIcon className="size-4" />
								<h3 className="y text-sm">
									<Trans>Editor</Trans>
								</h3>
							</div>
							{top &&
								Object.entries(top.editor)
									.filter(([, item]) => item.value !== "")
									.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} />)}
						</div>
						<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
							<div className="flex items-center gap-2">
								<FolderIcon className="size-4" />
								<h3 className="y text-sm">
									<Trans>Workspace</Trans>
								</h3>
							</div>
							{top &&
								Object.entries(top.workspace)
									.filter(([, item]) => item.value !== "")
									.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="workspace" />)}
						</div>
						<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
							<div className="flex items-center gap-2">
								<CodeXmlIcon className="size-4" />
								<h3 className="y text-sm">
									<Trans>Language</Trans>
								</h3>
							</div>
							{top &&
								Object.entries(top.language)
									.filter(([, item]) => item.value !== "")
									.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="language" />)}
						</div>
						<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
							<div className="flex items-center gap-2">
								<ComputerIcon className="size-4" />
								<h3 className="y text-sm">
									<Trans>Platform</Trans>
								</h3>
							</div>
							{top &&
								Object.entries(top.platform)
									.filter(([, item]) => item.value !== "")
									.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="platform" />)}
						</div>
					</CardDescription>
				</CardContent>
			</Card>
			<div className="grid grid-cols-1 gap-4 divide-accent xl:grid-cols-2">
				<Card>
					<CardDescription>
						<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
							<div className="flex items-center gap-2">
								<ComputerIcon className="size-4" />
								<h3 className="y text-sm">
									<Trans>User</Trans>
								</h3>
							</div>
							{top &&
								Object.entries(top.user)
									.filter(([, item]) => item.value !== "")
									.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="user" />)}
						</div>
					</CardDescription>
				</Card>
				{projectsError ? (
					<Card>
						<CardContent className="text-sm text-destructive">
							<Trans>Unable to load organization projects.</Trans>
						</CardContent>
					</Card>
				) : (
					<ProjectList org={org} projects={projects ?? []} />
				)}
			</div>
			<MemberList org={org} />
		</div>
	);
}
