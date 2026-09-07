import { ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { Platform, request, type TAbstractFile, type TFile } from 'obsidian';
import { ActivityLogModal } from './activity-log';
import type StarTimePlugin from './main';
import type { Payload, SettingsApp, Stat } from './types';

export class StarTime {
	public isActive: boolean = this.plugin.settings.pluginEnabled;
	public project: string =
		this.plugin.settings.projectOveride !== '' ? this.plugin.settings.projectOveride : this.plugin.app.vault.getName();
	private readonly statusBarItemEl: HTMLElement;
	public readonly activityLogModal: ActivityLogModal;
	public state: 'loading' | 'connected' | 'disconnected' | 'no-token' | 'invalid-token' | 'error' | 'disabled' =
		'disconnected';
	public codeTimeData: { minutes: number } | null = null;
	public lastTrackedAt: number | null = null;
	public lastEventTime: number = 0;
	public intervalId: number | null = null;

	constructor(
		private readonly plugin: StarTimePlugin,
		activityLogModal: ActivityLogModal,
	) {
		this.statusBarItemEl = plugin.addStatusBarItem();
		this.activityLogModal = activityLogModal;
	}

	async destroy(): Promise<void> {
		// eslint-disable-next-line eslint-comments/no-restricted-disable -- allowed
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- The name of the service is written in PascalCase
		this.statusBarItemEl.setText('StarTime: Disconnected');
		this.state = 'disconnected';
		this.stopLoop();
		// this.activityLogModal.close();
	}

	async reload(): Promise<void> {
		await this.configure();
	}

	async configure(): Promise<void> {
		await this.destroy();

		this.project =
			this.plugin.settings.projectOveride !== '' ? this.plugin.settings.projectOveride : this.plugin.app.vault.getName();

		// Set the status bar click event once, so it doesn't get re-registered every time
		this.statusBarItemEl.onClickEvent(() => {
			if (this.state === 'invalid-token' || this.state === 'no-token') {
				this.openSettings();
			} else {
				this.activityLogModal.open();
			}
		});
		this.statusBarItemEl.classList.add('codetime-status-bar-item');

		// MARK: Commands
		this.plugin.addCommand({
			id: 'open-codetime-dashboard',
			name: 'Open dashboard in browser',
			callback: () => {
				const url = new URL('/dashboard', this.plugin.settings.apiUrl.toString().replace('api.', ''));
				window.open(url.toString(), '_blank');
			},
		});
		this.plugin.addCommand({
			id: 'open-startime-log',
			name: 'Open activity log',
			callback: () => {
				this.activityLogModal.open();
			},
		});

		if (!this.isActive) {
			this.state = 'disabled';
			this.syncStatusBar();
			this.activityLogModal.appendLine('[PLUGIN]: Disabled');
			this.activityLogModal.appendLine('[PLUGIN]: The plugin is currently disabled.');
			return;
		}

		this.state = 'loading';
		this.syncStatusBar();
		this.activityLogModal.appendLine(`[PLUGIN]: Vault - ${this.project}`);
		this.activityLogModal.appendLine(
			`[PLUGIN]: Project Override - ${this.plugin.settings.projectOveride === '' ? 'Off' : 'On'}`,
			'warning',
		);
		// this.activityLogModal.appendLine(
		// 	`[PLUGIN]: Filenames - ${this.plugin.settings.hideFileNames ? 'Hidden' : 'Visible'}`,
		// 	!this.plugin.settings.hideFileNames ? 'warning' : 'success',
		// );
		this.activityLogModal.appendLine(
			`[PLUGIN]: Throttle Telemetry - ${this.plugin.settings.throttleTelemetry} seconds`,
			'info',
		);
		this.activityLogModal.appendLine(
			`[PLUGIN]: Update Interval - ${this.plugin.settings.updateInterval} minutes`,
			'info',
		);

		const token = this.getTokenFromSettings();

		if (!token) {
			this.state = 'no-token';
			this.syncStatusBar();
			this.activityLogModal.appendLine('[AUTH]: Token - missing', 'error');
			return;
		}

		this.activityLogModal.appendLine('[AUTH]: Token - configured');
		if (!(await this.plugin.networkManager.testToken()) && this.plugin.networkManager.networkState) {
			return;
		}

		this.state = 'connected';
		this.syncStatusBar();

		this.activityLogModal.appendLine('[API]: Connecting');

		await this.startLoop();
		this.listenFor();
	}

	private async startLoop(): Promise<void> {
		this.activityLogModal.appendLine('[LOOP]: Started');
		await this.fetchCurrentCodeTime();
		this.syncStatusBar();
		this.intervalId = this.plugin.registerInterval(
			window.setInterval(
				async () => {
					if (this.plugin.settings.pauseUpdateOnInactivity) {
						const now = Date.now();
						if (now - this.lastEventTime > this.plugin.settings.updateInterval * 60 * 1000) {
							this.activityLogModal.appendLine('[LOOP]: No activity - stopping');
							this.stopLoop();
							return;
						}
					}

					this.activityLogModal.appendLine('[LOOP]: Fetching data');
					await this.fetchCurrentCodeTime();
				},
				1000 * this.plugin.settings.updateInterval * 60,
			),
		);
	}

	private stopLoop(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
			this.activityLogModal.appendLine('[LOOP]: Stopped');
		}
	}

	private listenFor(): void {
		this.plugin.app.workspace.onLayoutReady(() => {
			this.plugin.registerEvent(
				this.plugin.app.workspace.on('file-open', (file) => {
					void this.track('activateFileChanged', file);
				}),
			);

			this.plugin.registerEvent(
				this.plugin.app.workspace.on('editor-change', (_editor, info) => {
					void this.track('editorChanged', info.file);
				}),
			);

			this.plugin.registerEvent(this.plugin.app.vault.on('create', (file) => void this.track('fileCreated', file)));
			this.plugin.registerEvent(
				this.plugin.app.vault.on('modify', (file) => {
					void this.track('fileEdited', file);
					// this.track('fileSaved', file); // best available public equivalent
				}),
			);

			const track = this.track.bind(this);
			const plugin = this.plugin;
			// Get the current open file
			this.plugin.registerEditorExtension(
				ViewPlugin.fromClass(
					class {
						update(update: ViewUpdate) {
							if (update.selectionSet) {
								const file = plugin.app.workspace.getActiveFile();
								void track('selectionChanged', file);
							}
						}
					},
				),
			);
		});
	}

	private async track(event: string, file: TFile | TAbstractFile | undefined | null) {
		const originalFilePath = file?.path ?? '__no-file__';
		const now = Date.now();
		const lastTime = this.lastTrackedAt;
		if (typeof lastTime === 'number' && now - lastTime < this.plugin.settings.throttleTelemetry * 1000) {
			// this.activityLogModal.appendLine(
			// 	`Throttled: ${event} ${originalFilePath}` + ` (last tracked ${now - lastTime}ms ago)`,
			// );
			return;
		}

		this.lastTrackedAt = now;

		async function hashFileName(fileName: string): Promise<string> {
			const bytes = new TextEncoder().encode(fileName);

			const hash = await window.crypto.subtle.digest('SHA-256', bytes);

			return Array.from(new Uint8Array(hash))
				.map((byte) => byte.toString(16).padStart(2, '0'))
				.join('');
		}

		const newName = await hashFileName(originalFilePath);

		const getOs = (): string => {
			if (Platform.isDesktopApp) {
				const desktopProcess = globalThis as typeof globalThis & {
					process?: { getSystemVersion?: () => string };
				};
				const version = desktopProcess.process?.getSystemVersion?.();

				if (Platform.isWin && version) {
					const build = Number(version.split('.')[2]);

					// Windows 11 reports NT 10.0 internally; builds 22000+ are Windows 11.
					return build >= 22000 ? 'Windows 11' : `Windows ${version}`;
				}

				if (Platform.isMacOS && version) {
					const majorVersion = version.split('.')[0];
					return `macOS ${majorVersion}`;
				}
			}

			if (Platform.isLinux) return 'Linux';
			if (Platform.isIosApp) return 'iOS';
			if (Platform.isAndroidApp) return 'Android';

			return 'Unknown';
		};
		const os = getOs();

		const payload = {
			editor: 'Obsidian',
			language: file && 'extension' in file ? file.extension : 'unknown',
			project: this.project,
			eventTime: Date.now(),
			eventType: event,
			operationType: event === 'activateFileChanged' ? 'read' : 'edit',
			relativeFile: newName,
			absoluteFile: newName,
			platform: os,
			// @ts-expect-error
			// eslint-disable-next-line no-undef, @typescript-eslint/no-unsafe-member-access -- process.arch is only available in desktop apps
			platformArch: Platform.isDesktopApp && 'arch' in process ? (process.arch as unknown) : 'unknown',
			gitOrigin: 'none',
			gitBranch: 'none',
		} as Payload;

		const url = new URL(`/v3/users/event-log`, this.plugin.settings.apiUrl);

		this.activityLogModal.appendLine(`[EVENT]: Sending - ${event} - ${file?.name ?? `unknown`}`, 'success');

		this.lastEventTime = Date.now();
		if (this.intervalId === null) {
			void this.startLoop();
		}

		await request({
			url: url.toString(),
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.getTokenFromSettings()}`,
				'User-Agent': 'obsidian-codetime',
			},
			body: JSON.stringify(payload),
		}).catch((e: Error) => {
			this.activityLogModal.appendLine(`[EVENT]: Send failed - ${e?.message ?? 'Unknown error'}`, 'error');
			return null;
		});
	}

	public syncStatusBar(): void {
		let text = '';

		const syncText = (text: string) => {
			// this.activityLogModal.appendLine(`State: ${this.state}`);
			this.statusBarItemEl.setText(text);
		};

		if (this.state === 'disabled') {
			text += 'StarTime: Disabled';
			syncText(text);
			return;
		}

		if (this.state === 'no-token' || this.state === 'invalid-token') {
			text += 'StarTime';
			if (this.state === 'invalid-token') {
				text += ': Invalid Token';
			} else {
				text += ': No Token Provided';
			}
			syncText(text);
			return;
		}

		if (this.state === 'error') {
			text += 'StarTime: Error';
			syncText(text);
			return;
		}

		if (this.state === 'disconnected') {
			text += 'StarTime: Disconnected';
			syncText(text);
			return;
		}

		if (this.state === 'loading') {
			text += 'StarTime: Loading...';
			syncText(text);
			return;
		}

		if (this.state === 'connected') {
			if (!this.codeTimeData) {
				text += 'StarTime: Fetching...';
			} else {
				text += `${this.project}: ${this.convertMinutes(this.codeTimeData?.minutes ?? 0)}`;
			}
			syncText(text);
			return;
		}
	}

	private convertMinutes(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return `${hours > 0 ? `${hours}h ` : ''}${remainingMinutes}m`;
	}

	public getTokenFromSettings(): string | null {
		return this.plugin.app.secretStorage.getSecret(this.plugin.settings.codeTimeToken);
	}

	private openSettings(): void {
		const app = this.plugin.app as SettingsApp;
		app.setting.open();
		app.setting.openTabById(this.plugin.manifest.id);
	}

	//
}
