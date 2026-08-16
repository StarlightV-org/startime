import { NextResponse, type NextRequest } from "next/server";
import z from "zod";
import { checkApiKey } from "~/server/better-auth/auth";
import { db, eventLogs } from "@startime/db";
import { createHmac } from "node:crypto";
import { ENV } from "@startime/env";

/**
 * This is a compatibility schema for the codetime.dev extentions
 */
const codeTimeSchema = z.object({
	editor: z.string(),
	language: z.string(),
	project: z.string(),
	eventTime: z.number(),
	eventType: z.string(),
	operationType: z.string(),
	relativeFile: z.string(),
	absoluteFile: z.string(),
	platform: z.string(),
});

export const eventLogSchema = z
	.object({
		/** the time the event occurred */
		eventTime: z.date(),
		/** the programming language used */
		language: z.string(),
		/** the project name */
		project: z.string(),
		/** the file hash, will be hashed again on the server */
		fileHash: z.string(),
		/** the editor used */
		editor: z.string(),
		/** the platform used */
		platform: z.string(),
	})
	.or(codeTimeSchema);

export async function POST(req: NextRequest) {
	const apiKey = await checkApiKey(req);
	if (apiKey instanceof NextResponse) {
		return apiKey;
	}

	const body = await req.json();
	const parsed = eventLogSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
	}

	Print.Debug("[event-log] parsed.data", parsed.data);

	const fileName = "fileHash" in parsed.data ? parsed.data.fileHash : parsed.data.relativeFile;
	const fileHash = createHmac("sha256", ENV.FILE_HASH_KEY).update(fileName).digest("hex");

	const eventTime = new Date(parsed.data.eventTime);

	const log = await db
		.insert(eventLogs)
		.values({
			editor: parsed.data.editor,
			language: parsed.data.language,
			project: parsed.data.project,
			eventTime: eventTime,
			userId: apiKey.userId,
			fileHash: fileHash,
			platform: parsed.data.platform,
		})
		.returning()
		.onConflictDoNothing();
	Print.Debug("[event-log] log", log);

	return NextResponse.json({ log: log });
}
