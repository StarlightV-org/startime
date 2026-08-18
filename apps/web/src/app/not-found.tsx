import { error } from "better-auth/api";
import { ArrowLeft, KeyRound, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { getAuth } from "~/server/better-auth";

export default async function NotFound() {
	const { session } = await getAuth();

	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center text-lg font-semibold">Startime</div>
				<Card>
					<CardHeader className="items-center px-6 text-center">
						<CardTitle className="text-2xl">Page not found</CardTitle>
						<CardDescription>Oops! The page you're looking for doesn't exist.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-3 px-6">
						<Button
							className="w-full"

							size="lg"
							variant="outline"
							type="button"
							asChild
						>
							{session?.id ? (
								<Link href="/dash">
									<ArrowLeft /> Back to Dashboard
								</Link>
							) : (
								<Link href="/">
									<ArrowLeft /> Back to Homepage
								</Link>
							)}
						</Button>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
