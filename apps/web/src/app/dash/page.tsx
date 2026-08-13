import { getAuth } from "~/server/better-auth";

export default async function DashPage() {
	const auth = await getAuth();
	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
			<div className="whitespace-pre-wrap">{JSON.stringify(auth, null, 2)}</div>
		</main>
	);
}
