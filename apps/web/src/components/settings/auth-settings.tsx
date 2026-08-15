"use client";

import type { API } from "~/trpc/server";
import { Card, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatDate } from "date-fns/format";
import { Button } from "../ui/button";
import { InfoIcon, PenIcon, TrashIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { useForm } from "@tanstack/react-form";
import { Input } from "../ui/input";
import { authClient } from "~/server/better-auth/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useDisclosure } from "@mantine/hooks";
import { useConfirmModal } from "../ui/confirm-modal";
import { useSession } from "~/provider/session-provider";
import { z } from "zod";
import { useEffect } from "react";

export default function AuthSettings({
	passkeys,
	promptForPasskey = false,
}: {
	passkeys: API["self"]["listPasskeys"];
	promptForPasskey?: boolean;
}) {
	const { user } = useSession();
	const form = useForm({
		defaultValues: {
			name: "",
		},
		validators: {
			onBlur: z.object({
				name: z.string().min(3, "Name must be at least 3 characters"),
			}),
			onSubmit: z.object({
				name: z.string().min(3, "Name must be at least 3 characters"),
			}),
		},
	});

	const router = useRouter();
	const [opened, { close, open }] = useDisclosure();
	const confirmModal = useConfirmModal();

	useEffect(() => {
		if (promptForPasskey && passkeys.length === 0) open();
	}, [open, passkeys.length, promptForPasskey]);

	return (
		<Card>
			<CardContent className="flex w-full flex-col">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-card!">
							<TableHead className="w-3/8">Name</TableHead>
							<TableHead className="w-3/8">Created At</TableHead>
							<TableHead className="w-2/8">
								<div className="flex items-center justify-end gap-2">
									<span>Actions</span>
									<Dialog open={opened} onOpenChange={(isOpen) => (isOpen ? open() : close())}>
										<DialogTrigger asChild>
											<Button size="sm" variant="outline">
												Create Passkey
											</Button>
										</DialogTrigger>
										<DialogContent>
											<DialogTitle>Create Passkey</DialogTitle>
											<DialogDescription>A passkey is required to verify sensitive actions.</DialogDescription>
											<form.Field
												name="name"
												children={(field) => {
													const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
													return (
														<Field data-invalid={isInvalid}>
															<FieldLabel htmlFor={field.name}>Name of Passkey</FieldLabel>
															<Input
																id={field.name}
																name={field.name}
																value={field.state.value}
																onBlur={field.handleBlur}
																onChange={(e) => field.handleChange(e.target.value)}
																aria-invalid={isInvalid}
																placeholder="1Password"
																autoComplete="off"
																data-op-ignore
															/>
															{isInvalid && <FieldError errors={field.state.meta.errors} />}
														</Field>
													);
												}}
											/>
											<DialogFooter>
												<Button variant="outline" onClick={close}>
													Cancel
												</Button>
												<Button
													variant="default"
													onClick={async () => {
														const name = form.getFieldValue("name");
														if (!name) return;

														const result = await authClient.passkey.addPasskey({ name: `${user.name}-${name}` });

														if (result.error) {
															toast.error(result.error.message);
															return;
														}

														close();
														toast.success("Passkey created successfully");
														form.reset();
														router.refresh();
													}}
												>
													Create
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								</div>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{passkeys.length > 0 ? (
							passkeys.map((passkey) => (
								<TableRow key={passkey.id}>
									<TableCell>{passkey.name}</TableCell>
									<TableCell>{passkey.createdAt ? formatDate(passkey.createdAt, "yyyy-MM-dd HH:mm:ss") : null}</TableCell>
									<TableCell className="flex justify-end gap-2">
										<Button
											size="icon-sm"
											variant="destructive"
											onClick={async () => {
												const confirmed = await confirmModal({
													title: "Delete Passkey",
													content: `Are you sure you want to delete the passkey "${passkey.name}"?`,
													requiredValue: passkey.name ?? undefined,
													delay: 2000,
												});
												if (!confirmed) return;

												const result = await authClient.passkey.deletePasskey({
													id: passkey.id,
												});
												if (!result) {
													toast.error("Failed to delete passkey");
													return;
												}

												toast.success("Passkey deleted");
												router.refresh();
											}}
										>
											<TrashIcon className="size-4" />
										</Button>
									</TableCell>
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={3}>
									<Empty>
										<EmptyHeader>
											<EmptyMedia variant="icon">
												<InfoIcon />
											</EmptyMedia>
											<EmptyTitle>No Passkeys</EmptyTitle>
										</EmptyHeader>
									</Empty>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
