"use server";
import { prisma } from "@/lib/db";
import { safe, AppError } from "@/lib/errors";
import { requireSession, ownScope, type Session } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { taskSchema, type TaskInput } from "@/lib/validators";
import { parseDate } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { assertInOrg, blank, refresh, validAssignee } from "./_shared";

async function ownedTask(s: Session, id: string) {
  const t = await prisma.task.findFirst({ where: { id, ...ownScope(s, "assigneeId") } });
  if (!t) throw new AppError("Task not found.");
  return t;
}

export async function createTaskAction(input: TaskInput) {
  return safe(async () => {
    const s = await requireSession();
    const d = taskSchema.parse(input);
    await assertInOrg(s, { leadId: d.leadId || null, contactId: d.contactId || null, dealId: d.dealId || null });
    const assigneeId = can(s.role, "leads:assign") ? (await validAssignee(s, d.assigneeId || null)) ?? s.userId : s.userId;
    const t = await prisma.task.create({ data: {
      orgId: s.orgId, title: d.title, description: blank(d.description), type: d.type, priority: d.priority,
      dueAt: parseDate(d.dueAt), reminderAt: parseDate(d.reminderAt), assigneeId,
      leadId: blank(d.leadId), contactId: blank(d.contactId), dealId: blank(d.dealId),
    } });
    audit(s.orgId, s.userId, "task.create", "task", t.id);
    refresh();
  });
}

export async function updateTaskAction(id: string, input: TaskInput) {
  return safe(async () => {
    const s = await requireSession();
    const d = taskSchema.parse(input);
    const existing = await ownedTask(s, id);
    const assigneeId = can(s.role, "leads:assign") ? (await validAssignee(s, d.assigneeId || null)) ?? existing.assigneeId : existing.assigneeId;
    const reminderAt = parseDate(d.reminderAt);
    await prisma.task.update({ where: { id }, data: {
      title: d.title, description: blank(d.description), type: d.type, priority: d.priority, dueAt: parseDate(d.dueAt), assigneeId,
      reminderAt, reminderSentAt: reminderAt?.getTime() === existing.reminderAt?.getTime() ? existing.reminderSentAt : null,
    } });
    audit(s.orgId, s.userId, "task.update", "task", id);
    refresh();
  });
}

export async function toggleTaskAction(id: string, done: boolean) {
  return safe(async () => {
    const s = await requireSession();
    await ownedTask(s, id);
    await prisma.task.update({ where: { id }, data: { completedAt: done ? new Date() : null } });
    refresh();
  });
}

export async function deleteTaskAction(id: string) {
  return safe(async () => {
    const s = await requireSession();
    await ownedTask(s, id);
    await prisma.task.delete({ where: { id } });
    audit(s.orgId, s.userId, "task.delete", "task", id);
    refresh();
  });
}
