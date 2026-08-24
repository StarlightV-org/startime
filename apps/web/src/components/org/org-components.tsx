"use client";

import type { SessionType } from "better-auth";
import { Card, CardContent, CardHeader } from "../ui/card";
import type { OrgType } from "better-auth";
import { Separator } from "../ui/separator";
import { Fragment } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { formatDate, formatDistanceToNowStrict } from "date-fns";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import { authClient } from "~/server/better-auth/client";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "../ui/dialog";
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
import { TrashIcon } from "lucide-react";
import { useConfirmModal } from "../ui/confirm-modal";

import { tryCatch } from "~/lib/utils";
import { Trans, useLingui } from "@lingui/react/macro";
import { roleLabels } from "../settings/org-settings";

export function MemberList({ org }: { org: SessionType["org"] }) {
	const checkRole = useRole();

	if (!org) return null;
	if (!org.members) return null;
	if (org.members.length === 0) return null;

	return (
		<Card className="w-full">
			<CardContent>
				<div className="flex items-center justify-between pb-2">
					<h1 className="text-2xl">Members</h1>
					{checkRole("admin") && <InviteMember />}
				</div>
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
			<DialogTrigger asChild>
				<Button variant="secondary">
					<Trans>Invite Member</Trans>
				</Button>
			</DialogTrigger>
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
