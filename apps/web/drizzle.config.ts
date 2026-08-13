import { type Config } from "drizzle-kit";

import { ENV } from "@startime/env";

export default {
  schema: "../../packages/db/src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: ENV.DATABASE_URL,
  },
  tablesFilter: ["startime_*"],
} satisfies Config;
