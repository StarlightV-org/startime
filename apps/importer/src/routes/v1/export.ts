import type { FastifyInstance } from "fastify";
import z from "zod";
import { db } from "@startime/db";
import { zipSync, strToU8 } from "fflate";
import { formatDate } from "date-fns/format";
import { utapi } from "../..";
import { saveFileToDatabase, wait, type JsonBody } from "../../server";
import { verifyInternalRequest } from "@startime/service-auth";
import { ENV } from "@startime/env";
import { eq } from "drizzle-orm";
import { userExports } from "@startime/db";

const createExportRequestSchema = z.object({
	userId: z.string(),
	exportId: z.string(),
});

async function updateExport(
	exportId: string,
	values: Partial<{
		status: "pending" | "failed" | "uploaded";
		message: string;
		totalRows: number;
		processedRows: number;
		fileId: string | null;
	}>,
): Promise<void> {
	await db
		.update(userExports)
		.set({
			status: values.status,
			message: values.message,
			completedAt: values.status === "uploaded" ? new Date() : null,
			fileId: values.fileId ?? null,
		})
		.where(eq(userExports.id, exportId));
}

async function objectToJsonFile(data: object, filename: string): Promise<File> {
	return new File([JSON.stringify(data, null, 2)], filename, { type: "application/json" });
}

async function arrayToCsv(data: readonly Record<string, unknown>[], filename: string): Promise<File> {
	const columns = [...new Set(data.flatMap((row) => Object.keys(row)))];
	const escapeValue = (value: unknown): string => {
		const text =
			value === null || value === undefined
				? ""
				: value instanceof Date
					? value.toISOString()
					: typeof value === "object"
						? JSON.stringify(value)
						: String(value);

		return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
	};
	const csv = [columns, ...data.map((row) => columns.map((column) => row[column]))]
		.map((row) => row.map(escapeValue).join(","))
		.join("\r\n");

	return new File([csv], filename, { type: "text/csv;charset=utf-8" });
}

async function filesToZip(files: File[], filename: string): Promise<File> {
	const entries: Record<string, Uint8Array> = {};

	for (const file of files) {
		entries[file.name] = new Uint8Array(await file.arrayBuffer());
	}

	const archive = zipSync(entries, { level: 6 });
	return new File([archive], filename, { type: "application/zip" });
}

async function createExport(request: z.infer<typeof createExportRequestSchema>) {
	const { userId, exportId } = request;
	try {
		const pastExports = await db.query.userExports.findMany({
			where: (exports, { eq }) => eq(exports.userId, userId),
			with: {
				file: { columns: { fileKey: true } },
			},
		});
		Print.Debug("[EXPORT]", "pastExports", pastExports);

		if (pastExports.length > 0) {
			const fileKeys = pastExports.map((e) => e.file?.fileKey).filter((fileKey): fileKey is string => Boolean(fileKey));
			Print.Debug("[EXPORT]", "fileKeys", fileKeys);
			if (fileKeys.length === 0) return;
			const result = await utapi.deleteFiles(fileKeys);
			Print.Debug("[EXPORT]", "delete result", result);
		}

		const user = await db.query.users.findFirst({
			where: (users, { eq }) => eq(users.id, userId),
			with: {
				accounts: true,
				passkeys: true,
				sessions: true,
				organization: true,
				memberships: true,
				invitations: true,
				sentInvitations: {
					columns: { email: false },
				},
				events: {
					columns: { id: false },
				},
			},
		});
		if (!user) return;

		await updateExport(exportId, { status: "pending", message: "User data loaded" });

		const userExportObj = {
			id: user.id,
			name: user.name ?? null,
			email: user.email ?? null,
			emailVerified: user.emailVerified ?? null,
			image: user.image ?? null,
			createdAt: user.createdAt ?? null,
			updatedAt: user.updatedAt ?? null,
			organizationId: user.organizationId ?? null,
			accounts: user.accounts.map((account) => ({
				...account,
				accessToken: "__REDACTED__",
				refreshToken: "__REDACTED__",
				password: null,
			})),
			passkeys: user.passkeys.map((passkey) => ({ ...passkey, credentialId: "__REDACTED__" })),
			sessions: user.sessions.map((session) => ({ ...session, token: "__REDACTED__" })),
		};
		const accountConfigObject = user.accountConfig as object;
		const events = user.events;

		const org = user.organization;
		const orgObject = {
			id: org?.id ?? null,
			name: org?.name ?? null,
			slug: org?.slug ?? null,
			logo: org?.logo ?? null,
			createdAt: org?.createdAt ?? null,
			membership: user.memberships[0] ?? null,
			sendInvitations: user.sentInvitations.map((inv) => ({ ...inv, email: "__REDACTED__" })) ?? null,
			receivedInvitations: user.invitations.map((inv) => ({ ...inv, email: "__REDACTED__" })) ?? null,
		};

		const [userExportFile, accountConfigFile, eventsFile, orgFile] = await Promise.all([
			objectToJsonFile(userExportObj, "user.json"),
			objectToJsonFile(accountConfigObject, "account_config.json"),
			arrayToCsv(events, "events.csv"),
			objectToJsonFile(orgObject, "organization.json"),
		]);

		const zipFile = await filesToZip(
			[userExportFile, accountConfigFile, eventsFile, orgFile],
			`startime-export_${user.name}_${user.id}_${formatDate(new Date(), "dd.MM.yyyy_mm-ss")}.zip`,
		);

		const result = await utapi.uploadFiles([zipFile], {
			acl: "private",
			concurrency: 5,
			contentDisposition: "attachment",
		});

		if (!result || result.length === 0 || !result[0]?.data || result[0]?.error) {
			if (result[0]?.error) {
				await updateExport(exportId, { status: "failed", message: result[0]?.error.message });
				return;
			}
			await updateExport(exportId, { status: "failed", message: "No result returned from upload" });
			return;
		}

		const savedFile = await saveFileToDatabase(result[0]?.data!, {
			userId: user.id,
			locationId: user.id,
		});

		Print.Debug(savedFile);

		await updateExport(exportId, {
			status: "pending",
			fileId: savedFile?.id,
			message: "Export finished, waiting for upload",
		});
		await wait(5000);

		await updateExport(exportId, { status: "uploaded", fileId: savedFile?.id, message: "Export uploaded successfully" });
		return savedFile;
	} catch (error) {
		await updateExport(exportId, { status: "failed", message: error instanceof Error ? error.message : String(error) });
	}
}

export async function registerExportRoutes(app: FastifyInstance): Promise<void> {
	app.post("/export", async (request, reply) => {
		const body = request.body as JsonBody;
		if (
			!verifyInternalRequest(
				ENV.INTERNAL_SERVICE_SECRET,
				"POST",
				"/v1/export",
				body.raw,
				new Headers(request.headers as Record<string, string>),
			)
		) {
			return reply.code(401).send({ error: "Unauthorized" });
		}
		const parsed = createExportRequestSchema.safeParse(body.value);
		if (!parsed.success) return reply.code(400).send({ error: "Invalid import request" });

		Print.Debug("[EXPORT]", "parsed.data", parsed.data);
		void createExport(parsed.data);
		return reply.code(202).send({ accepted: true });
	});
}
