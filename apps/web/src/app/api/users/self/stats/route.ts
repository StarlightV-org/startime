import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inputStatsSchema, outputCompatibilityStatsSchema, outputStatsSchema } from "@startime/zod";
import { checkApiKey } from "~/server/better-auth/auth";

import { parseAsFloat, createLoader, parseAsString } from "nuqs/server";
import { checkAccountConfig } from "~/lib/account-config";
import { getTimeRange, normalizeTimeZone, toTimeString } from "~/lib/time-range";
import { and, eq, gte, lt, sql } from "drizzle-orm";

import { db, eventLogs } from "@startime/db";
import { isCompatibilityMode } from "~/lib/api-lib";

// Describe your search params, and reuse this in useQueryStates / createSerializer:
export const coordinatesSearchParams = {
	project: parseAsString.withDefault(""),
};
const loadSearchParams = createLoader(coordinatesSearchParams);

export async function GET(req: NextRequest) {
	const apiKey = await checkApiKey(req);
	if (apiKey instanceof NextResponse) {
		return apiKey;
	}

	const data = loadSearchParams(req);
	const parsed = inputStatsSchema.safeParse(data);
	if (!parsed.success) {
		return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
	}

	const regional = checkAccountConfig(apiKey.user.accountConfig).regional;

	const timeZone = normalizeTimeZone(regional.timeZone);
	const [startToday, endToday] = getTimeRange("thisDay", timeZone, undefined, regional.startOfWeek);

	if (!startToday || !endToday) {
		throw new Error("Unable to determine the current day range");
	}

	const rangeFilter = and(
		eq(eventLogs.userId, apiKey.user.id),
		gte(eventLogs.eventTime, startToday),
		lt(eventLogs.eventTime, endToday),
		parsed.data.project ? eq(eventLogs.project, parsed.data.project) : undefined,
	);

	const [activityResult] = await Promise.all([
		db
			.select({
				activeMinutesToday: sql<number>`count(distinct date_trunc('minute', ${eventLogs.eventTime}))`.mapWith(Number),
			})
			.from(eventLogs)
			.where(rangeFilter),
	]);

	if (isCompatibilityMode(req)) {
		const activity: {
			data: Array<{
				duration: number;
			}>;
		} = {
			data: [
				{
					duration: activityResult[0]?.activeMinutesToday ?? 0,
				},
			],
		};

		return NextResponse.json(outputCompatibilityStatsSchema.parse(activity), { status: 200 });
	}

	return NextResponse.json(
		outputStatsSchema.parse({
			time: toTimeString(activityResult[0]?.activeMinutesToday ?? 0),
		}),
		{ status: 200 },
	);
}
