"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Trans } from "@lingui/react/macro";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../ui/dialog";
import { useLingui } from "@lingui/react";
import { Copy, TrashIcon } from "lucide-react";
import { CopyButton } from "../ui/copy-button";
import { useConfirmModal } from "../ui/confirm-modal";
import { toast } from "sonner";
import { ENV } from "@startime/env";
import { useSession } from "~/provider/session-provider";
import { msg } from "@lingui/core/macro";
import { cn, parseTranslate } from "~/lib/utils";
import { Spinner } from "../ui/spinner";
import Link from "next/link";
import { badgeOptionsSchema, defaultBadgeOptions, supportedBadgeTypes } from "~/lib/badge-options";
import { useForm } from "@tanstack/react-form";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { TimeSelect } from "../overview";

import { useSelector } from "@tanstack/react-form";

type BadgePreviewProps = {
	src: string;
	alt: string;
	className?: string;
	imageClassName?: string;
	isBadgeEnabled: boolean;
};

function BadgePreview(props: BadgePreviewProps) {
	return <BadgePreviewImage key={`${props.src}:${props.isBadgeEnabled}`} {...props} />;
}

function BadgePreviewImage({ src, alt, className, imageClassName, isBadgeEnabled }: BadgePreviewProps) {
	const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

	if (!isBadgeEnabled) {
		return (
			<div className={cn("flex min-h-45 w-full items-center justify-center px-4 py-6", className)}>
				<div className="flex max-w-sm flex-col items-center gap-3 text-center">
					<p className="text-muted-foreground">
						<Trans>Enable this badge in your settings to see its preview and create share keys.</Trans>
					</p>
					<Button
						variant="outline"
						render={
							<Link href="/dash/settings">
								<Trans>Open badge settings</Trans>
							</Link>
						}
					/>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn("relative flex min-h-45 w-full items-center justify-center", className)}
			aria-busy={status === "loading"}
		>
			{status === "loading" && (
				<div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground">
					<Spinner />
					<span>
						<Trans>Loading preview...</Trans>
					</span>
				</div>
			)}
			{status === "error" && (
				<span className="absolute inset-0 flex items-center justify-center px-4 text-center text-muted-foreground">
					<Trans>Unable to load preview.</Trans>
				</span>
			)}
			<img
				src={src}
				alt={alt}
				onLoad={() => {
					setStatus("loaded");
				}}
				onError={() => {
					setStatus("error");
				}}

				className={cn(
					"max-w-full transition-opacity duration-200",
					status === "loaded" ? "opacity-100" : "opacity-0",
					imageClassName,
				)}
			/>
		</div>
	);
}

