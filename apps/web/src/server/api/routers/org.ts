import { and, eq } from "drizzle-orm";
import z from "zod";
import { createTRPCRouter, protectedProcedure, trackMiddleware } from "~/server/api/trpc";
import { auth } from "~/server/better-auth";

import { users, invitations, organizations, members } from "@startime/db";
import { TRPCError } from "@trpc/server";
import { op } from "~/lib/op";
import { msg } from "@lingui/core/macro";

const slugSchema = z
	.string()
	.min(5, msg`Slug must be at least 5 characters long`)
	.max(20, msg`Slug must be at most 20 characters long`)
	.regex(
		/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
		msg`Slug must start with a lowercase letter and contain only lowercase letters, numbers, and single hyphens.`,
	);

export const OrgConfig = {
	maxMembers: 10,
	maxOrganizationsPerUser: 1,
	invitationExpiresIn: 24 * 60 * 60 * 1000, // 1 day
};

const orgMembersRouter = createTRPCRouter({
	updateMemberRole: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
				role: z.enum(["member", "admin", "owner"]),
			}),
		)
		.use(trackMiddleware({ event: "org:member:update" }))
		.mutation(async ({ ctx, input }) => {
			const { userId, role } = input;

			if (!["admin", "owner"].includes(ctx.user.role!)) {
				throw new TRPCError({ code: "FORBIDDEN", message: `You can not perform this action!` });
			}

			const user = await ctx.db.query.members.findFirst({
				where: (members, { eq }) => eq(members.userId, userId),
				columns: { organizationId: true },
			});

			if (!user?.organizationId) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
			}

			if (ctx.user.organizationId !== user.organizationId) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You can not perform this action!" });
			}

			if (role === "owner" && ctx.user.role !== "owner") {
				throw new TRPCError({ code: "FORBIDDEN", message: "You can not perform this action!" });
			}

			await ctx.db.update(members).set({ role }).where(eq(members.userId, userId));

			return { success: true, newRole: role };
		}),

	kickMember: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
			}),
		)
		.use(trackMiddleware({ event: "org:member:kick" }))
		.mutation(async ({ ctx, input }) => {
			const { userId } = input;

			if (!["admin", "owner"].includes(ctx.user.role!)) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You can not perform this action!" });
			}

			await ctx.db.transaction(async (tx) => {
				await tx.delete(members).where(eq(members.userId, userId));

				await tx.update(users).set({ organizationId: null }).where(eq(users.id, userId));
			});

			return { success: true };
		}),
});

