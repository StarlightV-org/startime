import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkApiKey } from "~/server/better-auth/auth";
import { db, eventLogs } from "@startime/db";
import { inputEventLogSchema, outputEventLogSchema } from "@startime/zod";
import { createHmac } from "node:crypto";
import { ENV } from "@startime/env";
import { normalizeLanguageId } from "~/lib/api-lib";
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
			platform: parsed.data.platform,
		})
		.returning()
		.onConflictDoNothing();

	op.track("event-log", {
		profileId: apiKey.userId,
		platform: parsed.data.platform,
		editor: parsed.data.editor,
		language: parsed.data.language,
	});

	return NextResponse.json(
		outputEventLogSchema.parse({
			log: log.map((event) => ({
				...event,
				eventTime: event.eventTime.toISOString(),
				createdAt: event.createdAt.toISOString(),
			})),
		}),
	);
}
