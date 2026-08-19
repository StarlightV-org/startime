"use client";

import type { OverviewTopElement } from "~/server/api/routers/overview";
import { Progress } from "../ui/progress";
import { cn } from "~/lib/utils";
import { FileIcons } from "./file-icons";
import { parseAsString, useQueryState } from "nuqs";
import { EditorIcon } from "./editor-icons";
import { getLanguageLabel } from "./language-lable";

export default function TopElement({
	element,
	isP1,
	filterKey,
	interactive = true,
}: {
	element: OverviewTopElement;
	isP1?: boolean;
	filterKey?: "editor" | "workspace" | "language" | "platform";
	interactive?: boolean;
}) {
	const [state, setState] = useQueryState(
		filterKey ?? "editor",
		parseAsString.withDefault("").withOptions({ history: "push", clearOnDefault: true }),
	);

	const isActiveFilter = state === element.value;

	return (
		<div
			className={cn(
				"flex flex-col rounded-sm p-1 hover:bg-accent",
				isActiveFilter && "shadow-[0_0_8px_rgba(0,0,0,0.3)] shadow-primary/80 outline outline-primary/80",
				interactive ? "cursor-pointer!" : "cursor-default!",
			)}
			aria-disabled={!interactive}
			role="button"
			onClick={async () => {
				if (!interactive) return;
				await setState((prev) => (prev !== element.value ? element.value : ""));
			}}
		>
			<div className="flex flex-row flex-nowrap items-center justify-start gap-1">
				<FileIcons language={element.value} />
				<EditorIcon editor={element.value} />

				<h3 className={cn("line-clamp-1 truncate text-[1rem]", isP1 ? "text-sidebar-primary" : "")} title={element.value}>
					{getLanguageLabel(element.value)}
				</h3>
			</div>
			<div className="flex flex-row items-center justify-between gap-1">
				<p className="line-clamp-1 min-w-fit text-xs">{element.time}</p>
				<span className="line-clamp-1 min-w-fit text-xs">{element.percentage}%</span>
			</div>
			<div className="flex flex-row items-center gap-1">
				<Progress value={element.percentage} />
			</div>
		</div>
	);
}
