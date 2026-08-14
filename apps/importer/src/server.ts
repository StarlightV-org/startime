import Fastify from "fastify";
import { registerImportRoutes } from "./routes/v1/import";

export function buildServer() {
	const app = Fastify({ bodyLimit: 1_048_576, logger: false });

	app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
		try {
			const raw = typeof body === "string" ? body : body.toString("utf8");
			done(null, { raw, value: JSON.parse(raw) });
		} catch {
			done(new Error("Invalid JSON"));
		}
	});

	app.get("/health", async () => ({ status: "ok" }));
	app.register(registerImportRoutes, { prefix: "/v1" });
	return app;
}
