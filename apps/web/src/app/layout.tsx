import "~/styles/globals.css";

import type { Metadata } from "next";
import { Nunito } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { cn } from "~/lib/utils";
import { HydrateClient } from "~/trpc/server";
import { TooltipProvider } from "~/components/ui/tooltip";
import { getAuth } from "~/server/better-auth";
import { SessionProvider } from "~/provider/session-provider";
import { ConfirmModalProvider } from "~/components/ui/confirm-modal";
import { Toaster } from "~/components/ui/sonner";
import { TimeZoneSync } from "~/components/time-zone-sync";
import { ReauthProvider } from "~/components/auth/reauth-provider";

import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "./api/uploadthing/core";
import { SyncConfigLocal } from "~/components/auth/sync-config-local";
import { VersionProvider } from "~/provider/version-provider";
import { IdentifyComponent, OpenPanelComponent } from "@openpanel/nextjs";
import { ENV } from "@startime/env";
import Footer from "~/components/ui/footer";

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: "Startime",
		description: "Startime tracks your time spend coding.",
		icons: [{ rel: "icon", url: "/favicon.svg" }],
	};
}

const nunito = Nunito({
	subsets: ["latin"],
	variable: "--font-nunito",
	weight: ["400", "500", "600", "700"],
	style: ["normal", "italic"],
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const auth = await getAuth();

	return (
		<html lang="en" className={cn("dark", nunito.className)}>
			<head>
				<meta name="darkreader-lock" />
			</head>
			<body className="dark @container/body">
				<NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
				<SessionProvider initialSession={auth}>
					<OpenPanelComponent
						debug={ENV.NODE_ENV === "development"}
						clientId={ENV.OPEN_PANEL_CLIENT_ID}
						clientSecret={ENV.OPEN_PANEL_CLIENT_SECRET}
						apiUrl={ENV.NEXT_PUBLIC_OPENPANEL_API_URL}
						scriptUrl={"/script"}
						trackAttributes
						trackOutgoingLinks
						trackScreenViews
						profileId={auth?.user?.id}
						strategy="afterInteractive"
						disabled={ENV.OPEN_PANEL_DISABLED}
					/>
					<IdentifyComponent
						profileId={auth?.user?.id}
						avatar={auth?.user?.image ?? undefined}
						firstName={auth?.user?.name}
					/>

					<NuqsAdapter>
						<TRPCReactProvider>
							<HydrateClient>
								<ConfirmModalProvider>
									<TooltipProvider>
										<TimeZoneSync />
										<ReauthProvider />
										<Toaster />
										<VersionProvider />
										<SyncConfigLocal />
										<main className="relative z-1 mb-8 w-full flex-1 border-b-3 border-b-border bg-background">{children}</main>
										<Footer />
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
