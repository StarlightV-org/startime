import type { App } from "obsidian";
import type StarTimePlugin from "./main";
import type { ActivityLogModal } from "./activity-log";
import { Platform, request, type TAbstractFile, type TFile } from "obsidian";
import { Stat } from "./types";

export class NetworkManager {
	private plugin: StarTimePlugin;
	public networkState: boolean = false;
	private activityLogModal: ActivityLogModal;

	public tokenValid: boolean = false;

	constructor(plugin: StarTimePlugin) {
		this.plugin = plugin;
		this.activityLogModal = plugin.activityLogModal;
	}

	configure() {
		this.networkState = navigator.onLine;

		this.activityLogModal.appendLine(`[NET]: ${navigator.onLine ? "Online" : "Offline"}`);

		if (navigator.connection) {
			navigator.connection.onchange = () => {
				this.onNetworkChange();
			};
		}
	}

	onNetworkChange() {
		this.networkState = navigator.onLine;

		const onlineMessage = "[NET]: You are online, events will be synced with the server.";
		const offlineMessage = "[NET]: You are offline, events will be saved locally and synced when you are back online.";

		this.activityLogModal.appendLine(
			`[NET]: ${this.networkState ? "Online" : "Offline"}`,
			this.networkState ? "success" : "warning",
		);

		if (this.networkState) {
			this.plugin.starTime.state = "connected";
			this.activityLogModal.appendLine(onlineMessage, "success");
			void this.plugin.starTime.startLoop();
		} else {
			this.plugin.starTime.stopLoop();
			this.plugin.starTime.state = "offline";
			this.activityLogModal.appendLine(offlineMessage, "warning");
		}

		this.plugin.starTime.syncStatusBar();
	}

	public async testToken(): Promise<boolean> {
		if (!this.networkState) {
			this.activityLogModal.appendLine("[AUTH]: No network, skipping test", "warning");
			return false;
		}

		const url = new URL(`/api/users/self/`, this.plugin.settings.apiUrl);

		this.activityLogModal.appendLine("[AUTH]: Testing");

		const response = await request({
			url: url.toString(),
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": `${this.plugin.starTime.getTokenFromSettings()}`,
				"User-Agent": "obsidian-startime",
			},
		}).catch((e: Error) => {
			this.activityLogModal.appendLine(`[AUTH]: Test failed - ${e?.message ?? "Unknown error"}`, "error");

			this.plugin.starTime.state = "invalid-token";
			this.plugin.starTime.syncStatusBar();

			// void this.reload();
			return false;
		});

		if (!response) {
			this.activityLogModal.appendLine("[AUTH]: Failed", "error");
			return false;
		}

		// this.userData = typeof response === 'string' ? (JSON.parse(response) as UserData) : null;
		this.activityLogModal.appendLine("[AUTH]: Successful", "success");
		return true;
	}

	public async fetchCurrentCodeTime(): Promise<void> {
		const url = new URL(`/api/users/self/stats`, this.plugin.settings.apiUrl);

		url.searchParams.set("project", this.plugin.starTime.project);

		const response = await request({
			url: url.toString(),
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": `${this.plugin.starTime.getTokenFromSettings()}`,
				"User-Agent": "obsidian-codetime",
			},
		}).catch((e: Error) => {
			this.activityLogModal.appendLine(`[API]: Fetch failed - ${e?.message ?? "Unknown error"}`, "error");
			return null;
		});

		if (!response) {
			return;
		}
		const responseJson: Stat = JSON.parse(response) as Stat;
		this.plugin.starTime.codeTimeData = { time: responseJson.time ?? "" };
		// this.activityLogModal.appendLine(
		// 	`[API]: Data fetched - ${this.convertMinutes(this.codeTimeData.minutes)} (${this.codeTimeData.minutes} minutes)`,
		// 	'success',
		// );
		this.plugin.starTime.syncStatusBar();
	}
}
