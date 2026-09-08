import type { App } from "obsidian";

import type { inputEventLogSchema } from "@startime/zod";
import type z from "zod";

export type SettingsApp = App & {
	setting: {
		open(): void;
		openTabById(id: string): void;
	};
};

export interface UserData {
	id: number;
	email: string;
	username: string;
	avatar: string;
	githubId: number;
	bio: string;
	googleId: string;
	plan: string;
	timezone: string;
	uploadToken: string;
	planExpiresAt: string;
	planStatus: string;
	createdAt: string;
	updatedAt: string;
}

export type EventPayload = Extract<z.infer<typeof inputEventLogSchema>, { eventTime?: Date | undefined }>;

export interface Payload {
	editor: string;
	language: string;
	project: string;
	eventTime: number;
	fileHash: string;
	platform: string;
}

export interface Stat {
	time: `${number}h ${number}m`;
}

export interface NetworkInformation extends EventTarget {
	readonly downlink: number;
	readonly effectiveType: "slow-2g" | "2g" | "3g" | "4g";
	readonly rtt: number;
	readonly saveData: boolean;
	onchange: () => void | Promise<void>;
	type?: string;
}

export interface Navigator {
	readonly connection?: NetworkInformation;
}

declare global {
	interface Navigator {
		readonly connection?: NetworkInformation;
	}
}
