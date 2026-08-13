"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { usePathname } from "next/navigation";
import AccountButton from "../auth/account-button";
import type { API } from "~/trpc/server";
import type { SessionType } from "better-auth";
import { useSession } from "~/provider/session-provider";

export function HeaderBar() {
	const pathname = usePathname();
	const { org } = useSession();

	return (
		<header className="sticky top-0 mb-2 flex h-fit w-full flex-col rounded-b-xl bg-accent">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl text-white">Startime</h1>
				<AccountButton />
			</div>
			<Tabs value={pathname}>
				<TabsList className="h-10! space-x-2">
					<TabsTrigger value="/dash">
						<Link href="/dash" className="text-sm">
							Overview
						</Link>
					</TabsTrigger>
					{!!org?.id && (
						<TabsTrigger value="/dash/org">
							<Link href="/dash/org" className="text-sm">
								Your Organization
							</Link>
						</TabsTrigger>
					)}
					<TabsTrigger value="/dash/settings">
						<Link href="/dash/settings" className="text-sm">
							Settings
						</Link>
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</header>
	);
}
