import { intervalToDuration } from "date-fns";
import { toast } from "sonner";

/** Error cause for re-auth required - session lastAuthenticatedAt older than 60 seconds */
export const RATE_LIMIT_CAUSE = "TOO_MANY_REQUESTS" as const;

/** Check if error is rate limit - use in onError to skip showing your own toast, or in ErrorView */
export function isRateLimit(error: unknown, withToast: boolean = false): boolean {
	const err = error as {
		cause?: { type?: string; retryAfterMs?: number };
		data?: { cause?: { type?: string; retryAfterMs?: number }; code?: string };
		code?: string;
		message?: string;
	};
	const result =
		(err?.cause?.type === RATE_LIMIT_CAUSE && err?.cause?.retryAfterMs !== undefined) ||
		(err?.data?.cause?.type === RATE_LIMIT_CAUSE && err?.data?.cause?.retryAfterMs !== undefined) ||
		(err?.data?.code === "TOO_MANY_REQUESTS" && err?.message === "Zu viele Anfragen") ||
		(err?.code === "TOO_MANY_REQUESTS" && (err?.message?.startsWith("Zu viele Anfragen") ?? false)) ||
		// RSC serialization strips cause/data/code - only message survives (e.g. from server tryCatch)
		(err?.message?.startsWith("Zu viele Anfragen") ?? false);

	if (withToast && result) {
		toast.error(
			(err?.data?.cause as { description?: string })?.description ?? "Zu viele Anfragen. Bitte versuche es später erneut.",
		);
	}

	return result;
}

/** Parse "8m 13s", "1h 2m 3s" etc. back to milliseconds. Matches formatRetryAfter output. */
export function parseRetryAfter(str: string): number {
	let ms = 0;
	const d = str.match(/(\d+)d/)?.[1];
	const h = str.match(/(\d+)h/)?.[1];
	const m = str.match(/(\d+)m/)?.[1];
	const s = str.match(/(\d+)s/)?.[1];
	if (d) ms += Number.parseInt(d, 10) * 24 * 60 * 60 * 1000;
	if (h) ms += Number.parseInt(h, 10) * 60 * 60 * 1000;
	if (m) ms += Number.parseInt(m, 10) * 60 * 1000;
	if (s) ms += Number.parseInt(s, 10) * 1000;
	return ms;
}

export function formatRetryAfter(ms: number): string {
	const endMs = Math.ceil(ms / 1000) * 1000;
	const { days, hours, minutes, seconds } = intervalToDuration({
		start: new Date(0),
		end: new Date(endMs),
	});
	const parts: string[] = [];
	if (days) parts.push(`${days}d`);
	if (hours) parts.push(`${hours}h`);
	if (minutes) parts.push(`${minutes}m`);
	if (seconds) parts.push(`${seconds}s`);
	return parts.length > 0 ? parts.join(" ") : "0s";
}
