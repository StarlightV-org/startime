"use client";

import { CheckIcon, HourglassIcon, PenIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useForm } from "@tanstack/react-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import type { OrgType } from "better-auth";
import z from "zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { normalizeSlug } from "../settings/org-settings";
import { Switch } from "../ui/switch";
import { useDisclosure } from "@mantine/hooks";
import { useConfirmModal } from "../ui/confirm-modal";
import { api } from "~/trpc/react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Spinner } from "../ui/spinner";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

export default function EditOrg({ org }: { org: OrgType }) {
	const { t } = useLingui();
	const [opened, { toggle }] = useDisclosure();
	const confirmModal = useConfirmModal();
	const router = useRouter();

	const isOwner = org.membership?.role === "owner";

	const { mutate: updateOrg } = api.org.manage.update.useMutation({
		onSuccess: () => {
			router.refresh();
			toggle();
			toast.success(t`Organization updated successfully.`, { id: "update-org" });
		},
		onMutate: () => {
			toast.loading(t`Updating organization...`, { id: "update-org" });
		},
		onError: (error) => {
			toast.error(t`Failed to update organization.`, { id: "update-org", description: error.message });
		},
	});

	const { mutate: deleteOrg } = api.org.manage.delete.useMutation({
		onSuccess: () => {
			router.refresh();
			toggle();
			toast.success(t`Organization deleted successfully.`, { id: "delete-org" });
		},
		onMutate: () => {
			toast.loading(t`Deleting organization...`, { id: "delete-org" });
		},
		onError: (error) => {
			toast.error(t`Failed to delete organization.`, { id: "delete-org", description: error.message });
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
		public: z.boolean(),
	});

	const form = useForm({
		defaultValues: {
			orgName: org.name ?? "",
			slug: org.slug ?? "",
			logo: org.logo ?? "",
			public: org.public ?? false,
		},
		validators: {
			onSubmit: orgSchema,
		},

		onSubmit: async ({ value }) => {
			if (value.slug !== org.slug) {
				const confirmed = await confirmModal({
					title: t`Update Slug`,
					content: (
						<span>
							<Trans>
								Are you sure you want to update the slug for this organization? <br />
								This will change the URL to this organization's page.
							</Trans>
						</span>
					),
					closeOnClickOutside: false,
				});

				if (!confirmed) return;
			}

			updateOrg({
				name: value.orgName,
				slug: value.slug,
				logo: value.logo,
				public: value.public,
			});
		},
	});

	const {
		mutate: isSlugTaken,
		isPending,
		data: isTaken,
	} = api.org.isSlugTaken.useMutation({
		onSuccess: (isTaken) => {
			if (isTaken) {
				form.setErrorMap({ onSubmit: { fields: { slug: t`This slug is already taken. Please choose a different one.` } } });
			}
		},
	});

	return (
		<Dialog open={opened} onOpenChange={toggle}>
			<DialogTrigger asChild>
				<Button>
					<PenIcon className="size-4" />
					<Trans>Edit Org</Trans>
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>
					<Trans>Edit Org</Trans>
				</DialogTitle>
				<form
					id="edit-org-form"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
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
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="Startime"
											autoComplete="off"
										/>
										<FieldDescription>Name of the organization.</FieldDescription>
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
												onBlur={(e) => {
													field.handleBlur();
													isSlugTaken({ slug: normalizeSlug(e.target.value), orgId: org.id });
												}}
												onChange={(e) => field.handleChange(normalizeSlug(e.target.value))}
												aria-invalid={isInvalid}
												placeholder="Startime"
												autoComplete="off"
											/>
											<InputGroupAddon align="inline-end">
												{isPending ? (
													<Spinner />
												) : isTaken === undefined ? (
													<CheckIcon className="text-green-500" />
												) : !isTaken ? (
													<CheckIcon className="text-green-500" />
												) : (
													<XIcon className="text-red-500" />
												)}
											</InputGroupAddon>
										</InputGroup>
										<FieldDescription>
											<Trans>The URL slug for the organization.</Trans>
										</FieldDescription>
										{isTaken && (
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
										<FieldDescription>
											<Trans>Logo URL of your organization.</Trans>
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
						<form.Field
							name="public"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Public</FieldLabel>
										<div className="flex w-full items-center justify-between gap-2">
											<FieldDescription>
												<Trans>Can the organization be seen by other users? Project names will be hidden.</Trans>
											</FieldDescription>
											<Switch
												id={field.name}
												name={field.name}
												checked={field.state.value}
												onCheckedChange={(checked) => field.handleChange(checked)}
											/>
										</div>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
					</FieldGroup>
				</form>
				<DialogFooter>
					<div className={cn("flex w-full justify-between", { "justify-end": !isOwner })}>
						<Button
							variant="destructive"
							onClick={async () => {
								if (!org.id) return;
								const confirmed = await confirmModal({
									content: (
										<Trans>
											Are you sure you want to delete this organization? <br />
											<ul className="list-disc pt-4 pl-4 text-sm text-destructive">
												<li>
													<span>All members will be removed.</span>
												</li>
												<li>
													<span>Other configurations will be deleted.</span>
												</li>
												<li>
													<strong>This action cannot be undone.</strong>
												</li>
											</ul>
										</Trans>
									),
									title: t`Delete Organization: ${org.name}?`,
									requiredValue: org.slug,
									delay: 5 * 1000,
								});
								if (confirmed) deleteOrg({ orgId: org.id, confirm: confirmed });
							}}
						>
							<Trans>Delete</Trans>
						</Button>
						<form.Subscribe
							selector={(state) => [state.canSubmit, state.isSubmitting]}
							children={([canSubmit, isSubmitting]) => (
								<div className="flex gap-2">
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
									<Button disabled={!canSubmit || isSubmitting} type="submit" form="edit-org-form">
										<Trans>Update</Trans>
									</Button>
								</div>
							)}
						/>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
