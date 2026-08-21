"use client";

import { areaY, defineChart, lineY, ruleX, text } from "@tanstack/charts";
import { focusDisabled } from "@tanstack/charts/focus/disabled";
import { Chart } from "@tanstack/charts/react/tooltip";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scaleSqrt } from "d3-scale";
import { useEffect, useState } from "react";
import { Empty, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import type { API } from "~/trpc/server";

type DistributionData = API["overview"]["getDistribution"];

const hourTicks = Array.from({ length: 7 }, (_, hour) => hour * 4 * 60);

function formatTime(minuteOfDay: number) {
	return `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:00`;
}

function getCurrentTime(timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts();
	const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
	const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

	return {
		minuteOfDay: hour * 60 + minute,
		label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
	};
}

function createDistributionChart({ average, currentTime, historical, historicalDates }: DistributionData) {
	return defineChart({
		focus: focusDisabled,
		marks: [
			lineY(historical, {
				x: "minuteOfDay",
				y: "density",
				z: "date",
				strokeWidth: 1,
			}),
			areaY(average, {
				x: "minuteOfDay",
				y: "density",
				fill: "var(--sidebar-primary)",
				fillOpacity: 0.1,
			}),
			lineY(average, {
				x: "minuteOfDay",
				y: "density",
				stroke: "var(--sidebar-primary)",
				strokeWidth: 2,
			}),
			ruleX([currentTime], {
				x: "minuteOfDay",
				stroke: "var(--muted-foreground)",
				strokeDasharray: "3 3",
				strokeOpacity: 0.7,
			}),
			text([{ ...currentTime, density: 0 }], {
				x: "minuteOfDay",
				y: "density",
				text: "label",
				fill: "var(--muted-foreground)",
				fontSize: 11,
				dy: -10,
			}),
		],
		x: {
			scale: scaleLinear,
			axis: {
				ticks: { values: hourTicks, format: formatTime },
			},
		},
		y: {
			axis: { ticks: false },
			scale: scaleSqrt,
			domain: [0, 1.05],
		},
		color: {
			domain: historicalDates,
			range: historicalDates.map((_, index) => {
				const opacity = 18 + (index / Math.max(historicalDates.length - 1, 1)) * 32;
				return `color-mix(in oklch, var(--muted-foreground) ${opacity}%, transparent)`;
			}),
		},
		margin: { top: 8, bottom: 28 },
	});
}

export default function DistributionChart({ data }: { data: DistributionData }) {
	const [currentTime, setCurrentTime] = useState(data.currentTime);

	useEffect(() => {
		const updateCurrentTime = () => setCurrentTime(getCurrentTime(data.timeZone));
		let interval: number | undefined;
		const delay = 60_000 - (Date.now() % 60_000);
		const timeout = window.setTimeout(() => {
			updateCurrentTime();
			interval = window.setInterval(updateCurrentTime, 60_000);
		}, delay);

		updateCurrentTime();
		return () => {
			window.clearTimeout(timeout);
			if (interval) window.clearInterval(interval);
		};
	}, [data.timeZone]);

	if (!data.hasActivity) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>No activity to display yet.</EmptyTitle>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<Chart
			ariaLabel="Coding activity by time of day over the last seven days"
			definition={createDistributionChart({ ...data, currentTime })}
			height={200}
			initialWidth={928}
			className="outline-none! select-none focus:outline-none! focus-visible:outline-none! [&_*:focus]:outline-none! [&_*:focus-visible]:outline-none!"
			tabIndex={0}
		/>
	);
}
