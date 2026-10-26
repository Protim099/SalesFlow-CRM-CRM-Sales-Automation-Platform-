import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

describe("role permissions", () => {
  it("admin can do everything", () => {
    for (const p of ["records:viewAll", "records:delete", "leads:assign", "automation:manage", "reports:team", "team:manage", "settings:manage"] as const) expect(can("ADMIN", p)).toBe(true);
  });
  it("manager manages sales but not team/settings", () => {
    expect(can("SALES_MANAGER", "automation:manage")).toBe(true);
    expect(can("SALES_MANAGER", "records:viewAll")).toBe(true);
    expect(can("SALES_MANAGER", "team:manage")).toBe(false);
    expect(can("SALES_MANAGER", "settings:manage")).toBe(false);
  });
  it("rep has no elevated permissions", () => {
    for (const p of ["records:viewAll", "records:delete", "leads:assign", "automation:manage", "reports:team", "team:manage", "settings:manage"] as const) expect(can("SALES_REP", p)).toBe(false);
  });
});
