import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { orgMembers } from "@/server/access";
import * as agenda from "@/server/agenda";
import * as calendar from "@/server/calendar";
import * as contacts from "@/server/contacts";
import * as fields from "@/server/fields";
import * as groups from "@/server/groups";
import * as pipelines from "@/server/pipelines";
import * as tasks from "@/server/tasks";
import * as team from "@/server/team";
import * as timeline from "@/server/timeline";
import * as inputs from "@/server/inputs";
import { actorMiddleware } from "./actor";

const id = z.object({ id: z.string().uuid() }).strict();
const parse =
  <T extends z.ZodTypeAny>(schema: T) =>
  (data: unknown): z.infer<T> =>
    schema.parse(data);


/** Who the member is and the team, for every page's pickers. */
export const getMe = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(async ({ context: { actor } }) => ({
  id: actor.id,
  email: actor.email,
  admin: actor.admin,
  members: (await orgMembers(actor.orgId)).map((m) => ({
    ...m,
    level: actor.admin || m.id === actor.id ? "full" : (actor.levels.get(m.id) ?? "full"),
  })),
}));

// Contacts and companies
export const listContacts = createServerFn({ method: "GET" }).middleware([actorMiddleware]).validator(parse(inputs.listInput)).handler(({ data, context }) => contacts.listContacts(context.actor, data));
export const getContact = createServerFn({ method: "GET" }).middleware([actorMiddleware]).validator(parse(id)).handler(async ({ data, context }) => {
  const found = await contacts.getContact(context.actor, data.id);
  if (!found) return null;
  const [entries, items] = await Promise.all([
    timeline.timeline(context.actor, data.id),
    pipelines.itemsForContact(context.actor, data.id),
  ]);
  return { ...found, timeline: entries, items };
});
export const saveContact = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.contactInput)).handler(({ data, context }) => contacts.saveContact(context.actor, data));
export const deleteContact = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => contacts.deleteContact(context.actor, data.id));
export const getContactOptions = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(({ context }) => contacts.contactOptions(context.actor));
export const getCompanyOptions = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(({ context }) => contacts.companyOptions(context.actor));
export const exportContacts = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(({ context }) => contacts.exportCsv(context.actor));

// Custom fields
export const getFields = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(({ context }) => fields.listFields(context.actor));
export const createField = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.fieldInput)).handler(({ data, context }) => fields.createField(context.actor, data));
export const deleteField = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => fields.deleteField(context.actor, data.id));

// Timeline
export const addNote = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.noteInput)).handler(({ data, context }) => timeline.addNote(context.actor, data));
export const editNote = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.noteEditInput)).handler(({ data, context }) => timeline.editNote(context.actor, data));
export const deleteNote = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => timeline.deleteNote(context.actor, data.id));
export const deleteFile = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => timeline.deleteFile(context.actor, data.id));

// Tasks and the agenda email
export const listTasks = createServerFn({ method: "GET" }).middleware([actorMiddleware]).validator(parse(inputs.taskListInput)).handler(({ data, context }) => tasks.listTasks(context.actor, data));
export const saveTask = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.taskInput)).handler(({ data, context }) => tasks.saveTask(context.actor, data));
export const setTaskDone = createServerFn({ method: "POST" }).middleware([actorMiddleware])
  .validator(parse(z.object({ id: z.string().uuid(), done: z.boolean() }).strict()))
  .handler(({ data, context }) => tasks.setTaskDone(context.actor, data.id, data.done));
export const deleteTask = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => tasks.deleteTask(context.actor, data.id));
export const getAgenda = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(({ context }) => agenda.agendaSettings(context.actor));
export const setAgenda = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.agendaInput)).handler(({ data, context }) => agenda.setAgenda(context.actor, data));

// Pipelines
export const getPipelines = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(({ context }) => pipelines.listPipelines(context.actor));
export const createPipeline = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.pipelineInput)).handler(({ data, context }) => pipelines.createPipeline(context.actor, data));
export const renamePipeline = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.renameInput)).handler(({ data, context }) => pipelines.renamePipeline(context.actor, data));
export const deletePipeline = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => pipelines.deletePipeline(context.actor, data.id));
export const addStatus = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.statusInput)).handler(({ data, context }) => pipelines.addStatus(context.actor, data));
export const moveStatus = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.moveStatusInput)).handler(({ data, context }) => pipelines.moveStatus(context.actor, data));
export const deleteStatus = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => pipelines.deleteStatus(context.actor, data.id));
export const addPipelineField = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.pipelineFieldInput)).handler(({ data, context }) => pipelines.addPipelineField(context.actor, data));
export const deletePipelineField = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => pipelines.deletePipelineField(context.actor, data.id));
export const getPipelineReport = createServerFn({ method: "GET" }).middleware([actorMiddleware]).validator(parse(inputs.reportInput)).handler(({ data, context }) => pipelines.pipelineReport(context.actor, data));
export const getItemOptions = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(({ context }) => pipelines.itemOptions(context.actor));
export const saveItem = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.itemInput)).handler(({ data, context }) => pipelines.saveItem(context.actor, data));
export const moveItem = createServerFn({ method: "POST" }).middleware([actorMiddleware])
  .validator(parse(z.object({ id: z.string().uuid(), statusId: z.string().uuid() }).strict()))
  .handler(({ data, context }) => pipelines.moveItem(context.actor, data.id, data.statusId));
export const deleteItem = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => pipelines.deleteItem(context.actor, data.id));

// Groups
export const getGroups = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(({ context }) => groups.listGroups(context.actor));
export const getGroup = createServerFn({ method: "GET" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => groups.getGroup(context.actor, data.id));
export const createGroup = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.groupInput)).handler(({ data, context }) => groups.createGroup(context.actor, data));
export const deleteGroup = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => groups.deleteGroup(context.actor, data.id));
export const addToGroup = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.membershipInput)).handler(({ data, context }) => groups.addToGroup(context.actor, data));
export const removeFromGroup = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.membershipInput)).handler(({ data, context }) => groups.removeFromGroup(context.actor, data));

// Calendar
export const getEvents = createServerFn({ method: "GET" }).middleware([actorMiddleware]).validator(parse(inputs.rangeInput)).handler(({ data, context }) => calendar.listEvents(context.actor, data));
export const saveEvent = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.eventInput)).handler(({ data, context }) => calendar.saveEvent(context.actor, data));
export const deleteEvent = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(id)).handler(({ data, context }) => calendar.deleteEvent(context.actor, data.id));

// Team access (admins)
export const getTeam = createServerFn({ method: "GET" }).middleware([actorMiddleware]).handler(({ context }) => team.teamOverview(context.actor));
export const setLevel = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.levelInput)).handler(({ data, context }) => team.setLevel(context.actor, data));
export const reassignAll = createServerFn({ method: "POST" }).middleware([actorMiddleware]).validator(parse(inputs.reassignInput)).handler(({ data, context }) => team.reassignAll(context.actor, data));
