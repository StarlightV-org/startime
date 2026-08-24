"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect } from "react";
import { Button } from "../ui/button";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";

const filterLabels = {
	editor: msg`Editor`,
	workspace: msg`Workspace`,
	language: msg`Language`,
	platform: msg`Platform`,
};

export default function FilterView() {
	const [state, setState] = useQueryStates({
		editor: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
		workspace: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
		language: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
		platform: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
	});

	const router = useRouter();

	useEffect(() => {
		setTimeout(() => {
			router.refresh();
		}, 100);
	}, [state.editor, state.workspace, state.language, state.platform]);

	const filters = [
		{ filter: "editor", val: state.editor },
		{ filter: "workspace", val: state.workspace },
		{ filter: "language", val: state.language },
		{ filter: "platform", val: state.platform },
	].filter((f) => f.val !== "");

	return (
		<div className="max-h-8">
			{filters.map((f) => (
				<Badge key={f.filter} filter={f.filter as keyof typeof filterLabels} val={f.val} setState={setState} />
			))}
		</div>
	);
}

function Badge({
	filter,
	val,
	setState,
}: {
	filter: keyof typeof filterLabels;
	val: string;
	setState: (state: { [key: string]: string }) => void;
}) {
	const { i18n } = useLingui();

	return (
		<div className="inline-flex max-h-8 items-center rounded-lg border px-2 py-1">
			<Button size="icon-xs" variant="ghost" onClick={() => setState({ [filter]: "" })}>
				<XIcon className="inline size-4" />
			</Button>
			<span>{`${i18n._(filterLabels[filter])}: ${val}`}</span>
		</div>
	);
}


