import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ENV } from "@startime/env";
import * as schema from "./schema";
export * from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
	conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(ENV.DATABASE_URL);
if (ENV.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema: { ...schema } });
