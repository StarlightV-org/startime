"use client";
import { Chart } from "@tanstack/charts/react/tooltip";
import { tooltip } from "@tanstack/charts/tooltip";
import { useLingui } from "@lingui/react";

import { defineChart, dot, lineY } from "@tanstack/charts";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { API } from "~/trpc/server";

const smoothingRadius = 3;
type TrendRow = API["overview"]["getTrend"][number] & { date: Date };

export const createTrendChart = (input: API["overview"]["getTrend"]) => {
	const rows = input.map((row) => ({ ...row, date: new Date(`${row.date}T00:00:00Z`) }));
	const smoothedRows = rows.map((row, index) => {
		const window = rows.slice(Math.max(0, index - smoothingRadius), index + smoothingRadius + 1);
		const smoothedHours = window.reduce((total, item) => total + item.hours, 0) / window.length;

		return { ...row, smoothedHours };
	});
	const maximumHours = Math.max(1, Math.ceil(Math.max(...rows.map((row) => row.hours))));

	return defineChart(
		{
			marks: [
				dot(rows, {
					x: "date",
					y: "hours",
					r: 2.5,
					fill: "var(--muted-foreground)",
					fillOpacity: 0.45,
				}),
				lineY(smoothedRows, {
					x: "date",
					y: "smoothedHours",
					stroke: "var(--primary)",
					strokeWidth: 2.25,
				}),
			],
			scales: {
				x: { scale: scaleUtc, axis: { label: "Date" } },
				y: {
					scale: () => scaleLinear().domain([0, maximumHours]),
					grid: true,
					axis: {
						label: "Time (hours)",
						ticks: { count: maximumHours + 1, format: (hours: number) => `${hours}h` },
					},
				},
			},
		},
		{
			keyboard: true,
			tooltip: {
				use: tooltip,
				sticky: false,
			},
		},
	);
};

export default function CodingTrendChart({ data }: { data: API["overview"]["getTrend"] }) {
	const { i18n } = useLingui();
	const dateFormatter = new Intl.DateTimeFormat(i18n.locale, {
		dateStyle: "medium",
		timeZone: "UTC",
	});

	return (
		<Chart
			ariaLabel={"Trend Chart"}
			className="outline-none! select-none focus:outline-none! focus-visible:outline-none! [&_*:focus]:outline-none! [&_*:focus-visible]:outline-none!"
			tabIndex={0}
			definition={createTrendChart(data)}
			height={300}
			initialWidth={928}
			width={928}
			renderTooltipBody={({ points }) => {
				const trend = points[0]?.datum as TrendRow | undefined;

				if (!trend) return null;

				return (
					<div className="grid gap-1">
						<strong>{dateFormatter.format(trend.date)}</strong>
						<span>{trend.time}</span>
					</div>
				);
			}}
		/>
	);
}
