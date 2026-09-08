import { normalizePath, type DataAdapter } from "obsidian";
import { EventPayload } from "./types";

export class EventStore {
	private readonly path: string;
	private writeQueue = Promise.resolve();

	constructor(
		private readonly adapter: DataAdapter,
		pluginDir: string | undefined,
	) {
		if (!pluginDir) {
			this.path = "";
			return;
		}

		this.path = normalizePath(`${pluginDir}/events.json`);
	}

	async ensureExists(): Promise<void> {
		if (!this.path || this.path.trim() === "") return;

		if (await this.adapter.exists(this.path)) {
			return;
		}

		await this.adapter.write(this.path, "[]\n");
	}

	public async getEvents(): Promise<EventPayload[]> {
		const content = await this.adapter.read(this.path);
		return JSON.parse(content) as EventPayload[];
	}

	append(event: EventPayload): Promise<void> {
		// Serialize read-modify-write operations. Without this, simultaneous
		// calls could overwrite each other's events.
		this.writeQueue = this.writeQueue.then(async () => {
			await this.ensureExists();

			const content = await this.adapter.read(this.path);
			const events = JSON.parse(content) as EventPayload[];

			events.push(event);

			await this.adapter.write(this.path, `${JSON.stringify(events, null, "\t")}\n`);
		});

		return this.writeQueue;
	}
}
