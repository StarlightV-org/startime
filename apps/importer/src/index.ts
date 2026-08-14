import "@startime/print";
import { ENV } from "@startime/env";
import { buildServer } from "./server";

const app = buildServer();
await app.listen({ host: "0.0.0.0", port: ENV.IMPORTER_PORT });
Print.StartUp(`Importer listening on port ${ENV.IMPORTER_PORT}`);
