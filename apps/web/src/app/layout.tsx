import "~/styles/globals.css";

import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { cn } from "~/lib/utils";
import { HydrateClient } from "~/trpc/server";
import { TooltipProvider } from "~/components/ui/tooltip";
import { getAuth } from "~/server/better-auth";
import { SessionProvider } from "~/provider/session-provider";
import { ConfirmModalProvider } from "~/components/ui/confirm-modal";
import { Toaster } from "~/components/ui/sonner";

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: "Startime",
		description: "Startime tracks your time spend coding.",
		icons: [{ rel: "icon", url: "/favicon.ico" }],
	};
}

const nunito = Nunito({
	subsets: ["latin"],
	variable: "--font-nunito",
	weight: ["400", "500", "600", "700"],
	style: ["normal", "italic"],
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const session = await getAuth();

	return (
		<html lang="en" className={cn("dark", nunito.className)}>
			<head>
				<meta name="darkreader-lock" />
			</head>
			<body>
				<SessionProvider initialSession={session}>
					<NuqsAdapter>
						<TRPCReactProvider>
							<HydrateClient>
								<ConfirmModalProvider>
									<TooltipProvider>
										<Toaster />
										{children}
									</TooltipProvider>
								</ConfirmModalProvider>
							</HydrateClient>
						</TRPCReactProvider>
					</NuqsAdapter>
				</SessionProvider>
			</body>
		</html>
	);
}
