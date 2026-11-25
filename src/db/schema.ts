import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

/** Members who have opened the app, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  email: text("email").notNull(),
  agendaEnabled: integer("agenda_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  timeZone: text("time_zone").notNull().default("UTC"),
  agendaSentOn: text("agenda_sent_on"),
  createdAt: createdAt(),
});

/** What a viewer may do with records assigned to a teammate; no row means full. */
export const accessLevels = sqliteTable(
  "access_levels",
  {
    orgId: text("org_id").notNull(),
    viewerId: text("viewer_id").notNull(),
    ownerId: text("owner_id").notNull(),
    level: text("level", { enum: ["full", "read", "none"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.viewerId, t.ownerId] })],
);

/** People and companies. */
export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    kind: text("kind", { enum: ["person", "company"] }).notNull(),
    name: text("name").notNull(),
    title: text("title").notNull().default(""),
    companyId: text("company_id"),
    emails: text("emails").notNull().default(""),
    phones: text("phones").notNull().default(""),
    address: text("address").notNull().default(""),
    background: text("background").notNull().default(""),
    assignedUserId: text("assigned_user_id").notNull(),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [
    index("contacts_org_idx").on(t.orgId, t.kind),
    index("contacts_company_idx").on(t.companyId),
  ],
);

export const customFields = sqliteTable("custom_fields", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["text", "number", "date", "dropdown"] }).notNull(),
  options: text("options").notNull().default(""),
  createdAt: createdAt(),
});

export const customFieldValues = sqliteTable(
  "custom_field_values",
  {
    contactId: text("contact_id").notNull(),
    fieldId: text("field_id").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.fieldId] })],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    contactId: text("contact_id").notNull(),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
    editedAt: text("edited_at"),
  },
  (t) => [index("notes_contact_idx").on(t.contactId)],
);

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    contactId: text("contact_id").notNull(),
    authorId: text("author_id").notNull(),
    name: text("name").notNull(),
    size: integer("size").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("files_contact_idx").on(t.contactId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    dueDate: text("due_date").notNull(),
    contactId: text("contact_id"),
    pipelineItemId: text("pipeline_item_id"),
    assignedUserId: text("assigned_user_id").notNull(),
    createdBy: text("created_by").notNull(),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("tasks_assignee_idx").on(t.assignedUserId, t.dueDate),
    index("tasks_contact_idx").on(t.contactId),
  ],
);

export const pipelines = sqliteTable("pipelines", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const pipelineStatuses = sqliteTable("pipeline_statuses", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["open", "won", "lost"] }).notNull(),
  position: integer("position").notNull(),
});

export const pipelineFields = sqliteTable("pipeline_fields", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id").notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["text", "number", "date", "dropdown"] }).notNull(),
  options: text("options").notNull().default(""),
  createdAt: createdAt(),
});

export const pipelineItems = sqliteTable(
  "pipeline_items",
  {
    id: text("id").primaryKey(),
    pipelineId: text("pipeline_id").notNull(),
    contactId: text("contact_id").notNull(),
    statusId: text("status_id").notNull(),
    value: real("value"),
    assignedUserId: text("assigned_user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("items_pipeline_idx").on(t.pipelineId),
    index("items_contact_idx").on(t.contactId),
  ],
);

export const pipelineItemValues = sqliteTable(
  "pipeline_item_values",
  {
    itemId: text("item_id").notNull(),
    fieldId: text("field_id").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.fieldId] })],
);

export const statusChanges = sqliteTable(
  "status_changes",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    fromStatusId: text("from_status_id"),
    toStatusId: text("to_status_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("changes_item_idx").on(t.itemId)],
);

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  ownerId: text("owner_id").notNull(),
  createdAt: createdAt(),
});

export const groupMembers = sqliteTable(
  "group_members",
  {
    groupId: text("group_id").notNull(),
    contactId: text("contact_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.contactId] })],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    location: text("location").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("events_org_idx").on(t.orgId, t.startsAt)],
);

export const eventAttendees = sqliteTable(
  "event_attendees",
  {
    eventId: text("event_id").notNull(),
    userId: text("user_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);

export const eventContacts = sqliteTable(
  "event_contacts",
  {
    eventId: text("event_id").notNull(),
    contactId: text("contact_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.contactId] })],
);
