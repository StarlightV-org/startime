import { type App, DropdownComponent, Modal, ToggleComponent } from 'obsidian';
import type StarTimePlugin from './main';

export type ActivityLogLevel = 'info' | 'success' | 'warning' | 'error';

interface ActivityLogEntry {
	message: string;
	level: ActivityLogLevel;
	timestamp: Date;
}

type ActivityLogFilter = ActivityLogLevel | 'all';

export class ActivityLogModal extends Modal {
	plugin: StarTimePlugin;
	private readonly entries: ActivityLogEntry[] = [];
	private filter: ActivityLogFilter = 'all';
	private searchTerm = '';
	private logEl?: HTMLDivElement;
	private reloadButton?: HTMLButtonElement;
	private stateToggle?: ToggleComponent;

	constructor(app: App, plugin: StarTimePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.setTitle('Activity log');
		this.modalEl.addClass('startime-activity-log-modal');
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
		this.logEl = undefined;
	}

	/** Add a line to the log. It is retained when the modal is closed. */
	appendLine(message: string, level: ActivityLogLevel = 'info', timestamp = new Date()): void {
		this.entries.push({ message, level, timestamp });
		this.renderLog();
	}

	clear(): void {
		this.entries.length = 0;
		this.renderLog();
	}

	getLogText(): string {
		return this.entries.map((entry) => this.formatEntry(entry)).join('\n');
	}

	private render(): void {
		this.contentEl.empty();

		const toolbar = this.contentEl.createDiv({
			cls: 'startime-log-toolbar',
		});
		const filter = new DropdownComponent(toolbar);
		filter.selectEl.addClass('startime-log-filter');
		filter.selectEl.setAttribute('aria-label', 'Filter log entries');
		filter.addOptions({
			all: 'All',
			info: 'Info',
			success: 'Success',
			warning: 'Warning',
			error: 'Error',
		});
		filter.setValue(this.filter).onChange((value) => {
			this.filter = value as ActivityLogFilter;
			this.renderLog();
		});

		const search = toolbar.createEl('input', {
			cls: 'startime-log-search',
			attr: {
				type: 'search',
				placeholder: 'Filter...',
				'aria-label': 'Search log entries',
			},
		});
		search.value = this.searchTerm;
		search.addEventListener('input', () => {
			this.searchTerm = search.value;
			this.renderLog();
		});

		this.logEl = this.contentEl.createDiv({
			cls: 'startime-log-output',
			attr: { role: 'log', 'aria-live': 'polite' },
		});

		const footer = this.contentEl.createDiv({
			cls: 'startime-log-footer',
		});
		const stateControl = footer.createDiv({
			cls: 'startime-log-state-control',
		});
		stateControl.createSpan({ text: 'startime enabled' });
		this.stateToggle = new ToggleComponent(stateControl)
			.setValue(this.plugin.starTime.isActive)
			.onChange((isActive) => {
				this.plugin.starTime.isActive = isActive;
				this.plugin.settings.pluginEnabled = isActive;
				void this.plugin.saveSettings();
				void this.plugin.starTime.reload();
			});
		this.stateToggle.toggleEl.setAttribute('aria-label', 'Enable startime');

		const doneButton = footer.createEl('button', { text: 'Done' });
		doneButton.addEventListener('click', () => this.close());

		this.reloadButton = footer.createEl('button', { text: 'Reload' });
		this.reloadButton.addEventListener('click', () => {
			void this.plugin.starTime.reload();
		});

		this.renderLog();
	}

	private renderLog(): void {
		if (!this.logEl) return;

		this.logEl.empty();
		const searchTerm = this.searchTerm.trim().toLowerCase();
		const visibleEntries = this.entries.filter((entry) => {
			const matchesLevel = this.filter === 'all' || entry.level === this.filter;
			const matchesSearch = !searchTerm || entry.message.toLowerCase().includes(searchTerm);
			return matchesLevel && matchesSearch;
		});

		for (const entry of visibleEntries) {
			const line = this.logEl.createDiv({
				cls: ['startime-log-line', `is-${entry.level}`],
			});
			this.renderEntry(line, entry);
		}

		this.logEl.scrollTop = this.logEl.scrollHeight;
	}

	private formatEntry(entry: ActivityLogEntry): string {
		const date = entry.timestamp;

		const timestamp = `${date.getHours()}:${this.pad(date.getMinutes())}:${this.pad(date.getSeconds())}`;

		return `${timestamp} - ${entry.message}`;
	}

	private renderEntry(line: HTMLDivElement, entry: ActivityLogEntry): void {
		const date = entry.timestamp;
		const timestamp = `${date.getHours()}:${this.pad(date.getMinutes())}:${this.pad(date.getSeconds())}`;
		line.createSpan({ cls: 'startime-log-timestamp', text: `${timestamp} - ` });

		const categoryMatch = entry.message.match(/^\[([A-Z]+)\]:\s*(.*)$/);
		if (!categoryMatch) {
			line.createSpan({ text: entry.message });
			return;
		}

		const category = categoryMatch[1] ?? 'UNKNOWN';
		const message = categoryMatch[2] ?? '';
		line.createSpan({
			cls: ['startime-log-category', `startime-log-category--${category.toLowerCase()}`],
			text: `[${category}]:`,
		});
		line.createSpan({ cls: 'startime-log-message', text: ` ${message}` });
	}

	private pad(value: number): string {
		return value.toString().padStart(2, '0');
	}
}
