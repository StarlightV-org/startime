export type ImportedEvent = {
	eventTime: string;
	createdAt: string;
	language: string;
	project: string;
	fileHash: string;
	editor: string;
	platform: string;
};

export type ImportFormat = {
	readonly id: string;
	parse(contents: string, fileHashKey: string): ImportedEvent[];
};
