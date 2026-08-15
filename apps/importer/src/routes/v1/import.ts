import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, eventImports, eventLogs, files } from "@startime/db";
import { ENV } from "@startime/env";
import { verifyInternalRequest } from "@startime/service-auth";
import { getFormat, type ImportedEvent } from "../../formats";
import { utapi } from "../..";
import { wait, type JsonBody } from "../../server";

const importRequestSchema = z.object({
	importId: z.string().min(1),
	fileKey: z.string().min(1),
	format: z.string().min(1),
});

const activeImports = new Set<string>();
const DOWNLOAD_DELAY_MS = 5_000;
const MAX_DOWNLOAD_ATTEMPTS = 3;

async function updateImport(
	importId: string,
	values: Partial<{
		status: "pending" | "completed" | "failed";
		message: string;
		totalRows: number;
		processedRows: number;
	}>,
): Promise<void> {
	await db.update(eventImports).set(values).where(eq(eventImports.id, importId));
}

async function deleteImportFile(fileId: string, fileKey: string): Promise<void> {
	try {
		await utapi.deleteFiles(fileKey);
		await db.delete(files).where(eq(files.id, fileId));
		Print.Debug("Deleted imported file", { fileId });
	} catch (error) {
		Print.Error("Unable to delete imported file", { fileId, error });
	}
}

async function processImport(importId: string, fileKey: string, formatId: string): Promise<void> {
	let processedRows = 0;
	let totalRows = 0;
	let importFile: { id: string; fileKey: string } | undefined;
	try {
		const eventImport = await db.query.eventImports.findFirst({
			where: (imports, { eq: equals }) => equals(imports.id, importId),
			columns: { userId: true },
			with: { importFile: { columns: { id: true, fileKey: true } } },
		});
		if (!eventImport?.importFile) throw new Error("Import file record not found");
		if (eventImport.importFile.fileKey !== fileKey) throw new Error("Import file key does not match the import record");
		importFile = eventImport.importFile;

		await updateImport(importId, { status: "pending", message: "Import dispatched" });
		await wait(DOWNLOAD_DELAY_MS);

		let contents: string | undefined;
		for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
			await updateImport(importId, {
				status: "pending",
				message: `Downloading import file (attempt ${attempt} of ${MAX_DOWNLOAD_ATTEMPTS})`,
			});
			const { ufsUrl: downloadUrl } = await utapi.generateSignedURL(fileKey, { expiresIn: 60 * 60 });
			const response = await fetch(downloadUrl, { redirect: "error" });
			if (!response.ok) throw new Error(`File download failed with ${response.status}`);

			const contentLength = Number(response.headers.get("content-length"));
			if (Number.isFinite(contentLength) && contentLength > 64 * 1024 * 1024)
				throw new Error("File exceeds the 64 MB import limit");

			const downloadedContents = await response.text();
			if (new TextEncoder().encode(downloadedContents).byteLength > 64 * 1024 * 1024)
				throw new Error("File exceeds the 64 MB import limit");
			const leadingContent = downloadedContents.trimStart().slice(0, 32).toLowerCase();
			const isHtml = leadingContent.startsWith("<!doctype html") || leadingContent.startsWith("<html");
			if (!isHtml) {
				contents = downloadedContents;
				await updateImport(importId, { status: "pending", message: "CSV downloaded; validating rows" });
				break;
			}

			if (attempt === MAX_DOWNLOAD_ATTEMPTS) {
				throw new Error(`UploadThing returned HTML instead of CSV after ${MAX_DOWNLOAD_ATTEMPTS} attempts`);
			}
			await updateImport(importId, {
				status: "pending",
				message: `UploadThing returned HTML on attempt ${attempt}; retrying in 5 seconds`,
			});
			await wait(DOWNLOAD_DELAY_MS);
		}
		if (!contents) throw new Error("CSV download did not return any content");

		const events = getFormat(formatId).parse(contents, ENV.FILE_HASH_KEY);
		totalRows = events.length;
		await updateImport(importId, { totalRows, processedRows, status: "pending", message: `Validated ${totalRows} rows` });

		for (let index = 0; index < events.length; index += 500) {
			const batch: ImportedEvent[] = events.slice(index, index + 500);
			processedRows += batch.length;
			await db.transaction(async (tx) => {
				await tx
					.insert(eventLogs)
					.values(
						batch.map((event) => ({
							userId: eventImport.userId,
							eventTime: new Date(event.eventTime),
							createdAt: new Date(event.createdAt),
							language: event.language,
							project: event.project,
							fileHash: event.fileHash,
							editor: event.editor,
							platform: event.platform,
						})),
					)
					.onConflictDoNothing();
				await tx
					.update(eventImports)
					.set({ processedRows, totalRows, message: `Imported ${processedRows} of ${totalRows} rows` })
					.where(eq(eventImports.id, importId));
			});
		}

		await updateImport(importId, { status: "completed", message: `Imported ${processedRows} rows` });
		Print.Success("Import completed", { importId, processedRows });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown import error";
		Print.Error("Import failed", { importId, message });
		await updateImport(importId, { status: "failed", message, processedRows, totalRows });
	} finally {
		if (importFile) await deleteImportFile(importFile.id, importFile.fileKey);
		activeImports.delete(importId);
	}
}

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
	app.post("/imports", async (request, reply) => {
		const body = request.body as JsonBody;
		if (
			!verifyInternalRequest(
				ENV.INTERNAL_SERVICE_SECRET,
				"POST",
				"/v1/imports",
				body.raw,
				new Headers(request.headers as Record<string, string>),
			)
		) {
			return reply.code(401).send({ error: "Unauthorized" });
		}
		const parsed = importRequestSchema.safeParse(body.value);
		if (!parsed.success) return reply.code(400).send({ error: "Invalid import request" });
		if (activeImports.has(parsed.data.importId)) return reply.code(202).send({ accepted: true, duplicate: true });

		activeImports.add(parsed.data.importId);
		void processImport(parsed.data.importId, parsed.data.fileKey, parsed.data.format);
		return reply.code(202).send({ accepted: true });
	});
}
