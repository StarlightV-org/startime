"use client";

import { parseAsString, useQueryState } from "nuqs";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Trans } from "@lingui/react/macro";
import { api } from "~/trpc/react";
import { useState } from "react";
import type { ChartType } from "@startime/db";
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
import { msg, t } from "@lingui/core/macro";
import { parseTranslate } from "~/lib/utils";

export default function TabSelect() {
	const i18n = useLingui();
	const confirmModal = useConfirmModal();
	const { user } = useSession();

	const [tab, setTab] = useQueryState(
		"tab",
		parseAsString.withDefault("calendar").withOptions({ clearOnDefault: true }),
	);

	const hasBadgeEnabled = user?.accountConfig.privacy.allowedBadges?.includes(tab as ChartType);

	const [newShareKey, setNewShareKey] = useState<string | undefined>(undefined);

	const { data: shareKeys, refetch } = api.badges.listShareKeys.useQuery({ chartType: tab as ChartType });

	const { mutate } = api.badges.createShareKey.useMutation({
		onSuccess: (data) => {
			refetch();
			if (!data?.id) {
				toast.error("Failed to create share key.", { id: "create-share-key" });
				return;
			}
			const url = new URL(ENV.NEXT_PUBLIC_BETTER_AUTH_URL);
			url.pathname = `/api/badge/${tab}`;
			url.searchParams.set("shareKey", data.id);
			setNewShareKey(url.toString());
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
							<TabsTrigger value="trend">
								<Trans>Trend</Trans>
							</TabsTrigger>
						</TabsList>
						<TabsContent value="calendar">
							<div className="relative flex min-h-45 items-center py-2">
								<img
									onProgress={(e) => {
										Print.Debug(e);
									}}
									loading="eager"
									src="/api/badge/calendar?internal=true"
									alt="Calandar Preview"
									className="absolute inset-0 z-auto min-h-[176.062px] bg-transparent"
								/>
								<span className="absolute inset-0 -z-10 flex items-center justify-center">Loading...</span>
							</div>
						</TabsContent>
						<TabsContent value="lang">
							<div className="mx-auto min-h-44.75 max-w-89.75">
								<img
									onProgress={(e) => {
										Print.Debug(e);
									}}
									loading="eager"
									src="/api/badge/lang?internal=true"
									alt="Lang Preview"
									className="aspect-auto w-fit"
								/>
								<span className="absolute inset-0 -z-10 flex items-center justify-center">Loading...</span>
							</div>
						</TabsContent>
						<TabsContent value="trend">
							<Trans>Trend</Trans>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<Button
						disabled={!hasBadgeEnabled}
						variant="outline"
						onClick={() => {
							mutate({ chartType: tab as ChartType });
						}}
					>
						{hasBadgeEnabled
							? parseTranslate(i18n.i18n, msg`Create new Share Key`)
							: parseTranslate(i18n.i18n, msg`Badge not enabled, enable it to create a share key`)}
					</Button>
				</CardHeader>
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
									<Trans>Last Accessed</Trans>
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
								const url = new URL(ENV.NEXT_PUBLIC_BETTER_AUTH_URL);
								url.pathname = `/api/badge/${tab}`;
								if (key?.id) url.searchParams.set("shareKey", key.id);
								return (
									<TableRow key={key.id}>
										<TableCell>{key.id}</TableCell>
										<TableCell>
											{key.referrers
												.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())[0]
												?.lastUsed?.toLocaleString(i18n.i18n.locale) ?? "-"}
										</TableCell>
										<TableCell className="text-center">
											<Dialog>
												<DialogTrigger
													disabled={key.referrers.length === 0}
													nativeButton={false}
													render={<Badge>{key.referrers.length}</Badge>}
												/>
												<DialogContent>
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>Referrer</TableHead>
																<TableHead>Last Accessed</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{key.referrers.map((referrer) => (
																<TableRow key={referrer.id}>
																	<TableCell>{referrer.referrer}</TableCell>
																	<TableCell>{referrer.lastUsed?.toLocaleString(i18n.i18n.locale)}</TableCell>
																</TableRow>
															))}
														</TableBody>
													</Table>
												</DialogContent>
											</Dialog>
										</TableCell>
										<TableCell className="flex justify-end gap-1">
											{/*<CopyButton
												value={url.toString()}

												className="size-7"
											/>*/}
											<Button
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
												size="icon-sm"
												variant="destructive"
												onClick={async () => {
													const confirmed = await confirmModal({
														title: "Delete Share Key",
														content: "Are you sure you want to delete this share key? The Badge will no longer load on any website.",
														requiredValue: `delete ${key.id}`,
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
							<CopyButton value={`![Startime Calendar Badge](${newShareKey})`} label={"Embed in Markdown"} />
							<CopyButton
								value={`<a href="${ENV.NEXT_PUBLIC_BETTER_AUTH_URL}"><img alt="Startime Calendar Badge" src="${newShareKey}"></a>`}
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
