"use client";

import {
	BracketsIcon,
	CircleIcon,
	CodeXmlIcon,
	ComputerIcon,
	FolderIcon,
	InfoIcon,
	PencilIcon,
	RefreshCwIcon,
	StarIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { API } from "~/trpc/server";
import { TopElement } from "~/components/overview";
import { api } from "~/trpc/react";
import { parseAsString, useQueryState, useQueryStates } from "nuqs";
import type { BiggestUnit, TimeRange } from "~/server/api/routers/overview";
import { useEffect, useState } from "react";
import { FileIcons } from "~/components/overview/file-icons";
import { useDocumentVisibility } from "@mantine/hooks";
import { Button } from "~/components/ui/button";
import { differenceInSeconds } from "date-fns/fp";
import { Spinner } from "~/components/ui/spinner";

const isActiveFn = (isActive: boolean) => (isActive ? 1000 * 30 : 1000 * 60 * 2);

export default function ClientOverview({
	activity: initialActivity,
	top: initialTop,
	biggestUnit,
	timeRange,
}: {
	activity: API["overview"]["getActivity"];
	top: API["overview"]["getTop"];
	biggestUnit: BiggestUnit;
	timeRange: TimeRange;
}) {
	const documentState = useDocumentVisibility();
	const utils = api.useUtils();
	const [state] = useQueryStates({
		editor: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
		workspace: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
		language: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
		platform: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	});

	const [_, setWorkspace] = useQueryState(
		"workspace",
		parseAsString.withDefault("").withOptions({ clearOnDefault: true, history: "push" }),
	);

	const [isActive, setIsActive] = useState(
		differenceInSeconds(initialActivity.lastEvent?.eventTime ?? 0, new Date()) <= 120,
	);

	const {
		data: activity,
		isRefetching: isRefetchingActivity,
		refetch: refetchActivity,
	} = api.overview.getActivity.useQuery(
		{
			timeRange: timeRange ?? "past30",
			biggestUnit: biggestUnit ?? "day",
		},
		{
			initialData: initialActivity,
			enabled: documentState === "visible",
			refetchInterval: isActiveFn(isActive),
		},
	);
	const { data: top, refetch: refetchTop } = api.overview.getTop.useQuery(
		{
			filter: state,
			timeRange: timeRange ?? "past30",
			biggestUnit: biggestUnit ?? "day",
		},
		{
			initialData: initialTop,
			enabled: documentState === "visible",
			refetchInterval: isActiveFn(isActive),
		},
	);

	useEffect(() => {
		if (isRefetchingActivity) return;
		const isActive = differenceInSeconds(activity.lastEvent?.eventTime ?? 0, new Date()) <= 120;
		setIsActive(isActive);
	}, [isRefetchingActivity]);

	useEffect(() => {
		if (documentState === "visible") {
			refetchOverview();
		}
	}, [documentState]);
	useEffect(() => {
		utils.overview.getActivity.setData(
			{
				timeRange: timeRange ?? "past30",
				biggestUnit: biggestUnit ?? "day",
			},
			initialActivity,
		);
		utils.overview.getTop.setData(
			{
				filter: state,
				timeRange: timeRange ?? "past30",
				biggestUnit: biggestUnit ?? "day",
			},
			initialTop,
		);
	}, [timeRange, biggestUnit]);

	const refetchOverview = () => Promise.all([refetchActivity(), refetchTop()]);

	return (
		<>
			<Card>
				<CardContent>
					<CardHeader className="flex flex-row items-center justify-between gap-2">
						<CardTitle className="h-8">Activity </CardTitle>
						{isActive && (
							<div className="flex items-center gap-1">
								<CircleIcon className="size-3 animate-pulse fill-primary text-primary drop-shadow-[0_0_4px_var(--sidebar-primary)]" />
								<FileIcons language={activity?.lastEvent?.language ?? ""} />
								<span> - </span>
								<span className="text-sm text-muted-foreground">
									Working on{" "}
									<Button
										variant="link"
										className="px-0.5 py-0 text-sm hover:bg-accent hover:no-underline"
										onClick={async () => {
											setWorkspace((prev) => (prev !== activity?.lastEvent?.project ? activity?.lastEvent?.project! : ""));
											refetchOverview();
										}}
									>
										{activity?.lastEvent?.project ?? "—"}
									</Button>
								</span>
							</div>
						)}
					</CardHeader>
					<CardDescription className="grid grid-cols-4 divide-x divide-border">
						<div className="col-span-1 flex flex-col pr-4 first:pl-0">
							<h3 className="text-sm text-sidebar-primary">Time/Total</h3>
							<p className="text-xl text-primary-foreground">{activity?.timeTotal ?? "—"}</p>
						</div>
						<div className="col-span-1 flex flex-col px-4">
							<h3 className="text-sm text-sidebar-primary">Time/Today</h3>
							<p className="text-xl text-primary-foreground">{activity?.timeToday ?? "—"}</p>
						</div>
						<div className="col-span-1 flex flex-col px-4">
							<h3 className="text-sm text-sidebar-primary">Streak/Current</h3>
							<p className="text-xl text-primary-foreground">{activity?.currentStreak ?? "—"}</p>
						</div>
						<div className="col-span-1 flex flex-col pl-4">
							<h3 className="text-sm text-sidebar-primary">Streak/Max</h3>
							<p className="text-xl text-primary-foreground">{activity?.allTimeStreak ?? "—"}</p>
						</div>
					</CardDescription>
				</CardContent>
			</Card>
			<Card>
				<CardContent>
					<CardHeader className="flex items-center justify-between">
						<CardTitle>Top</CardTitle>
						<div className="flex items-center">
							<Button variant="ghost" onClick={() => utils.overview.invalidate()}>
								{isRefetchingActivity ? <Spinner className="size-5" /> : <RefreshCwIcon className="size-5" />}
							</Button>

							<Dialog>
								<DialogTrigger asChild>
									<InfoIcon className="size-5 cursor-pointer" />
								</DialogTrigger>
								<DialogContent>
									<DialogTitle>Calculations</DialogTitle>
									<span className="text-sm text-pretty text-muted-foreground">
										Total time counts each active minute once. <br />
										If you switch workspace or language within a minute, that same minute is counted for every matching category.{" "}
										<br />
										So category times and percentages can exceed 100%.
									</span>
								</DialogContent>
							</Dialog>
						</div>
					</CardHeader>
					<CardDescription className="grid grid-cols-4 gap-x-2 divide-x divide-border">
						<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
							<div className="flex items-center gap-2">
								<PencilIcon className="size-4" />
								<h3 className="y text-sm">Editor</h3>
							</div>
							{top &&
								Object.entries(top.editor)
									.filter(([, item]) => item.value !== "")
									.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} />)}
						</div>
						<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
							<div className="flex items-center gap-2">
								<FolderIcon className="size-4" />
								<h3 className="y text-sm">Workspace</h3>
							</div>
							{top &&
								Object.entries(top.workspace)
									.filter(([, item]) => item.value !== "")
									.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="workspace" />)}
						</div>
						<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
							<div className="flex items-center gap-2">
								<CodeXmlIcon className="size-4" />
								<h3 className="y text-sm">Language</h3>
							</div>
							{top &&
								Object.entries(top.language)
									.filter(([, item]) => item.value !== "")
									.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="language" />)}
						</div>
						<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
							<div className="flex items-center gap-2">
								<ComputerIcon className="size-4" />
								<h3 className="y text-sm">Platform</h3>
							</div>
							{top &&
								Object.entries(top.platform)
									.filter(([, item]) => item.value !== "")
									.map(([key, item]) => <TopElement key={key} element={item} isP1={key === "p1"} filterKey="platform" />)}
						</div>
					</CardDescription>
				</CardContent>
			</Card>
		</>
	);
}
