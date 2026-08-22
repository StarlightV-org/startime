"use client";

import { PenIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useForm } from "@tanstack/react-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import type { OrgType } from "better-auth";
import z from "zod";
import { useLingui } from "@lingui/react/macro";

export default function EditOrg({ org }: { org: OrgType }) {
	const { t } = useLingui();

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

	const form = useForm({
		defaultValues: {
			name: org.name,
			slug: org.slug,
			logo: org.logo,
			public: org.public,
		},
		onSubmit: async (values) => {},
	});

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button>
					<PenIcon className="size-4" />
					Edit Org
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>Edit Org</DialogTitle>
				<form
					id="edit-org-form"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field
							name="name"
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
										<FieldLabel htmlFor={field.name}>Email</FieldLabel>
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
					</FieldGroup>
				</form>
			</DialogContent>
		</Dialog>
	);
}
