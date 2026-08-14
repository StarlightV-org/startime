"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { Textarea } from "../ui/textarea";
import {
	describeAccountSchemaSettingsSections,
	getNestedValue,
	type AccountConfig,
	type AccountConfigPath,
	type SchemaSettingsField,
} from "~/lib/account-config";

const sections = describeAccountSchemaSettingsSections();

type Props = {
	config: AccountConfig;
	disabled?: boolean;
	onValueChange: (path: AccountConfigPath, value: unknown) => void;
	onValueCommit: (path: AccountConfigPath, value: unknown) => void;
};

function clampNumber(value: number, field: Extract<SchemaSettingsField, { kind: "number" }>): number {
	let result = value;
	if (field.numberMin !== undefined) result = Math.max(field.numberMin, result);
	if (field.numberMax !== undefined) result = Math.min(field.numberMax, result);
	if (field.enforceInteger) result = Math.round(result);
	return result;
}

function booleanLabel(value: boolean, configuredDefault?: boolean): string {
	const label = value ? "On" : "Off";
	return configuredDefault === value ? `${label} (Default)` : label;
}

function AutoConfigField({
	field,
	config,
	disabled,
	onValueChange,
	onValueCommit,
}: Props & { field: SchemaSettingsField }) {
	const value = getNestedValue(config, field.path);
	const id = `account-config-${field.path}`;

	return (
		<div className="grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,26rem)] sm:items-center">
			<div className="grid gap-1">
				<Label htmlFor={id}>{field.label}</Label>
				{field.description ? <p className="text-sm text-muted-foreground">{field.description}</p> : null}
			</div>
			<div className="w-full">
				{field.kind === "boolean" ? (
					<Select
						value={String(Boolean(value))}
						disabled={disabled}
						onValueChange={(nextValue) => onValueCommit(field.path, nextValue === "true")}
					>
						<SelectTrigger id={id} className="w-full">
							<SelectValue fallback={booleanLabel(Boolean(value), field.configuredDefault)} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="true">{booleanLabel(true, field.configuredDefault)}</SelectItem>
							<SelectItem value="false">{booleanLabel(false, field.configuredDefault)}</SelectItem>
						</SelectContent>
					</Select>
				) : null}
				{field.kind === "enum" ? (
					<Select
						value={String(value ?? "")}
						disabled={disabled}
						onValueChange={(nextValue) => onValueCommit(field.path, nextValue)}
					>
						<SelectTrigger id={id} className="w-full">
							<SelectValue fallback={field.enumLabels[String(value)] ?? String(value)} />
						</SelectTrigger>
						<SelectContent>
							{field.values.map((option) => (
								<SelectItem key={option} value={option}>
									{field.enumLabels[option] ?? option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}
				{field.kind === "number" ? (
					<Input
						id={id}
						type="number"
						value={typeof value === "number" ? value : ""}
						min={field.numberMin}
						max={field.numberMax}
						step={field.numberStep ?? (field.enforceInteger ? 1 : "any")}
						disabled={disabled}
						onChange={(event) => onValueChange(field.path, event.currentTarget.valueAsNumber)}
						onBlur={(event) => {
							if (!Number.isFinite(event.currentTarget.valueAsNumber)) return;
							onValueCommit(field.path, clampNumber(event.currentTarget.valueAsNumber, field));
						}}
					/>
				) : null}
				{field.kind === "string" && field.editor === "input" ? (
					<Input
						id={id}
						value={String(value ?? "")}
						disabled={disabled}
						onChange={(event) => onValueChange(field.path, event.currentTarget.value)}
						onBlur={(event) => onValueCommit(field.path, event.currentTarget.value)}
					/>
				) : null}
				{field.kind === "string" && (field.editor === "textarea" || field.editor === "markdown") ? (
					<Textarea
						id={id}
						value={String(value ?? "")}
						disabled={disabled}
						onChange={(event) => onValueChange(field.path, event.currentTarget.value)}
						onBlur={(event) => onValueCommit(field.path, event.currentTarget.value)}
					/>
				) : null}
			</div>
		</div>
	);
}

/** Renders every schema section, subgroup, and supported leaf from config UI metadata. */
export function AutoConfigSettings({ config, disabled, onValueChange, onValueCommit }: Props) {
	return sections.map((section) => (
		<Card key={section.cardTitle}>
			<CardHeader>
				<CardTitle>{section.cardTitle}</CardTitle>
				{section.cardDescription ? <p className="text-sm text-muted-foreground">{section.cardDescription}</p> : null}
			</CardHeader>
			<CardContent className="flex flex-col gap-8">
				{section.subgroups.map((group) => (
					<div key={group.groupId} className="flex flex-col gap-1">
						{group.title ? (
							<div>
								<h2 className="text-xl font-medium">{group.title}</h2>
								{group.description ? <p className="mt-1 text-sm text-muted-foreground">{group.description}</p> : null}
							</div>
						) : null}
						{group.fields.map((field) => (
							<AutoConfigField
								key={field.path}
								field={field}
								config={config}
								disabled={disabled}
								onValueChange={onValueChange}
								onValueCommit={onValueCommit}
							/>
						))}
					</div>
				))}
			</CardContent>
		</Card>
	));
}
