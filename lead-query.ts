import { ownScope, type Session } from "./auth";
import { LEAD_STATUSES, PRIORITIES } from "./constants";

export type LeadParams = { q?: string; status?: string; priority?: string; source?: string; assignee?: string; archived?: string; sort?: string; dir?: string; page?: string };
export const SORTABLE = ["name", "value", "createdAt", "followUpAt", "status", "priority"] as const;

export function leadWhere(s: Session, p: LeadParams) {
  const q = p.q?.trim();
  return {
    ...ownScope(s, "assignedToId"),
    archivedAt: p.archived === "1" ? { not: null } : null,
    ...(p.status && (LEAD_STATUSES as readonly string[]).includes(p.status) && { status: p.status as never }),
    ...(p.priority && (PRIORITIES as readonly string[]).includes(p.priority) && { priority: p.priority as never }),
    ...(p.source && { source: p.source }),
    ...(p.assignee === "none" ? { assignedToId: null } : p.assignee ? { assignedToId: p.assignee } : {}),
    ...(q && { OR: [
      { name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } },
      { companyName: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } },
    ] }),
  };
}
export function leadOrder(p: LeadParams) {
  const field = (SORTABLE as readonly string[]).includes(p.sort ?? "") ? p.sort! : "createdAt";
  return { [field]: p.dir === "asc" ? "asc" : "desc" } as Record<string, "asc" | "desc">;
}
