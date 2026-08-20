"use client";

import type { API } from "~/trpc/server";
import { Card, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { formatDate } from "date-fns/format";
import { CopyIcon, InfoIcon, TrashIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { useForm } from "@tanstack/react-form";
import { Input } from "../ui/input";
import { authClient } from "~/server/better-auth/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useDisclosure } from "@mantine/hooks";
import { useConfirmModal } from "../ui/confirm-modal";
import { useSession } from "~/provider/session-provider";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Separator } from "../ui/separator";
import { api } from "~/trpc/react";
import { isReauthRequired } from "~/lib/reauth-util";
import { tryCatch } from "~/lib/utils";
import { Spinner } from "../ui/spinner";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";

export default function AuthSettings({
	passkeys,
	apiKeys,
	promptForPasskey = false,
}: {
	passkeys: API["self"]["listPasskeys"];
	apiKeys: API["self"]["listApiKeys"];
	promptForPasskey?: boolean;
}) {
	const { user } = useSession();

	const passkeyForm = useForm({
		defaultValues: {
			name: "",
		},
		validators: {
			onBlur: z.object({
				name: z.string().min(3, t`Name must be at least 3 characters`),
			}),
			onSubmit: z.object({
				name: z.string().min(3, t`Name must be at least 3 characters`),
			}),
		},
	});

	const apiKeyForm = useForm({
		defaultValues: {
			name: "",
		},
		validators: {
			onBlur: z.object({
				name: z.string().min(3, t`Name must be at least 3 characters`),
			}),
			onSubmit: z.object({
				name: z.string().min(3, t`Name must be at least 3 characters`),
			}),
		},
	});

	const router = useRouter();
	const [openedCreatePasskey, { toggle: toggleCreatePasskey }] = useDisclosure();
	const [openCreateApiKey, { toggle: toggleCreateApiKey }] = useDisclosure();

	const { mutate: createApiKey } = api.self.createApiKey.useMutation({
		onSuccess: () => {
			toggleCreateApiKey();
			toast.success(t`Api key created successfully`, {
				id: "create-api-key",
				description: undefined,
			});
			apiKeyForm.reset();
			router.refresh();
		},
		onError: (error) => {
			if (isReauthRequired(error)) return;
			toast.error(t`Failed to create api key`, {
				description: error.message,
				id: "create-api-key",
			});
		},
		onMutate: () => {
			toast.loading(t`Creating api key`, {
				id: "create-api-key",
			});
		},
	});

	useEffect(() => {
		if (promptForPasskey && passkeys.length === 0) toggleCreatePasskey();
	}, [passkeys.length, promptForPasskey, toggleCreatePasskey]);

	return (
		<Card>
			<CardContent className="flex w-full flex-col">
				<h2 className="font-heading text-xl font-semibold tracking-tight text-balance">Passkeys</h2>
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-card!">
							<TableHead className="w-3/8">Name</TableHead>
							<TableHead className="w-3/8">
								<Trans>Created At</Trans>
							</TableHead>
							<TableHead className="w-2/8">
								<div className="flex items-center justify-end gap-2">
									<span>Actions</span>
									<Dialog open={openedCreatePasskey} onOpenChange={toggleCreatePasskey}>
										<DialogTrigger asChild>
											<Button size="sm" variant="outline">
												Create Passkey
											</Button>
										</DialogTrigger>
										<DialogContent>
											<DialogTitle>
												<Trans>Create Passkey</Trans>
											</DialogTitle>
											<DialogDescription>
												<Trans>A passkey is required to verify sensitive actions.</Trans>
											</DialogDescription>
											<passkeyForm.Field
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
												<Button variant="outline" onClick={toggleCreatePasskey}>
													<Trans>Cancel</Trans>
												</Button>
												<Button
													variant="default"
													onClick={async () => {
														const name = passkeyForm.getFieldValue("name");
														if (!name) return;

														const result = await authClient.passkey.addPasskey({ name: `${user.name}-${name}` });

														if (result.error) {
															toast.error(result.error.message);
															return;
														}

														toggleCreatePasskey();
														toast.success(t`Passkey created successfully`);
														passkeyForm.reset();
														router.refresh();
													}}
												>
													<Trans>Create</Trans>
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
							passkeys.map((passkey) => <PasskeyRow key={passkey.id} passkey={passkey} />)
						) : (
							<TableRow>
								<TableCell colSpan={3}>
									<Empty>
										<EmptyHeader>
											<EmptyMedia variant="icon">
												<InfoIcon />
											</EmptyMedia>
											<EmptyTitle>
												<Trans>No Passkeys</Trans>
											</EmptyTitle>
										</EmptyHeader>
									</Empty>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
				<Separator className="mt-4 mb-2" />
				<h2 className="font-heading text-xl font-semibold tracking-tight text-balance">
					API <Trans>Keys</Trans>
				</h2>
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-card!">
							<TableHead className="w-3/8">
								<Trans>Name</Trans>
							</TableHead>
							<TableHead className="w-3/8">
								<Trans>Created At</Trans>
							</TableHead>
							<TableHead className="w-2/8">
								<div className="flex items-center justify-end gap-2">
									<span>
										<Trans>Actions</Trans>
									</span>
									<Dialog open={openCreateApiKey} onOpenChange={toggleCreateApiKey}>
										<DialogTrigger asChild>
											<Button size="sm" variant="outline">
												<Trans>Create Api Key</Trans>
											</Button>
										</DialogTrigger>
										<DialogContent>
											<DialogTitle>
												<Trans>Create Api Key</Trans>
											</DialogTitle>
											<DialogDescription>
												<Trans>A API key is required to verify sensitive actions.</Trans>
											</DialogDescription>
											<apiKeyForm.Field
												name="name"
												children={(field) => {
													const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
													return (
														<Field data-invalid={isInvalid}>
															<FieldLabel htmlFor={field.name}>Name of Api Key</FieldLabel>
															<Input
																id={field.name}
																name={field.name}
																value={field.state.value}
																onBlur={field.handleBlur}
																onChange={(e) => field.handleChange(e.target.value)}
																aria-invalid={isInvalid}
																placeholder="Zed"
																autoComplete="off"
																data-op-ignore
															/>
															{isInvalid && <FieldError errors={field.state.meta.errors} />}
														</Field>
													);
												}}
											/>
											<DialogFooter>
												<Button variant="outline" onClick={toggleCreateApiKey}>
													<Trans>Cancel</Trans>
												</Button>
												<Button
													variant="default"
													onClick={async () => {
														const name = apiKeyForm.getFieldValue("name");
														if (!name) return;

														createApiKey({ name });
													}}
												>
													<Trans>Create</Trans>
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								</div>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{apiKeys.length > 0 ? (
							apiKeys.map((apiKey) => <ApiKeyRow key={apiKey.id} apiKey={apiKey} />)
						) : (
							<TableRow>
								<TableCell colSpan={3}>
									<Empty>
										<EmptyHeader>
											<EmptyMedia variant="icon">
												<InfoIcon />
											</EmptyMedia>
											<EmptyTitle>
												<Trans>No Api Keys</Trans>
											</EmptyTitle>
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

type Passkey = API["self"]["listPasskeys"][number];

function PasskeyRow({ passkey }: { passkey: Passkey }) {
	const router = useRouter();
	const confirmModal = useConfirmModal();

	const deletePasskey = async () => {
		const confirmed = await confirmModal({
			title: t`Delete Passkey`,
			content: t`Are you sure you want to delete the passkey "${passkey.name!}"?`,
			requiredValue: passkey.name ?? undefined,
			delay: 2000,
		});
		if (!confirmed) return;

		const result = await authClient.passkey.deletePasskey({ id: passkey.id });
		if (!result) {
			toast.error(t`Failed to delete passkey`);
			return;
		}

		toast.success(t`Passkey deleted`);
		router.refresh();
	};

	return (
		<TableRow>
			<TableCell>{passkey.name}</TableCell>
			<TableCell>{passkey.createdAt ? formatDate(passkey.createdAt, "dd.MM.yyyy HH:mm:ss") : null}</TableCell>
			<TableCell className="flex justify-end gap-2">
				<Button size="icon-sm" variant="destructive" onClick={deletePasskey}>
					<TrashIcon className="size-4" />
				</Button>
			</TableCell>
		</TableRow>
	);
}

type ApiKey = API["self"]["listApiKeys"][number];

function ApiKeyRow({ apiKey }: { apiKey: ApiKey }) {
	const confirmModal = useConfirmModal();
	const router = useRouter();
	const { mutateAsync: getApiKey, isPending } = api.self.getApiKey.useMutation();
	const { mutateAsync: deleteApiKey, isPending: isDeleting } = api.self.deleteApiKey.useMutation();
	const [apiKeyToCopy, setApiKeyToCopy] = useState<string | null>(null);

	const showCopyDialog = async () => {
		const key = await tryCatch(getApiKey({ id: apiKey.id }));
		if (key.error) {
			if (isReauthRequired(key.error)) return;
			toast.error("Failed to get api key", {
				description: key.error.message,
				id: "get-api-key",
			});
			return;
		}

		setApiKeyToCopy(key.data);
	};

	const copyApiKey = async () => {
		if (!apiKeyToCopy) return;

		try {
			await navigator.clipboard.writeText(apiKeyToCopy);
			setApiKeyToCopy(null);
			toast.success(t`Api key copied to clipboard`, {
				id: "get-api-key",
				description: undefined,
			});
		} catch (error) {
			Print.Warning("[API_KEY] Failed to copy", error);
			toast.error(t`Failed to copy api key`, {
				id: "get-api-key",
			});
		}
	};

	return (
		<>
			<TableRow>
				<TableCell>{apiKey.name}</TableCell>
				<TableCell>{apiKey.createdAt ? formatDate(apiKey.createdAt, "dd.MM.yyyy HH:mm:ss") : null}</TableCell>
				<TableCell className="flex justify-end gap-2">
					<Button disabled={isPending} size="icon-sm" variant="outline" onClick={showCopyDialog}>
						{isPending ? <Spinner className="size-4" /> : <CopyIcon className="size-4" />}
					</Button>
					<Button
						disabled={isDeleting}
						size="icon-sm"
						variant="destructive"
						onClick={async () => {
							const confirmed = await confirmModal({
								title: "Delete API key",
								content: (
									<Trans>
										<p>
											Are you sure you want to delete the key: "{apiKey.name}"?
											<br />
											This action <strong className="text-destructive">cannot </strong> be undone and the API key will no longer
											function.
										</p>
									</Trans>
								),
								confirmLabel: "Delete",
								delay: 1000,
							});

							if (confirmed) {
								const result = await tryCatch(deleteApiKey({ id: apiKey.id }));

								if (result.error) {
									toast.error(t`Failed to delete API key: `, {
										id: apiKey.id,
										description: result.error.message,
									});
								} else {
									toast.success(t`API key deleted`, {
										id: apiKey.id,
										description: undefined,
									});
									router.refresh();
								}
							}
						}}
					>
						{isDeleting ? <Spinner className="size-4" /> : <TrashIcon className="size-4" />}
					</Button>
				</TableCell>
			</TableRow>
			<Dialog open={apiKeyToCopy !== null} onOpenChange={(open) => !open && setApiKeyToCopy(null)}>
				<DialogContent>
					<DialogTitle>
						<Trans>Copy API key</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>You can copy this API key to your clipboard now.</Trans>
					</DialogDescription>
					<DialogFooter>
						<Button variant="outline" onClick={() => setApiKeyToCopy(null)}>
							<Trans>Cancel</Trans>
						</Button>
						<Button onClick={copyApiKey}>
							<CopyIcon />
							<Trans>Copy API key</Trans>
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
