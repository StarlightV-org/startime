import { db, shareKeyReferrers } from "@startime/db";
import { checkAccountConfig } from "~/lib/account-config";
import {
	badgeOptionsSchema,
	badgeQuerySchema,
	badgeResponseHeaders,
	referrerOrigin,
	type BadgeType,
} from "~/lib/badge-options";
import { getAuth } from "./better-auth";

export function badgeError(status: number, error: string) {
	return Response.json({ error }, { status, headers: badgeResponseHeaders });
}

export async function resolveBadgeAccess(req: Request, chartType: BadgeType) {
	const parsed = badgeQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
	if (!parsed.success) return badgeError(400, "Invalid badge parameters");
	const params = parsed.data;
	let userId: string;
	let options = { timeRange: params.timeRange, inMinutes: params.inMinutes };
	if (params.internal) {
		const { user, session } = await getAuth();
		if (!session?.id || !user) return badgeError(401, "Unauthorized");
		userId = user.id;
	} else {
		const shareKeyId = params.shareKey;
		if (!shareKeyId) return badgeError(400, "Share key is required");
		const key = await db.query.shareKeys.findFirst({
			where: (keys, { and, eq }) => and(eq(keys.id, shareKeyId), eq(keys.chartType, chartType)),
		});
		if (!key) return badgeError(404, "Badge not found");
		userId = key.userId;
		const storedOptions = badgeOptionsSchema.safeParse({
			timeRange: key.timeRange ?? "past90",
			inMinutes: key.inMinutes ?? false,
		});
		if (!storedOptions.success) return badgeError(404, "Badge not found");
		options = storedOptions.data;
	}
	const targetUser = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.id, userId),
		columns: { id: true, accountConfig: true, name: true },
	});
	if (!targetUser) return badgeError(404, "Badge not found");
	const accountConfig = checkAccountConfig(targetUser.accountConfig);
	if (!accountConfig.privacy.allowedBadges.includes(chartType)) return badgeError(404, "Badge not found");
	return { targetUser, accountConfig, options, shareKey: params.internal ? undefined : params.shareKey };
}

export async function recordBadgeReferrer(req: Request, shareKey: string | undefined) {
	const referrer = referrerOrigin(req.headers.get("referer"));
	if (!shareKey || !referrer) return;
	try {
		await db
			.insert(shareKeyReferrers)
			.values({ shareKeyId: shareKey, referrer })
			.onConflictDoUpdate({
				target: [shareKeyReferrers.shareKeyId, shareKeyReferrers.referrer],
				set: { lastUsed: new Date() },
			});
	} catch {
		// Revocation may race with this write. Tracking must never fail a badge.
		Print.Warning("Unable to record badge referrer origin");
	}
}

export async function badgeResponse(render: () => Promise<Response>) {
	try {
		const response = await render();
		for (const [key, value] of Object.entries(badgeResponseHeaders)) response.headers.set(key, value);
		return response;
	} catch {
		Print.Error("Unable to render badge");
		return badgeError(500, "Unable to render badge");
	}
}
