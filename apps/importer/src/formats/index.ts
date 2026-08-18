import { parse } from "csv-parse/sync";
import { codeTimeCsvFormat } from "./codetime-csv";
import { startimeExportCsvFormat } from "./startime-export-csv";
import type { ImportFormat } from "./types";

const formats: readonly ImportFormat[] = [codeTimeCsvFormat, startimeExportCsvFormat];

export function detectFormat(contents: string): ImportFormat {
	let headers: string[];
	try {
		headers = (parse(contents, { bom: true, skip_empty_lines: true, to_line: 1 })[0] as string[] | undefined) ?? [];
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown CSV parsing error";
		throw new Error(`Invalid CSV: ${message}`);
	}

	const format = formats.find((candidate) => candidate.matchesHeaders(headers));
	if (!format)
		throw new Error(`Unsupported CSV headers: ${headers.map((header) => header.trim()).join(", ") || "none"}`);
	return format;
}

export type { ImportedEvent, ImportFormat } from "./types";
