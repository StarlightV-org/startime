import { type Config } from "drizzle-kit";

import { ENV } from "@startime/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: ENV.DATABASE_URL,
  },
  tablesFilter: ["web_*"],
} satisfies Config;
