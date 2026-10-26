import { prisma } from "./db";
import { sendEmail } from "./email";
import { actionSchema, type ActionDef, type Condition } from "./validators";
import { evaluateConditions, renderTemplate } from "./automation-rules";
export { evaluateConditions, renderTemplate } from "./automation-rules";
import type { Trigger } from "./constants";

type LogEntry = { index: number; type: string; ok: boolean; detail: string };
type Ctx = { orgId: string; entityType: "lead" | "deal"; entityId: string; ruleName: string; createdById: string | null };

async function loadEntity(ctx: Ctx) {
  if (ctx.entityType === "lead") {
    const lead = await prisma.lead.findFirst({ where: { id: ctx.entityId, orgId: ctx.orgId }, include: { assignedTo: true } });
    if (!lead) throw new Error("Lead no longer exists");
    return { kind: "lead" as const, lead, ownerId: lead.assignedToId, owner: lead.assignedTo };
  }
  const deal = await prisma.deal.findFirst({ where: { id: ctx.entityId, orgId: ctx.orgId }, include: { owner: true, stage: true } });
  if (!deal) throw new Error("Deal no longer exists");
  return { kind: "deal" as const, deal, ownerId: deal.ownerId, owner: deal.owner };
}

async function pickRoundRobin(orgId: string) {
  const members = await prisma.membership.findMany({ where: { orgId, active: true, role: { in: ["SALES_REP", "SALES_MANAGER"] } }, orderBy: { createdAt: "asc" } });
  if (!members.length) throw new Error("No active sales users to assign to");
  const counts = await prisma.lead.groupBy({ by: ["assignedToId"], where: { orgId, archivedAt: null, status: { in: ["NEW", "CONTACTED", "QUALIFIED"] }, assignedToId: { in: members.map((m) => m.userId) } }, _count: { _all: true } });
  const map = new Map(counts.map((c) => [c.assignedToId, c._count._all]));
  return members.map((m) => ({ id: m.userId, n: map.get(m.userId) ?? 0 })).sort((a, b) => a.n - b.n)[0].id;
}

async function runAction(action: ActionDef, ctx: Ctx): Promise<string> {
  const e = await loadEntity(ctx); // reloaded per action so earlier actions (e.g. assignment) are visible
  const name = e.kind === "lead" ? e.lead.name : e.deal.title;
  const vars = { name, status: e.kind === "lead" ? e.lead.status : e.deal.stage.name, value: e.kind === "lead" ? e.lead.value : e.deal.value, owner: e.owner?.name ?? "" };
  switch (action.type) {
    case "ASSIGN_ROUND_ROBIN": {
      if (e.kind !== "lead") throw new Error("Auto-assign only applies to leads");
      if (e.lead.assignedToId) return "Already assigned — left unchanged";
      const id = await pickRoundRobin(ctx.orgId);
      await prisma.lead.update({ where: { id: e.lead.id }, data: { assignedToId: id } });
      return `Assigned to user ${id}`;
    }
    case "CREATE_TASK": {
      const due = new Date(Date.now() + action.dueInDays * 86400000);
      await prisma.task.create({ data: {
        orgId: ctx.orgId, title: renderTemplate(action.title, vars), type: action.taskType, priority: action.priority, dueAt: due,
        assigneeId: e.ownerId ?? ctx.createdById, leadId: e.kind === "lead" ? e.lead.id : null, dealId: e.kind === "deal" ? e.deal.id : null,
      } });
      return "Follow-up task created";
    }
    case "SEND_EMAIL": {
      const to = action.to === "lead" ? (e.kind === "lead" ? e.lead.email : null) : e.owner?.email;
      if (!to) throw new Error(`No ${action.to} email address available`);
      await sendEmail({ to, subject: renderTemplate(action.subject, vars), text: renderTemplate(action.body, vars) });
      return `Email sent to ${to}`;
    }
    case "SET_LEAD_STATUS": {
      if (e.kind !== "lead") throw new Error("Status updates only apply to leads");
      await prisma.lead.update({ where: { id: e.lead.id }, data: { status: action.status } }); // no re-trigger: avoids loops
      return `Status set to ${action.status}`;
    }
    case "NOTIFY_OWNER": {
      const userId = e.ownerId ?? ctx.createdById;
      if (!userId) throw new Error("No user to notify");
      await prisma.notification.create({ data: { orgId: ctx.orgId, userId, title: renderTemplate(action.message, vars), href: e.kind === "lead" ? `/leads/${e.lead.id}` : `/deals/${e.deal.id}` } });
      return "Notification sent";
    }
  }
}

