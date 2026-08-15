import { eq } from "drizzle-orm";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import type { UploadedFileData } from "uploadthing/types";
import { getAuth } from "~/server/better-auth";
import { db, files, eventImports, type FileLocation } from "@startime/db";
import { signInternalRequest } from "@startime/service-auth";

import { UTApi } from "uploadthing/server";
import { ENV } from "@startime/env";

export const utapi = new UTApi({
	token: ENV.UPLOADTHING_TOKEN,
	// ...options,
});

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
	// Define as many FileRoutes as you like, each with a unique routeSlug
	startime_import_csv: f({
		"text/csv": {
			maxFileSize: "64MB",
			maxFileCount: 1,
			acl: "private",
			contentDisposition: "attachment",
		},
	})
		// Set permissions and file types for this FileRoute
		.middleware(async () => {
			const { user, session } = await getAuth();
			if (!session.id) throw new UploadThingError("Unauthorized");

			const pendingImport = await db.query.eventImports.findFirst({
				where: (eventImports, { eq, and, or }) =>
					and(eq(eventImports.userId, user.id), or(eq(eventImports.status, "pending"), eq(eventImports.status, "uploaded"))),
			});

			if (pendingImport)
				throw new UploadThingError({
					code: "BAD_REQUEST",
					cause: pendingImport,
					message: "You already have a pending import. Please complete it before uploading a new one.",
				});

			// Whatever is returned here is accessible in onUploadComplete as `metadata`
			return { userId: user.id };
		})
		.onUploadComplete(async ({ metadata, file }) => {
			const newFileObject = {
				...file,
				name: `startime-import-${metadata.userId}-${file.name}`,
			};

			const newFile = await saveFileToDatabase(newFileObject, {
				userId: metadata.userId,
				location: "user_import",
				locationId: metadata.userId,
			});

			Print.Debug("newFile", newFile);

			const newImport = await db
				.insert(eventImports)
				.values({
					status: "uploaded",
					message: `File was uploaded successfully.`,
					userId: metadata.userId,
					fileId: newFile?.id,
					fileName: newFile?.fileName ?? "Name not available",
				})
				.returning();

			const eventImport = newImport[0];
			if (!eventImport || !newFile) throw new UploadThingError("Unable to create the import record");

			try {
				await db
					.update(eventImports)
					.set({ status: "pending", message: "Import queued" })
					.where(eq(eventImports.id, eventImport.id));
				const path = "/v1/imports";
				const body = JSON.stringify({
					importId: eventImport.id,
					fileKey: newFile.fileKey,
					format: "codetime/csv",
				});
				const response = await fetch(new URL(path, ENV.IMPORTER_URL), {
					method: "POST",
					headers: {
						"content-type": "application/json",
						...signInternalRequest(ENV.INTERNAL_SERVICE_SECRET, "POST", path, body),
					},
					body,
				});
				if (!response.ok) throw new Error(`Importer request failed with ${response.status}`);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unable to queue import";
				Print.Error("Unable to queue import", { importId: eventImport.id, error });
				await db.update(eventImports).set({ status: "failed", message }).where(eq(eventImports.id, eventImport.id));
			}

			return { success: true, fileId: newFile.id };
			// !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
		}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

async function saveFileToDatabase(
	file: UploadedFileData,
	metadata: {
		userId: string;
		location: FileLocation;
		locationId?: string;
		extraData?: Record<string, any>;
	},
) {
	const [newFile] = await db
		.insert(files)
		.values({
			createdBy: metadata.userId,
			location: metadata.location,
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

	// await sendWebhook({
	// 	webhookUrl: env.DISCORD_WEBHOOK_DEV,
	// 	username: "StarlightV - UploadThing",
	// 	components: [
	// 		new ContainerBuilder({
	// 			accent_color: 0x0099ff,
	// 			components: [
	// 				{
	// 					type: ComponentType.MediaGallery,
	// 					items: [
	// 						{
	// 							media: {
	// 								url: newFile.fileUrl,
	// 								content_type: newFile.type,
	// 							},
	// 						},
	// 					],
	// 				},
	// 			],
	// 		}),
	// 	],
	// });

	return newFile;
}

export async function getUploadThingFile(fileKey: string) {
	const url = await utapi.generateSignedURL(fileKey, {
		expiresIn: 60 * 60, // 1 hour
	});
}
