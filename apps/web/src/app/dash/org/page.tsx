import { redirect } from "next/navigation";
import EditOrg from "~/components/org/edit-org";
import { MemberList, ProjectList } from "~/components/org/org-components";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { tryCatch } from "~/lib/utils";
import { getAuth } from "~/server/better-auth";
import { api } from "~/trpc/server";

export default async function OrgPage() {
	const { org } = await getAuth();

	if (!org?.id) redirect("/dash");

	const { data: projects } = await tryCatch(api.org.projects.list());

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
					{(org.membership?.role === "admin" || org.membership?.role === "owner") && <EditOrg org={org} />}
				</CardContent>
			</Card>

			<Card className="w-full">
				<CardContent>
					<h1 className="text-2xl">Organization Stats</h1>
				</CardContent>
			</Card>
			<div className="grid grid-cols-1 gap-4 divide-accent xl:grid-cols-2">
				<MemberList org={org} />
				<ProjectList org={org} projects={projects ?? []} />
			</div>
		</div>
	);
}
