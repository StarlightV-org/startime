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
import { strFromU8, unzlibSync } from "fflate/node";

export async function POST(req: NextRequest) {
	const apiKey = await checkApiKey(req);
	if (apiKey instanceof NextResponse) {
		return apiKey;
	}

	if (req.headers.get("content-type") !== "application/json") {
		return NextResponse.json(
			{
				error: "Invalid content type",
				expected: "application/json",
				actual: req.headers.get("content-type"),
			},
			{ status: 400 },
		);
	}
	if (req.headers.get("content-encoding") !== "zlib") {
		return NextResponse.json(
			{
				error: "Invalid content encoding",
				expected: "zlib",
				actual: req.headers.get("content-encoding"),
			},
			{ status: 400 },
		);
	}

	Print.Debug(req.headers.get("content-length"));

	let body: unknown;
	try {
		body = await req.arrayBuffer();
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}

	const uncompressed = unzlibSync(new Uint8Array(body as ArrayBuffer));
	const data = JSON.parse(strFromU8(uncompressed));

	// const parsed = inputEventLogSchema.safeParse(uncompressed);
	const parsed = z.array(inputEventLogSchema).safeParse(data);
	if (!parsed.success) {
		return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
	}

	Print.Debug(parsed);

	const result = await checkRateLimit({
		userId: apiKey.userId,
		resource: `api:event-log:batch:${cacheKey({ editor: parsed.data[0]!.editor })}`,
		cooldownMs: 1_000,
	});

	if (!result.ok) {
		Print.Fail({
			message: "Rate limit exceeded",
			userId: apiKey.userId,
			resource: `api:event-log:batch:${cacheKey({ editor: parsed.data[0]!.editor })}`,
			retryAfterMs: formatRetryAfter(result.retryAfterMs),
		});
		return NextResponse.json(
			{ error: "Rate limit exceeded", retryAfterMs: formatRetryAfter(result.retryAfterMs) },
			{ status: 429, headers: { "Retry-After": String(result.retryAfterMs) } },
		);
	}

	await db.transaction(async (tx) => {
		const data = [];

		for (const log of parsed.data) {
			const fileName = "fileHash" in log ? log.fileHash : log.relativeFile;
			const fileHash = createHmac("sha256", ENV.FILE_HASH_KEY).update(fileName).digest("hex");
			const eventTime = new Date(log.eventTime ?? new Date());

			// op.track("event-log", {
			// 	profileId: apiKey.userId,
			// });

			// op.track("event-log:platform", {
			// 	profileId: apiKey.userId,
			// 	platform: normalizePlatform(log.platform),
			// });

			// op.track("event-log:editor", {
			// 	profileId: apiKey.userId,
			// 	editor: log.editor,
			// });

			// op.track("event-log:language", {
			// 	profileId: apiKey.userId,
			// 	language: normalizeLanguageId(log.language),
			// });

			data.push({
				editor: log.editor,
				language: normalizeLanguageId(log.language),
				project: log.project,
				eventTime: eventTime,
				userId: apiKey.userId,
				fileHash: fileHash,
				platform: normalizePlatform(log.platform),
			});
		}

		const result = await tx.insert(eventLogs).values(data).returning().onConflictDoNothing();

		Print.Debug(result.length);
	});

	// const fileName = "fileHash" in parsed.data ? parsed.data.fileHash : parsed.data.relativeFile;
	// const fileHash = createHmac("sha256", ENV.FILE_HASH_KEY).update(fileName).digest("hex");

	// const eventTime = new Date(parsed.data.eventTime ?? new Date());

	// const log = await db
	// 	.insert(eventLogs)
	// 	.values({
	// 		editor: parsed.data.editor,
	// 		language: normalizeLanguageId(parsed.data.language),
	// 		project: parsed.data.project,
	// 		eventTime: eventTime,
	// 		userId: apiKey.userId,
	// 		fileHash: fileHash,
	// 		platform: normalizePlatform(parsed.data.platform),
	// 	})
	// 	.returning()
	// 	.onConflictDoNothing();

	// if (log.length === 0) {
	// 	return NextResponse.json(
	// 		{ success: false },
	// 		{
	// 			// Rate limit exceeded
	// 			status: 429,
	// 			headers: {
	// 				"Retry-After": "1000",
	// 			},
	// 		},
	// 	);
	// }

	// Print.API("[event-log]", {
	// 	name: apiKey.user.name,
	// 	mail: apiKey.user.email,
	// 	editor: parsed.data.editor,
	// 	language: normalizeLanguageId(parsed.data.language),
	// 	project: parsed.data.project,
	// 	eventTime: eventTime,
	// 	platform: normalizePlatform(parsed.data.platform),
	// });

	// op.track("event-log", {
	// 	profileId: apiKey.userId,
	// });

	// op.track("event-log:platform", {
	// 	profileId: apiKey.userId,
	// 	platform: normalizePlatform(parsed.data.platform),
	// });

	// op.track("event-log:editor", {
	// 	profileId: apiKey.userId,
	// 	editor: parsed.data.editor,
	// });

	// op.track("event-log:language", {
	// 	profileId: apiKey.userId,
	// 	language: normalizeLanguageId(parsed.data.language),
	// });

	return NextResponse.json(outputEventLogSchema.parse({ success: true }));
}
