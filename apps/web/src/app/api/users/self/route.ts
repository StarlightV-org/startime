import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "~/server/better-auth/auth";

export async function GET(req: NextRequest) {
	const apiKey = await checkApiKey(req);
	if (apiKey instanceof NextResponse) {
		return apiKey;
	}

	return NextResponse.json({ success: true });
}
