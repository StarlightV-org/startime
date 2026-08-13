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

export default function AccountButton() {
	const { user, session } = useSession();

	if (!session.id) {
		return (
			<Link href="/login">
				<Button>Login</Button>
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="mt-2 mr-5 flex items-center">
				<span className="text-sm">{user.name}</span>
				<Avatar>
					<AvatarImage src={user.image!} alt={`User Avatar - ${user.name}`} />
					<AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={10}>
				<DropdownMenuGroup>
					<DropdownMenuLabel>Account</DropdownMenuLabel>
					<DropdownMenuItem>Settings</DropdownMenuItem>
					<DropdownMenuItem className="text-destructive hover:bg-destructive/15! hover:text-destructive">
						Logout
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
