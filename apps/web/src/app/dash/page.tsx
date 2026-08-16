import { formatDate } from "date-fns/format";
import { subSeconds } from "date-fns/fp";
import { BracketsIcon, CodeXmlIcon, ComputerIcon, FolderIcon, InfoIcon, PencilIcon } from "lucide-react";
import { cookies } from "next/headers";
import { BiggestUnitSelect, Filter, TimeSelect, TopElement } from "~/components/overview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { tryCatch } from "~/lib/utils";
import { getTimeRange, type BiggestUnit, type TimeRange } from "~/server/api/routers/overview";
import { getAuth } from "~/server/better-auth";
import { api } from "~/trpc/server";
import { parseAsFloat, createLoader, parseAsString } from "nuqs/server";
import type { SearchParams } from "nuqs/server";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";

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
	const { editor, workspace, language, platform } = await loadSearchParams(searchParams);

	const timeRange = (cookieManager.get("startime_timeRange")?.value ?? "past30") as TimeRange;
	const biggestUnit = (cookieManager.get("startime_biggestUnit")?.value ?? "hour") as BiggestUnit;

	Print.Debug("timeRange", timeRange);
	const { data: activity, error: activityError } = await tryCatch(api.overview.getActivity({ timeRange, biggestUnit }));
	const { data: top, error: topError } = await tryCatch(
		api.overview.getTop({ timeRange, filter: { editor, workspace, language, platform }, biggestUnit }),
	);

	const regional = auth.user.accountConfig.regional;
	const [start, end] = getTimeRange(timeRange, regional.timeZone, undefined, regional.startOfWeek);

	return (
		<div>
			<div className="flex w-full flex-col gap-4">
				<Card>
					<CardContent>
						<CardHeader>
							<CardTitle>Time Range</CardTitle>
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
						<CardHeader>
							<CardTitle>Activity</CardTitle>
						</CardHeader>
						<CardDescription className="grid grid-cols-4 divide-x divide-border">
							<div className="col-span-1 flex flex-col pr-4 first:pl-0">
								<h3 className="text-sm text-sidebar-primary">Time/Total</h3>
								<p className="text-xl text-primary-foreground">{activity?.timeTotal ?? "—"}</p>
							</div>
							<div className="col-span-1 flex flex-col px-4">
								<h3 className="text-sm text-sidebar-primary">Time/Today</h3>
								<p className="text-xl text-primary-foreground">{activity?.timeToday ?? "—"}</p>
							</div>
							<div className="col-span-1 flex flex-col px-4">
								<h3 className="text-sm text-sidebar-primary">Streak/Current</h3>
								<p className="text-xl text-primary-foreground">{activity?.currentStreak ?? "—"}</p>
							</div>
							<div className="col-span-1 flex flex-col pl-4">
								<h3 className="text-sm text-sidebar-primary">Streak/Max</h3>
								<p className="text-xl text-primary-foreground">{activity?.allTimeStreak ?? "—"}</p>
							</div>
						</CardDescription>
					</CardContent>
				</Card>
				<Card>
					<CardContent>
						<CardHeader className="flex items-center justify-between">
							<CardTitle>Top</CardTitle>

							<Dialog>
								<DialogTrigger asChild>
									<InfoIcon className="size-5 cursor-pointer" />
								</DialogTrigger>
								<DialogContent>
									<DialogTitle>Calculations</DialogTitle>
									<span className="text-sm text-pretty text-muted-foreground">
										Total time counts each active minute once. <br />
										If you switch workspace or language within a minute, that same minute is counted for every matching category.{" "}
										<br />
										So category times and percentages can exceed 100%.
									</span>
								</DialogContent>
							</Dialog>
						</CardHeader>
						<CardDescription className="grid grid-cols-4 gap-x-2 divide-x divide-border">
							<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
								<div className="flex items-center gap-2">
									<PencilIcon className="size-4" />
									<h3 className="y text-sm">Editor</h3>
								</div>
								{top &&
									Object.entries(top.editor)
										.filter(([, item]) => item.value !== "")
										.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} />)}
							</div>
							<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
								<div className="flex items-center gap-2">
									<FolderIcon className="size-4" />
									<h3 className="y text-sm">Workspace</h3>
								</div>
								{top &&
									Object.entries(top.workspace)
										.filter(([, item]) => item.value !== "")
										.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="workspace" />)}
							</div>
							<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
								<div className="flex items-center gap-2">
									<CodeXmlIcon className="size-4" />
									<h3 className="y text-sm">Language</h3>
								</div>
								{top &&
									Object.entries(top.language)
										.filter(([, item]) => item.value !== "")
										.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="language" />)}
							</div>
							<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
								<div className="flex items-center gap-2">
									<ComputerIcon className="size-4" />
									<h3 className="y text-sm">Platform</h3>
								</div>
								{top &&
									Object.entries(top.platform)
										.filter(([, item]) => item.value !== "")
										.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="platform" />)}
							</div>
						</CardDescription>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
