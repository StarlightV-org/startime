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

	private enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.writeQueue.then(operation);

		// Keep processing later file operations when this operation fails.
		this.writeQueue = result.then(
			() => undefined,
			() => undefined,
		);

		return result;
	}

	drain(): Promise<EventPayload[]> {
		return this.enqueue(async () => {
			await this.ensureExists();

			const content = await this.adapter.read(this.path);
			const events = JSON.parse(content) as EventPayload[];

			await this.adapter.write(this.path, "[]\n");

			return events;
		});
	}

	restore(events: EventPayload[]): Promise<void> {
		if (events.length === 0) return Promise.resolve();

		return this.enqueue(async () => {
			await this.ensureExists();

			const content = await this.adapter.read(this.path);
			const queuedEvents = JSON.parse(content) as EventPayload[];

			await this.adapter.write(this.path, `${JSON.stringify([...events, ...queuedEvents], null, "\t")}\n`);
		});
	}

	getEventsCount(): Promise<number> {
		return this.enqueue(async () => {
			await this.ensureExists();

			const content = await this.adapter.read(this.path);
			const events = JSON.parse(content) as EventPayload[];
			return events.length;
		});
	}

	append(event: EventPayload): Promise<void> {
		return this.enqueue(async () => {
			await this.ensureExists();

			const content = await this.adapter.read(this.path);
			const events = JSON.parse(content) as EventPayload[];

			events.push(event);

			await this.adapter.write(this.path, `${JSON.stringify(events, null, "\t")}\n`);
		});
	}
}
