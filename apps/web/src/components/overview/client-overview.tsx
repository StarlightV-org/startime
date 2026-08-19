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
import { useEffect, useState, useTransition } from "react";
import { FileIcons } from "~/components/overview/file-icons";
import { useDocumentVisibility, useMounted } from "@mantine/hooks";
import { Button } from "~/components/ui/button";
import { differenceInSeconds } from "date-fns/fp";
import { Spinner } from "~/components/ui/spinner";
import { useRouter } from "next/navigation";

const isActiveFn = (isActive: boolean) => (isActive ? 1000 * 30 : 1000 * 60 * 2);

export default function RefetchOverview({ lastEvent }: { lastEvent: API["overview"]["getActivity"]["lastEvent"] }) {
	const router = useRouter();
	const documentState = useDocumentVisibility();
	const isMounted = useMounted();

	const [interval, setIntervalState] = useState<NodeJS.Timeout | null>(null);

	const isActive = differenceInSeconds(lastEvent?.eventTime ?? 0, new Date()) <= 120;

	useEffect(() => {
		if (!isMounted) return;
		interval && clearInterval(interval);

		if (documentState === "hidden" && interval) {
			Print.Debug("RefetchOverview", "Stopping interval");
			clearInterval(interval);
			setIntervalState(null);
			return;
		} else if (documentState === "visible") {
			Print.Debug("RefetchOverview", "Refreshing after visibility change");
			router.refresh();
		}

		Print.Debug("RefetchOverview", "Starting interval");

		setIntervalState(
			setInterval(() => {
				Print.Debug("Refetching overview", { isActive });
				router.refresh();
			}, isActiveFn(isActive)),
		);

		return () => (interval ? clearInterval(interval) : void 0);
	}, [isActive, documentState, isMounted]);

	return null;
}

export function ActivityIndicator({
	lastEvent,
	interactive = true,
}: {
	lastEvent: API["overview"]["getActivity"]["lastEvent"];
	interactive?: boolean;
}) {
	const [_, setWorkspace] = useQueryState(
		"workspace",
		parseAsString.withDefault("").withOptions({ clearOnDefault: true, history: "push" }),
	);
	const isActive = differenceInSeconds(lastEvent?.eventTime ?? 0, new Date()) <= 120;
	const router = useRouter();

	if (!isActive) return null;

	return (
		<div className="flex items-center gap-1">
			<CircleIcon className="size-3 animate-pulse fill-primary text-primary drop-shadow-[0_0_4px_var(--sidebar-primary)]" />
			<FileIcons language={lastEvent?.language ?? ""} />
			<span> - </span>
			<span className="text-sm text-muted-foreground">
				Working on{" "}
				<Button
					inert={!interactive}
					variant="link"
					className="px-0.5 py-0 text-sm hover:no-underline"
					onClick={async () => {
						await setWorkspace((prev) => (prev !== lastEvent?.project ? lastEvent?.project! : ""));
						router.refresh();
					}}
				>
					{lastEvent?.project ?? "—"}
				</Button>
			</span>
		</div>
	);
}

export function RefetchOverviewButton() {
	const router = useRouter();
	const [isRefreshing, startRefresh] = useTransition();

	return (
		<Button variant="ghost" onClick={() => startRefresh(() => router.refresh())} size="icon-sm" disabled={isRefreshing}>
			{isRefreshing ? <Spinner className="size-4" /> : <RefreshCwIcon className="size-4" />}
		</Button>
	);
}
