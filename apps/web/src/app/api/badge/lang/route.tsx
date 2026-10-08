import { NextResponse, type NextRequest } from "next/server";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";
import { z } from "zod";
import { getAuth } from "~/server/better-auth";

import { db, shareKeyReferrers, eventLogs } from "@startime/db";
import { checkAccountConfig } from "~/lib/account-config";
import { getTimeRange, toTimeString } from "~/lib/time-range";
import { and, eq, gte, lt } from "drizzle-orm";
import { rankByActiveMinutes } from "~/lib/overview-ranking";
import { createChartScene, defineChart } from "@tanstack/charts";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import { renderChartSvgWithResources } from "@tanstack/charts/svg/resources";
import { getLanguageLabel } from "~/components/overview/language-lable";

const coordinatesSearchParams = {
	shareKey: parseAsString,
	internal: parseAsBoolean,
};
const loadSearchParams = createLoader(coordinatesSearchParams);

const languageColors = [
	"var(--sidebar-primary)",
	"var(--primary)",
	"color-mix(in oklch, oklch(0.27 0.006 286) 30%, var(--primary))",
	"color-mix(in oklch, oklch(0.27 0.006 286) 50%, var(--primary))",
	"color-mix(in oklch, oklch(0.27 0.006 286) 70%, var(--primary))",
];

function escapeXml(value: string): string {
	return value.replace(/[<>&"']/g, (character) => {
		switch (character) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case '"':
				return "&quot;";
			default:
				return "&apos;";
		}
	});
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
			where: (shareKeys, { eq, and }) => and(eq(shareKeys.id, shareKeyId), eq(shareKeys.chartType, "lang")),
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

	if (!accountConfig.privacy.allowedBadges?.includes("lang")) {
		return NextResponse.json({ error: "Badge not found" }, { status: 404 });
	}

	const regional = accountConfig.regional;
	const [start, end] = getTimeRange("past365", regional.timeZone, undefined, regional.startOfWeek);

	const where = and(
		eq(eventLogs.userId, targetUser.id),
		start ? gte(eventLogs.eventTime, start) : undefined,
		end ? lt(eventLogs.eventTime, end) : undefined,
	);

	// Print.Debug("where", where?.getSQL());

	const events = await db
		.select({
			eventTime: eventLogs.eventTime,
			// editor: eventLogs.editor,
			// workspace: eventLogs.project,
			language: eventLogs.language,
			// platform: eventLogs.platform,
		})
		.from(eventLogs)
		.where(where);

	const rankedLanguages = rankByActiveMinutes(events.map(({ language, eventTime }) => ({ value: language, eventTime })));
	const totalMinutes = new Set(events.map(({ eventTime }) => Math.floor(eventTime.getTime() / 60_000))).size;
	const arcs = pie(rankedLanguages, { value: "minutes" });
	const languageNames = rankedLanguages.map(({ value }) => value);

	const chart = defineChart({
		marks: [
			polar({
				inset: 0,
				radiusRatio: 0.96,
				marks: [
					radialArc(arcs, {
						id: "language-slices",
						key: "value",
						innerRadius: ({ radius }) => radius * 0.64,
						color: "value",
					}),
				],
				scales: {
					angle: null,
					radius: null,
				},
			}),
		],
		scales: {
			x: null,
			y: null,
		},
		guides: false,
		color: {
			domain: languageNames,
			range: languageColors,
		},
		margin: { top: 18, right: 184, bottom: 18, left: 8 },
	});

	const scene = createChartScene(chart, {
		width: 360,
		height: 180,
	});
	const styles = `<style>
	svg {
		user-select: none;
		color: oklch(0.711 0.019 323.02);
		font-family: "Nunito", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
		font-weight: 500;
		--foreground: oklch(0.985 0 0);
		--primary: oklch(0.455 0.188 13.697);
		--sidebar-primary: oklch(0.645 0.246 16.439);
	}
	</style>`;
	const background =
		'<rect x="0.5" y="0.5" width="359" height="179" rx="10" fill="oklch(0.212 0.019 322.12)" stroke="oklch(1 0 0 / 10%)" />';
	const centerLabel = `<g text-anchor="middle">
		<text x="92" y="87" fill="var(--foreground)" font-size="14" font-weight="700">${escapeXml(toTimeString(totalMinutes, "hour"))}</text>
		<text x="92" y="105" fill="currentColor" font-size="9">last 365d</text>
	</g>`;
	const legend = rankedLanguages
		.map(({ value, percentage }, index) => {
			const y = 43 + index * 19;
			return `<g>
				<rect x="190" y="${y - 9}" width="10" height="10" rx="1.5" fill="${languageColors[index]}" />
				<text x="206" y="${y}" fill="var(--foreground)" font-size="11">${escapeXml(getLanguageLabel(value))}</text>
				<text x="350" y="${y}" fill="currentColor" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="10" text-anchor="end">${percentage.toFixed(1)}%</text>
			</g>`;
		})
		.join("");
	const overlay = `<g>
		<text x="190" y="23" fill="var(--sidebar-primary)" font-size="9" font-weight="600" letter-spacing="1.2">LANGUAGES</text>
		${centerLabel}
		${legend}
		<text x="350" y="166" fill="currentColor" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="8" text-anchor="end">time.starlightv.dev</text>
	</g>`;
	const svg = renderChartSvgWithResources(scene, {
		ariaLabel: "Language activity over the last year",
		ariaDescription: "A donut chart showing coding time by language during the last 365 days.",
		idPrefix: `language-activity-${targetUser.id}`,
		tabIndex: -1,
	})
		.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
		.replace(">", `>${styles}${background}`)
		.replace("</svg>", `${overlay}</svg>`);

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
