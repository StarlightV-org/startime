import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkApiKey } from "~/server/better-auth/auth";
import { db, eventLogs } from "@startime/db";
import { inputEventLogSchema, outputEventLogSchema } from "@startime/zod";
import { createHmac } from "node:crypto";
import { ENV } from "@startime/env";
import { normalizeLanguageId, normalizePlatform } from "~/lib/api-lib";
import { op } from "~/lib/op";
import { checkRateLimit } from "~/server/redis/rate-limit";
import { cacheKey } from "~/lib/cache-key";
import { formatRetryAfter } from "~/lib/rateLimit";

export async function POST(req: NextRequest) {
	const apiKey = await checkApiKey(req);
	if (apiKey instanceof NextResponse) {
		return apiKey;
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const parsed = inputEventLogSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
	}

	const result = await checkRateLimit({
		userId: apiKey.userId,
		resource: `api:event-log:${cacheKey({ editor: parsed.data.editor })}`,
		cooldownMs: 1_000,
	});

	if (!result.ok) {
		Print.Fail({
			message: "Rate limit exceeded",
			userId: apiKey.userId,
			resource: `api:event-log:${cacheKey({ editor: parsed.data.editor })}`,
			retryAfterMs: formatRetryAfter(result.retryAfterMs),
		});
		return NextResponse.json(
			{ error: "Rate limit exceeded", retryAfterMs: formatRetryAfter(result.retryAfterMs) },
			{ status: 429, headers: { "Retry-After": String(result.retryAfterMs) } },
		);
	}

	const fileName = "fileHash" in parsed.data ? parsed.data.fileHash : parsed.data.relativeFile;
	const fileHash = createHmac("sha256", ENV.FILE_HASH_KEY).update(fileName).digest("hex");

	const eventTime = new Date(parsed.data.eventTime ?? new Date());

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
		name: apiKey.user.name,
		mail: apiKey.user.email,
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
