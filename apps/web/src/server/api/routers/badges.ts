import z from "zod";
import { createTRPCRouter, protectedProcedure, serverOnlyMiddleware } from "../trpc";
import { chartTypes, shareKeys, eventLogs } from "@startime/db";
import { and, eq, gte, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { msg } from "@lingui/core/macro";
import { parseTranslate } from "~/lib/utils";
import { biggestUnitSchema, getTimeRange, timeRangeSchema } from "./overview";
import { rankByActiveMinutes } from "~/lib/overview-ranking";
import { toTimeString } from "~/lib/time-range";

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

	getTop: protectedProcedure
		.use(serverOnlyMiddleware)
		.input(
			z.object({
				timeRange: timeRangeSchema,
				biggestUnit: biggestUnitSchema,
				filter: z.object({
					editor: z.string().or(z.literal("")),
					workspace: z.string().or(z.literal("")),
					language: z.string().or(z.literal("")),
					platform: z.string().or(z.literal("")),
				}),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { timeRange, filter, biggestUnit } = input;
			const regional = ctx.user.accountConfig.regional;
			const [start, end] = getTimeRange(timeRange, regional.timeZone, undefined, regional.startOfWeek);

			const where = and(
				eq(eventLogs.userId, ctx.user.id),
				start ? gte(eventLogs.eventTime, start) : undefined,
				end ? lt(eventLogs.eventTime, end) : undefined,
				filter.editor ? eq(eventLogs.editor, filter.editor) : undefined,
				filter.workspace ? eq(eventLogs.project, filter.workspace) : undefined,
				filter.language ? eq(eventLogs.language, filter.language) : undefined,
				filter.platform ? eq(eventLogs.platform, filter.platform) : undefined,
			);

			// Print.Debug("where", where?.getSQL());

			const events = await ctx.db
				.select({
					eventTime: eventLogs.eventTime,
					// editor: eventLogs.editor,
					// workspace: eventLogs.project,
					language: eventLogs.language,
					// platform: eventLogs.platform,
				})
				.from(eventLogs)
				.where(where);

			const rankedItems = (values: { value: string; eventTime: Date }[]) => {
				const topItems = rankByActiveMinutes(values);
				const rankItem = (item: (typeof topItems)[number] | undefined) => ({
					value: item?.value ?? "",
					time: toTimeString(item?.minutes ?? 0, biggestUnit),
					percentage: item?.percentage ?? 0,
				});

				return {
					p1: rankItem(topItems[0]),
					p2: rankItem(topItems[1]),
					p3: rankItem(topItems[2]),
					p4: rankItem(topItems[3]),
					p5: rankItem(topItems[4]),
				};
			};

			return {
				// editor: rankedItems(events.map(({ editor, eventTime }) => ({ value: editor, eventTime }))),
				// workspace: rankedItems(events.map(({ workspace, eventTime }) => ({ value: workspace, eventTime }))),
				language: rankedItems(events.map(({ language, eventTime }) => ({ value: language, eventTime }))),
				// platform: rankedItems(events.map(({ platform, eventTime }) => ({ value: platform, eventTime }))),
			};
		}),
});
