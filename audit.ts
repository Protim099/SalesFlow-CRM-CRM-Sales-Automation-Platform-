import { prisma } from "./db";

export function audit(orgId: string, userId: string | null, action: string, entity: string, entityId?: string | null, meta?: Record<string, unknown>) {
  // Fire-and-forget: audit failures must never break the user's action.
  prisma.auditLog
    .create({ data: { orgId, userId, action, entity, entityId: entityId ?? null, meta: (meta ?? undefined) as never } })
    .catch((e: unknown) => console.error("[audit]", e));
}
