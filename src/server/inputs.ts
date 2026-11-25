import { z } from "zod";

// Inputs of the server functions. Only zod here: the pages import these.

export const fieldTypes = ["text", "number", "date", "dropdown"] as const;

export const fieldInput = z
  .object({
    name: z.string().trim().min(1, "Enter a field name").max(80),
    type: z.enum(fieldTypes),
    options: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  })
  .strict()
  .refine(
    (field) => field.type !== "dropdown" || field.options.length > 0,
    "A dropdown needs at least one option",
  );

export const contactKind = z.enum(["person", "company"]);

export const textField = (max: number) => z.string().trim().max(max).default("");

export const listInput = z
  .object({
    kind: contactKind,
    q: z.string().trim().max(200).default(""),
    groupId: z.string().max(64).default(""),
    assignee: z.string().max(128).default(""),
    sort: z.enum(["name-asc", "name-desc", "updated", "created"]).default("name-asc"),
    page: z.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export const contactInput = z
  .object({
    id: z.string().uuid().optional(),
    kind: contactKind,
    name: z.string().trim().min(1, "Enter a name").max(200),
    title: textField(200),
    companyId: z.string().uuid().nullable().default(null),
    emails: textField(2000),
    phones: textField(2000),
    address: textField(1000),
    background: textField(20_000),
    assignedUserId: z.string().min(1).max(128),
    values: z.record(z.string(), z.string().max(2000)).default({}),
  })
  .strict();

export const noteInput = z
  .object({ contactId: z.string().uuid(), body: z.string().trim().min(1, "Write a note first").max(20_000) })
  .strict();

export const noteEditInput = z
  .object({ id: z.string().uuid(), body: z.string().trim().min(1, "Write a note first").max(20_000) })
  .strict();

export const groupInput = z
  .object({ name: z.string().trim().min(1, "Enter a group name").max(100), isPrivate: z.boolean().default(false) })
  .strict();

export const membershipInput = z.object({ groupId: z.string().uuid(), contactId: z.string().uuid() }).strict();

export const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date");

export const taskInput = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Enter a title").max(300),
    description: z.string().trim().max(5000).default(""),
    dueDate: dayString,
    contactId: z.string().uuid().nullable().default(null),
    pipelineItemId: z.string().uuid().nullable().default(null),
    assignedUserId: z.string().min(1).max(128),
  })
  .strict();

export const taskListInput = z.object({ assignee: z.string().max(128).default("") }).strict();

export const uuid = z.string().uuid();

export const pipelineInput = z.object({ name: z.string().trim().min(1, "Enter a pipeline name").max(100) }).strict();

export const renameInput = z.object({ id: uuid, name: z.string().trim().min(1, "Enter a name").max(100) }).strict();

export const statusInput = z
  .object({ pipelineId: uuid, name: z.string().trim().min(1, "Enter a status name").max(100), kind: z.enum(["open", "won", "lost"]) })
  .strict();

export const moveStatusInput = z.object({ id: uuid, direction: z.enum(["up", "down"]) }).strict();

export const pipelineFieldInput = z.object({ pipelineId: uuid, field: fieldInput }).strict();

export const itemInput = z
  .object({
    id: uuid.optional(),
    pipelineId: uuid,
    contactId: uuid,
    statusId: uuid,
    value: z.number().min(0).max(1e12).nullable().default(null),
    assignedUserId: z.string().min(1).max(128),
    values: z.record(z.string(), z.string().max(2000)).default({}),
  })
  .strict();

export const reportInput = z
  .object({
    pipelineId: uuid,
    statusId: z.string().max(64).default(""),
    assignee: z.string().max(128).default(""),
    from: z.string().max(10).default(""),
    to: z.string().max(10).default(""),
  })
  .strict();

export const isoTime = z.string().datetime({ offset: true });

export const eventInput = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Enter a title").max(300),
    startsAt: isoTime,
    endsAt: isoTime,
    allDay: z.boolean().default(false),
    location: z.string().trim().max(500).default(""),
    notes: z.string().trim().max(10_000).default(""),
    attendeeIds: z.array(z.string().min(1).max(128)).max(100).default([]),
    contactIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .strict()
  .refine((e) => e.endsAt >= e.startsAt, "The end must be after the start");

export const rangeInput = z
  .object({ from: isoTime, to: isoTime, teammates: z.array(z.string().min(1).max(128)).max(50).default([]) })
  .strict();

export const levelInput = z
  .object({ viewerId: z.string().min(1).max(128), ownerId: z.string().min(1).max(128), level: z.enum(["full", "read", "none"]) })
  .strict();

export const reassignInput = z.object({ fromId: z.string().min(1).max(128), toId: z.string().min(1).max(128) }).strict();

export const agendaInput = z
  .object({ enabled: z.boolean(), timeZone: z.string().min(1).max(64) })
  .strict()
  .refine((v) => validZone(v.timeZone), "Unknown time zone");

export function validZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
