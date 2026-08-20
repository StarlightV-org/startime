import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkApiKey } from "~/server/better-auth/auth";
import { db, eventLogs } from "@startime/db";
import { inputEventLogSchema, outputEventLogSchema } from "@startime/zod";
import { createHmac } from "node:crypto";
import { ENV } from "@startime/env";
import { normalizeLanguageId, normalizePlatform } from "~/lib/api-lib";
import { op } from "~/lib/op";

export async function POST(req: NextRequest) {
	const apiKey = await checkApiKey(req);
	if (apiKey instanceof NextResponse) {
		return apiKey;
	}

	const body = await req.json();
	const parsed = inputEventLogSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
	}

	const fileName = "fileHash" in parsed.data ? parsed.data.fileHash : parsed.data.relativeFile;
	const fileHash = createHmac("sha256", ENV.FILE_HASH_KEY).update(fileName).digest("hex");

	const eventTime = new Date(parsed.data.eventTime);

	const log = await db
		.insert(eventLogs)
		.values({
			editor: parsed.data.editor,
			language: normalizeLanguageId(parsed.data.language),
			project: parsed.data.project,
			eventTime: eventTime,
			userId: apiKey.userId,
			fileHash: fileHash,
			platform: normalizePlatform(parsed.data.platform),
		})
		.returning()
		.onConflictDoNothing();

	if (log.length === 0) {
		return NextResponse.json(
			{ success: false },
			{
				// Rate limit exceeded
				status: 429,
				headers: {
					"Retry-After": "1000",
				},
			},
		);
	}

	Print.API("[event-log]", {
		userName: apiKey.user.email,
		editor: parsed.data.editor,
		language: normalizeLanguageId(parsed.data.language),
		project: parsed.data.project,
		eventTime: eventTime,
		platform: normalizePlatform(parsed.data.platform),
	});

	op.track("event-log", {
		profileId: apiKey.userId,
	});

	op.track("event-log:platform", {
		profileId: apiKey.userId,
		platform: normalizePlatform(parsed.data.platform),
	});

	op.track("event-log:editor", {
		profileId: apiKey.userId,
		editor: parsed.data.editor,
	});

	op.track("event-log:language", {
		profileId: apiKey.userId,
		language: normalizeLanguageId(parsed.data.language),
	});

	return NextResponse.json(outputEventLogSchema.parse({ success: true }));
}
