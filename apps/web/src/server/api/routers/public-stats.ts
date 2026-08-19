import { createTRPCRouter, publicProcedure, serverOnlyMiddleware } from "../trpc";
import { getTimeRange } from "./overview";
import { and, gte, lt } from "drizzle-orm";
import { eventLogs } from "@startime/db";
import { rankByActiveMinutes } from "~/lib/overview-ranking";
import { toTimeString } from "~/lib/time-range";

export const publicStatsRouter = createTRPCRouter({
	getTop: publicProcedure.use(serverOnlyMiddleware).query(async ({ ctx }) => {
		const regional = ctx?.user?.accountConfig?.regional;
		const [start, end] = getTimeRange("past90", regional?.timeZone, undefined);

		const where = and(
			start ? gte(eventLogs.eventTime, start) : undefined,
			end ? lt(eventLogs.eventTime, end) : undefined,
		);

		// Print.Debug("where", where?.getSQL());

		const events = await ctx.db
			.select({
				eventTime: eventLogs.eventTime,
				editor: eventLogs.editor,
				language: eventLogs.language,
				platform: eventLogs.platform,
			})
			.from(eventLogs)
			.where(where);

		const rankedItems = (values: { value: string; eventTime: Date }[]) => {
			const topItems = rankByActiveMinutes(values);
			const rankItem = (item: (typeof topItems)[number] | undefined) => ({
				value: item?.value ?? "",
				time: toTimeString(item?.minutes ?? 0, "day"),
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
			editor: rankedItems(events.map(({ editor, eventTime }) => ({ value: editor, eventTime }))),
			language: rankedItems(events.map(({ language, eventTime }) => ({ value: language, eventTime }))),
			platform: rankedItems(events.map(({ platform, eventTime }) => ({ value: platform, eventTime }))),
		};
	}),
});
