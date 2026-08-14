import z, { globalRegistry } from "zod";

import { isValidTimeZone, normalizeTimeZone } from "~/lib/time-range";

/** Metadata for auto-generated settings UI; attach via `.meta({ configUI: … })`. */
export type AccountConfigUIMeta = {
	cardTitle?: string;
	cardDescription?: string;
	requiredPermission?: string;
	groupTitle?: string;
	groupDescription?: string;
	label?: string;
	description?: string;
	enumLabels?: Partial<Record<string, string>>;
	defaultBadge?: "On" | "Off";
	excludeFromAutoSettings?: boolean;
	numberMin?: number;
	numberMax?: number;
	numberStep?: number;
	enforceInteger?: boolean;
	editor?: "markdown" | "input" | "textarea";
};

function createMeta(configUI: AccountConfigUIMeta) {
	return { configUI };
}

export const defaultAccountConfig = {
	regional: {
		timeZone: "UTC",
		startOfWeek: "monday",
		lang: "en-EN",
	},
	privacy: {
		publicProfile: false,
	},
} as const;

const timeZoneSchema = z
	.string()
	.trim()
	.refine(isValidTimeZone, "Select a valid IANA time zone.")
	.optional()
	.default(defaultAccountConfig.regional.timeZone)
	.catch(defaultAccountConfig.regional.timeZone)
	.meta(
		createMeta({
			groupTitle: "Regional settings",
			label: "Time zone",
			description: "Used to calculate daily and weekly activity ranges.",
			editor: "input",
		}),
	);

const startOfWeekSchema = z
	.enum(["monday", "sunday"])
	.optional()
	.default(defaultAccountConfig.regional.startOfWeek)
	.catch(defaultAccountConfig.regional.startOfWeek)
	.meta(
		createMeta({
			groupTitle: "Regional settings",
			label: "Start of week",
			description: "Controls which day starts weekly activity ranges.",
			enumLabels: { monday: "Monday", sunday: "Sunday" },
		}),
	);

const langSchema = z
	.enum(["en-EN", "de-DE"])
	.optional()
	.default(defaultAccountConfig.regional.lang)
	.catch(defaultAccountConfig.regional.lang)
	.meta(
		createMeta({
			groupTitle: "Regional settings",
			label: "Language",
			description: "Preferred interface language.",
			enumLabels: { "en-EN": "English", "de-DE": "Deutsch" },
		}),
	);

const regionalSchema = z
	.object({ timeZone: timeZoneSchema, startOfWeek: startOfWeekSchema, lang: langSchema })
	.optional()
	.default(defaultAccountConfig.regional)
	.catch(defaultAccountConfig.regional)
	.meta(
		createMeta({
			groupTitle: "Regional settings",
			groupDescription: "Set the regional preferences used to display and group your activity.",
		}),
	);

const privacySchema = z
	.object({
		publicProfile: z
			.boolean()
			.optional()
			.default(defaultAccountConfig.privacy.publicProfile)
			.meta(
				createMeta({
					groupTitle: "Privacy settings",
					label: "Public profile",
					description: "Whether your profile is publicly visible.",
				}),
			),
	})
	.optional()
	.default(defaultAccountConfig.privacy)
	.catch(defaultAccountConfig.privacy)
	.meta(
		createMeta({
			groupTitle: "Privacy settings",
		}),
	);

const accountConfigObjectSchema = z.object({
	regional: regionalSchema.meta(
		createMeta({
			cardTitle: "Account Settings",
		}),
	),
	privacy: privacySchema,
});

export const accountConfigSchema = accountConfigObjectSchema.catch(defaultAccountConfig).default(defaultAccountConfig);
export type AccountConfig = z.infer<typeof accountConfigSchema>;

type Paths<T> = T extends object
	? {
			[K in keyof T & string]: T[K] extends object ? K | `${K}.${Paths<T[K]>}` : K;
		}[keyof T & string]
	: never;

export type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
	? K extends keyof T
		? PathValue<T[K], Rest>
		: never
	: P extends keyof T
		? T[P]
		: never;

export type AccountConfigPath = Paths<AccountConfig>;
type SchemaSettingsFieldBase = {
	path: AccountConfigPath;
	label: string;
	description?: string;
	groupTitle?: string;
	groupDescription?: string;
};

