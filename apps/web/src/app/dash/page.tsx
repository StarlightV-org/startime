import { formatDate } from "date-fns/format";
import { subSeconds } from "date-fns/fp";
import { BracketsIcon, CodeXmlIcon, ComputerIcon, FolderIcon, InfoIcon, PencilIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { BiggestUnitSelect, Filter, TimeSelect, TopElement } from "~/components/overview";
import { getTimeRange, type BiggestUnit, type TimeRange } from "~/server/api/routers/overview";
import { cookies } from "next/headers";
import { tryCatch } from "~/lib/utils";
import { getAuth } from "~/server/better-auth";
import { api } from "~/trpc/server";
import { parseAsFloat, createLoader, parseAsString } from "nuqs/server";
import type { SearchParams } from "nuqs/server";
import ClientOverview from "./client-overview";

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

	Print.Debug("activity", activity);

	return (
		<div>
			<div className="flex w-full flex-col gap-4 pt-2">
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
				<ClientOverview activity={activity!} top={top!} biggestUnit={biggestUnit} timeRange={timeRange} />
			</div>
		</div>
	);
}
