"use client";

import { authClient } from "~/server/better-auth/client";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "../ui/dialog";
import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { useDisclosure } from "@mantine/hooks";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "~/provider/session-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { formatDate, formatDistanceToNowStrict } from "date-fns";
import { useConfirmModal } from "../ui/confirm-modal";
import { tryCatch } from "~/lib/utils";
import { Trans, useLingui } from "@lingui/react/macro";
import { CheckIcon, DoorOpenIcon, UserIcon, XIcon } from "lucide-react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Spinner } from "../ui/spinner";
import { useState } from "react";

export const normalizeSlug = (value: string) =>
	value
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/_/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/^[^a-z]+/, "")
		.replace(/-+/g, "-")
		.replace(/-$/, "");

export const roleLabels: Record<string, MessageDescriptor> = {
	owner: msg`Owner`,
	admin: msg`Admin`,
	member: msg`Member`,
};

export default function OrgSettings() {
	const { user, org, invitations } = useSession();

	const [opened, { toggle }] = useDisclosure();
	const router = useRouter();
	const { t, i18n } = useLingui();

	const { mutateAsync: acceptInvite } = api.org.invites.acceptInvite.useMutation();
	const { mutateAsync: declineInvite } = api.org.invites.declineInvite.useMutation();
	const { mutateAsync: leaveOrganization } = api.org.members.leave.useMutation();
	const [slugCheck, setSlugCheck] = useState<{ slug: string; isTaken: boolean }>();

	const { mutateAsync: checkSlugTaken, isPending: isCheckingSlug } = api.org.isSlugTaken.useMutation();

	const { mutate } = api.org.create.useMutation({
		onSuccess: () => {
			router.refresh();
			toggle();
			toast.success(t`Organization created successfully.`, { id: "create-org", description: undefined });
		},
		onMutate: () => {
			toast.loading(t`Creating organization...`, { id: "create-org", description: undefined });
		},
		onError: (e) => {
			toast.error(t`Failed to create organization.`, { id: "create-org", description: i18n._(e.message) });
		},
	});

	const orgSchema = z.object({
		orgName: z
			.string()
			.min(5, t`Name must be at least 5 characters.`)
			.max(32, t`Name must be at most 32 characters.`),
		slug: z
			.string()
			.min(5, t`Slug must be at least 5 characters.`)
			.max(32, t`Slug must be at most 32 characters.`)
			.regex(
				/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
				t`Slug must start with a lowercase letter and contain only lowercase letters, numbers, and single hyphens.`,
			),
		logo: z
			.string()
			.min(5, t`Logo must be at least 5 characters.`)
			.or(z.literal("")),
	});

	const confirmModal = useConfirmModal();

	const form = useForm({
		defaultValues: {
			orgName: "",
			slug: "",
			logo: "",
		},
		validators: {
			// onChange: orgSchema,
			onSubmit: orgSchema,
			// onBlur: orgSchema,
		},
		defaultState: {
			isValid: false,
		},

		onSubmit: async ({ value }) => {
			if (await checkSlugTaken({ slug: value.slug })) {
				form.setErrorMap({ onSubmit: { fields: { slug: t`This slug is already taken. Please choose a different one.` } } });
				return;
			}

			mutate({
				name: value.orgName,
				slug: value.slug,
				logo: value.logo,
			});
		},
	});

	const ownerCount = org?.members?.filter((m) => m.role === "owner").length ?? 1;
	// If the user is not an owner, or there is more than one owner, they can leave the organization.
	const canLeave = org?.membership?.role !== "owner" || ownerCount > 1;

	if (!user.organizationId)
		return (
			<Card data-docs="/docs/startime/settings#your-organisation">
				<CardContent>
					<Trans>No active organization</Trans>
				</CardContent>
				{!!invitations?.length && (
					<CardDescription className="space-y-2 px-4">
						<span className="text-sm text-muted-foreground">
							<Trans>Pending invitations: {invitations.length}</Trans>
						</span>

						{invitations.map((invitation) => (
							<div className="flex justify-between" key={invitation.id}>
								<div className="flex items-center space-x-2">
									<Avatar size="sm">
										<AvatarImage src={invitation.organization.logo!} alt={invitation.user.name} />
										<AvatarFallback visible={!invitation.organization.logo}>
											{invitation.organization.name.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="text-md">{invitation.organization.name}</span>
									<span className="text-md">
										<Trans>Created At</Trans> {formatDate(invitation.organization.createdAt, "dd.MM.yyyy")}
										{" - "}
										{formatDistanceToNowStrict(invitation.organization.createdAt, {
											addSuffix: true,
										})}
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="secondary"
										onClick={async () => {
											const result = await confirmModal({
												content: t`Are you sure you want to decline this invitation? You will need to be invited again to join this organization.`,
												title: t`Decline invitation to ${invitation.organization.name}`,
												confirmLabel: "Decline",
											});
											if (result) {
												toast.loading(t`Declining invitation...`, { id: "decline-invitation", description: undefined });
												const { data, error } = await tryCatch(declineInvite({ invitationId: invitation.id }));
												if (data) {
													toast.success(t`Invitation declined.`, { id: "decline-invitation" });
													router.refresh();
												}
												if (error) {
													toast.error(t`Failed to decline invitation.`, { id: "decline-invitation", description: error.message });
												}
											}
										}}
									>
										<Trans>Decline</Trans>
									</Button>
									<Button
										onClick={async () => {
											const result = await confirmModal({
												content: t`Are you sure you want to accept this invitation?`,
												title: t`Accept invitation to ${invitation.organization.name}`,
												confirmLabel: "Accept",
											});
											if (result) {
												toast.loading(t`Accepting invitation...`, { id: "accept-invitation", description: undefined });
												const { data, error } = await tryCatch(acceptInvite({ invitationId: invitation.id }));
												if (data) {
													toast.success(t`Invitation accepted.`, { id: "accept-invitation" });
													router.refresh();
												}
												if (error) {
													toast.error(t`Failed to accept invitation.`, { id: "accept-invitation", description: error.message });
												}
											}
										}}
									>
										<Trans>Accept</Trans>
									</Button>
								</div>
							</div>
						))}
					</CardDescription>
				)}

				{/*<CardDescription className="whitespace-pre-wrap">{JSON.stringify(org, null, 2)}</CardDescription>*/}
				<CardFooter>
					<Dialog open={opened} onOpenChange={toggle}>
						<DialogTrigger
							render={
								<Button>
									<Trans>Create Organization</Trans>
								</Button>
							}
						/>
						<DialogContent>
							<form
								id="create-org-form"
								onSubmit={(e) => {
									e.preventDefault();
									form.handleSubmit();
								}}
								data-op-ignore
							>
								<FieldGroup>
									<form.Field
										name="orgName"
										children={(field) => {
											const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>
														<Trans>Organization Name</Trans>
													</FieldLabel>
													<Input
														id={field.name}
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => {
															field.handleChange(e.target.value);

															form.setFieldValue("slug", normalizeSlug(e.target.value));
														}}
														aria-invalid={isInvalid}
														placeholder="Starlight"
														autoComplete="off"
														data-op-ignore
													/>
													{isInvalid && <FieldError errors={field.state.meta.errors} />}
												</Field>
											);
										}}
									/>
									<form.Field
										name="slug"
										children={(field) => {
											const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>Slug</FieldLabel>
													<InputGroup>
														<InputGroupInput
															id={field.name}
															name={field.name}
															value={field.state.value}
															onBlur={(event) => {
																field.handleBlur();
																const slug = normalizeSlug(event.target.value);
																void checkSlugTaken({ slug })
																	.then((isTaken) => {
																		if (form.state.values.slug === slug) setSlugCheck({ slug, isTaken });
																	})
																	.catch(() => undefined);
															}}
															onChange={(event) => {
																setSlugCheck(undefined);
																field.handleChange(normalizeSlug(event.target.value));
															}}
															aria-invalid={isInvalid}
															placeholder="starlight"
															autoComplete="off"
														/>
														<InputGroupAddon align="inline-end">
															{isCheckingSlug ? (
																<Spinner />
															) : slugCheck?.slug !== field.state.value || !slugCheck.isTaken ? (
																<CheckIcon className="text-green-500" />
															) : (
																<XIcon className="text-red-500" />
															)}
														</InputGroupAddon>
													</InputGroup>
													{slugCheck?.slug === field.state.value && slugCheck.isTaken && (
														<FieldError errors={[{ message: t`This slug is already taken. Please choose a different one.` }]} />
													)}
													{isInvalid && <FieldError errors={field.state.meta.errors} />}
												</Field>
											);
										}}
									/>
									<form.Field
										name="logo"
										children={(field) => {
											const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>Logo</FieldLabel>
													<Input
														id={field.name}
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
														placeholder="https://your-organization-logo.com"
														autoComplete="off"
													/>
													{isInvalid && <FieldError errors={field.state.meta.errors} />}
												</Field>
											);
										}}
									/>
								</FieldGroup>
							</form>

							<span className="text-sm text-muted-foreground">
								<Trans>You can only create one organization per account.</Trans>
							</span>

							<DialogFooter>
								<form.Subscribe
									selector={(state) => [state.canSubmit, state.isSubmitting]}
									children={([canSubmit, isSubmitting]) => (
										<>
											<Button variant="outline" disabled={isSubmitting} onClick={() => form.reset()}>
												<Trans>Cancel</Trans>
											</Button>
											<Button disabled={!canSubmit || isSubmitting} type="submit" form="create-org-form">
												<Trans>Create</Trans>
											</Button>
										</>
									)}
								/>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</CardFooter>
			</Card>
		);

	return (
		<Card data-docs="/docs/startime/settings#your-organisation">
			<CardHeader>
				<CardTitle>
					<Trans>Your Organization</Trans>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center justify-between gap-2">
				<div className="flex flex-row items-center gap-2">
					<Avatar size="lg">
						<AvatarImage src={org?.logo!} alt={org?.name} />
						<AvatarFallback visible={!org?.logo}>
							<span>{org?.name?.slice(0, 2).toUpperCase()}</span>
						</AvatarFallback>
					</Avatar>
					<h1 className="text-2xl">{org?.name}</h1>
					<div className="flex items-center gap-2">
						<Trans>Role: </Trans>
						{i18n._(roleLabels[org?.membership?.role!]!)}
					</div>
				</div>

				<div className="flex items-center gap-2">
					<span
						className="flex items-center gap-1"
						title={(org?.members.length ?? 0) > 1 ? t`${org?.members.length} members` : t`${org?.members.length} member`}
					>
						{org?.members?.length ?? 0}
						<UserIcon className="size-4" />
					</span>
					<div>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										variant="outline"
										className={!canLeave ? "cursor-not-allowed opacity-50 active:not-aria-[haspopup]:translate-y-0" : ""}
										onClick={async () => {
											if (!canLeave) {
												return;
											}
											const result = await confirmModal({
												content: t`Are you sure you want to leave this organization?`,
												title: t`Leave Organization`,
												confirmLabel: t`Leave`,
											});
											if (!result) {
												return;
											}
											toast.loading(t`Leaving organization...`, { id: "leave-org", description: undefined });
											const { error } = await tryCatch(leaveOrganization());
											if (error) {
												toast.error(t`Failed to leave organization.`, { id: "leave-org", description: error.message });
												return;
											}
											toast.success(t`You left the organization.`, { id: "leave-org" });
											router.refresh();
										}}
									>
										<DoorOpenIcon className="size-4" />
										<Trans>Leave</Trans>
									</Button>
								}
							/>

							<TooltipContent className="text-center" hidden={canLeave}>
								{canLeave ? null : (
									<span>
										<Trans>
											You cannot leave this organization.
											<br />
											Transfer ownership to another member or delete it.
										</Trans>
									</span>
								)}
							</TooltipContent>
						</Tooltip>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
