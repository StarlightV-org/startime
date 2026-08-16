import type { ComponentType, SVGProps } from "react";
import { Intellijidea } from "../ui/svgs/intellijidea";
import { Neovim } from "../ui/svgs/neovim";
import { Obsidian } from "../ui/svgs/obsidian";
import { Vim } from "../ui/svgs/vim";
import { VisualStudio } from "../ui/svgs/visualStudio";
import { Vscode } from "../ui/svgs/vscode";
import { ZedLogo } from "../ui/svgs/zedLogo";
import { CursorDark } from "../ui/svgs/cursorDark";
import { CursorLight } from "../ui/svgs/cursorLight";
import { Webstorm } from "../ui/svgs/webstorm";

const defaultClassName = "size-4";

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

type EditorName =
	"vscode" | "visual-studio" | "cursor" | "vim" | "neovim" | "obsidian" | "intellij-idea" | "zed" | "webstorm";

const editorIcons: Record<EditorName, SvgIcon> = {
	vscode: Vscode,
	"visual-studio": VisualStudio,
	cursor: CursorLight,
	vim: Vim,
	neovim: Neovim,
	obsidian: Obsidian,
	"intellij-idea": Intellijidea,
	zed: ZedLogo,
	webstorm: Webstorm,
};

const editorAliases: Record<string, EditorName> = {
	"visual-studio-code": "vscode",
	"vs-code": "vscode",
	intellijidea: "intellij-idea",
};

function getEditorName(editor: string): EditorName | undefined {
	const normalizedEditor = editor
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, "-");

	if (normalizedEditor in editorIcons) {
		return normalizedEditor as EditorName;
	}

	return editorAliases[normalizedEditor];
}

export function EditorIcon({ editor, className = defaultClassName }: { editor: string; className?: string }) {
	const editorName = getEditorName(editor);

	if (!editorName) {
		return null;
	}

	const Icon = editorIcons[editorName];

	return <Icon className={className} />;
}
