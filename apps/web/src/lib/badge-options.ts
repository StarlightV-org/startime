import z from "zod";
import { timeRangeValues } from "./time-range";

export const supportedBadgeTypes = ["calendar", "lang"] as const;
export type BadgeType = (typeof supportedBadgeTypes)[number];
export const badgeOptionsSchema = z.object({
	timeRange: z.enum(timeRangeValues),
	inMinutes: z.boolean(),
});
export type BadgeOptions = z.infer<typeof badgeOptionsSchema>;
export function defaultBadgeOptions(): BadgeOptions {
	return { timeRange: "past90", inMinutes: false };
}

const queryBoolean = z.enum(["true", "false"]).transform((value) => value === "true");
export const badgeQuerySchema = z
	.object({
		internal: queryBoolean.optional().default(false),
		shareKey: z
			.string()
			.regex(/^[A-Z]{8}\d{8}$/)
			.optional(),
		timeRange: z.enum(timeRangeValues).optional().default("past90"),
		inMinutes: queryBoolean.optional().default(false),
	})
	.superRefine((value, ctx) => {
		if (!value.internal && !value.shareKey) ctx.addIssue({ code: "custom", message: "Share key is required" });
		if (value.internal && value.shareKey)
			ctx.addIssue({ code: "custom", message: "Internal previews cannot use share keys" });
	});

/** Only retain an HTTP origin. Never retain paths, credentials, queries or fragments. */
export function referrerOrigin(value: string | null): string | undefined {
	if (!value || value.length > 4096) return undefined;
	try {
		const url = new URL(value);
		if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
		return url.origin;
	} catch {
		return undefined;
	}
}

// Even public keys are revocable. Do not allow HTTP caches to bypass authorization.
export const badgeResponseHeaders = {
	"Cache-Control": "private, no-store, max-age=0",
	Vary: "Cookie, Accept-Language",
	"X-Content-Type-Options": "nosniff",
};
