"use client";

import { error } from "better-auth/api";
import { KeyRound, LoaderCircle } from "lucide-react";
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { GithubDark } from "../ui/svgs/githubDark";
import { useSearchParams } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import Link from "next/link";
import { Button } from "../ui/button";

import { Trans } from "@lingui/react/macro";

export function SignInError() {
	const [state, setState] = useQueryStates({
		error: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
		error_description: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
	});

	return (
		<>
			<CardHeader className="items-center px-6 text-center">
				<CardTitle className="text-2xl">
					<Trans>Error</Trans>
				</CardTitle>
				<CardDescription className="text-sm">
					<Trans>An error occurred while signing in.</Trans>
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 px-6">
				<div className="mx-auto w-fit rounded-lg border-2 border-border px-3 py-1">
					<div className="font-mono text-sm text-muted-foreground">CODE: {state.error}</div>
				</div>
				<div className="text-center text-sm">{state.error_description}</div>
			</CardContent>
			<CardFooter className="justify-center px-6 text-center">
				<Link href="/auth/signin">
					<Button variant="default" className="w-20 text-sm">
						<Trans>Try Again</Trans>
					</Button>
				</Link>
			</CardFooter>
		</>
	);
}


