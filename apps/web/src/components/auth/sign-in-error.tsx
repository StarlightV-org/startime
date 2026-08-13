"use client";

import { error } from "better-auth/api";
import { KeyRound, LoaderCircle } from "lucide-react";
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { GithubDark } from "../ui/svgs/githubDark";
import { useSearchParams } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import Link from "next/link";
import { Button } from "../ui/button";

export function SignInError() {
	const [state, setState] = useQueryStates({
		error: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
		error_description: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
	});

	return (
		<>
			<CardHeader className="items-center px-6 text-center">
				<CardTitle className="text-2xl">Error</CardTitle>
				<CardDescription className="text-sm">An error occurred while signing in.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 px-6">
				<div className="mx-auto w-fit rounded-lg border-2 border-border px-3 py-1">
					<div className="font-mono text-sm text-muted-foreground">CODE: {state.error}</div>
				</div>
				<div className="text-center text-sm">{state.error_description}</div>

				{/*{error && (
				<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			)}*/}
			</CardContent>
			<CardFooter className="justify-center px-6 text-center">
				<Link href="/auth/signin">
					<Button variant="default" className="w-20 text-sm">
						Try Again
					</Button>
				</Link>
			</CardFooter>
		</>
	);
}
