import { cell, createChartScene, defineChart, renderChartSvg, text } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { db, shareKeyReferrers } from "@startime/db";
import { NextResponse, type NextRequest } from "next/server";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { checkAccountConfig } from "~/lib/account-config";
import { getDailyActivityForUser } from "~/server/activity-calendar";
import { getAuth } from "~/server/better-auth";
import z from "zod";
import { renderChartSvgWithResources } from "@tanstack/charts/svg/resources";
import { tooltip } from "@tanstack/charts/tooltip";
import { withRedisCache } from "~/server/redis/cache";
import { cacheKey } from "~/lib/cache-key";

const activityLevels = [
	"None",
	"Very low",
	"Low",
	"Medium low",
	"Medium",
	"Medium high",
	"High",
	"Very high",
	"Peak",
] as const;

type ActivityLevel = (typeof activityLevels)[number];

const coordinatesSearchParams = {
	shareKey: parseAsString,
	internal: parseAsBoolean,
};
const loadSearchParams = createLoader(coordinatesSearchParams);

function getActivityLevel(minutes: number, lowestActiveMinutes: number, highestActiveMinutes: number): ActivityLevel {
	if (minutes === 0) return "None";
	if (lowestActiveMinutes === highestActiveMinutes) return "Peak";

	const relativeIntensity = (minutes - lowestActiveMinutes) / (highestActiveMinutes - lowestActiveMinutes);
	const activeLevelIndex = 1 + Math.round(relativeIntensity * (activityLevels.length - 2));

	return activityLevels[activeLevelIndex]!;
}

