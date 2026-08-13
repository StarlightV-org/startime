import { eq } from "drizzle-orm";
import z from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { auth } from "~/server/better-auth";

import { users } from "@startime/db";

export const orgRouter = createTRPCRouter({
	create: protectedProcedure
		.input(
			z.object({
				name: z
					.string()
					.min(5, "Name must be at least 5 characters long")
					.max(30, "Name must be at most 30 characters long"),
				slug: z
					.string()
					.min(5, "Slug must be at least 5 characters long")
					.max(20, "Slug must be at most 20 characters long")
					.regex(
						/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
						"Slug must start with a lowercase letter and contain only lowercase letters, numbers, and single hyphens.",
					),
				logo: z.string().min(5, "Logo must be at least 5 characters.").or(z.literal("")),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const data = await auth.api.createOrganization({
				body: {
					name: input.name,
					userId: ctx.user.id,
					slug: input.slug,
					keepCurrentActiveOrganization: true,
				},
			});

			await ctx.db.update(users).set({ organizationId: data.id }).where(eq(users.id, ctx.user.id));

			return data;
		}),
});
