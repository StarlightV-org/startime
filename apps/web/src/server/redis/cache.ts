import "server-only";

import { getRedis } from "./redis-client";

export const REDIS_CACHE_KEY_PREFIX = "cache:v1:";

function namespacedKey(key: string): string {
	return key.startsWith(REDIS_CACHE_KEY_PREFIX) ? key : `${REDIS_CACHE_KEY_PREFIX}${key}`;
}

export async function redisCacheGet<T>(key: string): Promise<T | undefined> {
	const redis = getRedis();
	const raw = await redis.get(namespacedKey(key));
	if (raw === null) {
		return undefined;
	}
	try {
		return JSON.parse(raw) as T;
	} catch {
		return undefined;
	}
}

export async function redisCacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
	const redis = getRedis();
	await redis.set(namespacedKey(key), JSON.stringify(value), "EX", ttlSeconds);
}

// Redis cache utility function to get all values inside keys starting with a given prefix
/**
 *
 * @param prefix the prefix for the cacke key
 * @returns The parsed cache values
 */
export async function redisCacheGetAll(prefix: string): Promise<any[]> {
	const redis = getRedis();
	const keys = await redis.keys(`${REDIS_CACHE_KEY_PREFIX}${prefix}*`);
	const values = await redis.mget(keys);
	return values
		.filter((v): v is string => v !== null)
		.map((v) => {
			try {
				const parsed = JSON.parse(v) as unknown;
				return parsed;
			} catch {
				return v;
			}
		});
}

export async function invalidateCache(key: string): Promise<void> {
	const redis = getRedis();
	await redis.del(namespacedKey(key));
}

/**
 *
 * @param key The cache key to use
 * @param ttlSeconds Time-to-live in seconds
 * @param fn Function to execute if the cache is miss
 * @returns The result of the function
 */
export async function withRedisCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
	const redis = getRedis();
	const fullKey = namespacedKey(key);
	const raw = await redis.get(fullKey);
	if (raw !== null) {
		Print.Success(`Cache hit:`, fullKey);
		try {
			return JSON.parse(raw) as T;
		} catch {
			/* stale payload — refresh */
		}
	}
	Print.Fail(`Cache miss:`, fullKey);
	const val = await fn();
	await redis.set(fullKey, JSON.stringify(val), "EX", ttlSeconds);
	return val;
}

/**
 * Cache opaque binary (e.g. PNG bytes). Do not use {@link withRedisCache} for ArrayBuffer — JSON.stringify yields "{}".
 */
export async function withRedisCacheBuffer(
	key: string,
	ttlSeconds: number,
	fn: () => Promise<ArrayBuffer>,
): Promise<ArrayBuffer> {
	const redis = getRedis();
	const fullKey = namespacedKey(`bin:${key}`);
	const cached = await redis.getBuffer(fullKey);
	if (cached !== null && cached.length > 0) {
		Print.Success(`Cache hit:`, fullKey);
		return new Uint8Array(cached).buffer;
	}
	Print.Fail(`Cache miss:`, fullKey);
	const val = await fn();
	await redis.set(fullKey, Buffer.from(val), "EX", ttlSeconds);
	return val;
}
