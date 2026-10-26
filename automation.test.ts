import { describe, expect, it } from "vitest";
import { evaluateConditions, renderTemplate } from "@/lib/automation-rules";
import { ruleSchema } from "@/lib/validators";

describe("automation conditions", () => {
  const lead = { status: "QUALIFIED", value: 25000, source: "Website", assigned: false };
  it("matches when all conditions hold", () => {
    expect(evaluateConditions([{ field: "status", op: "eq", value: "qualified" }, { field: "value", op: "gte", value: 20000 }], lead)).toBe(true);
  });
  it("fails when any condition fails", () => {
    expect(evaluateConditions([{ field: "status", op: "eq", value: "NEW" }], lead)).toBe(false);
    expect(evaluateConditions([{ field: "value", op: "lte", value: 100 }], lead)).toBe(false);
  });
  it("supports boolean 'assigned', neq and contains", () => {
    expect(evaluateConditions([{ field: "assigned", op: "eq", value: "no" }], lead)).toBe(true);
    expect(evaluateConditions([{ field: "source", op: "neq", value: "Referral" }], lead)).toBe(true);
    expect(evaluateConditions([{ field: "source", op: "contains", value: "web" }], lead)).toBe(true);
  });
  it("empty conditions always match", () => expect(evaluateConditions([], lead)).toBe(true));
  it("renders templates", () => expect(renderTemplate("Hi {{ name }}, {{value}} ({{missing}})", { name: "Ann", value: 5 })).toBe("Hi Ann, 5 ()"));
});

describe("rule validation", () => {
  it("requires at least one action", () => expect(ruleSchema.safeParse({ name: "x1", trigger: "LEAD_CREATED", conditions: [], actions: [] }).success).toBe(false));
  it("accepts a valid rule", () => {
    expect(ruleSchema.safeParse({ name: "Route", trigger: "LEAD_CREATED", conditions: [], actions: [{ type: "ASSIGN_ROUND_ROBIN" }] }).success).toBe(true);
  });
  it("rejects unknown action types", () => expect(ruleSchema.safeParse({ name: "Bad", trigger: "LEAD_CREATED", conditions: [], actions: [{ type: "DROP_TABLE" }] }).success).toBe(false));
});
