// Authorization: private paths, no sign-in of the app's own, ownership,
// access levels, private groups and admin-only actions.
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";
import { captureServerCall, createRecord, expect, replay } from "./lib.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess([
    "/", "/contacts", "/companies", "/tasks", "/calendar", "/pipelines", "/groups",
    "/settings", "/settings/fields", "/settings/pipelines", "/settings/team",
  ]);

  // X001: no sign-in, sign-up or password page of the app's own.
  for (const path of ["/login", "/signin", "/signup", "/logout", "/account"]) {
    const anonymous = await runtime.fetch(path);
    expect([401, 403]).toContain(anonymous.status);
    const signedIn = await runtime.fetch(path, { role: "owner" });
    expect(signedIn.status).toBe(404);
    expect(await signedIn.text()).not.toMatch(/type="password"/i);
  }
  // Files are never public.
  expect([401, 403]).toContain((await runtime.fetch("/api/files/anything")).status);
  expect([401, 403]).toContain((await runtime.fetch("/api/files/anything", { role: "outsider" })).status);

  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/");
  await owner.goto("/");

  const blueFern = await createRecord(owner, "company", { Name: "Blue Fern Studio" });
  const blueFernId = blueFern.split("/").pop();
  await owner.getByLabel("New note").fill("Pricing agreed at the owner's discretion.");
  await owner.getByRole("button", { name: "Add note" }).click();
  await expect(owner.getByTestId("timeline-item").filter({ hasText: "owner's discretion" })).toBeVisible();

  const ridgeway = await createRecord(member, "company", { Name: "Ridgeway Hardware" });
  const ridgewayId = ridgeway.split("/").pop();
  await member.getByLabel("New note").fill("Prefers calls after 3pm.");
  await member.getByRole("button", { name: "Add note" }).click();
  await expect(member.getByTestId("timeline-item").filter({ hasText: "after 3pm" })).toBeVisible();

  // A captured edit of the member's own record, to replay against others.
  await member.getByRole("button", { name: "Edit", exact: true }).click();
  await member.getByRole("dialog").getByLabel("Name", { exact: true }).fill("Ridgeway Hardware Co");
  const update = await captureServerCall(
    member,
    () => member.getByRole("dialog").getByRole("button", { name: "Save" }).click(),
    ridgewayId,
  );
  await expect(member.getByRole("heading", { level: 1, name: "Ridgeway Hardware Co" })).toBeVisible();

  // Full access by default: the teammate opens the record but only edits their own notes.
  await member.goto(blueFern);
  await expect(member.getByRole("heading", { level: 1, name: "Blue Fern Studio" })).toBeVisible();
  await expect(member.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  const ownerNote = member.getByTestId("timeline-item").filter({ hasText: "owner's discretion" });
  await expect(ownerNote).toBeVisible();
  await expect(ownerNote.getByRole("button", { name: "Edit note" })).toHaveCount(0);
  await expect(ownerNote.getByRole("button", { name: "Delete note" })).toHaveCount(0);
  // An admin may edit anyone's note.
  await owner.goto(ridgeway);
  await expect(
    owner.getByTestId("timeline-item").filter({ hasText: "after 3pm" }).getByRole("button", { name: "Edit note" }),
  ).toBeVisible();

  // F007: the admin takes away the member's access to the owner's records.
  await owner.goto("/settings/team");
  const level = owner.getByLabel("member@example.test's access to owner@example.test's records");
  await level.selectOption("none");
  await expect(owner.getByText("Access saved")).toBeVisible();
  await member.goto("/companies");
  await expect(member.getByTestId("contact-row").filter({ hasText: "Ridgeway Hardware Co" })).toBeVisible();
  await expect(member.getByTestId("contact-row").filter({ hasText: "Blue Fern Studio" })).toHaveCount(0);
  await member.goto(blueFern);
  await expect(member.getByTestId("not-found")).toBeVisible();
  await expect(member.getByText("Blue Fern Studio")).toHaveCount(0);
  // A forged edit through the server function changes nothing.
  await replay(member, update, ridgewayId, blueFernId);
  const db = await runtime.database();
  const name = async (id) => (await db.prepare("select name from contacts where id = ?").bind(id).first())?.name;
  expect(await name(blueFernId)).toBe("Blue Fern Studio");

  // Read-only: visible, never changed.
  await owner.goto("/settings/team");
  await owner.getByLabel("member@example.test's access to owner@example.test's records").selectOption("read");
  await expect(owner.getByText("Access saved")).toBeVisible();
  await member.goto(blueFern);
  await expect(member.getByRole("heading", { level: 1, name: "Blue Fern Studio" })).toBeVisible();
  await expect(member.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(member.getByLabel("New note")).toHaveCount(0);
  await replay(member, update, ridgewayId, blueFernId);
  expect(await name(blueFernId)).toBe("Blue Fern Studio");
  // The member's own record stays theirs to edit.
  expect(await name(ridgewayId)).toBe("Ridgeway Hardware Co");

  // F005: a private group is invisible to everyone else, admins included.
  await member.goto("/groups");
  await member.getByLabel("Group name").fill("My shortlist");
  await member.getByLabel("Private").click();
  await member.getByRole("button", { name: "Create group" }).click();
  const privateRow = member.getByTestId("group-row").filter({ hasText: "My shortlist" });
  await expect(privateRow).toBeVisible();
  await privateRow.getByRole("link", { name: "My shortlist" }).click();
  await expect(member.getByRole("heading", { level: 1, name: "My shortlist" })).toBeVisible();
  const groupPath = new URL(member.url()).pathname;
  await owner.goto("/groups");
  await expect(owner.getByTestId("group-row").filter({ hasText: "My shortlist" })).toHaveCount(0);
  await owner.goto(groupPath);
  await expect(owner.getByTestId("not-found")).toBeVisible();
  await owner.goto(ridgeway);
  await expect(owner.getByLabel("Add to group").locator("option", { hasText: "My shortlist" })).toHaveCount(0);

  // Admin-only settings refuse members, in the page and at the server.
  await owner.goto("/settings/fields");
  await owner.getByLabel("Field name").fill("Region");
  const createField = await captureServerCall(owner, () =>
    owner.getByRole("button", { name: "Add field" }).click(),
  "Region");
  await expect(owner.getByTestId("field-row").filter({ hasText: "Region" })).toBeVisible();
  for (const path of ["/settings/fields", "/settings/pipelines", "/settings/team"]) {
    await member.goto(path);
    await expect(member.getByText("Only admins can change these settings.")).toBeVisible();
  }
  await expect(member.getByRole("button", { name: "Add field" })).toHaveCount(0);
  await replay(member, createField, "Region", "Sneaky");
  const fields = await db.prepare("select name from custom_fields").all();
  expect(fields.results.map((row) => row.name)).not.toContain("Sneaky");

  // F007: an admin reassigns all of one member's records in one action.
  await owner.goto("/settings/team");
  await owner.getByLabel("Reassign records from").selectOption({ label: "member@example.test" });
  await owner.getByLabel("Reassign records to").selectOption({ label: "owner@example.test" });
  await owner.getByRole("button", { name: "Reassign" }).click();
  await owner.getByRole("alertdialog").getByRole("button", { name: "Reassign" }).click();
  await expect(owner.getByText(/Reassigned 1 record/)).toBeVisible();
  const assigned = await db.prepare("select u.email from contacts c join users u on u.id = c.assigned_user_id where c.id = ?").bind(ridgewayId).first();
  expect(assigned.email).toBe("owner@example.test");
  // The member now only reads it, under the read-only level for the owner.
  await member.goto(ridgeway);
  await expect(member.getByRole("heading", { level: 1, name: "Ridgeway Hardware Co" })).toBeVisible();
  await expect(member.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
} finally {
  await runtime.close();
}
