import { z } from "zod";

export const inputCodeTimeEventLogSchema = z.object({
	editor: z.string(),
	language: z.string(),
	project: z.string(),
	eventTime: z.number(),
	eventType: z.string(),
	operationType: z.string(),
	relativeFile: z.string(),
	absoluteFile: z.string(),
	platform: z.string(),
});

export const inputEventLogSchema = z.union([
	z.object({
		eventTime: z.coerce.date(),
		language: z.string(),
		project: z.string(),
		fileHash: z.string(),
		editor: z.string(),
		platform: z.string(),
	}),
	inputCodeTimeEventLogSchema,
]);

export const outputEventLogRecordSchema = z.object({
	id: z.string(),
	userId: z.string(),
	eventTime: z.string().datetime(),
	language: z.string(),
	project: z.string(),
	fileHash: z.string().nullable(),
	editor: z.string(),
	platform: z.string(),
	createdAt: z.string().datetime(),
});

export const outputEventLogSchema = z.object({
	log: z.array(outputEventLogRecordSchema),
});

export const inputStatsSchema = z.object({
	project: z.string().optional(),
});

export const outputStatsSchema = z.object({
	time: z.string(),
});

export const outputCompatibilityStatsSchema = z.object({
	data: z.array(
		z.object({
			duration: z.number(),
		}),
	),
});

export const outputSelfSchema = z.object({
	success: z.literal(true),
});

export const outputValidationErrorSchema = z.object({
	error: z.unknown(),
});
