import "server-only";

import Redis from "ioredis";
import { ENV } from "@startime/env";

const globalForRedis = globalThis as typeof globalThis & { __controlPanelRedis?: Redis };

/**
 * Singleton Redis client. Safe across Next.js hot reload via `globalThis`.
 * Requires `REDIS_URL` (validated in env).
 */
export function getRedis(): Redis {
	if (!globalForRedis.__controlPanelRedis) {
		globalForRedis.__controlPanelRedis = new Redis(ENV.REDIS_URL, {
			maxRetriesPerRequest: null,
		});
	}
	return globalForRedis.__controlPanelRedis;
}
