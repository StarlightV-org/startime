import { and, count, eq, exists, gte, isNull, lt, sql } from "drizzle-orm";
import z from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	reauthProcedure,
	serverOnlyMiddleware,
	trackMiddleware,
} from "~/server/api/trpc";
import { auth } from "~/server/better-auth";

import {
	users,
	invitations,
	organizations,
	members,
	organizationProjects,
	organizationProjectAssignments,
	eventLogs,
} from "@startime/db";
import { TRPCError } from "@trpc/server";
import { op } from "~/lib/op";
import { msg } from "@lingui/core/macro";

import { getTimeRange, timeRangeValues, toTimeString } from "~/lib/time-range";
import type { BiggestUnit } from "~/server/api/routers/overview";
import type { API } from "~/trpc/server";
import { invalidateCachePartialKey } from "~/server/redis/cache";

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

function requireOrganizationOwner<T extends { organizationId: string | null; role: string | null }>(
	user: T,
): asserts user is T & { organizationId: string; role: "owner" } {
	if (!user.organizationId || user.role !== "owner") {
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

				await tx.delete(organizationProjectAssignments).where(
					and(
						eq(organizationProjectAssignments.userId, ctx.user.id),
						exists(
							tx
								.select({ id: organizationProjects.id })
								.from(organizationProjects)
								.where(
									and(
										eq(organizationProjects.id, organizationProjectAssignments.organizationProjectId),
										eq(organizationProjects.organizationId, ctx.user.organizationId),
									),
								),
						),
					),
				);

				await tx
					.delete(members)
					.where(and(eq(members.userId, ctx.user.id), eq(members.organizationId, ctx.user.organizationId)));
				await tx
					.update(users)
					.set({ organizationId: null })
					.where(and(eq(users.id, ctx.user.id), eq(users.organizationId, ctx.user.organizationId)));
			});

			await invalidateCachePartialKey(`org:top:${ctx.user.organizationId}`);
			await invalidateCachePartialKey(`org:activity:${ctx.user.organizationId}`);

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
				await tx.delete(organizationProjectAssignments).where(
					and(
						eq(organizationProjectAssignments.userId, userId),
						exists(
							tx
								.select({ id: organizationProjects.id })
								.from(organizationProjects)
								.where(
									and(
										eq(organizationProjects.id, organizationProjectAssignments.organizationProjectId),
										eq(organizationProjects.organizationId, ctx.user.organizationId),
									),
								),
						),
					),
				);

				await tx
					.delete(members)
					.where(and(eq(members.userId, userId), eq(members.organizationId, ctx.user.organizationId)));

				await tx
					.update(users)
					.set({ organizationId: null })
					.where(and(eq(users.id, userId), eq(users.organizationId, ctx.user.organizationId)));
			});

			await invalidateCachePartialKey(`org:top:${ctx.user.organizationId}`);
			await invalidateCachePartialKey(`org:activity:${ctx.user.organizationId}`);

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
					.returning({ id: users.id, organizationId: users.organizationId });

				if (!updatedUser) {
					throw new TRPCError({ code: "FORBIDDEN", message: "You already belong to an organization" });
				}
				await invalidateCachePartialKey(`org:top:${updatedUser.organizationId}`);
				await invalidateCachePartialKey(`org:activity:${ctx.user.organizationId}`);
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

			return { success: true };
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

const projectNameSchema = z.string().min(5, "Project name must be at least 5 characters");
const projectDescriptionSchema = z
	.string()
	.min(5, "Description must be at least 5 characters")
	.max(100, "Description must be at most 100 characters")
	.or(z.literal(""));

