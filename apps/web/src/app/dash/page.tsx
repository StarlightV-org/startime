import { tryCatch } from "~/lib/utils";
import { getAuth } from "~/server/better-auth";
import { api } from "~/trpc/server";

export default async function DashPage() {
	const auth = await getAuth();

	const { data, error } = await tryCatch(api.overview.getTotalTime());

	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
			<div className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</div>
		</main>
	);
}
