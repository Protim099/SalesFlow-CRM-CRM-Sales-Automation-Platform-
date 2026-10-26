import type { Condition } from "./validators";

/** Pure helper (unit tested): do all conditions match the entity's field values? */
export function evaluateConditions(conditions: Condition[], values: Record<string, string | number | boolean | null | undefined>): boolean {
  return conditions.every((c) => {
    const actual = values[c.field];
    const a = typeof actual === "boolean" ? (actual ? "yes" : "no") : actual;
    switch (c.op) {
      case "eq": return String(a ?? "").toLowerCase() === String(c.value).toLowerCase();
      case "neq": return String(a ?? "").toLowerCase() !== String(c.value).toLowerCase();
      case "gte": return Number(a) >= Number(c.value);
      case "lte": return Number(a) <= Number(c.value);
      case "contains": return String(a ?? "").toLowerCase().includes(String(c.value).toLowerCase());
    }
  });
}
export const renderTemplate = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => String(vars[k] ?? ""));

