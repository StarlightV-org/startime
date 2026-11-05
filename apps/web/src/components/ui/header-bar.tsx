"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { usePathname } from "next/navigation";
import AccountButton from "../auth/account-button";
import { useSession } from "~/provider/session-provider";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Separator } from "./separator";
import { cn } from "~/lib/utils";
import OpenMinimal from "../overview/open-minimal";
import { Trans } from "@lingui/react/macro";
import { ExternalLinkIcon } from "lucide-react";
import type { Route } from "next";

function resolveDocsUrl(pathname: string) {
	const url = new URL("https://docs.starlightv.dev");

	switch (pathname) {
		case "/dash/org":
			url.pathname = "/docs/startime/org";
			break;
		case "/dash/settings":
			url.pathname = "/docs/startime/settings";
			break;
		default:
			url.pathname = "/docs/startime/what-is-startime";
	}

	return url.toString();
}

export function HeaderBar({ showTabs = true, showUser = true }) {
	const pathname = usePathname();
	const { org } = useSession();

	return (
		<div className="mb-6 sm:mb-8">
			<header className="relative z-30 mx-auto flex w-full max-w-240 flex-col rounded-b-xl border border-t-0 bg-accent">
				<div className="flex min-h-18 items-center justify-between gap-3 px-4 py-3 sm:px-6">
					<Link href="/" className="shrink-0 rounded-md" prefetch={false}>
						<div className="flex items-center gap-2">
							<Avatar size="lg">
								<AvatarImage src="/favicon.svg" alt="" />
								<AvatarFallback>ST</AvatarFallback>
							</Avatar>
							<span className="text-xl font-semibold tracking-tight text-foreground">Star Time</span>
						</div>
					</Link>
					{showUser && <AccountButton />}
				</div>
				{showTabs && (
					<>
						<Separator />
						<div className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
							<Tabs value={pathname} className="min-w-0 p-1">
								<TabsList className="h-auto! w-full flex-wrap justify-start gap-1 sm:w-fit">
									<TabsTrigger
										value="/dash"
										render={
											<Link href="/dash" className="h-8! text-sm">
												<Trans>Overview</Trans>
											</Link>
										}
									/>
									{!!org?.id && (
										<TabsTrigger
											value="/dash/org"
											render={
												<Link href="/dash/org" className="h-8! text-sm">
													<Trans>Your Organization</Trans>
												</Link>
											}
										/>
									)}
									<TabsTrigger
										value="/dash/badges"
										render={
											<Link href="/dash/badges" className="h-8! text-sm">
												<Trans>Badges</Trans>
											</Link>
										}
									/>
									<TabsTrigger
										value="/dash/settings"
										render={
											<Link href="/dash/settings" className="h-8! text-sm">
												<Trans>Settings</Trans>
											</Link>
										}
									/>
									<TabsTrigger
										value="/dash/docs"
										render={
											<Link
												href={resolveDocsUrl(pathname) as Route}
												target="_blank"
												rel="noopener noreferrer"
												className="h-8! text-sm"
											>
												Docs <ExternalLinkIcon data-icon="inline-end" />
											</Link>
										}
									/>
								</TabsList>
							</Tabs>
							<OpenMinimal />
						</div>
					</>
				)}
			</header>
		</div>
	);
}
