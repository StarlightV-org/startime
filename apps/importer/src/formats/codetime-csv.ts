import { createHmac } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { ImportedEvent, ImportFormat } from "./types";

const headers = [
	"Language",
	"Workspace",
	"Absolute File",
	"Relative File",
	"Editor",
	"Platform",
	"Git Origin",
	"Git Branch",
	"Recorded At",
] as const;

type Header = (typeof headers)[number];

function value(record: Map<Header, string>, header: Header, rowNumber: number): string {
	const result = record.get(header)?.trim();
	if (!result) throw new Error(`Row ${rowNumber}: ${header} is required`);
	return result;
}

export const codeTimeCsvFormat: ImportFormat = {
	id: "codetime/csv",
	parse(contents, fileHashKey) {
		let rows: string[][];
		try {
			rows = parse(contents, {
				bom: true,
				skip_empty_lines: true,
				relax_column_count: false,
			}) as string[][];
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown CSV parsing error";
			throw new Error(`Invalid CodeTime CSV: ${message}`);
		}

		const actualHeaders = rows.shift();
		if (!actualHeaders || actualHeaders.length !== headers.length || headers.some((header, index) => actualHeaders[index]?.trim() !== header)) {
			throw new Error(`Expected CSV headers: ${headers.join(", ")}`);
		}

		const events: ImportedEvent[] = [];
		let discardedRows = 0;
		for (const [index, row] of rows.entries()) {
			const rowNumber = index + 2;
			const record = new Map(headers.map((header, column) => [header, row[column] ?? ""]));
			const hasActivityData = headers
				.filter((header) => header !== "Recorded At")
				.some((header) => record.get(header)?.trim());
			if (!hasActivityData) {
				discardedRows += 1;
				continue;
			}

			const recordedAt = value(record, "Recorded At", rowNumber);
			const eventDate = new Date(recordedAt);
			if (Number.isNaN(eventDate.getTime())) throw new Error(`Row ${rowNumber}: Recorded At must be an ISO-8601 date`);
			const relativeFile = record.get("Relative File")?.trim();
			const filePath = relativeFile || value(record, "Absolute File", rowNumber);
			events.push({
				eventTime: eventDate.toISOString(),
				createdAt: eventDate.toISOString(),
				language: value(record, "Language", rowNumber),
				project: value(record, "Workspace", rowNumber),
				fileHash: createHmac("sha256", fileHashKey).update(filePath).digest("hex"),
				editor: value(record, "Editor", rowNumber),
				platform: value(record, "Platform", rowNumber),
			});
		}
		if (discardedRows > 0) Print.Warning("Discarded incomplete CodeTime rows", { discardedRows });
		return events;
	},
};
