"use client";

import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AnyRouter } from "@trpc/server";
import { toast } from "sonner";
import { getCenteredPosition, toWindowFeatures } from "~/components/ui/new-window";
import { isPasskeyRegistrationRequired, isReauthRequired, openReauthModal } from "~/lib/reauth-util";

const REAUTH_POPUP_URL = "/auth/reauth";
const REAUTH_POPUP_WIDTH = 420;
const REAUTH_POPUP_HEIGHT = 520;

type ReauthMessage = { type: "REAUTH_SUCCESS" } | { type: "REAUTH_FAILED"; message?: string };

function openReauth(): Promise<boolean> {
	return new Promise((resolve) => {
		const { left, top } = getCenteredPosition("screen", REAUTH_POPUP_WIDTH, REAUTH_POPUP_HEIGHT);
		const url = typeof window !== "undefined" ? `${window.location.origin}${REAUTH_POPUP_URL}` : REAUTH_POPUP_URL;
		const popup = window.open(
			url,
			"reauth",
			toWindowFeatures({ width: REAUTH_POPUP_WIDTH, height: REAUTH_POPUP_HEIGHT, left, top }),
		);

		if (!popup) {
			// Popup blocked (common on mobile) – fallback to in-page modal
			openReauthModal().then(resolve);
			return;
		}

		const handleMessage = (event: MessageEvent<ReauthMessage>) => {
			if (event.origin !== window.location.origin) return;
			if (event.data?.type === "REAUTH_SUCCESS") {
				cleanup();
				resolve(true);
			} else if (event.data?.type === "REAUTH_FAILED") {
				cleanup();
				toast.error("Verifizierung fehlgeschlagen", {
					description: event.data.message ?? "Bitte versuche es erneut.",
				});
				resolve(false);
			}
		};

		const checkClosed = () => {
			if (popup.closed) {
				cleanup();
				toast.error("Verifizierung abgebrochen", {
					description: "Die Aktion wurde nicht ausgeführt.",
				});
				resolve(false);
			}
		};

		const cleanup = () => {
			window.removeEventListener("message", handleMessage);
			clearInterval(interval);
			try {
				popup.close();
			} catch {
				/* popup may already be closed */
			}
		};

		window.addEventListener("message", handleMessage);
		const interval = setInterval(checkClosed, 300);
	});
}

/**
 * tRPC link that intercepts REAUTH_REQUIRED errors, opens reauth popup, and retries.
 * Skips subscriptions (EventSource cannot be retried).
 */
export function reauthLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {
	return () => {
		return ({ next, op }) => {
			// Skip subscriptions - they use EventSource and can't be retried
			if (op.type === "subscription") {
				return next(op);
			}

			return observable((observer) => {
				let subscription: { unsubscribe: () => void } | null = null;
				let disposed = false;

				function run() {
					subscription = next(op).subscribe({
						next(value) {
							observer.next(value);
						},
						error(err) {
							if (disposed) return;
							if (isPasskeyRegistrationRequired(err)) {
								window.location.assign("/dash/settings?passkey=required");
								observer.error(err);
							} else if (isReauthRequired(err)) {
								openReauth().then((ok) => {
									if (disposed) return;
									if (ok) {
										run();
									} else {
										observer.error(err);
									}
								});
							} else {
								observer.error(err);
							}
						},
						complete() {
							observer.complete();
						},
					});
				}

				run();

				return () => {
					disposed = true;
					subscription?.unsubscribe();
				};
			});
		};
	};
}
