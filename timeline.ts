import { prisma } from "./db";
import type { TimelineItem } from "@/components/timeline";

/** Merged, newest-first communication history (activities + notes) for a lead, contact or deal. */
export async function loadTimeline(orgId: string, key: "leadId" | "contactId" | "dealId", id: string): Promise<TimelineItem[]> {
  const [acts, notes] = await Promise.all([
    prisma.activity.findMany({ where: { orgId, [key]: id }, include: { user: { select: { name: true } } }, orderBy: { occurredAt: "desc" }, take: 100 }),
    prisma.note.findMany({ where: { orgId, [key]: id }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return [
    ...acts.map((a) => ({ id: a.id, kind: a.type as TimelineItem["kind"], title: a.subject, body: a.body, by: a.user?.name ?? "System", at: a.occurredAt.toISOString() })),
    ...notes.map((n) => ({ id: n.id, kind: "NOTE" as const, title: "Note", body: n.body, by: n.author?.name ?? "Unknown", at: n.createdAt.toISOString() })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}
