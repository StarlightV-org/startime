import { createTRPCRouter, protectedProcedure, reauthProcedure } from "~/server/api/trpc";

import { eventImports, users, userExports, apiKeys } from "@startime/db";
import { count, eq, and, or } from "drizzle-orm";
import {
	checkAccountConfig,
	normalizeAccountConfig,
	setAccountConfigValue,
	setAccountConfigValueSchema,
} from "~/lib/account-config";
import { isValidTimeZone, normalizeTimeZone } from "~/lib/time-range";
import z from "zod";
import { signInternalRequest } from "@startime/service-auth";
import { ENV } from "@startime/env";
import { utapi } from "~/app/api/uploadthing/core";
import { TRPCError } from "@trpc/server";
import { tryCatch } from "~/lib/utils";

const timeZoneSchema = z.string().trim().refine(isValidTimeZone, "Select a valid IANA time zone.");

export const selfRouter = createTRPCRouter({
	/** Updates one account preference after validating the path/value pair. */
	setConfigValue: protectedProcedure.input(setAccountConfigValueSchema).mutation(async ({ ctx, input }) => {
		const currentConfig = await ctx.db.query.users.findFirst({
			where: (users, { eq }) => eq(users.id, ctx.user.id),
			columns: { accountConfig: true },
		});
		if (!currentConfig) {
			throw new Error("Config not found");
		}

		const updatedConfig = normalizeAccountConfig(
			setAccountConfigValue(checkAccountConfig(currentConfig.accountConfig), input.path, input.value),
		);
		await ctx.db.update(users).set({ accountConfig: updatedConfig }).where(eq(users.id, ctx.user.id));

		return { success: true };
	}),
	/** Synchronizes the browser's IANA time zone without replacing account choices. */
	syncSettings: protectedProcedure.input(z.object({ timeZone: timeZoneSchema })).mutation(async ({ ctx, input }) => {
		const user = await ctx.db.query.users.findFirst({
			where: (users, { eq }) => eq(users.id, ctx.user.id),
			columns: { accountConfig: true },
		});
		if (!user) throw new Error("Config not found");

		const accountConfig = setAccountConfigValue(
			checkAccountConfig(user.accountConfig),
			"regional.timeZone",
			normalizeTimeZone(input.timeZone),
		);
		await ctx.db.update(users).set({ accountConfig }).where(eq(users.id, ctx.user.id));
		return accountConfig;
	}),
	listImports: protectedProcedure.query(async ({ ctx }) => {
		const imports = await ctx.db.query.eventImports.findMany({
			where: (imports, { eq, and }) => and(eq(imports.userId, ctx.user.id)),
			with: {
				importFile: true,
			},
			orderBy: (imports, { desc }) => desc(imports.updatedAt),
			limit: 5,
		});

		if (!imports) return { pendingImports: [], otherImports: [], totalCount: 0 };

		const totalCount = await ctx.db
			.select({ count: count(eventImports) })
			.from(eventImports)
			.where(
				and(
					eq(eventImports.userId, ctx.user.id),
					or(eq(eventImports.status, "failed"), eq(eventImports.status, "completed")),
				),
			);

		return {
			pendingImports: imports.filter((imports) => imports.status === "pending" || imports.status === "uploaded"),
			otherImports: imports
				.filter((imports) => imports.status !== "pending" && imports.status !== "uploaded")
				.sort((a, b) => {
					if (!a.updatedAt || !b.updatedAt) return 0;
					return b.updatedAt.getTime() - a.updatedAt.getTime();
				}),

			totalCount: totalCount?.[0]?.count ?? 0,
		};
	}),

	triggerExport: protectedProcedure.mutation(async ({ ctx }) => {
		const importResult = await ctx.db
			.insert(userExports)
			.values({
				userId: ctx.user.id,
				message: "Export queued",
			})
			.returning({ id: userExports.id });
		const exportId = importResult[0]?.id;

		try {
			const path = "/v1/export";
			const body = JSON.stringify({
				userId: ctx.user.id,
				exportId: exportId,
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
			const message = error instanceof Error ? error.message : "Unable to queue export";
			Print.Error("Unable to queue export", { error });
			await ctx.db.update(userExports).set({ status: "failed", message }).where(eq(userExports.id, exportId!));
		}
	}),
	listExports: protectedProcedure.query(async ({ ctx }) => {
		const exports = await ctx.db.query.userExports.findMany({
			where: eq(userExports.userId, ctx.user.id),
		});
		return {
			pending: exports.filter((e) => e.status === "pending"),
			other: exports.filter((e) => e.status !== "pending"),
		};
	}),
	getExportUrl: protectedProcedure.mutation(async ({ ctx }) => {
		const exports = await ctx.db.query.userExports.findFirst({
			where: (userExports, { eq, and }) => and(eq(userExports.userId, ctx.user.id), eq(userExports.status, "uploaded")),
			orderBy: (userExports, { desc }) => [desc(userExports.completedAt)],
			with: { file: true },
		});
		if (!exports?.file) {
			throw new TRPCError({ code: "NOT_FOUND", message: "No uploaded export found" });
		}

		const { ufsUrl: downloadUrl } = await utapi.generateSignedURL(exports?.file?.fileKey, { expiresIn: 60 * 60 });

		return downloadUrl;
	}),

	listPasskeys: protectedProcedure.query(async ({ ctx }) => {
		const passkeys = await ctx.db.query.users.findFirst({
			where: (users, { eq }) => eq(users.id, ctx.user.id),
			columns: {},
			with: { passkeys: true },
		});
		return passkeys?.passkeys ?? [];
	}),

	listApiKeys: protectedProcedure.query(async ({ ctx }) => {
		const keys = await ctx.db.query.apiKeys.findMany({
			where: (apiKeys, { eq }) => eq(apiKeys.userId, ctx.user.id),
			columns: { key: false },
		});
		return keys.map((key) => ({ ...key, key: undefined }));
	}),

	createApiKey: protectedProcedure.input(z.object({ name: z.string() })).mutation(async ({ ctx, input }) => {
		const { name } = input;
		const apiKey = await tryCatch(ctx.db.insert(apiKeys).values({ name, userId: ctx.user.id }).returning());

		if (!apiKey.data) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Api key with that name already exists" });
		}

		return { success: true };
	}),

	getApiKey: reauthProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
		const { id } = input;
		const apiKey = await ctx.db.query.apiKeys.findFirst({
			where: (apiKeys, { eq, and }) => and(eq(apiKeys.id, id), eq(apiKeys.userId, ctx.user.id)),
			columns: { key: true },
		});

		if (!apiKey) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Api key not found" });
		}

		return apiKey?.key;
	}),
	deleteApiKey: reauthProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
		const { id } = input;
		await ctx.db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, ctx.user.id)));
		return { success: true };
	}),
});
