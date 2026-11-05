"use client";

import { Trans } from "@lingui/react/macro";
import type { OverviewTopElement } from "~/server/api/routers/overview";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { cn } from "~/lib/utils";
import { FileIcons } from "./file-icons";
import { parseAsString, useQueryState } from "nuqs";
import { useTransition } from "react";
import { EditorIcon } from "./editor-icons";
import { getLanguageLabel } from "./language-lable";
import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export default function TopElement({
	element,
	isP1,
	filterKey,
	interactive = true,
}: {
	element: OverviewTopElement & {
		image?: string | null;
		shareAllTime?: boolean;
	};
	isP1?: boolean;
	filterKey?: "editor" | "workspace" | "language" | "platform" | "user";
	interactive?: boolean;
}) {
	const [, startTransition] = useTransition();
	const [state, setState] = useQueryState(
		filterKey ?? "editor",
		parseAsString.withDefault("").withOptions({
			history: "push",
			clearOnDefault: true,
			shallow: false,
			scroll: false,
			startTransition,
		}),
	);

	const isActiveFilter = state === element.value;
	const isUser = filterKey === "user";
	const initials = element.value
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<div
			className={cn(
				"group @container/top-element",
				"flex min-w-0 flex-col gap-1.5 rounded-lg p-2 transition-colors",
				isActiveFilter && interactive && "bg-accent ring-1 ring-ring",
				interactive ? "cursor-pointer hover:bg-accent" : "cursor-default",
			)}
			aria-disabled={!interactive}
			role="button"
			tabIndex={interactive ? 0 : undefined}
			aria-pressed={interactive ? isActiveFilter : undefined}
			onKeyDown={(event) => {
				if (interactive && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
					event.preventDefault();
					void setState((prev) => (prev !== element.value ? element.value : ""));
				}
			}}
			onClick={() => {
				if (!interactive) return;
				void setState((prev) => (prev !== element.value ? element.value : ""));
			}}
		>
			<div className="flex flex-row flex-nowrap items-center justify-between gap-2">
				<div className="flex min-w-0 flex-row items-center gap-1.5">
					{isUser ? (
						<Avatar className="size-5">
							<AvatarImage src={element.image ?? undefined} alt={element.value} />
							<AvatarFallback visible={!element.image}>{initials}</AvatarFallback>
						</Avatar>
					) : (
						<>
							<FileIcons language={element.value} />
							<EditorIcon editor={element.value} />
						</>
					)}

					<h3
						className={cn("truncate text-sm font-medium", isP1 ? "text-sidebar-primary" : "text-foreground")}
						title={element.value}
					>
						{getLanguageLabel(element.value)}
					</h3>
				</div>
				{isUser && !element.shareAllTime && (
					<Tooltip>
						<TooltipTrigger onClick={(event) => event.stopPropagation()}>
							<InfoIcon className="size-4 cursor-help" />
						</TooltipTrigger>
						<TooltipContent>
							<Trans>
								This user has not shared their all-time data. <br />
								So the time shown is only for they assigned to the organization.
							</Trans>
						</TooltipContent>
					</Tooltip>
				)}
			</div>
			<div className="flex flex-row items-center justify-between gap-1">
				<p className="line-clamp-1 min-w-fit text-xs">{element.time}</p>
				<span className="line-clamp-1 min-w-fit text-xs">{element.percentage}%</span>
			</div>
			<div className="flex flex-row items-center gap-1">
				<Progress value={element.percentage} className="w-full" />
			</div>
		</div>
	);
}
