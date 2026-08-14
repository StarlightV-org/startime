import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

import { eventImports, users } from "@startime/db";
import { count, eq, and, or } from "drizzle-orm";
import {
	checkAccountConfig,
	normalizeAccountConfig,
	setAccountConfigValue,
	setAccountConfigValueSchema,
} from "~/lib/account-config";
import { isValidTimeZone, normalizeTimeZone } from "~/lib/time-range";
import z from "zod";

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
});
