import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
const { canRead, canWrite, hiddenOwners, levelFor } = await import("./access");

const actor = (admin: boolean, levels: [string, "full" | "read" | "none"][]) => ({
  id: "me",
  orgId: "org",
  email: "me@example.test",
  admin,
  levels: new Map(levels),
});

describe("access levels", () => {
  it("default to full and honour read-only and none", () => {
    const me = actor(false, [["ann", "read"], ["bob", "none"]]);
    expect(levelFor(me, "carl")).toBe("full");
    expect(canRead(me, "ann")).toBe(true);
    expect(canWrite(me, "ann")).toBe(false);
    expect(canRead(me, "bob")).toBe(false);
    expect(hiddenOwners(me)).toEqual(["bob"]);
    expect(canWrite(me, "me")).toBe(true);
  });

  it("always give admins full access", () => {
    const admin = actor(true, [["bob", "none"]]);
    expect(canWrite(admin, "bob")).toBe(true);
    expect(hiddenOwners(admin)).toEqual([]);
  });
});
