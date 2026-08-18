export type ImportedEvent = {
	eventTime: string;
	createdAt: string;
	language: string;
	project: string;
	fileHash: string | null;
	editor: string;
	platform: string;
};

export type ImportFormat = {
	readonly id: string;
	readonly headers: readonly string[];
	matchesHeaders(headers: readonly string[]): boolean;
	parse(contents: string, fileHashKey: string): ImportedEvent[];
};