const orgProjects = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		if (!ctx.user.organizationId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You must be a member of an organization to perform this action",
			});
		}

		const projects = await ctx.db.query.organizationProjects.findMany({
			where: eq(organizationProjects.organizationId, ctx.user.organizationId),
			with: {
				assignments: {
					where: eq(organizationProjectAssignments.userId, ctx.user.id),
				},
			},
		});
		return projects;
	}),
	create: protectedProcedure
		.input(
			z.object({
				name: projectNameSchema,
				description: projectDescriptionSchema,
			}),
		)
		.mutation(async ({ input, ctx }) => {
			requireOrganizationManager(ctx.user);
			const normalizedName = input.name.toLowerCase();
			const existingProject = await ctx.db.query.organizationProjects.findFirst({
				where: and(
					eq(organizationProjects.organizationId, ctx.user.organizationId),
					eq(organizationProjects.normalizedName, normalizedName),
				),
				columns: { id: true },
			});

			if (existingProject) {
				throw new TRPCError({ code: "CONFLICT", message: "A project with this name already exists" });
			}

			await ctx.db.insert(organizationProjects).values({
				name: input.name,
				normalizedName,
				organizationId: ctx.user.organizationId,
				description: input.description,
			});
		}),

	edit: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				name: projectNameSchema,
				description: projectDescriptionSchema,
			}),
		)
		.mutation(async ({ input, ctx }) => {
			requireOrganizationManager(ctx.user);

			const project = await ctx.db.query.organizationProjects.findFirst({
				where: (project, { eq, and }) =>
					and(eq(project.id, input.projectId), eq(project.organizationId, ctx.user.organizationId)),
			});
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			const normalizedName = input.name.toLowerCase();
			const existingProject = await ctx.db.query.organizationProjects.findFirst({
				where: (candidate, { and, eq, not }) =>
					and(
						eq(candidate.organizationId, ctx.user.organizationId),
						eq(candidate.normalizedName, normalizedName),
						not(eq(candidate.id, input.projectId)),
					),
				columns: { id: true },
			});

			if (existingProject) {
				throw new TRPCError({ code: "CONFLICT", message: "A project with this name already exists" });
			}

			await ctx.db
				.update(organizationProjects)
				.set({
					name: input.name,
					normalizedName,
					description: input.description,
				})
				.where(eq(organizationProjects.id, project.id));
		}),

	delete: reauthProcedure
		.input(
			z.object({
				projectId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			requireOrganizationOwner(ctx.user);

			const project = await ctx.db.query.organizationProjects.findFirst({
				where: (project, { eq, and }) =>
					and(eq(project.id, input.projectId), eq(project.organizationId, ctx.user.organizationId)),
			});
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			await ctx.db.delete(organizationProjects).where(eq(organizationProjects.id, input.projectId));

			await invalidateCachePartialKey(`org:top:${ctx.user.organizationId}`);
			await invalidateCachePartialKey(`org:activity:${ctx.user.organizationId}`);
		}),

	assign: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				userProjects: z.array(z.string()),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const project = await ctx.db.query.organizationProjects.findFirst({
				where: (project, { eq, and }) =>
					and(eq(project.id, input.projectId), eq(project.organizationId, ctx.user.organizationId)),
			});
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			await ctx.db.transaction(async (tx) => {
				await tx
					.delete(organizationProjectAssignments)
					.where(
						and(
							eq(organizationProjectAssignments.organizationProjectId, input.projectId),
							eq(organizationProjectAssignments.userId, ctx.user.id),
						),
					);

				if (input.userProjects.length === 0) return;

				await tx.insert(organizationProjectAssignments).values(
					input.userProjects.map((userProject) => ({
						sourceProject: userProject,
						normalizedSourceProject: userProject.toLowerCase(),
						organizationProjectId: input.projectId,
						userId: ctx.user.id,
					})),
				);
			});

			await invalidateCachePartialKey(`org:top:${ctx.user.organizationId}`);
			await invalidateCachePartialKey(`org:activity:${ctx.user.organizationId}`);
		}),
});