export async function GET(req: NextRequest) {
	const rawParams = loadSearchParams(req);

	let userId: string | undefined;
	if (rawParams.internal) {
		const { user, session } = await getAuth();
		if (!session?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		userId = user.id;
	}

	if (!rawParams.internal) {
		const { data, success, error } = z
			.object({
				shareKey: z.string("Share key is required").regex(/^[A-Z]{8}\d{8}$/, "Share does not match the required format"),
			})
			.safeParse(rawParams);

		if (!success) {
			return NextResponse.json(z.treeifyError(error).properties, { status: 400 });
		}

		const { shareKey: shareKeyId } = data;

		if (!shareKeyId) {
			Print.Debug("Share key not found 1");
			return NextResponse.json({ error: "Badge not found" }, { status: 404 });
		}

		const shareKey = await db.query.shareKeys.findFirst({
			where: (shareKeys, { eq, and }) => and(eq(shareKeys.id, shareKeyId), eq(shareKeys.chartType, "calendar")),
		});

		if (!shareKey) {
			Print.Debug("Share key not found 2");
			return NextResponse.json({ error: "Key not found" }, { status: 404 });
		}

		userId = shareKey.userId;

		if (!userId) {
			const { user } = await getAuth();
			if (!user) {
				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			}
			userId = user.id;
		}
	}

	const targetUser = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.id, userId!),
		columns: { id: true, accountConfig: true, name: true },
	});

	if (!targetUser) {
		Print.Debug("Target user not found");
		return NextResponse.json({ error: "Badge not found" }, { status: 404 });
	}

	const referrer = req.headers.get("referer");
	if (referrer && rawParams.shareKey) {
		void db
			.insert(shareKeyReferrers)
			.values({ shareKeyId: rawParams.shareKey, referrer: referrer.toString() })
			.onConflictDoUpdate({
				target: [shareKeyReferrers.shareKeyId, shareKeyReferrers.referrer],
				set: { referrer: referrer.toString(), lastUsed: new Date() },
			})
			.then(() => {
				Print.Debug("Referrer logged", { referrer: referrer.toString() });
			});
	}

	const accountConfig = checkAccountConfig(targetUser.accountConfig);

	if (!accountConfig.privacy.allowedBadges?.includes("calendar")) {
		return NextResponse.json({ error: "Badge not found" }, { status: 404 });
	}

	const dailyActivity = await withRedisCache(
		cacheKey({ userId: targetUser.id, regional: accountConfig.regional }),
		3600,
		() => getDailyActivityForUser(targetUser.id, accountConfig.regional),
	);
	const weekStartsOn = accountConfig.regional.startOfWeek === "monday" ? 1 : 0;
	const weekdays =
		weekStartsOn === 1
			? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
			: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const activeMinutes = dailyActivity.map((activity) => activity.numOfMin).filter((minutes) => minutes > 0);
	const lowestActiveMinutes = Math.min(...activeMinutes);
	const highestActiveMinutes = Math.max(...activeMinutes);
	const rows = dailyActivity.map((activity) => ({
		...activity,
		weekday: weekdays[activity.weekday]!,
		activityLevel: getActivityLevel(activity.numOfMin, lowestActiveMinutes, highestActiveMinutes),
	}));
	const monthLabels = new Map<number, string>();
	let currentMonth: string | undefined;

	for (const row of rows) {
		if (row.month !== currentMonth) {
			monthLabels.set(row.week, row.month);
			currentMonth = row.month;
		}
	}

	const usernameLabel = [
		{
			week: Math.max(...rows.map((row) => row.week)),
			weekday: weekdays[0]!,
			text: `@${targetUser.name}`,
		},
	];
	const appLabel = [
		{
			week: Math.min(...rows.map((row) => row.week)),
			weekday: weekdays[0]!,
			text: `time.starlightv.dev`,
		},
	];

	const chart = defineChart({
		marks: [
			cell(rows, {
				x: "week",
				y: "weekday",
				color: "activityLevel",
				key: "date",
				inset: 2,
				radius: 2,
			}),
			text(usernameLabel, {
				x: "week",
				y: "weekday",
				text: "text",
				anchor: "end",
				dx: 4,
				dy: -18,
				fill: "currentColor",
				fontSize: 12,
				fontWeight: 600,
			}),
			text(appLabel, {
				x: "week",
				y: "weekday",
				text: "text",
				anchor: "start",
				dx: 0,
				dy: -18,
				fill: "currentColor",
				fontSize: 12,
				fontWeight: 600,
			}),
		],
		tooltip: {
			use: tooltip,
		},
		scales: {
			x: {
				scale: () => scaleBand<number>().paddingInner(0.08).paddingOuter(0.04),
				axis: {
					ticks: { values: [...monthLabels.keys()], format: (week: number) => monthLabels.get(week) ?? "" },
				},
			},
			y: {
				scale: scaleBand<string>().domain(weekdays).paddingInner(0.08).paddingOuter(0.04),
			},
		},
		color: {
			domain: activityLevels,
			range: [
				"oklch(0.27 0.006 286)",
				"color-mix(in oklch, oklch(0.27 0.006 286) 60%, var(--primary))",
				"color-mix(in oklch, oklch(0.27 0.006 286) 50%, var(--primary))",
				"color-mix(in oklch, oklch(0.27 0.006 286) 40%, var(--primary))",
				"color-mix(in oklch, oklch(0.27 0.006 286) 30%, var(--primary))",
				"color-mix(in oklch, oklch(0.27 0.006 286) 20%, var(--primary))",
				"color-mix(in oklch, oklch(0.27 0.006 286) 10%, var(--primary))",
				"var(--primary)",
				"var(--sidebar-primary)",
			],
		},
		margin: { top: 28, right: 8, bottom: 28, left: 44 },
	});

	const scene = createChartScene(chart, {
		width: 896,
		height: 170,
	});
	const styles = `<style>
	svg {
	  user-select: none;
		color: oklch(0.711 0.019 323.02);
		font-family: "Nunito", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
		font-weight: 500;
		--primary: oklch(0.455 0.188 13.697);
		--sidebar-primary: oklch(0.645 0.246 16.439);
	}
	</style>`;
	const background =
		'<rect x="0.5" y="0.5" width="895" height="169" rx="10" fill="oklch(0.212 0.019 322.12)" stroke="oklch(1 0 0 / 10%)" />';
	const svg = renderChartSvgWithResources(scene, {
		ariaLabel: "Daily activity over the last year",
		ariaDescription: "A calendar showing daily coding activity during the last 365 days.",
		idPrefix: `activity-calendar-${targetUser.id}`,
		tabIndex: -1,
	})
		.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
		.replace(">", `>${styles}${background}`);

	return new Response(svg, {
		headers: {
			"Cache-Control": accountConfig.privacy.publicProfile
				? "public, max-age=300, s-maxage=300, stale-while-revalidate=3600"
				: "private, no-store",
			"Content-Type": "image/svg+xml; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
