import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";
import { BiggestUnitSelect, TimeSelect } from "~/components/overview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { getTimeRange, type TimeRange } from "~/lib/time-range";
import { tryCatch } from "~/lib/utils";
import type { BiggestUnit } from "~/server/api/routers/overview";
import { getAuth } from "~/server/better-auth";
import { api } from "~/trpc/server";
import RefetchOverview, {
	ActivityIndicator,
	RefetchOverviewButton,
} from "../../../components/overview/client-overview";
import { Filter } from "lucide-react";
import { formatDate } from "date-fns/format";
import { subSeconds } from "date-fns/fp";
import { Separator } from "~/components/ui/separator";
// Describe your search params, and reuse this in useQueryStates / createSerializer:
export const coordinatesSearchParams = {
	editor: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	workspace: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	language: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	platform: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
};
export const loadSearchParams = createLoader(coordinatesSearchParams);

export default async function MinimalPage() {
	const auth = await getAuth();
	const cookieManager = await cookies();

	const timeRange = (cookieManager.get("startime_timeRange")?.value ?? "past30") as TimeRange;
	const biggestUnit = (cookieManager.get("startime_biggestUnit")?.value ?? "hour") as BiggestUnit;

	const { data: activity, error: activityError } = await tryCatch(api.overview.getActivity({ timeRange, biggestUnit }));
	const regional = auth.user.accountConfig.regional;
	return (
		<main className="flex h-svh items-center justify-center overflow-hidden bg-background" data-minimal-page>
			<Card className="h-37.5 w-100">
				<CardContent>
					<CardHeader className="flex flex-row items-center justify-between gap-2 px-0">
						<CardTitle className="h-8">Activity </CardTitle>
						<ActivityIndicator lastEvent={activity?.lastEvent} interactive={false} />
					</CardHeader>
					<CardDescription className="flex flex-col items-center gap-2 px-0">
						<div className="flex w-full flex-row justify-between">
							<div className="flex flex-col pr-4 first:pl-0">
								<h3 className="text-sm text-sidebar-primary">Time/Total</h3>
								<p className="text-xl text-primary-foreground">{activity?.timeTotal ?? "—"}</p>
							</div>
							<Separator orientation="vertical" />
							<div className="flex flex-col px-4">
								<h3 className="text-sm text-sidebar-primary">Time/Today</h3>
								<p className="text-xl text-primary-foreground">{activity?.timeToday ?? "—"}</p>
							</div>
						</div>
						<div className="flex w-full flex-row items-center justify-between gap-2">
							<TimeSelect timeRange={timeRange} />
							<BiggestUnitSelect biggestUnit={biggestUnit} />
						</div>
					</CardDescription>
				</CardContent>
			</Card>
			<RefetchOverview lastEvent={activity?.lastEvent} />
		</main>
	);
}