export type SchemaSettingsFieldBoolean = SchemaSettingsFieldBase & {
	kind: "boolean";
	defaultBadge?: "Off" | "On";
	configuredDefault?: boolean;
};
export type SchemaSettingsFieldEnum = SchemaSettingsFieldBase & {
	kind: "enum";
	values: readonly string[];
	enumLabels: Partial<Record<string, string>>;
	schemaDefaultEnum?: string;
};
export type SchemaSettingsFieldNumber = SchemaSettingsFieldBase & {
	kind: "number";
	numberMin?: number;
	numberMax?: number;
	numberStep?: number;
	enforceInteger?: boolean;
	schemaDefaultNum?: number;
};
export type SchemaSettingsFieldString = SchemaSettingsFieldBase & {
	kind: "string";
	editor: NonNullable<AccountConfigUIMeta["editor"]>;
	schemaDefaultStr?: string;
};
export type SchemaSettingsField =
	SchemaSettingsFieldBoolean | SchemaSettingsFieldEnum | SchemaSettingsFieldNumber | SchemaSettingsFieldString;
export type SchemaSettingsSubgroup = {
	groupId: string;
	title?: string;
	description?: string;
	fields: SchemaSettingsField[];
};
export type SchemaSettingsSection = {
	cardTitle: string;
	cardDescription?: string;
	requiredPermission?: string;
	subgroups: SchemaSettingsSubgroup[];
};

type AnySchema = z.ZodType;
type Shape = Readonly<Record<string, AnySchema>>;

function unwrapAll(schema: AnySchema): AnySchema {
	let current = schema;
	for (let index = 0; index < 64; index++) {
		const next = (current as { unwrap?: () => AnySchema }).unwrap?.();
		if (!next || next === current) break;
		current = next;
	}
	return current;
}

function schemaType(schema: AnySchema): string | undefined {
	return (schema as { def?: { type?: string } }).def?.type;
}

function objectShape(schema: AnySchema): Shape | undefined {
	return (
		(unwrapAll(schema) as { shape?: Shape; def?: { shape?: Shape } }).shape ??
		(unwrapAll(schema) as { def?: { shape?: Shape } }).def?.shape
	);
}

export function getAccountConfigUIMeta(schema: AnySchema): AccountConfigUIMeta | undefined {
	return (globalRegistry.get(schema) as { configUI?: AccountConfigUIMeta } | undefined)?.configUI;
}

function readConfiguredDefault(schema: AnySchema): unknown {
	let current = schema as { def?: { type?: string; defaultValue?: unknown }; unwrap?: () => AnySchema };
	for (let index = 0; index < 64; index++) {
		if (current.def?.type === "default") {
			return typeof current.def.defaultValue === "function" ? undefined : current.def.defaultValue;
		}
		const next = current.unwrap?.();
		if (!next) break;
		current = next as typeof current;
	}
	return undefined;
}

function humanizeKey(key: string): string {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (character) => character.toUpperCase())
		.trim();
}

function buildField(
	sectionKey: keyof AccountConfig,
	pathParts: string[],
	wrappedLeaf: AnySchema,
): SchemaSettingsField | null {
	const meta = getAccountConfigUIMeta(wrappedLeaf);
	if (meta?.excludeFromAutoSettings) return null;
	const core = unwrapAll(wrappedLeaf);
	const type = schemaType(core);
	const path = `${sectionKey}.${pathParts.join(".")}` as AccountConfigPath;
	const label = meta?.label ?? humanizeKey(pathParts.at(-1) ?? path);
	const defaultValue = readConfiguredDefault(wrappedLeaf);
	const groupTitle = meta?.groupTitle;
	const groupDescription = meta?.groupDescription;

	if (type === "boolean") {
		const configuredDefault = typeof defaultValue === "boolean" ? defaultValue : undefined;
		return {
			kind: "boolean",
			path,
			label,
			description: meta?.description,
			groupTitle,
			groupDescription,
			configuredDefault,
			defaultBadge: meta?.defaultBadge ?? (configuredDefault ? "Off" : "On"),
		};
	}
	if (type === "enum") {
		const values = (core as { options?: readonly unknown[] }).options?.map(String) ?? [];
		return {
			kind: "enum",
			path,
			label,
			description: meta?.description,
			groupTitle,
			groupDescription,
			values,
			enumLabels: meta?.enumLabels ?? {},
			schemaDefaultEnum: typeof defaultValue === "string" ? defaultValue : undefined,
		};
	}
	if (type === "number") {
		const bag = (core as { _zod?: { bag?: { minimum?: number; maximum?: number } } })._zod?.bag;
		return {
			kind: "number",
			path,
			label,
			description: meta?.description,
			groupTitle,
			groupDescription,
			numberMin: meta?.numberMin ?? bag?.minimum,
			numberMax: meta?.numberMax ?? bag?.maximum,
			numberStep: meta?.numberStep,
			enforceInteger: meta?.enforceInteger,
			schemaDefaultNum: typeof defaultValue === "number" ? defaultValue : undefined,
		};
	}
	if (type === "string") {
		return {
			kind: "string",
			path,
			label,
			description: meta?.description,
			groupTitle,
			groupDescription,
			editor: meta?.editor ?? "input",
			schemaDefaultStr: typeof defaultValue === "string" ? defaultValue : undefined,
		};
	}
	return null;
}

