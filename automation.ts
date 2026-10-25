"use server";
import { prisma } from "@/lib/db";
import { safe, AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/auth";
import { ruleSchema, type RuleInput } from "@/lib/validators";
import { retryRun } from "@/lib/automation";
import { audit } from "@/lib/audit";
import { refresh } from "./_shared";

export async function saveRuleAction(id: string | null, input: RuleInput) {
  return safe(async () => {
    const s = await requirePermission("automation:manage");
    const d = ruleSchema.parse(input);
    if (d.trigger === "DEAL_STAGE_CHANGED" && d.actions.some((a) => a.type === "ASSIGN_ROUND_ROBIN" || a.type === "SET_LEAD_STATUS"))
      throw new AppError("Assign / set-status actions only work with lead triggers.");
    const data = { name: d.name, trigger: d.trigger, conditions: d.conditions as never, actions: d.actions as never };
    if (id) {
      const r = await prisma.automationRule.updateMany({ where: { id, orgId: s.orgId }, data });
      if (!r.count) throw new AppError("Rule not found.");
    } else {
      id = (await prisma.automationRule.create({ data: { ...data, orgId: s.orgId, createdById: s.userId } })).id;
    }
    audit(s.orgId, s.userId, "automation.save", "rule", id);
    refresh();
  });
}

export async function toggleRuleAction(id: string, active: boolean) {
  return safe(async () => {
    const s = await requirePermission("automation:manage");
    await prisma.automationRule.updateMany({ where: { id, orgId: s.orgId }, data: { active } });
    audit(s.orgId, s.userId, active ? "automation.enable" : "automation.disable", "rule", id);
    refresh();
  });
}

export async function deleteRuleAction(id: string) {
  return safe(async () => {
    const s = await requirePermission("automation:manage");
    await prisma.automationRule.deleteMany({ where: { id, orgId: s.orgId } });
    audit(s.orgId, s.userId, "automation.delete", "rule", id);
    refresh();
  });
}

export async function retryRunAction(runId: string) {
  return safe(async () => {
    const s = await requirePermission("automation:manage");
    try { await retryRun(s.orgId, runId); } catch (e) { throw new AppError(e instanceof Error ? e.message : "Retry failed"); }
    refresh();
  });
}
