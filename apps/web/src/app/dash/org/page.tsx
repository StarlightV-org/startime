import { redirect } from "next/navigation";
import EditOrg from "~/components/org/edit-org";
import { MemberList } from "~/components/org/org-components";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { getAuth } from "~/server/better-auth";

export default async function OrgPage() {
	const { org } = await getAuth();

	if (!org?.id) redirect("/dash");

	return (
		<div className="flex flex-col gap-5">
			<Card className="w-full">
				<CardContent className="flex items-center justify-between gap-5">
					<div className="flex items-center gap-5 align-baseline">
						<Avatar size="lg">
							<AvatarImage src={org?.logo!} alt={org?.name} />
							<AvatarFallback>
								<span>{org?.name?.slice(0, 2).toUpperCase()}</span>
							</AvatarFallback>
						</Avatar>
						<h1 className="text-2xl">{org?.name}</h1>
					</div>
					<EditOrg org={org} />
				</CardContent>
			</Card>
			<Card className="w-full">
				<CardContent>
					<h1 className="text-2xl">Organization Stats</h1>
				</CardContent>
			</Card>
			<MemberList org={org} />
		</div>
	);
}
