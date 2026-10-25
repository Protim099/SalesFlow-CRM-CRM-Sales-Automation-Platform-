"use server";
import { prisma } from "@/lib/db";
import { safe, AppError } from "@/lib/errors";
import { requireSession, ownScope, type Session } from "@/lib/auth";
import { activitySchema, targetSchema, type ActivityInput, type Target } from "@/lib/validators";
import { parseDate } from "@/lib/utils";
import { z } from "zod";
import { refresh } from "./_shared";

async function resolve(s: Session, t: Target) {
  const ok =
    t.type === "lead" ? await prisma.lead.findFirst({ where: { id: t.id, ...ownScope(s, "assignedToId") } })
    : t.type === "deal" ? await prisma.deal.findFirst({ where: { id: t.id, ...ownScope(s, "ownerId") } })
    : await prisma.contact.findFirst({ where: { id: t.id, orgId: s.orgId } });
  if (!ok) throw new AppError("Record not found.");
  return { leadId: t.type === "lead" ? t.id : null, dealId: t.type === "deal" ? t.id : null, contactId: t.type === "contact" ? t.id : null };
}

export async function addNoteAction(target: Target, body: string) {
  return safe(async () => {
    const s = await requireSession();
    const t = targetSchema.parse(target);
    const text = z.string().trim().min(1, "Write something first").max(5000).parse(body);
    await prisma.note.create({ data: { orgId: s.orgId, body: text, authorId: s.userId, ...(await resolve(s, t)) } });
    refresh();
  });
}

export async function logActivityAction(target: Target, input: ActivityInput) {
  return safe(async () => {
    const s = await requireSession();
    const t = targetSchema.parse(target);
    const d = activitySchema.parse(input);
    await prisma.activity.create({ data: { orgId: s.orgId, type: d.type, subject: d.subject, body: d.body?.trim() || null, userId: s.userId, occurredAt: parseDate(d.occurredAt) ?? new Date(), ...(await resolve(s, t)) } });
    refresh();
  });
}

export async function markNotificationsReadAction() {
  return safe(async () => {
    const s = await requireSession();
    await prisma.notification.updateMany({ where: { userId: s.userId, orgId: s.orgId, readAt: null }, data: { readAt: new Date() } });
  });
}
