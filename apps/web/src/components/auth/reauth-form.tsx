"use client";

import { useMounted } from "@mantine/hooks";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { authClient } from "~/server/better-auth/client";

type ReauthMessage = { type: "REAUTH_SUCCESS" } | { type: "REAUTH_FAILED"; message?: string };

function notifyOpener(message: ReauthMessage) {
	window.opener?.postMessage(message, window.location.origin);
}

export function ReauthForm({ onSuccess, onFailure }: { onSuccess?: () => void; onFailure?: () => void }) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const mounted = useMounted();
	const reauthenticate = async (autofill: boolean = true) => {
		if (!window.PublicKeyCredential) {
			setError("Passkeys are not supported in this browser.");
			return;
		}

		setPending(true);
		setError(null);

		const result = await authClient.signIn.passkey({
			autoFill: autofill,
		});
		if (result.error) {
			const message = result.error.message ?? "Your passkey could not be verified.";
			setError(message);
			setPending(false);
			if (onFailure) {
				onFailure();
			} else {
				notifyOpener({ type: "REAUTH_FAILED", message });
			}
			return;
		}

		if (onSuccess) {
			onSuccess();
		} else {
			notifyOpener({ type: "REAUTH_SUCCESS" });
			window.close();
		}
	};

	useEffect(() => {
		let timeout: NodeJS.Timeout | undefined;
		if (mounted) {
			timeout = setTimeout(() => {
				void reauthenticate(false);
			}, 300);
		}
		return () => {
			if (timeout) clearTimeout(timeout);
		};
	}, [mounted]);

	return (
		<>
			<CardHeader className="items-center px-6 text-center">
				<CardTitle className="text-2xl">Verify it&apos;s you</CardTitle>
				<CardDescription>Use a passkey to continue with this sensitive action.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 px-6">
				<Button className="w-full" disabled={pending} onClick={() => void reauthenticate()} size="lg" type="button">
					{pending ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
					Continue with a passkey
				</Button>
				{error && (
					<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</p>
				)}
				{mounted && <input hidden type="text" name="name" autoComplete="webauthn" />}
			</CardContent>
			<CardFooter className="justify-center px-6 text-center">
				<p className="text-xs leading-5 text-muted-foreground">
					Reauthentication is available only with a registered passkey.
				</p>
			</CardFooter>
		</>
	);
}
