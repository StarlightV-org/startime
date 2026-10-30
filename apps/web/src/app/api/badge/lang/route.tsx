import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { badgeResponse, recordBadgeReferrer, resolveBadgeAccess } from "~/server/badge-access";

import { db, eventLogs } from "@startime/db";
import { getTimeRange, timeRangeLabels, toTimeString } from "~/lib/time-range";
import { and, eq, gte, lt } from "drizzle-orm";
import { rankBadgeLanguages } from "~/lib/overview-ranking";
import { getLanguageIconSrc } from "~/lib/languageIcons";
import { createChartScene, defineChart } from "@tanstack/charts";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import { renderChartSvgWithResources } from "@tanstack/charts/svg/resources";
import { getLanguageLabel } from "~/components/overview/language-lable";
import { setRequestI18n } from "~/i18n/server";
import { fromHeader, resolveLocale } from "~/i18n/locales";
import { parseTranslate } from "~/lib/utils";

export const dynamic = "force-dynamic";

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

async function getLanguageIconDataUri(language: string): Promise<string | undefined> {
	const iconSrc = getLanguageIconSrc(language);
	if (!iconSrc) return undefined;

	try {
		const icon = await readFile(join(process.cwd(), "public", iconSrc.replace(/^\//, "")));
		return `data:image/svg+xml;base64,${icon.toString("base64")}`;
	} catch {
		return undefined;
	}
}

export async function GET(req: NextRequest) {
	return badgeResponse(() => renderBadge(req));
}

async function renderBadge(req: NextRequest) {
	const access = await resolveBadgeAccess(req, "lang");
	if (access instanceof Response) return access;
	const { targetUser, accountConfig, options: { timeRange, inMinutes }, shareKey } = access;
	const i18n = await setRequestI18n(resolveLocale(fromHeader(req.headers)));

	const regional = accountConfig.regional;
	const translatedTimeRange = parseTranslate(i18n, timeRangeLabels[timeRange]);
	const [start, end] = getTimeRange(timeRange, regional.timeZone, undefined, regional.startOfWeek);

	const where = and(
		eq(eventLogs.userId, targetUser.id),
		start ? gte(eventLogs.eventTime, start) : undefined,
		end ? lt(eventLogs.eventTime, end) : undefined,
	);

	const events = await db
		.select({
			eventTime: eventLogs.eventTime,
			language: eventLogs.language,
		})
		.from(eventLogs)
		.where(where);

	const rankedLanguages = rankBadgeLanguages(events.map(({ language, eventTime }) => ({ value: language, eventTime })));
	const totalMinutes = new Set(events.map(({ eventTime }) => Math.floor(eventTime.getTime() / 60_000))).size;
	const arcs = pie(rankedLanguages, { value: "minutes" });
	const languageNames = rankedLanguages.map(({ value }) => value);
	const languageIconDataUris = await Promise.all(rankedLanguages.map(({ value }) => getLanguageIconDataUri(value)));

	const badgeWidth = 400;
	const legendRight = badgeWidth - 10;

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
		margin: { top: 34, right: badgeWidth - 176, bottom: 8, left: 8 },
	});

	const scene = createChartScene(chart, {
		width: badgeWidth,
		height: 174,
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
	const background = `<rect x="0.5" y="0.5" width="${badgeWidth - 1}" height="173" rx="10" fill="oklch(0.212 0.019 322.12)" stroke="oklch(1 0 0 / 10%)" />`;
	const centerLabel = `<g text-anchor="middle">
		<text x="92" y="97" fill="var(--foreground)" font-size="14" font-weight="700">${escapeXml(toTimeString(totalMinutes, "hour"))}</text>
		<text x="92" y="115" fill="currentColor" font-size="9">${escapeXml(translatedTimeRange)}</text>
	</g>`;
	const legend = rankedLanguages
		.map(({ value, minutes, percentage }, index) => {
			const y = 72 + index * 19;
			const iconDataUri = languageIconDataUris[index];
			const icon = iconDataUri
				? `<image x="206" y="${y - 11}" width="14" height="14" href="${iconDataUri}" preserveAspectRatio="xMidYMid meet" />`
				: "";
			return `<g>
				<rect x="190" y="${y - 9}" width="10" height="10" rx="1.5" fill="${languageColors[index]}" />
				${icon}
				<text x="225" y="${y}" fill="var(--foreground)" font-size="11">${escapeXml(getLanguageLabel(value))}</text>
				<text x="${legendRight}" y="${y}" fill="currentColor" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="10" text-anchor="end">${inMinutes ? escapeXml(toTimeString(minutes)) : `${percentage.toFixed(1)}%`}</text>
			</g>`;
		})
		.join("");
	const overlay = `<g>
		<text x="10" y="18" fill="currentColor" font-size="10" font-weight="600">time.starlightv.dev</text>
		<text x="${legendRight}" y="18" fill="currentColor" font-size="10" font-weight="600" text-anchor="end">@${escapeXml(targetUser.name)}</text>
		<text x="190" y="53" fill="var(--sidebar-primary)" font-size="9" font-weight="600" letter-spacing="1.2">${escapeXml(i18n.t(`LANGUAGES`))}</text>
		${centerLabel}
		${legend || '<text x="190" y="80" fill="currentColor" font-size="12">No activity</text>'}
	</g>`;
	const svg = renderChartSvgWithResources(scene, {
		ariaLabel: `Language activity: ${translatedTimeRange}`,
		ariaDescription: "Share of language-minutes in the selected range; the center shows distinct active time.",
		idPrefix: `language-activity-${targetUser.id}`,
		tabIndex: -1,
	})
		.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
		.replace(">", `>${styles}${background}`)
		.replace("</svg>", `${overlay}</svg>`);

	await recordBadgeReferrer(req, shareKey);
	return new Response(svg, {
		headers: {
			"Content-Type": "image/svg+xml; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