function collectLeaves(
	wrappedObject: AnySchema,
	sectionKey: keyof AccountConfig,
	pathParts: string[],
): SchemaSettingsField[] {
	const shape = objectShape(wrappedObject);
	if (!shape) return [];
	return Object.entries(shape).flatMap(([key, child]) => {
		const nextParts = [...pathParts, key];
		return schemaType(unwrapAll(child)) === "object"
			? collectLeaves(child, sectionKey, nextParts)
			: (buildField(sectionKey, nextParts, child) ?? []);
	});
}

/** Describes every supported configurable leaf in one card, grouped by UI metadata. */
export function describeAccountSchemaSettingsSections(): SchemaSettingsSection[] {
	const rootShape = objectShape(accountConfigObjectSchema);
	if (!rootShape) return [];

	const subgroups: SchemaSettingsSubgroup[] = [];
	for (const [sectionKeyRaw, section] of Object.entries(rootShape)) {
		const sectionKey = sectionKeyRaw as keyof AccountConfig;
		for (const field of collectLeaves(section, sectionKey, [])) {
			const title = field.groupTitle ?? humanizeKey(sectionKeyRaw);
			const group = subgroups.find((candidate) => candidate.title === title);
			if (group) {
				group.fields.push(field);
			} else {
				subgroups.push({
					groupId: title,
					title,
					description: field.groupDescription,
					fields: [field],
				});
			}
		}
	}

	return subgroups.length === 0 ? [] : [{ cardTitle: "Account Settings", subgroups }];
}

export const setAccountConfigValueSchema = z.discriminatedUnion("path", [
	z.object({
		path: z.literal("regional.timeZone"),
		value: z.string().trim().refine(isValidTimeZone, "Select a valid IANA time zone."),
	}),
	z.object({ path: z.literal("regional.startOfWeek"), value: z.enum(["monday", "sunday"]) }),
	z.object({ path: z.literal("regional.lang"), value: z.enum(["en-EN", "de-DE"]) }),
	z.object({ path: z.literal("privacy.publicProfile"), value: z.boolean() }),
]);

export function checkAccountConfig(config: unknown): AccountConfig {
	return accountConfigSchema.parse(config);
}

export function getNestedValue<T extends object, P extends Paths<T>>(object: T, path: P): PathValue<T, P> | undefined {
	return path
		.split(".")
		.reduce<unknown>(
			(value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined),
			object,
		) as PathValue<T, P> | undefined;
}

export function setNestedValue<T extends object, P extends Paths<T>>(object: T, path: P, value: PathValue<T, P>): T {
	const keys = path.split(".");
	const result = { ...object } as Record<string, unknown>;
	let current = result;
	for (const key of keys.slice(0, -1)) {
		const nested = current[key];
		current[key] = nested && typeof nested === "object" && !Array.isArray(nested) ? { ...(nested as object) } : {};
		current = current[key] as Record<string, unknown>;
	}
	const lastKey = keys.at(-1);
	if (!lastKey) throw new Error("Path cannot be empty");
	current[lastKey] = value;
	return result as T;
}

export function setAccountConfigValue<P extends AccountConfigPath>(
	config: AccountConfig,
	path: P,
	value: PathValue<AccountConfig, P>,
): AccountConfig {
	const result = accountConfigSchema.safeParse(setNestedValue(config, path, value));
	if (!result.success) throw new Error(`Invalid value for path "${path}": ${result.error.message}`);
	return result.data;
}

/** Parses persisted account configuration and applies schema defaults for missing values. */
export function getAccountConfig(config: unknown): AccountConfig {
	return checkAccountConfig(config);
}

export function normalizeAccountConfig(config: AccountConfig): AccountConfig {
	return setNestedValue(config, "regional.timeZone", normalizeTimeZone(config.regional.timeZone));
}
