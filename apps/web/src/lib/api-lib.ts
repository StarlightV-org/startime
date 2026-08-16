import type { NextRequest } from "next/server";

export function isCompatibilityMode(req: NextRequest) {
	const headers = req.headers;

	const compatibilityMode = headers.get("x-compatibility-mode") === "true";

	return compatibilityMode;
}

const languageIdMap: Record<string, string[]> = {
	javascript: ["js", "javascript"],
	javascriptreact: ["jsx", "javascriptreact"],
	typescript: ["ts", "typescript"],
	typescriptreact: ["tsx", "typescriptreact"],
	markdown: ["md", "markdown"],
};

export function normalizeLanguageId(languageId: string): string {
	const entry = Object.entries(languageIdMap).find(([, ids]) => ids.includes(languageId));

	return entry ? entry[0] : languageId;
}
