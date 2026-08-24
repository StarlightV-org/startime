"use client";

import Link from "next/link";
import { useSession } from "~/provider/session-provider";
import { Button } from "../ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuGroup,
	DropdownMenuLabel,
} from "../ui/dropdown-menu";
import { authClient } from "~/server/better-auth/client";
import { useOpenPanel } from "@openpanel/nextjs";
import { Trans } from "@lingui/react/macro";

export default function AccountButton() {
	const { user, session } = useSession();
	const op = useOpenPanel();

	if (!session.id) {
		return (
			<Link href="/auth/signin">
				<Button>Login</Button>
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button type="button" className="mr-5 flex items-center gap-2 rounded-md px-1 py-2 hover:bg-white/10">
						<span className="text-sm">{user.name}</span>
						<Avatar size="sm">
							<AvatarImage src={user.image!} alt={`User Avatar - ${user.name}`} />
							<AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
						</Avatar>
					</button>
				}
			/>
			<DropdownMenuContent align="end" sideOffset={10}>
				<DropdownMenuGroup>
					<DropdownMenuLabel>
						<Trans>Account</Trans>
					</DropdownMenuLabel>
					<DropdownMenuItem
						render={
							<Link href="/dash/settings">
								<span>
									<Trans>Settings</Trans>
								</span>
							</Link>
						}
					/>
					<DropdownMenuItem
						onClick={async () => {
							await authClient.signOut();
							op.track("session:end");

							window.location.href = "/";
						}}
						className="text-destructive hover:bg-destructive/15! hover:text-destructive"
					>
						<Trans>Logout</Trans>
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
