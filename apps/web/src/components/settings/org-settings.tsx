"use client";

import { authClient } from "~/server/better-auth/client";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "../ui/dialog";
import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { InputGroup, InputGroupAddon, InputGroupText, InputGroupTextarea } from "../ui/input-group";
import { useDisclosure } from "@mantine/hooks";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "~/provider/session-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { formatDate, formatDistanceToNowStrict } from "date-fns";
import { useConfirmModal } from "../ui/confirm-modal";
import { tryCatch } from "~/lib/utils";

export const normalizeSlug = (value: string) =>
	value
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/_/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/^[^a-z]+/, "")
		.replace(/-+/g, "-")
		.replace(/-$/, "");

export default function DataManagement() {
	const { user, org, invitations } = useSession();

	const [opened, { toggle }] = useDisclosure();
	const router = useRouter();

	const { mutateAsync: acceptInvite } = api.org.invites.acceptInvite.useMutation();

	const { mutate } = api.org.create.useMutation({
		onSuccess: () => {
			router.refresh();
			toggle();
			toast.success("Organization created successfully.", { id: "create-org", description: undefined });
		},
		onMutate: () => {
			toast.loading("Creating organization...", { id: "create-org", description: undefined });
		},
		onError: (e) => {
			toast.error("Failed to create organization.", { id: "create-org", description: e.message });
		},
	});

	const orgSchema = z.object({
		orgName: z.string().min(5, "Name must be at least 5 characters.").max(32, "Name must be at most 32 characters."),
		slug: z
			.string()
			.min(5, "Slug must be at least 5 characters.")
			.max(32, "Slug must be at most 32 characters.")
			.regex(
				/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
				"Slug must start with a lowercase letter and contain only lowercase letters, numbers, and single hyphens.",
			),
		logo: z.string().min(5, "Logo must be at least 5 characters.").or(z.literal("")),
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
			mutate({
				name: value.orgName,
				slug: value.slug,
				logo: value.logo,
			});
		},
	});

	if (!user.organizationId)
		return (
			<Card>
				<CardContent>No active organization</CardContent>
				{/*<Button
					onClick={async () => {
						const { data, error } = await authClient.organization.setActive({
							organizationSlug: "starlightv",
						});
						Print.Debug(data, error);
						router.refresh();
					}}
				>
					Create Organization
				</Button>*/}

				{!!invitations?.length && (
					<CardDescription className="space-y-2 px-4">
						<span className="text-sm text-muted-foreground">Pending invitations: {invitations.length}</span>

						{invitations.map((invitation) => (
							<div className="flex justify-between" key={invitation.id}>
								<div className="flex items-center space-x-2">
									<Avatar size="sm">
										<AvatarImage src={invitation.organization.logo!} alt={invitation.user.name} />
										<AvatarFallback>{invitation.organization.name.slice(0, 2).toUpperCase()}</AvatarFallback>
									</Avatar>
									<span className="text-md">{invitation.organization.name}</span>
									<span className="text-md">
										{"Created: "}
										{formatDate(invitation.organization.createdAt, "dd.MM.yyyy")}
										{" - "}
										{formatDistanceToNowStrict(invitation.organization.createdAt, {
											addSuffix: true,
										})}
									</span>
								</div>
								<Button
									onClick={async () => {
										const result = await confirmModal({
											content: "Are you sure you want to accept this invitation?",
											title: `Accept invitation to ${invitation.organization.name}`,
											confirmLabel: "Accept",
										});
										if (result) {
											toast.loading("Accepting invitation...", { id: "accept-invitation", description: undefined });
											const { data, error } = await tryCatch(acceptInvite({ invitationId: invitation.id }));
											if (data) {
												toast.success("Invitation accepted.", { id: "accept-invitation" });
												router.refresh();
											}
											if (error) {
												toast.error("Failed to accept invitation.", { id: "accept-invitation", description: error.message });
											}
										}
									}}
								>
									Accept
								</Button>
							</div>
						))}
					</CardDescription>
				)}

				{/*<CardDescription className="whitespace-pre-wrap">{JSON.stringify(org, null, 2)}</CardDescription>*/}
				<CardFooter>
					<Dialog open={opened} onOpenChange={toggle}>
						<DialogTrigger render={
							<Button>Create Organization</Button>
						}/>
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
													<FieldLabel htmlFor={field.name}>Organization Name</FieldLabel>
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
													<Input
														id={field.name}
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(normalizeSlug(e.target.value))}
														aria-invalid={isInvalid}
														placeholder="starlight"
														autoComplete="off"
													/>
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
														onChange={(e) => field.handleChange(normalizeSlug(e.target.value))}
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

							<span className="text-sm text-muted-foreground">You can only create one organization per account.</span>

							<DialogFooter>
								<form.Subscribe
									selector={(state) => [state.canSubmit, state.isSubmitting]}
									children={([canSubmit, isSubmitting]) => (
										<>
											<Button variant="outline" disabled={isSubmitting} onClick={() => form.reset()}>
												Cancel
											</Button>
											<Button disabled={!canSubmit || isSubmitting} type="submit" form="create-org-form">
												Create
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

	// Print.Debug(activeOrganization);

	return (
		<Card>
			<CardContent></CardContent>
		</Card>
	);
}

