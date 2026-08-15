import "@startime/print";
import { ENV } from "@startime/env";
import { buildServer } from "./server";
import { UTApi } from "uploadthing/server";

export const utapi = new UTApi({ token: ENV.UPLOADTHING_TOKEN });

const app = buildServer();
await app.listen({ host: "0.0.0.0", port: ENV.IMPORTER_PORT });
Print.StartUp(`Importer listening on port ${ENV.IMPORTER_PORT}`);
