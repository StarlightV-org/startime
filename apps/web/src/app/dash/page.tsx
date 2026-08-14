import { formatDate } from "date-fns/format";
import { subSeconds } from "date-fns/fp";
import { cookies } from "next/headers";
import { TimeSelect } from "~/components/overview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { tryCatch } from "~/lib/utils";
import { getTimeRange, type TimeRange } from "~/server/api/routers/overview";
import { getAuth } from "~/server/better-auth";
import { api } from "~/trpc/server";

export default async function DashPage() {
	const auth = await getAuth();
	const cookieManager = await cookies();

	const timeRange = (cookieManager.get("startime_timeRange")?.value ?? "past30") as TimeRange;
	Print.Debug("timeRange", timeRange);
	const { data, error } = await tryCatch(api.overview.getActivity(timeRange));
	Print.Debug("data", data, "error", error);
	const [start, end] = getTimeRange(timeRange, auth.user.timeZone, undefined, auth.user.startOfWeek);
	return (
		<div>
			<h1 className="p-4 text-2xl">Overview</h1>

			<div className="flex w-full flex-col gap-4">
				<Card>
					<CardContent>
						<CardHeader>
							<CardTitle>Time Range</CardTitle>
						</CardHeader>
						<CardDescription className="flex flex-col justify-between">
							<div className="flex flex-row items-center gap-2">
								<TimeSelect timeRange={timeRange} />
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
								<h3 className="text-sm text-pink-600">Time/Total</h3>
								<p className="text-xl text-primary-foreground">{data?.timeTotal ?? "—"}</p>
							</div>
							<div className="col-span-1 flex flex-col px-4">
								<h3 className="text-sm text-pink-600">Time/Today</h3>
								<p className="text-xl text-primary-foreground">{data?.timeToday ?? "—"}</p>
							</div>
							<div className="col-span-1 flex flex-col px-4">
								<h3 className="text-sm text-pink-600">Streak/Current</h3>
								<p className="text-xl text-primary-foreground">{data?.currentStreak ?? "—"}</p>
							</div>
							<div className="col-span-1 flex flex-col pl-4">
								<h3 className="text-sm text-pink-600">Streak/Max</h3>
								<p className="text-xl text-primary-foreground">{data?.allTimeStreak ?? "—"}</p>
							</div>
						</CardDescription>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
