import { relations } from "drizzle-orm";
import * as t from "drizzle-orm/pg-core";
import ShortUniqueId from "short-unique-id";

function generateShortId(totalLength = 16): string {
	const length = totalLength % 2 === 0 ? totalLength / 2 : Math.ceil(totalLength / 2);
	const { randomUUID: uuidNumber } = new ShortUniqueId({
		length,
		dictionary: "number",
	});
	const { randomUUID: uuidLetter } = new ShortUniqueId({
		length,
		dictionary: "alpha_upper",
	});
	return `${uuidLetter()}${uuidNumber()}`;
}

/** Shared Startime tables. The prefix prevents collisions with legacy data. */
export const createTable = t.pgTableCreator((name) => `startime_${name}`);

// MARK: USER
export const users = createTable("users", {
	id: t
		.text("id")
		.primaryKey()
		.$defaultFn(() => generateShortId()),
	name: t.text("name").notNull(),
	email: t.text("email").notNull().unique(),
	emailVerified: t.boolean("email_verified").notNull().default(false),
	image: t.text("image"),
	createdAt: t.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	organizationId: t.text("organization_id").references(() => organizations.id),

	/** User-owned settings, parsed and defaulted by the web application's account config schema. */
	accountConfig: t.jsonb("account_config").$type<unknown>().notNull().default({}),
});

export const userRelations = relations(users, ({ many, one }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	passkeys: many(passkeys),
	invitations: many(invitations, { relationName: "invitationRecipient" }),
	sentInvitations: many(invitations, { relationName: "invitationInviter" }),
	organization: one(organizations, {
		fields: [users.organizationId],
		references: [organizations.id],
	}),
	events: many(eventLogs),
	memberships: many(members),
	exports: many(userExports),
}));

