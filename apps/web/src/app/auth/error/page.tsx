import type { Metadata } from "next";
import { SignInError } from "~/components/auth/sign-in-error";

import { Card } from "~/components/ui/card";

export const metadata: Metadata = {
	title: "Sign in | Startime",
	description: "Sign in to your Startime workspace.",
};

export default function AuthPage() {
	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center text-lg font-semibold">Startime</div>
				<Card>
					<SignInError />
				</Card>
			</div>
		</main>
	);
}
