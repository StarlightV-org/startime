import { ENV } from "@startime/env";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
	const newUrl = new URL("/auth/error", ENV.BETTER_AUTH_URL);
	newUrl.searchParams.set("error", request.nextUrl.searchParams.get("error") ?? "");
	newUrl.searchParams.set("error_description", request.nextUrl.searchParams.get("error_description") ?? "");

	return Response.redirect(newUrl.toString());
}
