import { Plugin } from "obsidian";
import { StarTime } from "./startime";
import { type StarTimePluginSettings, StarTimeSettingTab, DEFAULT_SETTINGS } from "./settings";
import "@startime/print";
import { NetworkManager } from "./network-manager";
import { ActivityLogModal } from "./activity-log";
import { EventStore } from "./event-store";
import { EventPayload } from "./types";
Print.Setup({
	prefix: "StarTime",
});

export default class StarTimePlugin extends Plugin {
	settings!: StarTimePluginSettings;
	starTime: StarTime = null as unknown as StarTime;
	networkManager: NetworkManager = null as unknown as NetworkManager;
	activityLogModal: ActivityLogModal = null as unknown as ActivityLogModal;
	eventStore: EventStore = null as unknown as EventStore;

	async onload() {
		await this.loadSettings();
		this.eventStore = new EventStore(this.app.vault.adapter, this.manifest.dir);

		this.activityLogModal = new ActivityLogModal(this.app, this);
		this.networkManager = new NetworkManager(this);
		this.networkManager.configure();

		this.starTime = new StarTime(this, this.activityLogModal);
		this.addSettingTab(new StarTimeSettingTab(this.app, this));
		await this.starTime.configure();
	}

	onunload() {
		void this.starTime.destroy();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<StarTimePluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
