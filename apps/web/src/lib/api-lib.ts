import type { NextRequest } from "next/server";

export function isCompatibilityMode(req: NextRequest) {
	const headers = req.headers;

	const compatibilityMode = headers.get("x-compatibility-mode") === "true";

	return compatibilityMode;
}
