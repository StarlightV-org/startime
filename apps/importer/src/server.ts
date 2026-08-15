import Fastify from "fastify";
import { registerImportRoutes } from "./routes/v1/import";
import { registerExportRoutes } from "./routes/v1/export";
import type { UploadedFileData } from "uploadthing/types";

import { files, db } from "@startime/db";

export function buildServer() {
	const app = Fastify({ bodyLimit: 1_048_576, logger: false });

	app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
		try {
			const raw = typeof body === "string" ? body : body.toString("utf8");
			done(null, { raw, value: JSON.parse(raw) });
		} catch {
			done(new Error("Invalid JSON"));
		}
	});

	app.get("/health", async () => ({ status: "ok" }));
	app.register(registerImportRoutes, { prefix: "/v1" });
	app.register(registerExportRoutes, { prefix: "/v1" });
	return app;
}

export type JsonBody = { raw: string; value: unknown };

export async function saveFileToDatabase(
	file: UploadedFileData,
	metadata: {
		userId: string;
		locationId?: string;
		extraData?: Record<string, any>;
	},
) {
	const [newFile] = await db
		.insert(files)
		.values({
			createdBy: metadata.userId,
			location: "user_import",
			locationId: metadata.locationId,
			fileName: file.name,
			fileKey: file.key,
			fileUrl: file.ufsUrl,
			size: file.size,
			type: file.type,
			lastModified: file.lastModified ? new Date(file.lastModified) : null,
			metadata: metadata.extraData,
		})
		.returning();

	return newFile;
}

export function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
