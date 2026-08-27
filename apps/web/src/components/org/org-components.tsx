"use client";

import type { SessionType } from "better-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import type { OrgType } from "better-auth";
import { Separator } from "../ui/separator";
import React, { Fragment } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { formatDate, formatDistanceToNowStrict } from "date-fns";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import { authClient } from "~/server/better-auth/client";
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useForm } from "@tanstack/react-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import z from "zod";
import { Button } from "../ui/button";
import { api } from "~/trpc/react";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useRole, useSession } from "~/provider/session-provider";
import { InfoIcon, PenIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useConfirmModal } from "../ui/confirm-modal";

import { cn, tryCatch } from "~/lib/utils";
import { Trans, useLingui } from "@lingui/react/macro";
import { roleLabels } from "../settings/org-settings";
import type { API } from "~/trpc/server";
import { Badge } from "../ui/badge";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from "../ui/combobox";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function MemberList({ org }: { org: SessionType["org"] }) {
	const checkRole = useRole();

	if (!org) return null;
	if (!org.members) return null;
	if (org.members.length === 0) return null;

	return (
		<Card className="w-full gap-0">
			<CardHeader className="flex items-center justify-between pb-2">
				<CardTitle className="text-2xl">
					<Trans>Members</Trans>
				</CardTitle>
				{checkRole("admin") && <InviteMember />}
			</CardHeader>
			<CardContent>
				{org.members.map((member, i) => {
					return (
						<Fragment key={member.id}>
							<MemberListItem member={member} />
							{i !== org.members.length - 1 && <Separator />}
						</Fragment>
					);
				})}
				{!!org.invitations?.length && (
					<div>
						<Separator className="my-2" />
						<h1 className="text-lg">Pending Invites</h1>

						{org.invitations.map((inv, i) => {
							return (
								<Fragment key={inv.id}>
									<div className="flex items-center gap-2 p-1">
										<Avatar size="sm">
											<AvatarImage src={inv.user.image!} alt={inv.user.name} />
										</Avatar>
										<span>{inv.user.name}</span>
									</div>
									{i !== (org.invitations?.length ?? 0) - 1 && <Separator />}
								</Fragment>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function MemberListItem({ member }: { member: OrgType["members"][number] }) {
	const router = useRouter();
	const checkRole = useRole();
	const { user } = useSession();
	const confirmModal = useConfirmModal();
	const { mutate: updateRole } = api.org.members.updateMemberRole.useMutation({
		onSuccess: ({ newRole }) => {
			router.refresh();
			toast.success("Role updated", {
				description: `Role for ${member.user.name} has been set to ${newRole}`,
				id: `role-update-${member.id}`,
			});
		},
		onError: (e) => {
			toast.error("Failed to update role", {
				id: `role-update-${member.id}`,
				description: e.message,
			});
		},
		onMutate: () => {
			toast.loading("Updating role", {
				id: `role-update-${member.id}`,
			});
		},
	});
	const { t, i18n } = useLingui();

	const { mutateAsync: kickMember } = api.org.members.kickMember.useMutation();

	const canEditMember =
		(checkRole("owner") && user.id !== member.userId) ||
		(checkRole("admin") && user.id !== member.userId && member.role !== "owner");

	return (
		<div className="flex items-center justify-between space-x-2 rounded-md p-1 hover:bg-card-foreground/10">
			<div className="flex items-center space-x-2">
				<Avatar size="sm">
					<AvatarImage src={member.user.image!} alt={member.user.name} />
					<AvatarFallback visible={!member.user.image}>{member.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
				</Avatar>
				<span className="text-md">{member.user.name}</span>
				<span className="text-md">
					{formatDate(member.user.createdAt, "dd.MM.yyyy")}
					{" - "}
					{formatDistanceToNowStrict(member.user.createdAt, {
						addSuffix: true,
					})}
				</span>
			</div>
			{canEditMember ? (
				<div className="flex w-1/3 items-center justify-end gap-2">
					<Select
						value={member.role}
						defaultValue={member.role}
						onValueChange={async (value) => {
							if (value === member.role) return;

							if (value === "owner") {
								if (!checkRole("owner")) return;
								const confirmed = await confirmModal({
									title: t`Change role`,
									closeOnClickOutside: true,
									content: (
										<Trans>
											<p>
												Are you sure you want to change the role of "{member.user.name}" to{" "}
												<strong className="text-destructive">owner</strong>?
												<br />
												They will be able to do everything, including changing{" "}
												<strong className="text-destructive">your role</strong>.
											</p>
										</Trans>
									),
								});
								if (!confirmed) return;
							}

							updateRole({ role: value as "owner" | "admin" | "member", userId: member.userId });
						}}
					>
						<SelectTrigger className="w-full max-w-40">
							<SelectValue fallback={i18n._(roleLabels[member.role!]!)} placeholder="Select a role" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="owner" disabled={!checkRole("owner")}>
									{i18n._(roleLabels.owner!)}
								</SelectItem>
								<SelectItem value="admin">{i18n._(roleLabels.admin!)}</SelectItem>
								<SelectItem value="member">{i18n._(roleLabels.member!)}</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
					<Button
						className="aspect-square size-8"
						variant="destructive"
						onClick={async () => {
							const result = await confirmModal({
								content: (
									<Trans>
										<div>
											Are you sure you want to kick "{member.user.name}"? <br />
											this action cannot be undone.
										</div>
									</Trans>
								),
								title: t`Kick Member`,
								closeOnClickOutside: true,
								confirmLabel: t`Kick "${member.user.name}"`,
								delay: 2000,
							});

							if (!result) return;
							toast.loading(t`Kicking member`, {
								id: "kick-member",
							});

							const { data, error } = await tryCatch(kickMember({ userId: member.userId }));

							if (error) {
								toast.error(t`Failed to kick member`, {
									id: "kick-member",
									description: error.message,
								});
								return;
							}

							toast.success(t`Member kicked`, {
								id: "kick-member",
								description: undefined,
							});
							router.refresh();
						}}
					>
						<TrashIcon />
					</Button>
				</div>
			) : null}
		</div>
	);
}

export function InviteMember() {
	const [open, { toggle }] = useDisclosure();
	const router = useRouter();
	const { t } = useLingui();

	const { mutate } = api.org.invites.createInvite.useMutation({
		onSuccess: () => {
			form.reset();
			router.refresh();
			toggle();
			toast.success(t`Member invited successfully`, {
				id: "invite-member",
				description: undefined,
			});
		},
		onError: (e) => {
			toast.error(t`Failed to invite member`, {
				id: "invite-member",
				description: e.message,
			});
		},
		onMutate: () => {
			toast.loading(t`Inviting member...`, {
				id: "invite-member",
				description: undefined,
			});
		},
	});

	const form = useForm({
		defaultValues: {
			email: "",
		},
		validators: {
			onSubmit: z.object({
				email: z.email(),
			}),
		},
		onSubmit: async ({ value }) => {
			mutate(value);
		},
	});

	return (
		<Dialog open={open} onOpenChange={toggle}>
			<DialogTrigger
				render={
					<Button variant="outline" size="sm">
						<Trans>Invite Member</Trans>
					</Button>
				}
			/>
			<DialogContent>
				<form
					id="invite-member-form"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field
							name="email"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Email</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="example@example.com"
											autoComplete="off"
										/>
										<FieldDescription>
											<Trans>
												Email of the user you want to invite. <br /> They will be invited with the role "Member".
											</Trans>
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
					</FieldGroup>
				</form>
				<DialogFooter>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
						children={([canSubmit, isSubmitting]) => (
							<>
								<Button
									variant="outline"
									disabled={isSubmitting}
									onClick={() => {
										toggle();
										form.reset();
									}}
								>
									<Trans>Cancel</Trans>
								</Button>
								<Button disabled={!canSubmit || isSubmitting} type="submit" form="invite-member-form">
									<Trans>Invite</Trans>
								</Button>
							</>
						)}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function ProjectList({ org, projects }: { org: SessionType["org"]; projects: API["org"]["projects"]["list"] }) {
	const checkRole = useRole();
	return (
		<Card className="gap-0">
			<CardHeader className="flex items-center justify-between">
				<CardTitle className="text-2xl">
					<Trans>Projects</Trans>
				</CardTitle>
				{checkRole("admin") && <CreateProjectDialog org={org} />}
			</CardHeader>
			<CardDescription>
				{projects.map((project) => (
					<div key={project.id}>
						<ProjectItem project={project} />
					</div>
				))}
			</CardDescription>
		</Card>
	);
}

function ProjectItem({ project }: { project: API["org"]["projects"]["list"][number] }) {
	const checkRole = useRole();
	const confirmModal = useConfirmModal();
	const { t } = useLingui();
	const router = useRouter();

	const { mutate: deleteProject } = api.org.projects.delete.useMutation({
		onSuccess: () => {
			toast.success(t`Project deleted`, {
				id: project.id,
				description: undefined,
			});
			router.refresh();
		},
		onError: (e) => {
			toast.error(t`Failed to delete project`, {
				description: e instanceof Error ? e.message : String(e),
				id: project.id,
			});
		},
		onMutate: () => {
			toast.loading(t`Deleting project`, {
				id: project.id,
				description: undefined,
			});
		},
	});

	return (
		<div className="flex items-center justify-between border-b-2 border-b-border p-1">
			<p className="flex h-fit items-center gap-1">
				<span>{project.name}</span>
				{project.description && (
					<Tooltip>
						<TooltipTrigger>
							<InfoIcon className="size-4" />
						</TooltipTrigger>
						<TooltipContent className="max-w-xs text-pretty">
							<p>{project.description}</p>
						</TooltipContent>
					</Tooltip>
				)}
			</p>
			<div className="flex items-center gap-2">
				{checkRole("member") && <AssignProjectDialog project={project} />}
				{checkRole("admin") && <UpdateProjectDialog project={project} />}
				{checkRole("owner") && (
					<Button
						variant="destructive"
						size="icon-sm"
						onClick={async () => {
							const result = await confirmModal({
								title: t`Delete project`,
								content: t`Are you sure you want to delete the project: "${project.name}"?`,
								confirmLabel: t`Delete`,
								delay: 2000,
							});
							if (!result) return;
							deleteProject({
								projectId: project.id,
							});
						}}
					>
						<TrashIcon />
					</Button>
				)}
			</div>
		</div>
	);
}

function CreateProjectDialog({ org }: { org: SessionType["org"] }) {
	const router = useRouter();
	const [opened, { toggle }] = useDisclosure();
	const { t } = useLingui();

	const form = useForm({
		defaultValues: {
			projectName: "",
			description: "",
		},
		validators: {
			onSubmit: z.object({
				projectName: z.string().min(5, t`Project name must be at least 5 characters`),
				description: z
					.string()
					.min(5, t`Description must be at least 5 characters`)
					.max(100, t`Description must be at most 100 characters`)
					.or(z.literal("")),
			}),
		},
		onSubmit: async (values) => {
			createProject({ name: values.value.projectName, description: values.value.description });
		},
	});

	const { mutate: createProject } = api.org.projects.create.useMutation({
		onSuccess: () => {
			toast.success(t`Project created successfully`, {
				id: "create-project",
				description: undefined,
			});
			toggle();
			form.reset();
			router.refresh();
		},
		onError: (error) => {
			toast.error(t`Failed to create project`, {
				id: "create-project",
				description: error.message,
			});
		},
		onMutate: () => {
			toast.loading(t`Creating project...`, {
				id: "create-project",
				description: undefined,
			});
		},
	});

	return (
		<Dialog open={opened} onOpenChange={toggle}>
			<DialogTrigger
				render={
					<Button variant="outline" size="sm">
						<PlusIcon />
						<Trans>Create Project</Trans>
					</Button>
				}
			></DialogTrigger>
			<DialogContent>
				<DialogTitle>
					<Trans>Create Project</Trans>
				</DialogTitle>
				<form
					id="create-project-form"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field
							name="projectName"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel required htmlFor={field.name}>
											<Trans>Project Name</Trans>
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="startime"
											autoComplete="off"
										/>
										<FieldDescription>
											<Trans>The name of the project you want to create.</Trans>
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
						<form.Field
							name="description"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											<Trans>Description</Trans>
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="Codetime tracking app"
											autoComplete="off"
										/>
										<FieldDescription>
											<Trans>A short description of the project you want to create.</Trans>
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
					</FieldGroup>
				</form>
				<DialogFooter>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
						children={([canSubmit, isSubmitting]) => (
							<>
								<Button
									variant="outline"
									disabled={isSubmitting}
									onClick={() => {
										toggle();
										form.reset();
									}}
								>
									<Trans>Cancel</Trans>
								</Button>
								<Button disabled={!canSubmit || isSubmitting} type="submit" form="create-project-form">
									<Trans>Create Project</Trans>
								</Button>
							</>
						)}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function UpdateProjectDialog({ project }: { project: API["org"]["projects"]["list"][number] }) {
	const router = useRouter();
	const [opened, { close, open }] = useDisclosure();
	const { t } = useLingui();
	const formId = `update-project-form-${project.id}`;

	const { mutateAsync: updateProject } = api.org.projects.edit.useMutation({
		onSuccess: () => {
			close();
			toast.success(t`Project updated`, {
				id: `update-project-${project.id}`,
			});
			router.refresh();
		},
		onError: (error) => {
			toast.error(t`Failed to update project`, {
				description: error.message,
				id: `update-project-${project.id}`,
			});
		},
	});

	const form = useForm({
		defaultValues: {
			projectName: project.name,
			description: project.description ?? "",
		},
		validators: {
			onSubmit: z.object({
				projectName: z.string().min(5, t`Project name must be at least 5 characters`),
				description: z
					.string()
					.min(5, t`Description must be at least 5 characters`)
					.max(100, t`Description must be at most 100 characters`)
					.or(z.literal("")),
			}),
		},
		onSubmit: async ({ value }) => {
			await updateProject({
				projectId: project.id,
				name: value.projectName,
				description: value.description,
			});
		},
	});

	const resetAndClose = () => {
		form.reset();
		close();
	};

	return (
		<Dialog
			open={opened}
			onOpenChange={(isOpen) => {
				if (isOpen) {
					open();
					return;
				}
				resetAndClose();
			}}
		>
			<DialogTrigger
				render={
					<Button variant="outline" size="icon-sm" aria-label={t`Update project`} className="text-foreground">
						<PenIcon />
					</Button>
				}
			/>
			<DialogContent>
				<DialogTitle>
					<Trans>Update Project</Trans>
				</DialogTitle>
				<form
					id={formId}
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field
							name="projectName"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel required htmlFor={field.name}>
											<Trans>Project Name</Trans>
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											aria-invalid={isInvalid}
											autoComplete="off"
										/>
										<FieldDescription>
											<Trans>The name of the organization project.</Trans>
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
						<form.Field
							name="description"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											<Trans>Description</Trans>
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											aria-invalid={isInvalid}
											autoComplete="off"
										/>
										<FieldDescription>
											<Trans>A short description of the project.</Trans>
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
					</FieldGroup>
				</form>
				<DialogFooter>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
						children={([canSubmit, isSubmitting]) => (
							<>
								<Button variant="outline" disabled={isSubmitting} onClick={resetAndClose}>
									<Trans>Cancel</Trans>
								</Button>
								<Button disabled={!canSubmit || isSubmitting} type="submit" form={formId}>
									<Trans>Update Project</Trans>
								</Button>
							</>
						)}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function AssignProjectDialog({ project }: { project: API["org"]["projects"]["list"][number] }) {
	const router = useRouter();
	const [opened, { toggle }] = useDisclosure();
	const anchor = useComboboxAnchor();
	const formId = `assign-project-form-${project.id}`;

	const assignement = project.assignments[0];
	const { data: projects } = api.self.listProjects.useQuery(undefined, {
		staleTime: 0,
		enabled: opened,
	});

	const { mutate: assignProject } = api.org.projects.assign.useMutation({
		onSuccess: () => {
			toggle();
			router.refresh();
		},
	});

	const { t } = useLingui();

	const form = useForm({
		defaultValues: {
			projects: project.assignments.map((a) => a.sourceProject),
		},
		validators: {
			onSubmit: z.object({
				projects: z.array(z.enum(projects ?? [])),
			}),
		},
		onSubmit: async (values) => {
			assignProject({
				projectId: project.id,
				userProjects: values.value.projects,
			});
			// createProject({ name: values.value.projectName, description: values.value.description });
		},
	});

	return (
		<Dialog
			open={opened}
			onOpenChange={() => {
				toggle();
				form.reset();
			}}
		>
			<DialogTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className={cn(
							"text-foreground",
							assignement ? "border-green-500/40! bg-green-500/30!" : "border-red-500/40! bg-red-500/30!",
						)}
					>
						{assignement ? t`Assigned` : t`Not assigned`}
					</Button>
				}
			></DialogTrigger>
			<DialogContent>
				<DialogTitle>
					<Trans>Assign Project: {project.name}</Trans>
				</DialogTitle>
				<form
					id={formId}
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field
							name="projects"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel required htmlFor={field.name}>
											<Trans>Project Name</Trans>
										</FieldLabel>
										<Combobox
											multiple
											items={projects}
											value={field.state.value}
											onValueChange={(value) => field.handleChange(value)}
											autoHighlight
											virtualized
										>
											<ComboboxChips ref={anchor} className="w-full">
												<ComboboxValue>
													{(values) => (
														<React.Fragment>
															{values.map((value: string) => (
																<ComboboxChip key={value}>{value}</ComboboxChip>
															))}
															<ComboboxChipsInput placeholder={values.length === 0 ? t`Select a project` : undefined} />
														</React.Fragment>
													)}
												</ComboboxValue>
											</ComboboxChips>
											<ComboboxContent anchor={anchor}>
												<ComboboxEmpty>No items found.</ComboboxEmpty>
												<ComboboxList>
													{(item) => (
														<ComboboxItem key={item} value={item}>
															{item}
														</ComboboxItem>
													)}
												</ComboboxList>
											</ComboboxContent>
										</Combobox>
										<FieldDescription>
											<Trans>Select a personal project, to add its time to the org.</Trans>
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
					</FieldGroup>
				</form>
				<DialogFooter>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting, state.values.projects]}
						children={([canSubmit, isSubmitting, projects]) => (
							<>
								<Button
									variant="outline"
									disabled={!!isSubmitting}
									onClick={() => {
										toggle();
										form.reset();
									}}
								>
									<Trans>Cancel</Trans>
								</Button>
								<Button type="submit" form={formId}>
									{project.assignments?.length === 0 ? (
										<Trans>Assign Project</Trans>
									) : typeof projects === "boolean" || !projects ? (
										<Trans>Update Project</Trans>
									) : projects.length === 0 ? (
										<Trans>Unassign Project</Trans>
									) : (
										<Trans>Update Project</Trans>
									)}
								</Button>
							</>
						)}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
