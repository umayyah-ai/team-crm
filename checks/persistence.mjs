// Persistence: records, notes and files survive a restart.
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";
import { createRecord, expect } from "./lib.mjs";

const runtime = await startRuntime();
try {
  let owner = await (await runtime.context("owner")).newPage();
  await owner.goto("/");
  const path = await createRecord(owner, "person", {
    Name: "Priya Raman",
    Emails: "priya@lanternbooks.example",
  });
  await owner.getByLabel("New note").fill("Wants a quote for 40 gift boxes.");
  await owner.getByRole("button", { name: "Add note" }).click();
  await expect(owner.getByTestId("timeline-item").filter({ hasText: "40 gift boxes" })).toBeVisible();
  await owner.getByLabel("Attach file").setInputFiles({
    name: "quote.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("40 boxes at 18 each"),
  });
  await expect(owner.getByRole("link", { name: "quote.txt" })).toBeVisible();
  await owner.goto("/groups");
  await owner.getByLabel("Group name").fill("Gift buyers");
  await owner.getByRole("button", { name: "Create group" }).click();
  await expect(owner.getByTestId("group-row").filter({ hasText: "Gift buyers" })).toBeVisible();

  await runtime.restart();

  owner = await (await runtime.context("owner")).newPage();
  await owner.goto(path);
  await expect(owner.getByRole("heading", { level: 1, name: "Priya Raman" })).toBeVisible();
  await expect(owner.getByText("priya@lanternbooks.example")).toBeVisible();
  await expect(owner.getByTestId("timeline-item").filter({ hasText: "40 gift boxes" })).toBeVisible();
  const [download] = await Promise.all([
    owner.waitForEvent("download"),
    owner.getByRole("link", { name: "quote.txt" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("quote.txt");
  await owner.goto("/groups");
  await expect(owner.getByTestId("group-row").filter({ hasText: "Gift buyers" })).toBeVisible();
} finally {
  await runtime.close();
}
