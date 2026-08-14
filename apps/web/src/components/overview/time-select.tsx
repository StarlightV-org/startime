"use client";

import { useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import type { TimeRange } from "~/server/api/routers/overview";
import { useRouter } from "next/navigation";

const timeRangeLabels: Record<TimeRange, string> = {
	past1: "Last 24 hours",
	past7: "Last 7 days",
	past30: "Last 30 days",
	past90: "Last 90 days",
	past365: "Last year",
	thisDay: "Today",
	thisWeek: "This week",
	thisMonth: "This month",
	thisYear: "This year",
	allTime: "All time",
};

export default function TimeSelect({ timeRange }: { timeRange: TimeRange }) {
	const [value, setValue] = useState(timeRange);
	const router = useRouter();

	const handleChange = (value: TimeRange) => {
		setValue(value);
		document.cookie = `startime_timeRange=${value}; path=/`;
		router.refresh();
	};

	return (
		<Select value={value} onValueChange={handleChange}>
			<SelectTrigger>
				<SelectValue fallback={timeRangeLabels[value]} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="allTime">All Time</SelectItem>
				<SelectGroup>
					<SelectLabel>Relative</SelectLabel>
					<SelectItem value="past1">Last 24 hours</SelectItem>
					<SelectItem value="past7">Last 7 days</SelectItem>
					<SelectItem value="past30">Last 30 days</SelectItem>
					<SelectItem value="past90">Last 90 days</SelectItem>
				</SelectGroup>
				<SelectGroup>
					<SelectLabel>Absolute</SelectLabel>
					<SelectItem value="thisDay">Today</SelectItem>
					<SelectItem value="thisWeek">This week</SelectItem>
					<SelectItem value="thisMonth">This month</SelectItem>
					<SelectItem value="thisYear">This year</SelectItem>
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
