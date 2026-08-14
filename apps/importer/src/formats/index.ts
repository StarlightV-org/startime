import { codeTimeCsvFormat } from "./codetime-csv";
import type { ImportFormat } from "./types";

const formats = new Map<string, ImportFormat>([[codeTimeCsvFormat.id, codeTimeCsvFormat]]);

export function getFormat(formatId: string): ImportFormat {
	const format = formats.get(formatId);
	if (!format) throw new Error(`Unsupported import format: ${formatId}`);
	return format;
}

export type { ImportedEvent, ImportFormat } from "./types";
