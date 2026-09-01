import "~/styles/globals.css";

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
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
import { setRequestI18n } from "~/i18n/server";
import { fromHeader, localeCookieName, resolveLocale } from "~/i18n/locales";
import { LinguiProvider } from "~/provider/lingui-provider";
import { DocsContextMenu } from "~/components/docs-context-menu";

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
	const [auth, cookieStore] = await Promise.all([getAuth(), cookies()]);
	const locale = resolveLocale(auth.user?.accountConfig.regional.lang, fromHeader(await headers()));
	const i18n = await setRequestI18n(locale);

	return (
		<html lang={locale} className={cn("dark", nunito.className)}>
			<head>
				<meta name="darkreader-lock" />
			</head>
			<body className="dark @container/body">
				<NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
				<LinguiProvider key={locale} locale={locale} messages={i18n.messages}>
					<SessionProvider initialSession={auth}>
						<OpenPanelComponent
							debug={ENV.NODE_ENV === "development" && ENV.OPEN_PANEL_DISABLED !== true}
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
											<DocsContextMenu />
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
				</LinguiProvider>
			</body>
		</html>
	);
}
