import { createHash } from "node:crypto";

/**
 * Returns a hash of an object's keys and values, independent of key order.
 */
export function cacheKey(obj: Record<string, unknown>): string {
	const serialized = JSON.stringify(obj, (_key, value: unknown) => {
		if (value === null || typeof value !== "object" || Array.isArray(value)) {
			return value;
		}

		return Object.fromEntries(
			Object.entries(value).sort(([keyA], [keyB]) => {
				if (keyA < keyB) return -1;
				if (keyA > keyB) return 1;
				return 0;
			}),
		);
	});

	return createHash("sha256").update(serialized).digest("hex");
}