async function runActions(runId: string, actions: ActionDef[], prior: LogEntry[], ctx: Ctx) {
  const log: LogEntry[] = [...prior];
  let failed = false;
  for (let i = 0; i < actions.length; i++) {
    if (log.find((l) => l.index === i)?.ok) continue; // idempotent retry: never repeat a succeeded action
    let entry: LogEntry;
    try { entry = { index: i, type: actions[i].type, ok: true, detail: await runAction(actions[i], ctx) }; }
    catch (err) { failed = true; entry = { index: i, type: actions[i].type, ok: false, detail: err instanceof Error ? err.message : "Unknown error" }; }
    const at = log.findIndex((l) => l.index === i);
    if (at >= 0) log[at] = entry; else log.push(entry);
  }
  const bad = log.filter((l) => !l.ok);
  await prisma.automationRun.update({ where: { id: runId }, data: { status: failed || bad.length ? "FAILED" : "SUCCESS", log: log as never, error: bad.length ? bad.map((b) => `#${b.index + 1} ${b.type}: ${b.detail}`).join("; ") : null, attempts: { increment: 1 } } });
}

/**
 * Fire all active rules for a trigger. Safeguards:
 *  - unique (ruleId, dedupeKey) → the same event can never execute a rule twice
 *  - each action is isolated; failures are recorded and retryable without repeating successes
 *  - dispatcher never throws into the caller's request
 */
export async function runAutomations(trigger: Trigger, orgId: string, entityType: "lead" | "deal", entityId: string, eventKey: string, extra: Record<string, string | number | boolean | null> = {}) {
  try {
    const rules = await prisma.automationRule.findMany({ where: { orgId, trigger, active: true } });
    for (const rule of rules) {
      const dedupeKey = `${trigger}:${entityId}:${eventKey}`;
      let run;
      try { run = await prisma.automationRun.create({ data: { orgId, ruleId: rule.id, entityType, entityId, dedupeKey, status: "RUNNING" } }); }
      catch (e) { if ((e as { code?: string }).code === "P2002") continue; throw e; }
      try {
        const e = await loadEntity({ orgId, entityType, entityId, ruleName: rule.name, createdById: rule.createdById });
        const values = e.kind === "lead"
          ? { status: e.lead.status, priority: e.lead.priority, source: e.lead.source, value: e.lead.value, assigned: !!e.lead.assignedToId, ...extra }
          : { stage: e.deal.stage.name, value: e.deal.value, ...extra };
        if (!evaluateConditions((rule.conditions as Condition[]) ?? [], values)) {
          await prisma.automationRun.update({ where: { id: run.id }, data: { status: "SKIPPED" } });
          continue;
        }
        const actions = actionSchema.array().parse(rule.actions);
        await runActions(run.id, actions, [], { orgId, entityType, entityId, ruleName: rule.name, createdById: rule.createdById });
      } catch (err) {
        await prisma.automationRun.update({ where: { id: run.id }, data: { status: "FAILED", error: err instanceof Error ? err.message : "Unknown error", attempts: { increment: 1 } } });
      }
    }
  } catch (e) { console.error("[automation] dispatch failed", e); }
}

export async function retryRun(orgId: string, runId: string) {
  const run = await prisma.automationRun.findFirst({ where: { id: runId, orgId }, include: { rule: true } });
  if (!run || run.status !== "FAILED") throw new Error("Only failed runs can be retried");
  if (run.attempts >= 3) throw new Error("Maximum retry attempts reached");
  await prisma.automationRun.update({ where: { id: run.id }, data: { status: "RUNNING" } });
  const actions = actionSchema.array().parse(run.rule.actions);
  await runActions(run.id, actions, (run.log as LogEntry[]) ?? [], { orgId, entityType: run.entityType as "lead" | "deal", entityId: run.entityId, ruleName: run.rule.name, createdById: run.rule.createdById });
}

/** Creates in-app notifications for tasks whose reminder time has passed. */
export async function generateReminders(orgId: string, userId?: string) {
  const due = await prisma.task.findMany({ where: { orgId, completedAt: null, reminderSentAt: null, reminderAt: { lte: new Date() }, assigneeId: userId ?? { not: null } }, take: 100 });
  for (const t of due) {
    if (!t.assigneeId) continue;
    const claimed = await prisma.task.updateMany({ where: { id: t.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (claimed.count === 0) continue;
    await prisma.notification.create({ data: { orgId, userId: t.assigneeId, title: `Reminder: ${t.title}`, body: t.dueAt ? `Due ${t.dueAt.toISOString().slice(0, 10)}` : undefined, href: "/tasks" } });
  }
  return due.length;
}
