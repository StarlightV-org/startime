import { cookies } from "next/headers";
import { TimeSelect } from "~/components/overview";
import { tryCatch } from "~/lib/utils";
import type { TimeRange } from "~/server/api/routers/overview";
import { getAuth } from "~/server/better-auth";
import { api } from "~/trpc/server";

export default async function DashPage() {
	const auth = await getAuth();
	const cookieManager = await cookies();

	const timeRange = (cookieManager.get("startime_timeRange")?.value ?? "past30") as TimeRange;
	Print.Debug("timeRange", timeRange);
	const { data, error } = await tryCatch(api.overview.getTime(timeRange));

	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
			<TimeSelect timeRange={timeRange} />

			<div className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</div>
		</main>
	);
}
