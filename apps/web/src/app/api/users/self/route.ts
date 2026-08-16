import { type NextRequest, NextResponse } from "next/server";
import { outputSelfSchema } from "@startime/zod";
import { checkApiKey } from "~/server/better-auth/auth";

export async function GET(req: NextRequest) {
	const apiKey = await checkApiKey(req);
	if (apiKey instanceof NextResponse) {
		return apiKey;
	}

	return NextResponse.json(outputSelfSchema.parse({ success: true }));
}
