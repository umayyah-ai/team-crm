// Shared helpers for the release checks.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export { expect };

/** A local calendar day as YYYY-MM-DD, offset by `days`. */
export function day(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Creates a person or company through the list page's dialog and returns its page URL. */
export async function createRecord(page, kind, fields) {
  await page.goto(kind === "company" ? "/companies" : "/contacts");
  await page
    .getByRole("button", { name: kind === "company" ? "New company" : "New contact" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const [label, value] of Object.entries(fields)) {
    const field = dialog.getByLabel(label, { exact: true });
    if ((await field.evaluate((el) => el.tagName)) === "SELECT") {
      await field.selectOption({ label: value });
    } else {
      await field.fill(value);
    }
  }
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1, name: fields.Name })).toBeVisible();
  return new URL(page.url()).pathname;
}

/** Records the next server-function request a page sends while `action` runs. */
export async function captureServerCall(page, action, match) {
  const found = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().includes("/_serverFn/") &&
      (!match || (request.postData() ?? "").includes(match)),
  );
  const [request] = await Promise.all([found, action()]);
  return {
    url: request.url(),
    body: request.postData() ?? "",
    headers: Object.fromEntries(
      Object.entries(await request.allHeaders()).filter(
        ([name]) => !["cookie", "host", "content-length"].includes(name) && !name.startsWith(":"),
      ),
    ),
  };
}

/** Replays a captured server-function call from another person's page. */
export async function replay(page, call, from, to) {
  return page.evaluate(
    async ({ url, body, headers }) => {
      const response = await fetch(url, { method: "POST", body, headers });
      return { status: response.status, text: await response.text() };
    },
    { ...call, body: from ? call.body.split(from).join(to) : call.body },
  );
}
