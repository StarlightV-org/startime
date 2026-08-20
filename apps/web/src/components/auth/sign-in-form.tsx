"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { authClient } from "~/server/better-auth/client";
import { GithubDark } from "../ui/svgs/githubDark";
import { FieldError } from "../ui/field";
import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";

type SignInMethod = "github" | "passkey" | null;

export function SignInForm() {
	const [pending, setPending] = useState<SignInMethod>(null);
	const [error, setError] = useState<string | null>(null);
	const { t } = useLingui();

	const signInWithGithub = async () => {
		setPending("github");
		setError(null);

		const result = await authClient.signIn.social({
			provider: "github",
			callbackURL: "/dash",
		});

		if (result.error) {
			setError(result.error.message ?? t`GitHub sign-in could not be started.`);
			setPending(null);
		}
	};

	const signInWithPasskey = async () => {
		if (!window.PublicKeyCredential) {
			setError(t`Passkeys are not supported in this browser. Try GitHub instead.`);
			return;
		}

		setPending("passkey");
		setError(null);

		const result = await authClient.signIn.passkey();

		if (result.error) {
			setError(result.error.message ?? t`Your passkey could not be verified.`);
			setPending(null);
			return;
		}

		window.location.assign("/dash");
	};

	return (
		<>
			<CardHeader className="items-center px-6 text-center">
				<CardTitle className="text-2xl">
					<Trans>Welcome</Trans>
				</CardTitle>
				<CardDescription>
					<Trans>Sign in to view your dashboard.</Trans>
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 px-6">
				<Button className="w-full" disabled={pending !== null} onClick={signInWithGithub} size="lg" type="button">
					{pending === "github" ? <LoaderCircle className="animate-spin" /> : <GithubDark />}
					<Trans>Continue with GitHub</Trans>
				</Button>
				<Button
					className="w-full"
					disabled={pending !== null}
					onClick={signInWithPasskey}
					size="lg"
					variant="outline"
					type="button"
				>
					{pending === "passkey" ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
					<Trans>Continue with a passkey</Trans>
				</Button>
				{error && (
					<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</p>
				)}
			</CardContent>

			<CardDescription className="text-center">
				<span className="text-lg text-destructive">
					<Trans>Signups are currently disabled.</Trans>
				</span>
				<br />
				<Trans>This site is currently in closed beta. Want to contribute?</Trans> <br />
				<Link
					href="https://starlightv.link/discord"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary hover:underline"
				>
					<Trans>Join our Discord</Trans>
				</Link>
			</CardDescription>
			{/*<CardFooter className="justify-center px-6 text-center">
				<p className="text-xs leading-5 text-muted-foreground">
					By continuing, you agree to our{" "}
					<a className="font-semibold text-primary hover:underline" href="#terms">
						Terms
					</a>{" "}
					and{" "}
					<a className="font-semibold text-primary hover:underline" href="#privacy">
						Privacy Policy
					</a>
					.
				</p>
			</CardFooter>*/}
		</>
	);
}
