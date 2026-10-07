"use client";

import { parseAsString, useQueryState } from "nuqs";
import { Card, CardContent } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Trans } from "@lingui/react/macro";
import { api } from "~/trpc/react";
import { useState } from "react";
import type { ChartType } from "@startime/db";
import { Button } from "../ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { useLingui } from "@lingui/react";

export default function TabSelect() {
	const i18n = useLingui();

	const [tab, setTab] = useQueryState(
		"tab",
		parseAsString.withDefault("calendar").withOptions({ clearOnDefault: true }),
	);

	const { data: shareKeys, refetch } = api.badges.listShareKeys.useQuery({ chartType: tab as ChartType });

	const { mutate } = api.badges.createShareKey.useMutation({
		onSuccess: (data) => {
			Print.Debug(data);
			const url = new URL(window.location.href);
			url.pathname = `/api/badge/${tab}`;
			if (data?.id) url.searchParams.set("shareKey", data.id);
			Print.Debug(url.toString());
			refetch();
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
							<div className="relative flex min-h-[176.062px] items-center py-2">
								<img
									onProgress={(e) => {
										Print.Debug(e);
									}}
									loading="lazy"
									src="/api/badge/calendar?internal=true"
									alt="test"
									className="absolute inset-0 z-auto min-h-[176.062px] bg-transparent"
								/>
								<span className="absolute inset-0 -z-10 flex items-center justify-center">Loading...</span>
							</div>
						</TabsContent>
						<TabsContent value="lang">
							<Trans>Language</Trans>
						</TabsContent>
						<TabsContent value="trend">
							<Trans>Trend</Trans>
						</TabsContent>
					</Tabs>
					{/*<div>
					<Button onClick={() => mutate({ chartType: tab as ChartType })}>
						<Trans>Create Share Key</Trans>
					</Button>
					Previus Share Keys
					{shareKeys?.map((key) => (
						<div key={key.id}>{key.id}</div>
					))}
				</div>*/}
				</CardContent>
			</Card>
			<Card>
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
							</TableRow>
						</TableHeader>
						<TableBody>
							{shareKeys?.map((key) => (
								<TableRow key={key.id}>
									<TableCell>{key.id}</TableCell>
									<TableCell>
										{key.referrers
											.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())[0]
											?.lastUsed?.toLocaleString(i18n.i18n.locale)}
									</TableCell>
									<TableCell className="text-center">
										<Dialog>
											<DialogTrigger nativeButton={false} render={<Badge>{key.referrers.length}</Badge>} />
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
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</>
	);
}