const orgInvitesRouter = createTRPCRouter({
	createInvite: protectedProcedure
		.input(
			z.object({
				email: z.email(),
			}),
		)
		.use(trackMiddleware({ event: "org:invite:create", addInput: false }))
		.mutation(async ({ ctx, input }) => {
			const user = await ctx.db.query.users.findFirst({
				where: eq(users.email, input.email),
			});

			if (!user) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
			}

			if (user.organizationId) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
			}

			const org = await ctx.db.query.organizations.findFirst({
				where: eq(organizations.id, ctx.user.organizationId),
				columns: {
					id: true,
				},
				with: {
					members: {
						columns: {
							userId: true,
						},
					},
				},
			});

			if (!org?.id) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
			}

			if (org.members.find((m) => m.userId === user.id)) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User is already a member" });
			}

			if (org.members.length > OrgConfig.maxMembers) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Organization is full" });
			}

			const invitation = await ctx.db.query.invitations.findFirst({
				where: and(
					eq(invitations.email, input.email),
					eq(invitations.organizationId, org.id),
					eq(invitations.status, "pending"),
				),
			});

			if (invitation) {
				throw new TRPCError({ code: "NOT_FOUND", message: "The User is already invited" });
			}

			await ctx.db.transaction(async (tx) => {
				await tx.insert(invitations).values({
					email: input.email,
					organizationId: org.id,
					expiresAt: new Date(Date.now() + OrgConfig.invitationExpiresIn),
					inviterId: ctx.user.id,
					createdAt: new Date(),
					role: "member",
					status: "pending",
				});
			});
		}),

	acceptInvite: protectedProcedure
		.input(
			z.object({
				invitationId: z.string(),
			}),
		)
		.use(trackMiddleware({ event: "org:invite:accept" }))
		.mutation(async ({ ctx, input }) => {
			const invitation = await ctx.db.query.invitations.findFirst({
				where: eq(invitations.id, input.invitationId),
			});

			if (!invitation) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
			}

			if (invitation.status !== "pending") {
				if (invitation.status === "accepted") {
					throw new TRPCError({ code: "FORBIDDEN", message: "Invitation already accepted" });
				}
				throw new TRPCError({ code: "NOT_FOUND", message: "Invitation already rejected" });
			}

			await ctx.db.transaction(async (tx) => {
				const [updatedInvitation] = await tx
					.update(invitations)
					.set({
						status: "accepted",
					})
					.where(eq(invitations.id, input.invitationId))
					.returning();

				if (!updatedInvitation) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
				}

				await tx.insert(members).values({
					userId: ctx.user.id,
					organizationId: updatedInvitation.organizationId,
					role: "member",
					createdAt: new Date(),
				});

				await tx
					.update(users)
					.set({
						organizationId: updatedInvitation.organizationId,
					})
					.where(eq(users.id, ctx.user.id));
			});
			return true;
		}),

	declineInvite: protectedProcedure
		.input(
			z.object({
				invitationId: z.string(),
			}),
		)
		.use(trackMiddleware({ event: "org:invite:decline" }))
		.mutation(async ({ ctx, input }) => {
			const invitation = await ctx.db.query.invitations.findFirst({
				where: eq(invitations.id, input.invitationId),
			});

			if (!invitation) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
			}

			if (invitation.status !== "pending") {
				if (invitation.status === "accepted") {
					throw new TRPCError({ code: "FORBIDDEN", message: "Invitation already accepted" });
				}
				throw new TRPCError({ code: "NOT_FOUND", message: "Invitation already rejected" });
			}

			await ctx.db.transaction(async (tx) => {
				await tx
					.update(invitations)
					.set({
						status: "declined",
					})
					.where(eq(invitations.id, input.invitationId));
			});
		}),
});

const manageOrg = createTRPCRouter({
	update: protectedProcedure
		.input(
			z.object({
				name: z
					.string()
					.min(5, msg`Name must be at least 5 characters long`)
					.max(30, msg`Name must be at most 30 characters long`),
				slug: slugSchema,
			}),
		)
		.mutation(async ({ input, ctx }) => {}),
});

export const orgRouter = createTRPCRouter({
	invites: orgInvitesRouter,
	members: orgMembersRouter,
	create: protectedProcedure
		.input(
			z.object({
				name: z
					.string()
					.min(5, msg`Name must be at least 5 characters long`)
					.max(30, msg`Name must be at most 30 characters long`),
				slug: slugSchema,
				logo: z
					.string()
					.min(5, msg`Logo must be at least 5 characters.`)
					.or(z.literal("")),
			}),
		)
		.use(trackMiddleware({ event: "org:create" }))
		.mutation(async ({ ctx, input }) => {
			const data = await ctx.db.transaction(async (tx) => {
				const [data] = await tx
					.insert(organizations)
					.values({
						name: input.name,
						logo: input.logo,
						slug: input.slug,
						createdAt: new Date(),
					})
					.returning({ id: organizations.id });

				if (!data) throw new Error("Failed to create organization");

				await tx.update(users).set({ organizationId: data.id }).where(eq(users.id, ctx.user.id));
				await tx.insert(members).values({
					userId: ctx.user.id,
					organizationId: data.id,
					role: "owner",
					createdAt: new Date(),
				});

				await tx.update(invitations).set({ status: "declined" }).where(eq(invitations.email, ctx.user.email));

				return data;
			});
			op.setGroup(data.id);

			return data;
		}),

	manage: manageOrg,
});