export const accounts = createTable("accounts", {
	id: t
		.text("id")
		.primaryKey()
		.$defaultFn(() => generateShortId()),
	accountId: t.text("account_id").notNull(),
	providerId: t.text("provider_id").notNull(),
	userId: t
		.text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
	accessToken: t.text("access_token"),
	refreshToken: t.text("refresh_token"),
	idToken: t.text("id_token"),
	accessTokenExpiresAt: t.timestamp("access_token_expires_at", { withTimezone: true }),
	refreshTokenExpiresAt: t.timestamp("refresh_token_expires_at", { withTimezone: true }),
	scope: t.text("scope"),
	password: t.text("password"),
	createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const accountRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable("sessions", {
	id: t
		.text("id")
		.primaryKey()
		.$defaultFn(() => generateShortId()),
	expiresAt: t.timestamp("expires_at", { withTimezone: true }).notNull(),
	token: t.text("token").notNull().unique(),
	createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { withTimezone: true }).notNull(),
	ipAddress: t.text("ip_address"),
	userAgent: t.text("user_agent"),
	userId: t
		.text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const sessionRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verifications = createTable("verifications", {
	id: t
		.text("id")
		.primaryKey()
		.$defaultFn(() => generateShortId()),
	identifier: t.text("identifier").notNull(),
	value: t.text("value").notNull(),
	expiresAt: t.timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: t.timestamp("created_at", { withTimezone: true }),
	updatedAt: t.timestamp("updated_at", { withTimezone: true }),
});

export const passkeys = createTable(
	"passkeys",
	{
		id: t
			.text("id")
			.primaryKey()
			.$defaultFn(() => generateShortId()),
		name: t.text("name"),
		publicKey: t.text("public_key").notNull(),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		credentialID: t.text("credential_id").notNull(),
		counter: t.integer("counter").notNull(),
		deviceType: t.text("device_type").notNull(),
		backedUp: t.boolean("backed_up").notNull(),
		transports: t.text("transports"),
		createdAt: t.timestamp("created_at"),
		aaguid: t.text("aaguid"),
	},
	(table) => [
		t.index("passkey_userId_idx").on(table.userId),
		t.index("passkey_credentialID_idx").on(table.credentialID),
	],
);

export const passkeyRelations = relations(passkeys, ({ one }) => ({
	user: one(users, {
		fields: [passkeys.userId],
		references: [users.id],
	}),
}));

// MARK: ORGANIZATION

export const organizations = createTable("organizations", {
	id: t
		.text("id")
		.primaryKey()
		.$defaultFn(() => generateShortId(8)),
	name: t.text("name").notNull(),
	slug: t.text("slug").notNull().unique(),
	logo: t.text("logo"),
	createdAt: t.timestamp("created_at").notNull(),
	metadata: t.text("metadata"),
});

export type DbOrganization = typeof organizations.$inferSelect;

export const organizationRelations = relations(organizations, ({ many }) => ({
	members: many(members),
	invitations: many(invitations),
}));

export const members = createTable(
	"members",
	{
		id: t
			.text("id")
			.primaryKey()
			.$defaultFn(() => generateShortId(8)),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: t.text("role").default("member").notNull().$type<"owner" | "admin" | "member">(),
		createdAt: t.timestamp("created_at").notNull(),
	},
	(table) => [
		t.index("member_organizationId_idx").on(table.organizationId),
		t.index("member_userId_idx").on(table.userId),
	],
);

export const memberRelations = relations(members, ({ one }) => ({
	organization: one(organizations, {
		fields: [members.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [members.userId],
		references: [users.id],
	}),
}));

export const invitations = createTable(
	"invitations",
	{
		id: t
			.text("id")
			.primaryKey()
			.$defaultFn(() => generateShortId()),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
		email: t
			.text("email")
			.notNull()
			.references(() => users.email, { onDelete: "cascade", onUpdate: "cascade" }),
		role: t.text("role"),
		status: t.text("status").default("pending").notNull().$type<"pending" | "accepted" | "declined">(),
		expiresAt: t.timestamp("expires_at").notNull(),
		createdAt: t.timestamp("created_at").defaultNow().notNull(),
		inviterId: t
			.text("inviter_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
	},
	(table) => [
		t.index("invitation_organizationId_idx").on(table.organizationId),
		t.index("invitation_email_idx").on(table.email),
	],
);

export type DbInvitation = typeof invitations.$inferSelect;

export const invitationRelations = relations(invitations, ({ one }) => ({
	organization: one(organizations, {
		fields: [invitations.organizationId],
		references: [organizations.id],
	}),
	inviter: one(users, {
		relationName: "invitationInviter",
		fields: [invitations.inviterId],
		references: [users.id],
	}),
	user: one(users, {
		relationName: "invitationRecipient",
		fields: [invitations.email],
		references: [users.email],
	}),
}));

// MARK: EVENTS
export const eventLogs = createTable(
	"event_logs",
	{
		id: t
			.text("id")
			.primaryKey()
			.$defaultFn(() => generateShortId()),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
		eventTime: t.timestamp("event_time", { withTimezone: true }).notNull(),
		language: t.text("language").notNull(),
		project: t.text("project").notNull(),
		fileHash: t.text("file_hash"),
		editor: t.text("editor").notNull(),
		platform: t.text("platform").notNull(),
		createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		t.index("event_logs_user_id_event_time_idx").on(table.userId, table.eventTime),
		t.unique("event_logs_user_id_event_time_unique").on(table.userId, table.eventTime),
	],
);

export const eventLogsRelation = relations(eventLogs, ({ one }) => ({
	user: one(users, { fields: [eventLogs.userId], references: [users.id] }),
}));

export const fileLocations = ["none", "user_import", "user_export"] as const;
export type FileLocation = (typeof fileLocations)[number];

export const files = createTable(
	"files",
	{
		id: t
			.varchar("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateShortId()),
		createdBy: t.varchar("created_by", { length: 255 }).notNull(),
		fileName: t.varchar("file_name", { length: 255 }).notNull(),
		createdAt: t.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		fileKey: t.varchar("file_key", { length: 255 }).notNull(),
		fileUrl: t.varchar("file_url", { length: 1024 }).notNull(),
		size: t.integer("size").notNull(),
		lastModified: t.timestamp("last_modified", { withTimezone: true }),
		type: t.varchar("type", { length: 255 }).notNull(),
		location: t.varchar("location", { length: 255, enum: fileLocations }).default("none"),
		locationId: t.varchar("location_id", { length: 255 }),
		metadata: t.json("metadata").$type<{ [key: string]: any }>(),
	},
	(table) => [t.index("files_size_idx").on(table.size)],
);

const eventImportStates = ["uploaded", "pending", "completed", "failed"] as const;
export type EventImportState = (typeof eventImportStates)[number];

export const eventImports = createTable("event_imports", {
	id: t
		.text("id")
		.primaryKey()
		.$defaultFn(() => generateShortId()),
	userId: t
		.text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
	status: t.text("status", { enum: eventImportStates }).notNull(),
	fileId: t.text("file_id").references(() => files.id, { onDelete: "set null", onUpdate: "cascade" }),
	fileName: t.text("file_name").notNull(),
	message: t.text("message"),
	totalRows: t.integer("total_rows").notNull().default(0),
	processedRows: t.integer("processed_rows").notNull().default(0),
	createdAt: t.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
});

export const eventImportRelations = relations(eventImports, ({ one }) => ({
	importFile: one(files, { fields: [eventImports.fileId], references: [files.id] }),
}));

export const userExports = createTable("user_exports", {
	id: t
		.varchar("id", { length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => generateShortId()),
	userId: t
		.varchar("user_id", { length: 255 })
		.notNull()
		.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
	fileId: t.varchar("file_id", { length: 255 }).references(() => files.id, { onDelete: "cascade", onUpdate: "cascade" }),
	createdAt: t.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
	completedAt: t.timestamp("completed_at", { withTimezone: true }),
	status: t
		.text("status", { enum: ["pending", "uploaded", "failed"] })
		.notNull()
		.default("pending"),
	message: t.text("message"),
});

export const userExportRelations = relations(userExports, ({ one }) => ({
	user: one(users, { fields: [userExports.userId], references: [users.id] }),
	file: one(files, { fields: [userExports.fileId], references: [files.id] }),
}));
