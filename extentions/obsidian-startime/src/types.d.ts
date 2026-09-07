import type { App } from 'obsidian';

import type { inputEventLogSchema } from '@startime/zod';
import type z from 'zod';

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
	project: string;
	language: string;
	relativeFile: string;
	absoluteFile: string;
	editor: string;
	platform: string;
	eventTime: number;
	eventType: string;
	platformArch: string;
	gitOrigin: string;
	gitBranch: string;
	operationType: string;
}

export interface Stat {
	data: Array<{
		duration: number;
		time: string;
		by: string;
	}>;
}

export interface NetworkInformation extends EventTarget {
	readonly downlink: number;
	readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
	readonly rtt: number;
	readonly saveData: boolean;
	onchange: () => void;
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
