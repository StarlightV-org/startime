"use client";

import { cell, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react/tooltip";
import { scaleBand } from "@tanstack/charts/scales/band";
import { tooltip } from "@tanstack/charts/tooltip";

import type { API } from "~/trpc/server";

type ActivityLevel =
	"None" | "Very low" | "Low" | "Medium low" | "Medium" | "Medium high" | "High" | "Very high" | "Peak";
type DailyActivityRow = API["overview"]["getDailyActivity"][number];
type CalendarRow = Omit<DailyActivityRow, "weekday"> & { weekday: string; activityLevel: ActivityLevel };

const activityLevels: readonly ActivityLevel[] = [
	"None",
	"Very low",
	"Low",
	"Medium low",
	"Medium",
	"Medium high",
	"High",
	"Very high",
	"Peak",
];

function getActivityLevel(minutes: number, lowestActiveMinutes: number, highestActiveMinutes: number): ActivityLevel {
	if (minutes === 0) return "None";
	if (lowestActiveMinutes === highestActiveMinutes) return "Peak";

	const relativeIntensity = (minutes - lowestActiveMinutes) / (highestActiveMinutes - lowestActiveMinutes);
	const activeLevelIndex = 1 + Math.round(relativeIntensity * (activityLevels.length - 2));

	return activityLevels[activeLevelIndex]!;
}

export default function ActivityCalendar({
	dailyActivity,
	startOfWeek: userStartOfWeek,
}: {
	dailyActivity: API["overview"]["getDailyActivity"];
	startOfWeek: "monday" | "sunday";
}) {
	const weekStartsOn = userStartOfWeek === "monday" ? 1 : 0;
	const weekdays =
		weekStartsOn === 1
			? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
			: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	if (dailyActivity.length === 0) {
		return <p className="py-6 text-sm text-muted-foreground">No activity to display yet.</p>;
	}

	const activeMinutes = dailyActivity.map((activity) => activity.numOfMin).filter((minutes) => minutes > 0);
	const lowestActiveMinutes = Math.min(...activeMinutes);
	const highestActiveMinutes = Math.max(...activeMinutes);
	const rows: CalendarRow[] = dailyActivity.map((activity) => ({
		...activity,
		weekday: weekdays[activity.weekday]!, // The API constrains weekday to 0–6.
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

	const monthTicks = [...monthLabels.keys()];
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
		],
		x: {
			scale: () => scaleBand<number>().paddingInner(0.08).paddingOuter(0.04),
			axis: {
				line: false,
				ticks: { values: monthTicks, size: 0, padding: 6, format: (week) => monthLabels.get(week) ?? "" },
				tickLabels: { anchor: "start" },
			},
		},
		y: {
			// Use a scale instance: factories have their categorical domain inferred
			// from the first data point, which would rotate the weekday rows.
			scale: scaleBand<string>().domain(weekdays).paddingInner(0.08).paddingOuter(0.04),
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
		margin: { top: 8, right: 8, bottom: 28, left: 44 },
		tooltip: {
			use: tooltip,
			sticky: false,
		},
	});

	return (
		<Chart
			ariaLabel="Daily activity over the last year"
			definition={chart}
			height={150}
			initialWidth={896}
			aspectRatio={21 / 9}
			className="outline-none! select-none focus:outline-none! focus-visible:outline-none! [&_*:focus]:outline-none! [&_*:focus-visible]:outline-none!"
			tabIndex={0}
			renderTooltipBody={({ points }) => {
				const activity = points[0]?.datum as CalendarRow | undefined;

				if (!activity) return null;

				return (
					<div className="grid gap-1">
						<strong>{activity.displayDate}</strong>
						<span>{activity.codeTime || "No code time"}</span>
					</div>
				);
			}}
		/>
	);
}
