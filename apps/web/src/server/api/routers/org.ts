import { and, count, eq, isNull, sql } from "drizzle-orm";
import z from "zod";
import { createTRPCRouter, protectedProcedure, reauthProcedure, trackMiddleware } from "~/server/api/trpc";
import { auth } from "~/server/better-auth";

import { users, invitations, organizations, members } from "@startime/db";
import { TRPCError } from "@trpc/server";
import { op } from "~/lib/op";
import { msg } from "@lingui/core/macro";
import { _int32 } from "zod/v4/core";

const slugSchema = z
	.string()
	.min(5, msg`Slug must be at least 5 characters.`)
	.max(32, msg`Slug must be at most 32 characters.`)
	.regex(
		/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
		msg`Slug must start with a lowercase letter and contain only lowercase letters, numbers, and single hyphens.`,
	);

export const OrgConfig = {
	maxMembers: 10,
	maxOrganizationsPerUser: 1,
	invitationExpiresIn: 24 * 60 * 60 * 1000, // 1 day
};

function requireOrganizationManager<T extends { organizationId: string | null; role: string | null }>(
	user: T,
): asserts user is T & { organizationId: string; role: "admin" | "owner" } {
	if (!user.organizationId || (user.role !== "admin" && user.role !== "owner")) {
		throw new TRPCError({ code: "FORBIDDEN", message: "You can not perform this action!" });
	}
}

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
			requireOrganizationManager(ctx.user);

			const member = await ctx.db.query.members.findFirst({
				where: and(eq(members.userId, userId), eq(members.organizationId, ctx.user.organizationId)),
				columns: { role: true },
			});

			if (!member) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
			}

			const isEditingSelf = userId === ctx.user.id;
			const adminEditingOwner = ctx.user.role === "admin" && member.role === "owner";
			const adminAssigningOwner = ctx.user.role === "admin" && role === "owner";

			if (isEditingSelf || adminEditingOwner || adminAssigningOwner) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You can not perform this action!" });
			}

			await ctx.db
				.update(members)
				.set({ role })
				.where(and(eq(members.userId, userId), eq(members.organizationId, ctx.user.organizationId)));

			return { success: true, newRole: role };
		}),

	leave: protectedProcedure
		.use(trackMiddleware({ event: "org:member:leave", addInput: false }))
		.mutation(async ({ ctx }) => {
			if (!ctx.user.organizationId) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Organization membership not found" });
			}

			await ctx.db.transaction(async (tx) => {
				await tx.execute(
					sql`SELECT 1 FROM ${organizations} WHERE ${organizations.id} = ${ctx.user.organizationId} FOR UPDATE`,
				);

				const membership = await tx.query.members.findFirst({
					where: and(eq(members.userId, ctx.user.id), eq(members.organizationId, ctx.user.organizationId)),
					columns: { role: true },
				});

				if (!membership) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Organization membership not found" });
				}

				if (membership.role === "owner") {
					const ownerCount =
						(
							await tx
								.select({ ownerCount: count() })
								.from(members)
								.where(and(eq(members.organizationId, ctx.user.organizationId), eq(members.role, "owner")))
						)[0]?.ownerCount ?? 0;

					if (ownerCount <= 1) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message: "Transfer ownership or delete the organization before leaving",
						});
					}
				}

				await tx
					.delete(members)
					.where(and(eq(members.userId, ctx.user.id), eq(members.organizationId, ctx.user.organizationId)));
				await tx
					.update(users)
					.set({ organizationId: null })
					.where(and(eq(users.id, ctx.user.id), eq(users.organizationId, ctx.user.organizationId)));
			});

			return { success: true };
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
			requireOrganizationManager(ctx.user);

			const member = await ctx.db.query.members.findFirst({
				where: and(eq(members.userId, userId), eq(members.organizationId, ctx.user.organizationId)),
				columns: { role: true },
			});

			if (!member) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
			}

			if (userId === ctx.user.id || (ctx.user.role === "admin" && member.role === "owner")) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You can not perform this action!" });
			}

			await ctx.db.transaction(async (tx) => {
				await tx
					.delete(members)
					.where(and(eq(members.userId, userId), eq(members.organizationId, ctx.user.organizationId)));

				await tx
					.update(users)
					.set({ organizationId: null })
					.where(and(eq(users.id, userId), eq(users.organizationId, ctx.user.organizationId)));
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
			requireOrganizationManager(ctx.user);

			await ctx.db.transaction(async (tx) => {
				await tx.execute(
					sql`SELECT 1 FROM ${organizations} WHERE ${organizations.id} = ${ctx.user.organizationId} FOR UPDATE`,
				);

				const user = await tx.query.users.findFirst({
					where: eq(users.email, input.email),
					columns: { id: true, organizationId: true },
				});

				if (!user) {
					throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
				}

				if (user.organizationId) {
					throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
				}

				const memberCount =
					(
						await tx.select({ memberCount: count() }).from(members).where(eq(members.organizationId, ctx.user.organizationId))
					)[0]?.memberCount ?? 0;

				if (memberCount >= OrgConfig.maxMembers) {
					throw new TRPCError({ code: "FORBIDDEN", message: "Organization is full" });
				}

				const invitation = await tx.query.invitations.findFirst({
					where: and(
						eq(invitations.email, input.email),
						eq(invitations.organizationId, ctx.user.organizationId),
						eq(invitations.status, "pending"),
					),
					columns: { id: true },
				});

				if (invitation) {
					throw new TRPCError({ code: "NOT_FOUND", message: "The User is already invited" });
				}

				await tx.insert(invitations).values({
					email: input.email,
					organizationId: ctx.user.organizationId,
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
			await ctx.db.transaction(async (tx) => {
				await tx.execute(sql`SELECT 1 FROM ${users} WHERE ${users.id} = ${ctx.user.id} FOR UPDATE`);

				const invitation = await tx.query.invitations.findFirst({
					where: eq(invitations.id, input.invitationId),
				});

				if (!invitation || invitation.email !== ctx.user.email) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
				}

				if (invitation.status !== "pending") {
					if (invitation.status === "accepted") {
						throw new TRPCError({ code: "FORBIDDEN", message: "Invitation already accepted" });
					}
					throw new TRPCError({ code: "NOT_FOUND", message: "Invitation already rejected" });
				}

				if (invitation.expiresAt <= new Date()) {
					throw new TRPCError({ code: "FORBIDDEN", message: "Invitation has expired" });
				}

				const user = await tx.query.users.findFirst({
					where: eq(users.id, ctx.user.id),
					columns: { organizationId: true },
				});

				if (!user || user.organizationId) {
					throw new TRPCError({ code: "FORBIDDEN", message: "You already belong to an organization" });
				}

				await tx.execute(
					sql`SELECT 1 FROM ${organizations} WHERE ${organizations.id} = ${invitation.organizationId} FOR UPDATE`,
				);

				const memberCount =
					(
						await tx
							.select({ memberCount: count() })
							.from(members)
							.where(eq(members.organizationId, invitation.organizationId))
					)[0]?.memberCount ?? 0;

				if (memberCount >= OrgConfig.maxMembers) {
					throw new TRPCError({ code: "FORBIDDEN", message: "Organization is full" });
				}

				const [updatedInvitation] = await tx
					.update(invitations)
					.set({ status: "accepted" })
					.where(and(eq(invitations.id, input.invitationId), eq(invitations.status, "pending")))
					.returning({ organizationId: invitations.organizationId });

				if (!updatedInvitation) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
				}

				await tx.insert(members).values({
					userId: ctx.user.id,
					organizationId: updatedInvitation.organizationId,
					role: "member",
					createdAt: new Date(),
				});

				const [updatedUser] = await tx
					.update(users)
					.set({ organizationId: updatedInvitation.organizationId })
					.where(and(eq(users.id, ctx.user.id), isNull(users.organizationId)))
					.returning({ id: users.id });

				if (!updatedUser) {
					throw new TRPCError({ code: "FORBIDDEN", message: "You already belong to an organization" });
				}
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
					.min(5, msg`Name must be at least 5 characters.`)
					.max(32, msg`Name must be at most 32 characters.`),
				slug: slugSchema,
				logo: z
					.string()
					.min(5, msg`Logo must be at least 5 characters.`)
					.or(z.literal("")),
				public: z.boolean(),
			}),
		)
		.use(trackMiddleware({ event: "org:update" }))
		.mutation(async ({ input, ctx }) => {
			requireOrganizationManager(ctx.user);

			const existingOrg = await ctx.db.query.organizations.findFirst({
				where: (org, { and, eq, not }) => and(eq(org.slug, input.slug), not(eq(org.id, ctx.user.organizationId))),
				columns: { id: true },
			});

			if (existingOrg) {
				throw new TRPCError({ code: "CONFLICT", message: "This slug is already taken" });
			}

			const [organization] = await ctx.db
				.update(organizations)
				.set({
					name: input.name,
					slug: input.slug,
					logo: input.logo,
					public: input.public,
				})
				.where(eq(organizations.id, ctx.user.organizationId))
				.returning({ id: organizations.id });

			if (!organization) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
			}

			return organization;
		}),

	delete: reauthProcedure
		.input(
			z.object({
				orgId: z.string(),
				confirm: z.boolean(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { orgId, confirm } = input;

			if (!confirm) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You can't perform this action" });
			}

			if (orgId !== ctx.user.organizationId) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You can't perform this action" });
			}

			const org = await ctx.db.query.organizations.findFirst({
				where: eq(organizations.id, orgId),
				with: {
					members: {
						where: eq(members.role, "owner"),
					},
				},
			});

			if (!org) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
			}

			if (org.members.length === 0) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You can't perform this action" });
			}

			const orgOwners = org.members.map((member) => member.userId);

			if (!orgOwners.includes(ctx.user.id)) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You can't perform this action" });
			}

			await ctx.db.delete(organizations).where(eq(organizations.id, orgId));
		}),
});

export const orgRouter = createTRPCRouter({
	isSlugTaken: protectedProcedure
		.input(
			z.object({
				slug: z.string(),
				orgId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { slug, orgId } = input;
			const existingOrg = await ctx.db.query.organizations.findFirst({
				where: (org, { eq, and, not }) => and(eq(org.slug, slug), orgId ? not(eq(org.id, orgId)) : undefined),
			});
			return !!existingOrg?.id;
		}),
	invites: orgInvitesRouter,
	members: orgMembersRouter,
	create: protectedProcedure
		.input(
			z.object({
				name: z
					.string()
					.min(5, msg`Name must be at least 5 characters.`)
					.max(32, msg`Name must be at most 32 characters.`),
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
