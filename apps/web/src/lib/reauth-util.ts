/** Error cause for re-auth required - session lastAuthenticatedAt older than 60 seconds */
export const REAUTH_REQUIRED_CAUSE = "REAUTH_REQUIRED" as const;
export const PASSKEY_REGISTRATION_REQUIRED_CAUSE = "PASSKEY_REGISTRATION_REQUIRED" as const;

/** Check if error is REAUTH_REQUIRED - use in onError to skip showing your own toast */
export function isReauthRequired(error: unknown): boolean {
	const err = error as { data?: { cause?: string; code?: string }; message?: string };
	return (
		err?.data?.cause === REAUTH_REQUIRED_CAUSE ||
		(err?.data?.code === "UNAUTHORIZED" && err?.message === "Re-authentication required")
	);
}

export function isPasskeyRegistrationRequired(error: unknown): boolean {
	const err = error as { data?: { cause?: string; code?: string }; message?: string };
	return (
		err?.data?.cause === PASSKEY_REGISTRATION_REQUIRED_CAUSE ||
		(err?.data?.code === "UNAUTHORIZED" && err?.message === "A passkey is required before this action can be verified")
	);
}

/**
 * Bridge for opening reauth modal from non-React code (e.g. tRPC reauth-link).
 * ReauthProvider listens for the custom event and shows the modal.
 */
const REAUTH_MODAL_REQUEST = "reauth-modal-request" as const;

let pendingResolve: ((ok: boolean) => void) | null = null;

export function openReauthModal(): Promise<boolean> {
	return new Promise((resolve) => {
		pendingResolve = resolve;
		window.dispatchEvent(new CustomEvent(REAUTH_MODAL_REQUEST));
	});
}

export function resolveReauthModal(ok: boolean): void {
	if (pendingResolve) {
		pendingResolve(ok);
		pendingResolve = null;
	}
}

export function getReauthModalRequestEvent(): string {
	return REAUTH_MODAL_REQUEST;
}