export type OrgTopElement = NonNullable<API["org"]["getTop"]>["editor"]["p1"];

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
	projects: orgProjects,

	getActivity: protectedProcedure
		.use(serverOnlyMiddleware)
		.input(
			z.object({
				timeRange: z.enum(timeRangeValues),
				biggestUnit: z.enum(["hour", "day", "week"]).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const organizationId = ctx.user.organizationId;
			if (!organizationId) return null;

			const regional = ctx.user.accountConfig.regional;
			const [start, end] = getTimeRange(input.timeRange, regional.timeZone, undefined, regional.startOfWeek);
			const [startToday, endToday] = getTimeRange("thisDay", regional.timeZone, undefined, regional.startOfWeek);
			if (!startToday || !endToday) throw new Error("Unable to determine the current day range");

			const eventFilter = and(
				eq(members.organizationId, organizationId),
				start ? gte(eventLogs.eventTime, start) : undefined,
				end ? lt(eventLogs.eventTime, end) : undefined,
			);
			const todayFilter = and(gte(eventLogs.eventTime, startToday), lt(eventLogs.eventTime, endToday));

			const result = await ctx.db.execute<{ minutes: number; minutesToday: number }>(sql`
				with project_minutes as (
					select distinct
						${organizationProjects.id} as project_id,
						${eventLogs.userId} as user_id,
						date_trunc('minute', ${eventLogs.eventTime}) as active_minute,
						case when ${todayFilter} then 1 else 0 end as is_today
					from ${eventLogs}
					inner join ${members} on ${members.userId} = ${eventLogs.userId}
					inner join ${organizationProjectAssignments} on
						${organizationProjectAssignments.userId} = ${eventLogs.userId}
						and ${organizationProjectAssignments.normalizedSourceProject} = lower(${eventLogs.project})
					inner join ${organizationProjects} on
						${organizationProjects.id} = ${organizationProjectAssignments.organizationProjectId}
						and ${organizationProjects.organizationId} = ${organizationId}
					where ${eventFilter}
				)
				select count(*)::int as minutes,
					coalesce(sum(is_today), 0)::int as "minutesToday"
				from project_minutes
			`);
			const activity = result[0];

			return {
				timeTotal: toTimeString(activity?.minutes ?? 0, input.biggestUnit),
				timeToday: toTimeString(activity?.minutesToday ?? 0, input.biggestUnit),
			};
		}),

	getTop: protectedProcedure
		.use(serverOnlyMiddleware)
		.input(
			z.object({
				timeRange: z.enum(timeRangeValues),
				biggestUnit: z.enum(["hour", "day", "week"]).optional(),
				filter: z.object({
					user: z.string().or(z.literal("")),
					editor: z.string().or(z.literal("")),
					workspace: z.string().or(z.literal("")),
					language: z.string().or(z.literal("")),
					platform: z.string().or(z.literal("")),
				}),
			}),
		)
		.query(async ({ ctx, input }) => {
			const organizationId = ctx.user.organizationId;
			if (!organizationId) return null;

			const regional = ctx.user.accountConfig.regional;
			const [start, end] = getTimeRange(input.timeRange, regional.timeZone, undefined, regional.startOfWeek);
			const eventFilter = and(
				eq(members.organizationId, organizationId),
				input.filter.user ? eq(users.name, input.filter.user) : undefined,
				start ? gte(eventLogs.eventTime, start) : undefined,
				end ? lt(eventLogs.eventTime, end) : undefined,
				input.filter.editor ? eq(eventLogs.editor, input.filter.editor) : undefined,
				input.filter.language ? eq(eventLogs.language, input.filter.language) : undefined,
				input.filter.platform ? eq(eventLogs.platform, input.filter.platform) : undefined,
				input.filter.workspace ? eq(organizationProjects.name, input.filter.workspace) : undefined,
			);
			type Dimension = "user" | "editor" | "workspace" | "language" | "platform";
			type RankedRow = {
				dimension: Dimension;
				id: string;
				value: string;
				image: string | null;
				shareAllTime: boolean | null;
				minutes: number;
				percentage: number;
				rank: number;
			};
			const rows = await ctx.db.execute<RankedRow>(sql`
				with member_events as materialized (
					select distinct on (${eventLogs.userId}, date_trunc('minute', ${eventLogs.eventTime}))
						${eventLogs.userId} as user_id,
						${eventLogs.eventTime} as event_time,
						${eventLogs.editor} as editor,
						${eventLogs.language} as language,
						${eventLogs.platform} as platform,
						${users.name} as user_name,
						${users.image} as user_image,
						${organizationProjects.id} as project_id,
						${organizationProjects.name} as project_name,
						coalesce(${users.accountConfig} #>> '{personalOrg,shareAllTime}', 'false') = 'true' as share_all_time
					from ${eventLogs}
					inner join ${members} on ${members.userId} = ${eventLogs.userId}
					inner join ${users} on ${users.id} = ${eventLogs.userId}
					left join ${organizationProjectAssignments} on
						${organizationProjectAssignments.userId} = ${eventLogs.userId}
						and ${organizationProjectAssignments.normalizedSourceProject} = lower(${eventLogs.project})
					left join ${organizationProjects} on
						${organizationProjects.id} = ${organizationProjectAssignments.organizationProjectId}
						and ${organizationProjects.organizationId} = ${organizationId}
					where ${eventFilter}
					order by ${eventLogs.userId}, date_trunc('minute', ${eventLogs.eventTime}), ${eventLogs.eventTime}
				), grouped as (
					select 'user' as dimension, user_id as id, user_name as value, user_image as image,
						share_all_time as share_all_time,
						count(*)::int as minutes
					from member_events where share_all_time or project_id is not null
					group by user_id, user_name, user_image, share_all_time
					union all
					select 'editor', editor, editor, null::text, null::boolean, count(*)::int
					from member_events where project_id is not null group by editor
					union all
					select 'workspace', project_id, project_name, null::text, null::boolean, count(*)::int
					from member_events where project_id is not null group by project_id, project_name
					union all
					select 'language', language, language, null::text, null::boolean, count(*)::int
					from member_events where project_id is not null group by language
					union all
					select 'platform', platform, platform, null::text, null::boolean, count(*)::int
					from member_events where project_id is not null group by platform
				), totals as (
					select 'user' as dimension, count(*)::int as minutes
					from member_events where share_all_time or project_id is not null
					union all
					select dimension, count(*)::int
					from member_events
					cross join (values ('editor'), ('workspace'), ('language'), ('platform')) dimensions(dimension)
					where project_id is not null group by dimension
				), ranked as (
					select grouped.*, round(grouped.minutes::numeric / nullif(totals.minutes, 0) * 100, 2)::float as percentage,
						row_number() over (partition by grouped.dimension order by grouped.minutes desc, grouped.value) as rank
					from grouped inner join totals using (dimension)
				)
				select dimension, id, value, image, share_all_time as "shareAllTime", minutes, percentage, rank::int
				from ranked where rank <= 5 order by dimension, rank
			`);

			const rankedItems = (dimension: Dimension) => {
				const dimensionRows = rows.filter((row) => row.dimension === dimension);
				const item = (index: number) => ({
					id: dimensionRows[index]?.id ?? "",
					value: dimensionRows[index]?.value ?? "",
					image: dimensionRows[index]?.image ?? null,
					shareAllTime: dimensionRows[index]?.shareAllTime ?? false,
					time: toTimeString(dimensionRows[index]?.minutes ?? 0, input.biggestUnit),
					percentage: dimensionRows[index]?.percentage ?? 0,
				});
				return { p1: item(0), p2: item(1), p3: item(2), p4: item(3), p5: item(4) };
			};

			return {
				user: rankedItems("user"),
				editor: rankedItems("editor"),
				workspace: rankedItems("workspace"),
				language: rankedItems("language"),
				platform: rankedItems("platform"),
			};
		}),

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
