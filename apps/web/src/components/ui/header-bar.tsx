"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { usePathname, useRouter } from "next/navigation";
import AccountButton from "../auth/account-button";
import type { API } from "~/trpc/server";
import type { SessionType } from "better-auth";
import { useSession } from "~/provider/session-provider";
import { useEffect } from "react";
import { Avatar, AvatarImage } from "./avatar";
import { Separator } from "./separator";

export function HeaderBar() {
	const pathname = usePathname();
	const router = useRouter();
	const { org } = useSession();

	return (
		<header className="sticky top-0 mb-2 flex h-fit w-full flex-col rounded-b-xl bg-accent">
			<div className="flex items-center justify-between px-6 pt-3 pb-1">
				<Link href="/" className="text-3xl text-white" prefetch={false}>
					<div className="flex items-center gap-2">
						<Avatar size="lg">
							<AvatarImage src="/favicon.svg" />
						</Avatar>
						<h1 className="text-3xl text-white">Star Time</h1>
					</div>
				</Link>
				<AccountButton />
			</div>
			<Separator className="my-1" />
			<Tabs value={pathname} className="px-6 pb-1">
				<TabsList
					className="h-10! space-x-2"
					onClick={() => {
						router.refresh();
					}}
				>
					<TabsTrigger value="/dash" asChild>
						<Link href="/dash" className="text-sm">
							Overview
						</Link>
					</TabsTrigger>
					{!!org?.id && (
						<TabsTrigger value="/dash/org" asChild>
							<Link href="/dash/org" className="text-sm">
								Your Organization
							</Link>
						</TabsTrigger>
					)}
					<TabsTrigger value="/dash/settings" asChild>
						<Link href="/dash/settings" className="text-sm">
							Settings
						</Link>
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</header>
	);
}
