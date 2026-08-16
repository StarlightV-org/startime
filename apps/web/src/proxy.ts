import { NextResponse } from "next/server";
import type { NextProxy, NextRequest, ProxyConfig } from "next/server";
import { getAuth } from "~/server/better-auth";

// This function can be marked `async` if using `await` inside
export async function proxy(request: NextRequest) {
	if (request.nextUrl.pathname === "/v3" || request.nextUrl.pathname.startsWith("/v3/")) {
		const url = request.nextUrl.clone();
		url.pathname = url.pathname.replace(/^\/v3(?=\/|$)/, "/api");

		const response = NextResponse.rewrite(url);
		response.headers.set("x-compatibility-mode", "true");

		return response;
	}

	const { session } = await getAuth();

	const isProtected = request.nextUrl.pathname.startsWith("/dash");

	if (!session && isProtected) {
		return NextResponse.redirect(new URL("/auth/signin", request.url));
	}

	if (request.nextUrl.pathname.startsWith("/auth") && request.nextUrl.pathname !== "/auth/reauth" && session?.id) {
		return NextResponse.redirect(new URL("/dash", request.url));
	}

	return NextResponse.next();
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
	matcher: ["/v3/:path*", "/dash/:path*", "/auth/:path*", "/"],
} as ProxyConfig;
