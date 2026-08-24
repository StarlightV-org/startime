import { formatDate } from "date-fns/format";
import { subSeconds } from "date-fns/fp";
import { BracketsIcon, CodeXmlIcon, ComputerIcon, FolderIcon, InfoIcon, PencilIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
	ActivityCalendar,
	BiggestUnitSelect,
	DistributionChart,
	Filter,
	TimeSelect,
	TopElement,
} from "~/components/overview";
import { getTimeRange, type BiggestUnit, type TimeRange } from "~/server/api/routers/overview";
import { cookies, headers } from "next/headers";
import { tryCatch } from "~/lib/utils";
import { getAuth } from "~/server/better-auth";
import { api } from "~/trpc/server";
import { parseAsFloat, createLoader, parseAsString } from "nuqs/server";
import type { SearchParams } from "nuqs/server";
import RefetchOverview, { ActivityIndicator, RefetchOverviewButton } from "../../components/overview/client-overview";
import { Button } from "~/components/ui/button";
import { withRedisCache } from "~/server/redis/cache";
import { Trans } from "@lingui/react/macro";
import { fromHeader, resolveLocale } from "~/i18n/locales";
import { setRequestI18n } from "~/i18n/server";

// Describe your search params, and reuse this in useQueryStates / createSerializer:
export const coordinatesSearchParams = {
	editor: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	workspace: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	language: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	platform: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
};
export const loadSearchParams = createLoader(coordinatesSearchParams);

export default async function DashPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const auth = await getAuth();
	const cookieManager = await cookies();
	await setRequestI18n(resolveLocale(auth.user.accountConfig.regional.lang, fromHeader(await headers())));
	const { editor, workspace, language, platform } = await loadSearchParams(searchParams);

	const timeRange = (cookieManager.get("startime_timeRange")?.value ?? "past30") as TimeRange;
	const biggestUnit = (cookieManager.get("startime_biggestUnit")?.value ?? "hour") as BiggestUnit;

	Print.Debug("timeRange", timeRange);
	const { data: activity, error: activityError } = await tryCatch(api.overview.getActivity({ timeRange, biggestUnit }));
	const { data: dailyActivity, error: dailyActivityError } = await tryCatch(
		withRedisCache(`api:overview:getDailyActivity:${auth.user.id}`, 60 * 5, () => api.overview.getDailyActivity()),
	);

	const { data: distribution, error: distributionError } = await tryCatch(
		api.overview.getDistribution({ workspace: workspace || undefined }),
	);

	// const { data: dailyActivity, error: dailyActivityError } = await tryCatch(api.overview.getDailyActivity());
	const { data: top, error: topError } = await tryCatch(
		api.overview.getTop({ timeRange, filter: { editor, workspace, language, platform }, biggestUnit }),
	);

	if (activityError || dailyActivityError || distributionError || topError) {
		activityError && Print.Error("[OVERVIEW]", "activityError", activityError);
		dailyActivityError && Print.Error("[OVERVIEW]", "dailyActivityError", dailyActivityError);
		distributionError && Print.Error("[OVERVIEW]", "distributionError", distributionError);
		topError && Print.Error("[OVERVIEW]", "topError", topError);
	}

	const regional = auth.user.accountConfig.regional;
	const [start, end] = getTimeRange(timeRange, regional.timeZone, undefined, regional.startOfWeek);

	Print.Debug("[OVERVIEW]", "distribution", distribution?.historicalDates);

	return (
		<div>
			<div className="flex w-full flex-col gap-4 pt-2">
				<Card>
					<CardContent>
						<CardHeader>
							<CardTitle>
								<Trans>Time Range</Trans>
							</CardTitle>
						</CardHeader>
						<CardDescription className="flex flex-col justify-between">
							<div className="flex flex-row items-center gap-2">
								<TimeSelect timeRange={timeRange} />
								<BiggestUnitSelect biggestUnit={biggestUnit} />
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
						<CardHeader className="flex flex-row items-center justify-between gap-2">
							<CardTitle className="h-8">
								<Trans>Activity</Trans>
							</CardTitle>
							<ActivityIndicator lastEvent={activity?.lastEvent} />
						</CardHeader>
						<CardDescription>
							<div className="grid grid-cols-4 divide-x divide-border">
								<div className="col-span-1 flex flex-col pr-4 first:pl-0">
									<h3 className="text-sm text-sidebar-primary">
										<Trans>Time/Total</Trans>
									</h3>
									<p className="text-xl text-primary-foreground">{activity?.timeTotal ?? "�"}</p>
								</div>
								<div className="col-span-1 flex flex-col px-4">
									<h3 className="text-sm text-sidebar-primary">
										<Trans>Time/Today</Trans>
									</h3>
									<p className="text-xl text-primary-foreground">{activity?.timeToday ?? "�"}</p>
								</div>
								<div className="col-span-1 flex flex-col px-4">
									<h3 className="text-sm text-sidebar-primary">
										<Trans>Streak/Current</Trans>
									</h3>
									<p className="text-xl text-primary-foreground">{activity?.currentStreak ?? "�"}</p>
								</div>
								<div className="col-span-1 flex flex-col pl-4">
									<h3 className="text-sm text-sidebar-primary">
										<Trans>Streak/Max</Trans>
									</h3>
									<p className="text-xl text-primary-foreground">{activity?.allTimeStreak ?? "�"}</p>
								</div>
							</div>
							<ActivityCalendar dailyActivity={dailyActivity ?? []} startOfWeek={regional.startOfWeek} />
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
											<DialogTitle>Calculations</DialogTitle>
											<span className="text-sm text-pretty text-muted-foreground">
												Total time counts each active minute once. <br />
												If you switch workspace or language within a minute, that same minute is counted for every matching
												category. <br />
												So category times and percentages can exceed 100%.
											</span>
										</Trans>
									</DialogContent>
								</Dialog>
							</div>
						</CardHeader>
						<CardDescription className="grid grid-cols-4 gap-x-2 divide-x divide-border">
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
				<Card>
					<CardContent>
						<CardHeader className="flex items-center justify-between">
							<CardTitle>
								<Trans>Daily Coding Distribution</Trans>
							</CardTitle>
						</CardHeader>
						{distribution && <DistributionChart data={distribution} />}
					</CardContent>
				</Card>
				<RefetchOverview lastEvent={activity?.lastEvent} />
			</div>
		</div>
	);
}