export default function TabSelect() {
	const { i18n } = useLingui();
	const confirmModal = useConfirmModal();
	const { user } = useSession();

	const [tab, setTab] = useQueryState(
		"tab",
		parseAsStringLiteral(supportedBadgeTypes).withDefault("calendar").withOptions({ clearOnDefault: true }),
	);

	const hasBadgeEnabled = user?.accountConfig.privacy.allowedBadges?.includes(tab);

	const [newShareKey, setNewShareKey] = useState<string | undefined>(undefined);

	const { data: shareKeys, refetch } = api.badges.listShareKeys.useQuery(
		{ chartType: tab },
		{
			refetchOnMount: true,
		},
	);

	const { mutate, isPending } = api.badges.createShareKey.useMutation({
		onSuccess: (data) => {
			refetch();
			if (!data?.id) {
				toast.error("Failed to create share key.", { id: "create-share-key" });
				return;
			}
			const url = new URL(ENV.NEXT_PUBLIC_BETTER_AUTH_URL);
			url.pathname = `/api/badge/${data.chartType}`;
			url.searchParams.set("shareKey", data.id);
			setNewShareKey(url.toString());
			toast.success("Share key created successfully.", { id: "create-share-key" });
		},
		onError: (error) => {
			toast.error("Failed to create share key.", { id: "create-share-key", description: error.message });
		},
		onMutate: () => {
			toast.loading("Creating share key...", {
				id: "create-share-key",
				description: undefined,
			});
		},
	});
	const { mutate: deleteShareKey } = api.badges.deleteShareKey.useMutation({
		onSuccess: () => {
			refetch();
			toast.success("Share key deleted successfully.", { id: "delete-share-key" });
		},
		onError: () => {
			toast.error("Failed to delete share key.", { id: "delete-share-key" });
		},
		onMutate: () => {
			toast.loading("Deleting share key...", {
				id: "delete-share-key",
			});
		},
	});

	const badgeInputForm = useForm({
		defaultValues: defaultBadgeOptions(),
		validators: {
			onSubmit: badgeOptionsSchema,
		},
		onSubmit: ({ value }) => {
			if (hasBadgeEnabled && !isPending) mutate({ chartType: tab, data: value });
		},
	});

	const timeRange = useSelector(badgeInputForm.store, (state) => state.values.timeRange);
	const inMinutes = useSelector(badgeInputForm.store, (state) => state.values.inMinutes);

	useEffect(() => {
		badgeInputForm.reset(defaultBadgeOptions());
		setNewShareKey(undefined);
	}, [tab]);

	return (
		<>
			<Card className="py-2">
				<CardContent className="py-0">
					<Tabs value={tab} onValueChange={(value) => setTab(value)}>
						<TabsList>
							<TabsTrigger value="calendar">
								<Trans>Calendar</Trans>
							</TabsTrigger>
							<TabsTrigger value="lang">
								<Trans>Language</Trans>
							</TabsTrigger>
						</TabsList>
						<div className="min-h-45 py-1">
							<TabsContent value="calendar" className="w-full">
								<BadgePreview
									isBadgeEnabled={Boolean(hasBadgeEnabled)}
									src="/api/badge/calendar?internal=true"
									alt="Calendar Preview"
									imageClassName="min-h-[176.062px]"
								/>
							</TabsContent>
							<TabsContent value="lang" className="w-full">
								<BadgePreview
									isBadgeEnabled={Boolean(hasBadgeEnabled)}
									src={`/api/badge/lang?internal=true&timeRange=${timeRange ?? "past90"}&inMinutes=${Boolean(inMinutes)}`}
									alt="Language Preview"
									imageClassName="aspect-auto max-h-[180px]"
								/>
							</TabsContent>
						</div>
					</Tabs>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-0">
					<form
						id="badge-options"
						onSubmit={(e) => {
							e.preventDefault();
							badgeInputForm.handleSubmit();
						}}
					>
						{tab === "lang" && (
							<FieldGroup>
								<badgeInputForm.Field
									name="timeRange"
									children={(field) => {
										const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field orientation="responsive" data-invalid={isInvalid}>
												<FieldContent>
													<FieldLabel htmlFor="form-tanstack-select-time-range">Time Range</FieldLabel>
													<FieldDescription>The time range to display in the badge.</FieldDescription>

													{isInvalid && <FieldError errors={field.state.meta.errors} />}
												</FieldContent>

												<TimeSelect
													id="form-tanstack-select-time-range"
													timeRange={field.state.value}
													onChange={(value) => field.setValue(value)}
													useCookie={false}
												/>
											</Field>
										);
									}}
								/>
								<badgeInputForm.Field
									name="inMinutes"
									children={(field) => {
										const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field orientation="responsive" data-invalid={isInvalid}>
												<FieldContent>
													<FieldLabel htmlFor="form-tanstack-select-unit">Unit</FieldLabel>
													<FieldDescription>
														Percentages use language-minutes, counting overlaps separately. The center shows distinct active time.
													</FieldDescription>

													{isInvalid && <FieldError errors={field.state.meta.errors} />}
												</FieldContent>

												<Select
													value={Boolean(field.state.value)}
													onValueChange={(value) => {
														if (value !== null) field.setValue(value);
													}}
												>
													<SelectTrigger id="form-tanstack-select-unit" aria-invalid={isInvalid}>
														<SelectValue fallback={field.state.value ? "Minutes" : "Percentage"} />
													</SelectTrigger>
													<SelectContent>
														<SelectGroup>
															<SelectItem value={false}>Percentage</SelectItem>
															<SelectItem value={true}>Minutes</SelectItem>
														</SelectGroup>
													</SelectContent>
												</Select>
											</Field>
										);
									}}
								/>
							</FieldGroup>
						)}
					</form>
					<Button
						disabled={!hasBadgeEnabled || isPending}
						type="submit"
						form="badge-options"
						variant="outline"
					>
						{hasBadgeEnabled
							? parseTranslate(i18n, msg`Create new Share Key`)
							: parseTranslate(i18n, msg`Badge not enabled, enable it to create a share key`)}
					</Button>
				</CardHeader>
				{hasBadgeEnabled && (
					<CardContent>
						<Table>
							<TableCaption>
								<Trans>Showing share keys for the Selected Tab</Trans>
							</TableCaption>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead>
										<Trans>Share Key</Trans>
									</TableHead>
									<TableHead>
										<Trans>Last observed referrer</Trans>
									</TableHead>
									<TableHead className="text-center">
										<Trans>Referrers</Trans>
									</TableHead>
									<TableHead className="text-end">
										<Trans>Actions</Trans>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{shareKeys?.map((key) => {
									return (
										<TableRow key={key.id}>
											<TableCell>{key.id}</TableCell>
											<TableCell>
												{[...key.referrers]
													.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())[0]
													?.lastUsed?.toLocaleString(i18n.locale) ?? "-"}
											</TableCell>
											<TableCell className="text-center">
												<Dialog>
													<DialogTrigger
														disabled={key.referrers.length === 0}
														nativeButton={false}
														render={<Badge>{key.referrers.length}</Badge>}
														aria-label="View observed referrer origins"
													/>
													<DialogContent>
														<DialogHeader>
															<DialogTitle>Observed referrer origins</DialogTitle>
															<DialogDescription>
																Only HTTP origins are stored. Headers may be missing or spoofed; image proxies can hide visits.
															</DialogDescription>
														</DialogHeader>
														<Table>
															<TableHeader>
																<TableRow>
																	<TableHead>Referrer</TableHead>
																	<TableHead>Last observed</TableHead>
																</TableRow>
															</TableHeader>
															<TableBody>
																{key.referrers.map((referrer) => (
																	<TableRow key={referrer.id}>
																		<TableCell>{referrer.referrer}</TableCell>
																		<TableCell>{referrer.lastUsed?.toLocaleString(i18n.locale)}</TableCell>
																	</TableRow>
																))}
															</TableBody>
														</Table>
													</DialogContent>
												</Dialog>
											</TableCell>
											<TableCell className="flex justify-end gap-1">
												<Button
													aria-label="Copy badge embed"
													variant="outline"
													size="icon-sm"
													onClick={() => {
														const url = new URL(ENV.NEXT_PUBLIC_BETTER_AUTH_URL);
														url.pathname = `/api/badge/${tab}`;
														url.searchParams.set("shareKey", key.id);
														setNewShareKey(url.toString());
													}}
												>
													<Copy className="size-4" />
												</Button>
												<Button
													aria-label="Delete share key"
													size="icon-sm"
													variant="destructive"
													onClick={async () => {
														const confirmed = await confirmModal({
															title: i18n.t(`Delete Share Key`),
															content: i18n.t(
																`Delete this share key? New requests will fail, but websites and image proxies may retain copies.`,
															),
															delay: 1000,
															variant: "destructive",
															confirmLabel: "Delete",
														});

														if (confirmed) {
															deleteShareKey({ id: key.id });
														}
													}}
												>
													<TrashIcon className="size-4" />
												</Button>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</CardContent>
				)}
			</Card>
			<Dialog
				closeOnOutsideClick={false}
				open={newShareKey !== undefined}
				onOpenChange={(open) => {
					if (!open) {
						setNewShareKey(undefined);
					}
				}}
			>
				{newShareKey && (
					<DialogContent className="min-w-sm">
						<DialogHeader>
							<DialogTitle>Share Key</DialogTitle>
							<DialogDescription>You can share this key with others to load the Badge on their website.</DialogDescription>
						</DialogHeader>
						<div className="flex flex-col gap-2">
							<CopyButton value={newShareKey} label={"Permalink"} />
							<CopyButton
								value={`![Startime ${new URL(newShareKey).pathname.endsWith("/lang") ? "Language" : "Calendar"} Badge](${newShareKey})`}
								label={"Embed in Markdown"}
							/>
							<CopyButton
								value={`<a href="${ENV.NEXT_PUBLIC_BETTER_AUTH_URL}"><img alt="Startime ${new URL(newShareKey).pathname.endsWith("/lang") ? "Language" : "Calendar"} Badge" src="${newShareKey}"></a>`}
								label={"Embed in HTML"}
							/>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setNewShareKey(undefined)}>
								Close
							</Button>
						</DialogFooter>
					</DialogContent>
				)}
			</Dialog>
		</>
	);
}
