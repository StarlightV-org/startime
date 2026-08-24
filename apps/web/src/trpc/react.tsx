"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { httpBatchStreamLink, httpSubscriptionLink, loggerLink, splitLink } from "@trpc/client";
import type { TRPCLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { useState } from "react";
import SuperJSON from "superjson";

import type { AppRouter } from "~/server/api/root";

import { createQueryClient } from "./query-client";
import { reauthLink } from "./reauth-link";
import { printBinding } from "@startime/print";
import { ENV } from "@startime/env";

const subscriptionDisableLink: TRPCLink<AppRouter> = () => {
	return ({ next, op }) => {
		if (op.type === "subscription" && ENV.NEXT_PUBLIC_DISABLE_SUBSCRIPTIONS_IN_DEV && ENV.NODE_ENV === "development") {
			return observable((observer) => {
				observer.complete();
				return () => {};
			});
		}
		return next(op);
	};
};

let clientQueryClientSingleton: QueryClient | undefined;
const getQueryClient = () => {
	if (typeof window === "undefined") {
		// Server: always make a new query client
		return createQueryClient();
	}
	// Browser: use singleton pattern to keep the same query client
	clientQueryClientSingleton ??= createQueryClient();

	return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
	const queryClient = getQueryClient();

	const [trpcClient] = useState(() =>
		api.createClient({
			links: [
				loggerLink({
					console: printBinding,
					enabled: (op) => process.env.NODE_ENV === "development" || (op.direction === "down" && op.result instanceof Error),
				}),
				reauthLink<AppRouter>(),
				subscriptionDisableLink,
				splitLink({
					condition: (op) => op.type === "subscription",
					true: httpSubscriptionLink({
						transformer: SuperJSON,
						url: `${getBaseUrl()}/api/trpc`,
						// EventSource needs credentials for cookies/auth to work
						eventSourceOptions: () => ({
							withCredentials: true,
						}),
					}),
					false: httpBatchStreamLink({
						transformer: SuperJSON,
						url: `${getBaseUrl()}/api/trpc`,
						headers: () => {
							const headers = new Headers();
							headers.set("x-trpc-source", "nextjs-react");
							return headers;
						},
					}),
				}),
			],
		}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<api.Provider client={trpcClient} queryClient={queryClient}>
				{props.children}
			</api.Provider>
		</QueryClientProvider>
	);
}

function getBaseUrl() {
	if (typeof window !== "undefined") return window.location.origin;
	if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
	return `http://localhost:${process.env.PORT ?? 3000}`;
}


