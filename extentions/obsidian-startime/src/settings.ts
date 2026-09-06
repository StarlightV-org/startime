import {
	type App,
	Component,
	MarkdownRenderer,
	PluginSettingTab,
	SecretComponent,
	type SettingDefinitionItem,
} from 'obsidian';
import type StarTimePlugin from './main';

export interface StarTimePluginSettings {
	/** The SecretStorage ID for the CodeTime token, not the token itself. */
	codeTimeToken: string;
	/** The API URL to use for CodeTime requests. */
	apiUrl: string;
	/** The project override to use for CodeTime requests. */
	projectOveride: string;
	/** The throttle telemetry setting. in seconds */
	throttleTelemetry: number;
	/** The update interval setting. in minutes */
	updateInterval: number;
	/** Pause the update on inactivity. */
	pauseUpdateOnInactivity: boolean;

	/** Batch multiple events into a single request. */
	batchEvents: boolean;

	// INTERNAL
	pluginEnabled: boolean;
}

export const DEFAULT_SETTINGS: StarTimePluginSettings = {
	codeTimeToken: '',
	apiUrl: 'https://time.starlightv.dev',
	projectOveride: '',
	throttleTelemetry: 1,
	updateInterval: 1,
	pauseUpdateOnInactivity: true,

	batchEvents: true,

	// INTERNAL
	pluginEnabled: true,
};

export class StarTimeSettingTab extends PluginSettingTab {
	plugin: StarTimePlugin;
	private markdownComponents: Component[] = [];

	constructor(app: App, plugin: StarTimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private markdownDescription(markdown: string): DocumentFragment {
		const descriptionEl = createDiv();
		const component = new Component();
		component.load();
		this.markdownComponents.push(component);

		void MarkdownRenderer.render(this.app, markdown, descriptionEl, '', component);

		return createFragment((fragment) => {
			fragment.appendChild(descriptionEl);
		});
	}

	private unloadMarkdownComponents(): void {
		for (const component of this.markdownComponents) {
			component.unload();
		}
		this.markdownComponents = [];
	}

	override hide(): void {
		this.unloadMarkdownComponents();
		super.hide();
	}

	override async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'apiUrl' && typeof value === 'string') {
			this.plugin.settings.apiUrl = value;
		}

		if (key === 'projectOveride' && typeof value === 'string') {
			this.plugin.settings.projectOveride = value;
		}

		if (key === 'batchEvents' && typeof value === 'boolean') {
			this.plugin.settings.batchEvents = value;
		}

		// if (key === 'hideFileNames' && typeof value === 'boolean') {
		// 	this.plugin.settings.hideFileNames = value;
		// }

		if (key === 'throttleTelemetry' && typeof value === 'number') {
			this.plugin.settings.throttleTelemetry = value;
		}

		if (key === 'updateInterval' && typeof value === 'number') {
			this.plugin.settings.updateInterval = value;
		}

		await this.plugin.saveSettings();
		await this.plugin.starTime.configure();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		this.unloadMarkdownComponents();

		return [
			{
				type: 'group',
				heading: 'CodeTime',
				extraButtons: [
					async (button) => {
						button.setIcon('reset');
						button.onClick(async () => {
							this.plugin.settings = {
								...DEFAULT_SETTINGS,
								codeTimeToken: this.plugin.settings.codeTimeToken,
							};
							await this.plugin.saveSettings();
							this.update();
							await this.plugin.starTime.configure();
						});
						button.setTooltip('Reset to default');
					},
				],

				items: [
					{
						name: 'StarTime Token',
						desc: this.markdownDescription(
							'Select or create the secret that stores your StarTime token. ' +
								'\n[Open StarTime settings](https://time.starlightv.dev/dash/settings).',
						),
						render: (setting) => {
							setting.addComponent((el) =>
								new SecretComponent(this.app, el).setValue(this.plugin.settings.codeTimeToken).onChange(async (secretId) => {
									this.plugin.settings.codeTimeToken = secretId;
									await this.plugin.saveSettings();
									await this.plugin.starTime.configure();
								}),
							);
						},
					},
					{
						name: 'Server URL',
						desc: 'The URL of the CodeTime server to use.',
						control: {
							type: 'text',
							key: 'apiUrl',
							defaultValue: 'https://api.codetime.dev',
							validate: (url) => {
								if (!url) return 'URL is required';
								if (!url.startsWith('http')) return 'URL must start with http or https';
								return undefined;
							},
						},
					},
					{
						name: 'Project Override',
						desc: 'The URL of the CodeTime server to use.',
						control: {
							type: 'text',
							key: 'projectOveride',
							defaultValue: '',
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Privacy',
				items: [
					{
						name: 'Hide File Names',
						desc: 'Hide file names in telemetry data.',
						control: {
							type: 'toggle',
							key: 'hideFileNames',
							defaultValue: true,
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Performance',
				items: [
					{
						name: 'Throttle Telemetry',
						desc: 'Throttle telemetry data to reduce network usage. (in seconds)',
						control: { type: 'slider', key: 'throttleTelemetry', min: 1, max: 10, step: 1 },
					},
					{
						name: 'Update Interval',
						desc: 'The interval at which the current telemetry data is fetched from the server. (in minutes)',
						control: { type: 'slider', key: 'updateInterval', min: 1, max: 10, step: 1 },
					},
					{
						name: 'Pause Update on Inactivity',
						desc: 'Pause the update on inactivity.',
						control: { type: 'toggle', key: 'pauseUpdateOnInactivity', defaultValue: true },
					},
				],
			},
			{
				type: 'group',
				heading: 'Hidden',
				searchable: false,
				visible: false,
				items: [
					{
						name: 'Enabled',
						desc: 'If the plugin is enabled.',
						control: { type: 'toggle', key: 'pluginEnabled', defaultValue: true },
					},
				],
			},
		];
	}
}
