// Behavior: each feature's main path, through the packaged release.
import { readFile } from "node:fs/promises";
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";
import { createRecord, day, expect } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();

  // Both people open the app once, so each is on the team list.
  await member.goto("/");
  await expect(member.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await owner.goto("/");
  await expect(owner.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await runtime.assertBackLink(owner);

  // F001: an admin adds a dropdown custom field.
  await owner.goto("/settings/fields");
  await owner.getByLabel("Field name").fill("Industry");
  await owner.getByLabel("Type").selectOption("dropdown");
  await owner.getByLabel("Options").fill("Retail\nSoftware\nHospitality");
  await owner.getByRole("button", { name: "Add field" }).click();
  await expect(owner.getByTestId("field-row").filter({ hasText: "Industry" })).toBeVisible();

  // F001: validation, then a company and a person linked to it.
  await owner.goto("/companies");
  await owner.getByRole("button", { name: "New company" }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(owner.getByRole("dialog").getByText("Enter a name")).toBeVisible();
  await owner.keyboard.press("Escape");

  const harbor = await createRecord(owner, "company", {
    Name: "Harbor Coffee Roasters",
    Phones: "+1 503 555 0142",
    Industry: "Hospitality",
  });
  const maya = await createRecord(owner, "person", {
    Name: "Maya Lindqvist",
    Title: "Head of Purchasing",
    Company: "Harbor Coffee Roasters",
    Emails: "maya@harborcoffee.example",
    Phones: "+1 503 555 0199",
    Address: "214 Water Street, Portland",
    Background: "Met at the regional food fair.",
    Industry: "Retail",
  });
  await expect(owner.getByText("Head of Purchasing")).toBeVisible();
  await expect(owner.getByRole("link", { name: "Harbor Coffee Roasters" })).toBeVisible();
  await expect(owner.getByText("maya@harborcoffee.example")).toBeVisible();
  await createRecord(owner, "company", { Name: "Northwind Bakery", Industry: "Retail" });
  await createRecord(owner, "company", { Name: "Cedar Street Florists", Industry: "Retail" });

  await owner.goto(harbor);
  await expect(owner.getByTestId("company-people")).toContainText("Maya Lindqvist");

  // F001: search by email, phone and custom value; filter by assignee; empty state.
  await owner.goto("/contacts");
  await owner.getByLabel("Search").fill("harborcoffee");
  await expect(owner.getByTestId("contact-row")).toHaveCount(1);
  await expect(owner.getByTestId("contact-row")).toContainText("Maya Lindqvist");
  await owner.getByLabel("Search").fill("555 0199");
  await expect(owner.getByTestId("contact-row")).toHaveCount(1);
  await owner.getByLabel("Search").fill("nothing like this");
  await expect(owner.getByText("No contacts match")).toBeVisible();
  await owner.goto("/companies");
  await owner.getByLabel("Search").fill("Hospitality");
  await expect(owner.getByTestId("contact-row")).toHaveCount(1);
  await expect(owner.getByTestId("contact-row")).toContainText("Harbor Coffee Roasters");
  await owner.getByLabel("Search").fill("");
  await owner.getByLabel("Assigned to").selectOption({ label: "member@example.test" });
  await expect(owner.getByText("No companies match")).toBeVisible();
  await owner.getByLabel("Assigned to").selectOption({ label: "owner@example.test" });
  await expect(owner.getByTestId("contact-row")).toHaveCount(3);
  await owner.getByLabel("Sort").selectOption("name-desc");
  await expect(owner.getByTestId("contact-row").first()).toContainText("Northwind Bakery");
  await owner.goto("/contacts/00000000-0000-4000-8000-000000000000");
  await expect(owner.getByTestId("not-found")).toBeVisible();

  // F002: notes, edited and deleted, and a file uploaded and downloaded.
  await owner.goto(maya);
  await owner.getByLabel("New note").fill("Called about the spring order; wants samples of the Ethiopian roast.");
  await owner.getByRole("button", { name: "Add note" }).click();
  const note = owner.getByTestId("timeline-item").filter({ hasText: "spring order" });
  await expect(note).toContainText("owner@example.test");
  await note.getByRole("button", { name: "Edit note" }).click();
  await owner.getByLabel("Note text").fill("Called about the spring order; samples ship Friday.");
  await owner.getByRole("button", { name: "Save note" }).click();
  await expect(owner.getByTestId("timeline-item").filter({ hasText: "samples ship Friday" })).toBeVisible();
  await owner.getByLabel("New note").fill("Left a voicemail.");
  await owner.getByRole("button", { name: "Add note" }).click();
  const voicemail = owner.getByTestId("timeline-item").filter({ hasText: "Left a voicemail." });
  await expect(voicemail).toBeVisible();
  await voicemail.getByRole("button", { name: "Delete note" }).click();
  await owner.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(voicemail).toHaveCount(0);

  await owner.getByLabel("Attach file").setInputFiles({
    name: "price-list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("item,price\nHouse blend 5lb,62\n"),
  });
  const fileLink = owner.getByRole("link", { name: "price-list.csv" });
  await expect(fileLink).toBeVisible();
  const [download] = await Promise.all([owner.waitForEvent("download"), fileLink.click()]);
  expect(download.suggestedFilename()).toBe("price-list.csv");
  expect(await readFile(await download.path(), "utf8")).toContain("House blend 5lb");
  // The newest entry comes first.
  await expect(owner.getByTestId("timeline-item").first()).toContainText("price-list.csv");

  // F005: a shared group, a record added to it, and the list filtered by it.
  await owner.goto("/groups");
  await owner.getByLabel("Group name").fill("Wholesale accounts");
  await owner.getByRole("button", { name: "Create group" }).click();
  await expect(owner.getByTestId("group-row").filter({ hasText: "Wholesale accounts" })).toBeVisible();
  await owner.goto(maya);
  await owner.getByLabel("Add to group").selectOption({ label: "Wholesale accounts" });
  await expect(owner.getByTestId("record-groups")).toContainText("Wholesale accounts");
  await owner.goto("/contacts");
  await owner.getByLabel("Group").selectOption({ label: "Wholesale accounts" });
  await expect(owner.getByTestId("contact-row")).toHaveCount(1);
  await expect(owner.getByTestId("contact-row")).toContainText("Maya Lindqvist");
  // The shared group is visible to the teammate too.
  await member.goto("/groups");
  await expect(member.getByTestId("group-row").filter({ hasText: "Wholesale accounts" })).toBeVisible();

  // F001: CSV export of the readable contacts.
  await owner.goto("/contacts");
  const [csv] = await Promise.all([
    owner.waitForEvent("download"),
    owner.getByRole("button", { name: "Export CSV" }).click(),
  ]);
  const csvText = await readFile(await csv.path(), "utf8");
  expect(csvText).toContain("Industry");
  expect(csvText).toContain("Maya Lindqvist");
  expect(csvText).toContain("maya@harborcoffee.example");

  // F004: an admin sets up a pipeline with ordered statuses and a field.
  await owner.goto("/settings/pipelines");
  await owner.getByLabel("Pipeline name").fill("Wholesale deals");
  await owner.getByRole("button", { name: "Create pipeline" }).click();
  const editor = owner.getByTestId("pipeline-editor").filter({ hasText: "Wholesale deals" });
  for (const [name, kind] of [["Lead", "open"], ["Proposal", "open"], ["Won", "won"], ["Lost", "lost"]]) {
    await editor.getByLabel("Status name").fill(name);
    await editor.getByLabel("Status kind").selectOption(kind);
    await editor.getByRole("button", { name: "Add status" }).click();
    await expect(editor.getByTestId("status-row").filter({ hasText: name })).toBeVisible();
  }
  await editor.getByLabel("Pipeline field name").fill("Expected close");
  await editor.getByLabel("Pipeline field type").selectOption("date");
  await editor.getByRole("button", { name: "Add pipeline field" }).click();
  await expect(editor.getByTestId("pipeline-field-row").filter({ hasText: "Expected close" })).toBeVisible();

  // F004: a contact attached to the pipeline, then moved.
  await owner.goto(maya);
  await owner.getByRole("button", { name: "Add to pipeline" }).click();
  let dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Pipeline", { exact: true }).selectOption({ label: "Wholesale deals" });
  await dialog.getByLabel("Status", { exact: true }).selectOption({ label: "Lead" });
  await dialog.getByLabel("Value").fill("4800");
  await dialog.getByLabel("Expected close").fill(day(30));
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByTestId("record-pipelines")).toContainText("Wholesale deals");
  await owner.getByLabel("Status in Wholesale deals").selectOption({ label: "Proposal" });
  await expect(
    owner.getByTestId("timeline-item").filter({ hasText: "Moved from Lead to Proposal" }),
  ).toBeVisible();

  await owner.goto("/pipelines");
  await owner.getByRole("link", { name: "Wholesale deals" }).click();
  await expect(owner.getByRole("heading", { level: 1, name: "Wholesale deals" })).toBeVisible();
  for (const [record, status, value] of [["Northwind Bakery", "Lead", "1200"], ["Cedar Street Florists", "Won", "2350"]]) {
    await owner.getByRole("button", { name: "Add item" }).click();
    dialog = owner.getByRole("dialog");
    await dialog.getByLabel("Record").selectOption({ label: record });
    await dialog.getByLabel("Status", { exact: true }).selectOption({ label: status });
    await dialog.getByLabel("Value").fill(value);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(owner.getByTestId("pipeline-item-row").filter({ hasText: record })).toBeVisible();
  }
  await expect(owner.getByTestId("pipeline-item-row").filter({ hasText: "Maya Lindqvist" })).toContainText("$4,800");
  await owner.getByLabel("Status", { exact: true }).selectOption({ label: "Lead" });
  await expect(owner.getByTestId("pipeline-item-row")).toHaveCount(1);
  await owner.getByLabel("Status", { exact: true }).selectOption({ label: "All statuses" });
  await expect(owner.getByTestId("pipeline-item-row")).toHaveCount(3);
  await owner.getByLabel("Assigned to").selectOption({ label: "member@example.test" });
  await expect(owner.getByTestId("pipeline-item-row")).toHaveCount(0);
  await owner.getByLabel("Assigned to").selectOption({ label: "Anyone" });
  await owner.getByLabel("Added from").fill(day(1));
  await expect(owner.getByTestId("pipeline-item-row")).toHaveCount(0);
  await owner.getByLabel("Added from").fill(day(-1));
  await expect(owner.getByTestId("pipeline-item-row")).toHaveCount(3);

  // F003: tasks across overdue, today, upcoming and completed.
  await owner.goto("/tasks");
  for (const [title, due, record] of [
    ["Send wholesale price sheet", day(0), "Maya Lindqvist"],
    ["Chase March invoice", day(-2), "Northwind Bakery"],
    ["Plan summer menu tasting", day(4), null],
  ]) {
    await owner.getByRole("button", { name: "New task" }).click();
    dialog = owner.getByRole("dialog");
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Due date").fill(due);
    if (record) await dialog.getByLabel("Linked record").selectOption({ label: record });
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
  }
  await expect(owner.getByTestId("tasks-today")).toContainText("Send wholesale price sheet");
  await expect(owner.getByTestId("tasks-overdue")).toContainText("Chase March invoice");
  await expect(owner.getByTestId("tasks-upcoming")).toContainText("Plan summer menu tasting");
  await owner.getByRole("checkbox", { name: "Complete Send wholesale price sheet" }).click();
  await expect(owner.getByTestId("tasks-completed")).toContainText("Send wholesale price sheet");
  await owner.getByRole("checkbox", { name: "Complete Send wholesale price sheet" }).click();
  await expect(owner.getByTestId("tasks-today")).toContainText("Send wholesale price sheet");
  await owner.getByRole("button", { name: "Edit Plan summer menu tasting" }).click();
  dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Plan autumn menu tasting");
  await dialog.getByLabel("Assigned to").selectOption({ label: "member@example.test" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Plan autumn menu tasting")).toHaveCount(0);
  await member.goto("/tasks");
  await expect(member.getByTestId("tasks-upcoming")).toContainText("Plan autumn menu tasting");
  await owner.getByRole("button", { name: "Delete Chase March invoice" }).click();
  await owner.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(owner.getByText("Chase March invoice")).toHaveCount(0);

  // F006: an event with an invitee and a linked contact.
  await owner.goto("/calendar");
  await owner.getByRole("button", { name: "New event" }).click();
  dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Roastery tasting");
  await dialog.getByLabel("Starts").fill(`${day(0)}T15:00`);
  await dialog.getByLabel("Ends").fill(`${day(0)}T16:00`);
  await dialog.getByLabel("Location").fill("Harbor Coffee tasting room");
  await dialog.getByRole("checkbox", { name: "member@example.test" }).click();
  await dialog.getByLabel("Find a record").fill("Maya");
  await dialog.getByRole("checkbox", { name: "Maya Lindqvist" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByTestId("calendar-event").filter({ hasText: "Roastery tasting" })).toBeVisible();
  await owner.getByRole("button", { name: "Week" }).click();
  await expect(owner.getByTestId("calendar-event").filter({ hasText: "Roastery tasting" })).toBeVisible();

  await member.goto("/calendar");
  await expect(member.getByTestId("calendar-event").filter({ hasText: "Roastery tasting" })).toBeVisible();
  await member.getByRole("button", { name: "New event" }).click();
  dialog = member.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Inventory count");
  await dialog.getByLabel("All day").click();
  await dialog.getByLabel("Date", { exact: true }).fill(day(0));
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(member.getByTestId("calendar-event").filter({ hasText: "Inventory count" })).toBeVisible();

  // Team view: the owner overlays the teammate's calendar.
  await owner.goto("/calendar");
  await expect(owner.getByTestId("calendar-event").filter({ hasText: "Inventory count" })).toHaveCount(0);
  await owner.getByRole("checkbox", { name: "Show member@example.test" }).click();
  await expect(owner.getByTestId("calendar-event").filter({ hasText: "Inventory count" })).toBeVisible();

  // F002/F003/F006: the timeline gathers tasks, events and moves.
  await owner.goto(maya);
  const timeline = owner.getByTestId("timeline");
  await expect(timeline).toContainText("Send wholesale price sheet");
  await expect(timeline).toContainText("Roastery tasting");
  await expect(timeline).toContainText("samples ship Friday");
  await expect(timeline).toContainText("price-list.csv");

  // F003: the morning agenda email, switched on in a timezone where it is midday.
  const offset = 12 - new Date().getUTCHours();
  const timezoneId = offset === 0 ? "Etc/GMT" : `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`;
  const agendaPage = await (await runtime.context("owner", { timezoneId })).newPage();
  await agendaPage.goto("/settings");
  await agendaPage.getByRole("switch", { name: "Morning agenda email" }).click();
  await expect(agendaPage.getByRole("switch", { name: "Morning agenda email" })).toBeChecked();
  await expect(agendaPage.getByText("Email isn't set up on this Gateway")).toBeVisible();
  await runtime.scheduled("0 * * * *");
  const calls = await runtime.gatewayCalls();
  const mail = calls.find((call) => /email/.test(call.path) && call.body?.includes("owner@example.test"));
  expect(mail, JSON.stringify(calls.map((call) => call.path))).toBeTruthy();
  expect(mail.body).toContain("Send wholesale price sheet");

  // Phone-sized smoke.
  const phone = await (
    await runtime.context("owner", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  ).newPage();
  await phone.goto("/contacts");
  await expect(phone.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  await expect(phone.getByTestId("contact-row").filter({ hasText: "Maya Lindqvist" })).toBeVisible();

  // The journey's result: the pipeline board with its totals.
  await owner.goto("/pipelines");
  await owner.getByRole("link", { name: "Wholesale deals" }).click();
  await owner.getByRole("button", { name: "Board" }).click();
  const proposal = owner.getByTestId("board-column").filter({ has: owner.getByRole("heading", { name: "Proposal" }) });
  await expect(proposal).toContainText("Maya Lindqvist");
  await expect(proposal).toContainText("$4,800");
  await expect(owner.getByTestId("board-column").filter({ has: owner.getByRole("heading", { name: "Won" }) })).toContainText("$2,350");
  await runtime.screenshot(owner);
} finally {
  await runtime.close();
}
