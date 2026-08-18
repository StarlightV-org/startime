import { parse } from "csv-parse/sync";
import type { ImportedEvent, ImportFormat } from "./types";

const headers = ["userId", "eventTime", "language", "project", "fileHash", "editor", "platform", "createdAt"] as const;
type Header = (typeof headers)[number];

function value(record: Map<Header, string>, header: Header, rowNumber: number): string {
	const result = record.get(header)?.trim();
	if (!result) throw new Error(`Row ${rowNumber}: ${header} is required`);
	return result;
}

function dateValue(record: Map<Header, string>, header: "eventTime" | "createdAt", rowNumber: number): string {
	const result = value(record, header, rowNumber);
	const date = new Date(result);
	if (Number.isNaN(date.getTime())) throw new Error(`Row ${rowNumber}: ${header} must be an ISO-8601 date`);
	return date.toISOString();
}

export const startimeExportCsvFormat: ImportFormat = {
	id: "startime/export-csv",
	headers,
	matchesHeaders(actualHeaders) {
		return (
			actualHeaders.length === headers.length && headers.every((header, index) => actualHeaders[index]?.trim() === header)
		);
	},
	parse(contents) {
		let rows: string[][];
		try {
			rows = parse(contents, {
				bom: true,
				skip_empty_lines: true,
				relax_column_count: false,
			}) as string[][];
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown CSV parsing error";
			throw new Error(`Invalid Startime export CSV: ${message}`);
		}

		const actualHeaders = rows.shift();
		if (!actualHeaders || !this.matchesHeaders(actualHeaders))
			throw new Error(`Expected CSV headers: ${headers.join(", ")}`);

		const events: ImportedEvent[] = [];
		for (const [index, row] of rows.entries()) {
			const rowNumber = index + 2;
			const record = new Map(headers.map((header, column) => [header, row[column] ?? ""]));

			// Validate every column in a Startime export, including values not used on import.
			value(record, "userId", rowNumber);
			const eventTime = dateValue(record, "eventTime", rowNumber);
			value(record, "language", rowNumber);
			value(record, "project", rowNumber);
			const fileHash = record.get("fileHash")?.trim();
			if (fileHash && !/^[a-f0-9]{64}$/i.test(fileHash))
				throw new Error(`Row ${rowNumber}: fileHash must be a SHA-256 hash`);
			value(record, "editor", rowNumber);
			value(record, "platform", rowNumber);
			const createdAt = dateValue(record, "createdAt", rowNumber);

			events.push({
				eventTime,
				createdAt,
				language: value(record, "language", rowNumber),
				project: value(record, "project", rowNumber),
				fileHash: fileHash || null,
				editor: value(record, "editor", rowNumber),
				platform: value(record, "platform", rowNumber),
			});
		}
		return events;
	},
};
