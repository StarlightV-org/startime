"use client";

import { XIcon } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useTransition } from "react";

import { Button } from "../ui/button";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";

const filterLabels = {
	editor: msg`Editor`,
	workspace: msg`Workspace`,
	language: msg`Language`,
	platform: msg`Platform`,
	user: msg`User`,
};

export default function FilterView() {
	const [, startTransition] = useTransition();
	const [state, setState] = useQueryStates(
		{
			editor: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
			workspace: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
			language: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
			platform: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
			user: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
		},
		{ shallow: false, scroll: false, startTransition },
	);

	const clearFilter = (filter: keyof typeof filterLabels) => {
		void setState({ [filter]: "" });
	};

	const filters = [
		{ filter: "editor", val: state.editor },
		{ filter: "workspace", val: state.workspace },
		{ filter: "language", val: state.language },
		{ filter: "platform", val: state.platform },
		{ filter: "user", val: state.user },
	].filter((f) => f.val !== "");

	return (
		<div className="max-h-8">
			{filters.map((f) => (
				<Badge key={f.filter} filter={f.filter as keyof typeof filterLabels} val={f.val} clearFilter={clearFilter} />
			))}
		</div>
	);
}

function Badge({
	filter,
	val,
	clearFilter,
}: {
	filter: keyof typeof filterLabels;
	val: string;
	clearFilter: (filter: keyof typeof filterLabels) => void;
}) {
	const { i18n } = useLingui();

	return (
		<div className="inline-flex max-h-8 items-center rounded-lg border px-2 py-1">
			<Button size="icon-xs" variant="ghost" onClick={() => clearFilter(filter)}>
				<XIcon className="inline size-4" />
			</Button>
			<span>{`${i18n._(filterLabels[filter])}: ${val}`}</span>
		</div>
	);
}
