#!/usr/bin/env node

import { basename } from "node:path";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import {
	createConnection,

	ProposedFeatures,
	TextDocuments,
	TextDocumentSyncKind,
	type InitializeParams,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import "@startime/print";

import { version } from "../package.json";

const DEFAULT_API_URL = "https://time.starlightv.dev";
const EVENT_LOG_PATH = "/api/users/event-log";
const LOG_INTERVAL_MS = 1_000;

interface StartimeLspOptions {
	url: string;
	token?: string;
	projectOverride?: string;
	allowSelfSignedCertificates?: boolean;
}

interface EventLog {
	eventTime: string;
	language: string;
	project: string;
	fileHash: string;
	editor: string;
	platform: string;
}

class StartimeLanguageServer {
	private readonly connection = createConnection(ProposedFeatures.all, stdin, stdout);
	private readonly documents = new TextDocuments(TextDocument);
	private options: StartimeLspOptions = { url: DEFAULT_API_URL };
	private project = "unknown";
	private lastLogTime = 0;

	public start() {
		this.registerLifecycleHandlers();
		this.documents.listen(this.connection);
		this.connection.listen();
	}

	private registerLifecycleHandlers() {
		this.connection.onInitialize((params) => {
			this.configure(params);

			return {
				capabilities: {
					textDocumentSync: {
						openClose: true,
						change: TextDocumentSyncKind.Incremental,
						save: true,
					},
					hoverProvider: true,
				},
				serverInfo: {
					name: "StarTime",
					version,
				},
			};
		});

		this.documents.onDidOpen(({ document }) => this.recordDocumentActivity(document));
		this.documents.onDidChangeContent(({ document }) => this.recordDocumentActivity(document));
		this.documents.onDidSave(({ document }) => this.recordDocumentActivity(document));
		this.documents.onDidClose(({ document }) => this.recordDocumentActivity(document));

		this.connection.onHover(({ textDocument }) => {
			const document = this.documents.get(textDocument.uri);
			if (!document) {
				return null;
			}

			this.recordDocumentActivity(document);
			return null;
		});
	}

	private configure(params: InitializeParams) {
		const initializationOptions = this.toOptions(params.initializationOptions);
		this.options = {
			url: initializationOptions.url ?? DEFAULT_API_URL,
			token: initializationOptions.token ?? process.env.STARTIME_TOKEN,
			projectOverride: initializationOptions.projectOverride,
			allowSelfSignedCertificates: initializationOptions.allowSelfSignedCertificates,
		};
		if (this.options.allowSelfSignedCertificates) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		}
		this.project = this.options.projectOverride ?? this.getProject(params);

		// LSP stdout is reserved for JSON-RPC, so use stderr for server diagnostics.
		Print.Error("[LSP] StarTime configuration", {
			url: this.options.url,
			project: this.project,
			projectOverride: this.options.projectOverride,
			allowSelfSignedCertificates: Boolean(this.options.allowSelfSignedCertificates),
			hasToken: Boolean(this.options.token),
		});
	}

	private toOptions(value: unknown): Partial<StartimeLspOptions> {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			return {};
		}

		const options = value as Record<string, unknown>;
		return {
			url: typeof options.url === "string" ? options.url : undefined,
			token: typeof options.token === "string" ? options.token : undefined,
			projectOverride: typeof options.projectOverride === "string" ? options.projectOverride : undefined,
			allowSelfSignedCertificates:
				typeof options.allowSelfSignedCertificates === "boolean"
					? options.allowSelfSignedCertificates
					: undefined,
		};
	}

	private getProject(params: InitializeParams) {
		const workspaceUri = params.workspaceFolders?.[0]?.uri ?? params.rootUri;
		if (!workspaceUri) {
			return "unknown";
		}

		try {
			return basename(fileURLToPath(workspaceUri)) || "unknown";
		} catch {
			return workspaceUri;
		}
	}

	private recordDocumentActivity(document: TextDocument) {
		const now = Date.now();
		if (now - this.lastLogTime < LOG_INTERVAL_MS) {
			return;
		}
		this.lastLogTime = now;

		if (!this.options.token) {
			Print.Error("[LSP] StarTime token is not configured; skipping activity log");
			return;
		}

		const event: EventLog = {
			eventTime: new Date(now).toISOString(),
			language: document.languageId,
			project: this.project,
			fileHash: document.uri,
			editor: "Zed",
			platform: process.platform,
		};

		void this.sendEventLog(event);
	}

	private async sendEventLog(event: EventLog) {
		let endpoint: URL;
		try {
			endpoint = new URL(EVENT_LOG_PATH, this.options.url);
		} catch {
			Print.Error("[LSP] Invalid StarTime API URL", this.options.url);
			return;
		}

		try {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-api-key": this.options.token ?? "",
				},
        body: JSON.stringify(event),
			});

			if (!response.ok) {
				Print.Error("[LSP] Failed to record document activity", response.status, response.statusText);
			}
			Print.Error("[LSP] Sent document activity", response.status, response.statusText);
		} catch (error) {
			const failure = error instanceof Error ? error : new Error(String(error));
			Print.Error("[LSP] Failed to send document activity", {
				endpoint: endpoint.toString(),
				name: failure.name,
				message: failure.message,
				cause: failure.cause,
			});
		}
	}
}

new StartimeLanguageServer().start();
