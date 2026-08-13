import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "~/components/auth/sign-in-form";
import { Card } from "~/components/ui/card";
import { getAuth } from "~/server/better-auth";

export const metadata: Metadata = {
	title: "Sign in | Startime",
	description: "Sign in to your Startime workspace.",
};

export default async function AuthPage() {
	const { session } = await getAuth();
	if (session) {
		redirect("/dash");
	}
	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center text-lg font-semibold">Startime</div>
				<Card>
					<SignInForm />
				</Card>
			</div>
		</main>
	);
}
