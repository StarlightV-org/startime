import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "~/components/ui/button";

import { getAuth } from "~/server/better-auth/server";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
	const session = await getAuth();

	return (
		<main>
			<div className="whitespace-pre-wrap">{JSON.stringify(session, null, 2)}</div>

			<Link href="/auth/sign-in">
				<Button>Sign in</Button>
			</Link>
		</main>
	);
}
