import type { Metadata } from "next";
import { SignInError } from "~/components/auth/sign-in-error";

import { Card } from "~/components/ui/card";
import { setRequestI18n } from "~/i18n/server";
import { fromHeader, resolveLocale } from "~/i18n/locales";
import { headers } from "next/headers";

export const metadata: Metadata = {
	title: "Sign in | Startime",
	description: "Sign in to your Startime workspace.",
};

export default async function AuthPage() {
	await setRequestI18n(resolveLocale(fromHeader(await headers())));

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


