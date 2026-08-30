"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { usePathname } from "next/navigation";
import AccountButton from "../auth/account-button";
import { useSession } from "~/provider/session-provider";
import { Avatar, AvatarImage } from "./avatar";
import { Separator } from "./separator";
import { cn } from "~/lib/utils";
import OpenMinimal from "../overview/open-minimal";
import { Trans } from "@lingui/react/macro";
import { ExternalLinkIcon } from "lucide-react";

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
		<div className={cn("mb-2 h-29.25", !showTabs && "h-20")}>
			<header className="fixed top-0 left-1/2 z-50 flex h-fit w-[calc(100%-2.5rem)] max-w-240 -translate-x-1/2 flex-col rounded-b-xl bg-accent">
				<div className={cn("flex items-center justify-between px-6 pt-3 pb-1", !showTabs && "pb-3")}>
					<Link href="/" className="text-3xl text-white" prefetch={false}>
						<div className="flex items-center gap-2">
							<Avatar size="lg">
								<AvatarImage src="/favicon.svg" />
							</Avatar>
							<h1 className="text-3xl text-white">Star Time</h1>
						</div>
					</Link>
					{showUser && <AccountButton />}
				</div>
				{showTabs && (
					<>
						<Separator className="my-1" />
						<div className="flex items-center justify-between gap-2 px-6 py-2">
							<Tabs value={pathname} className="h-8! py-0">
								<TabsList className="h-8! space-x-2 py-0">
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
											<Link href={resolveDocsUrl(pathname)} target="_blank" rel="noopener noreferrer" className="h-8! text-sm">
												Docs <ExternalLinkIcon className="inline-flex h-8!" />
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
