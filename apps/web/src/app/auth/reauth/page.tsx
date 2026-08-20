import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReauthForm } from "~/components/auth/reauth-form";
import { Card } from "~/components/ui/card";
import { db } from "@startime/db";
import { getAuth } from "~/server/better-auth";

import { setRequestI18n } from "~/i18n/server";
import { fromHeader, resolveLocale } from "~/i18n/locales";
import { headers } from "next/headers";

export const metadata: Metadata = {
	title: "Verify your identity | Startime",
	description: "Verify your identity with a passkey to continue.",
};

export default async function ReauthPage() {
	const { user } = await getAuth();
	if (!user?.id) {
		redirect("/auth/signin");
	}

	const passkey = await db.query.passkeys.findFirst({
		where: (passkeys, { eq }) => eq(passkeys.userId, user.id),
		columns: { id: true },
	});
	if (!passkey) {
		redirect("/dash/settings?passkey=required");
	}

	await setRequestI18n(resolveLocale(fromHeader(await headers())));

	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center text-lg font-semibold">Startime</div>
				<Card>
					<ReauthForm />
				</Card>
			</div>
		</main>
	);
}
