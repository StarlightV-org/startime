import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@startime/db";
import { getRedis } from "~/server/redis/redis-client";
import "@startime/env";

export const dynamic = "force-dynamic";

const healthy = "healthy" as const;
const error = "error" as const;

const timeout = 1000 * 5;

async function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
	return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeout))]);
}

export async function GET() {
	const [dbState, redisState] = await Promise.all([
		withTimeout(
			db
				.execute(sql`SELECT 1`)
				.then(() => healthy)
				.catch(() => error),
			timeout,
		).catch(() => error),
		withTimeout(
			getRedis()
				.ping()
				.then(() => healthy)
				.catch(() => error),
			timeout,
		).catch(() => error),
	]);

	const body = {
		db: dbState,
		redis: redisState,
		next: healthy,
	};
	const isHealthy = dbState === healthy && redisState === healthy;

	return NextResponse.json(body, { status: isHealthy ? 200 : 503 });
}
