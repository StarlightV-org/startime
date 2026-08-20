"use client";

import { useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import type { BiggestUnit, TimeRange } from "~/server/api/routers/overview";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Trans, useLingui } from "@lingui/react/macro";

export function TimeSelect({ timeRange }: { timeRange: TimeRange }) {
	const [value, setValue] = useState(timeRange);
	const router = useRouter();
	const { t } = useLingui();
	// const utils = api.useUtils();

	const handleChange = (value: TimeRange) => {
		setValue(value);
		// biome-ignore lint/suspicious/noDocumentCookie: i want to set a cookie so the client has access to the value
		document.cookie = `startime_timeRange=${value}; path=/`;
		// utils.overview.invalidate();
		router.refresh();
	};

	const timeRangeLabels: Record<TimeRange, string> = {
		past1: t`Last 24 hours`,
		past7: t`Last 7 days`,
		past30: t`Last 30 days`,
		past90: t`Last 90 days`,
		past365: t`Last 365 days`,
		thisDay: t`Today`,
		thisWeek: t`This week`,
		thisMonth: t`This month`,
		thisYear: t`This year`,
		allTime: t`All Time`,
	};

	return (
		<Select value={value} onValueChange={handleChange}>
			<SelectTrigger>
				<SelectValue fallback={timeRangeLabels[value]} />
			</SelectTrigger>
			<SelectContent position={"popper"}>
				<SelectGroup>
					<SelectLabel>Relative</SelectLabel>
					<SelectItem value="past1">
						<Trans>Last 24 hours</Trans>
					</SelectItem>
					<SelectItem value="past7">
						<Trans>Last 7 days</Trans>
					</SelectItem>
					<SelectItem value="past30">
						<Trans>Last 30 days</Trans>
					</SelectItem>
					<SelectItem value="past90">
						<Trans>Last 90 days</Trans>
					</SelectItem>
					<SelectItem value="past365">
						<Trans>Last 365 days</Trans>
					</SelectItem>
				</SelectGroup>
				<SelectGroup>
					<SelectLabel>
						<Trans>Absolute</Trans>
					</SelectLabel>
					<SelectItem value="thisDay">
						<Trans>Today</Trans>
					</SelectItem>
					<SelectItem value="thisWeek">
						<Trans>This week</Trans>
					</SelectItem>
					<SelectItem value="thisMonth">
						<Trans>This month</Trans>
					</SelectItem>
					<SelectItem value="thisYear">
						<Trans>This year</Trans>
					</SelectItem>
					<SelectItem value="allTime">
						<Trans>All Time</Trans>
					</SelectItem>
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

export function BiggestUnitSelect({ biggestUnit }: { biggestUnit: BiggestUnit }) {
	const [value, setValue] = useState(biggestUnit);
	const router = useRouter();
	const { t } = useLingui();
	// const utils = api.useUtils();

	const handleChange = (value: NonNullable<BiggestUnit>) => {
		setValue(value);
		// biome-ignore lint/suspicious/noDocumentCookie: i want to set a cookie so the client has access to the value
		document.cookie = `startime_biggestUnit=${value}; path=/`;
		router.refresh();
		// utils.overview.invalidate();
	};

	const biggestUnitLabels: Record<NonNullable<BiggestUnit>, string> = {
		hour: t`Hour`,
		day: t`Day`,
		week: t`Week`,
	};
	return (
		<Select value={value} onValueChange={handleChange}>
			<SelectTrigger className="min-w-max">
				<SelectValue fallback={biggestUnitLabels[value ?? "day"]} />
			</SelectTrigger>
			<SelectContent position={"popper"}>
				<SelectGroup>
					<SelectLabel>
						<Trans>Biggest Unit</Trans>
					</SelectLabel>
					<SelectItem value="hour">
						<Trans>Hour</Trans>
					</SelectItem>
					<SelectItem value="day">
						<Trans>Day</Trans>
					</SelectItem>
					<SelectItem value="week">
						<Trans>Week</Trans>
					</SelectItem>
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
