import z from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { chartTypes, shareKeys } from "@startime/db";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { msg } from "@lingui/core/macro";
import { parseTranslate } from "~/lib/utils";

export const badgesRouter = createTRPCRouter({
	listShareKeys: protectedProcedure
		.input(
			z.object({
				chartType: z.enum(chartTypes, `chartType must be one of ${chartTypes.join(", ")}`),
			}),
		)
		.query(async ({ ctx, input }) => {
			const shareKeys = await ctx.db.query.shareKeys.findMany({
				where: (keys, { eq, and }) => and(eq(keys.userId, ctx.user.id), eq(keys.chartType, input.chartType)),
				with: {
					referrers: true,
				},
			});

			return shareKeys;
		}),

	createShareKey: protectedProcedure
		.input(
			z.object({
				chartType: z.enum(chartTypes, `chartType must be one of ${chartTypes.join(", ")}`),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { chartType } = input;

			if (!ctx.user.accountConfig.privacy.allowedBadges.includes(chartType)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: parseTranslate(ctx.i18n, msg`Badge "${chartType}" is not allowed. Enable it in your account settings.`),
				});
			}

			const shareKey = await ctx.db
				.insert(shareKeys)
				.values({
					userId: ctx.user.id,
					chartType,
				})
				.returning();

			return shareKey[0];
		}),

	deleteShareKey: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(shareKeys).where(and(eq(shareKeys.id, input.id), eq(shareKeys.userId, ctx.user.id)));
		}),
});
