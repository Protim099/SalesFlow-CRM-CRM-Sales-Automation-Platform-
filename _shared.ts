import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/auth";

export const refresh = () => revalidatePath("/", "layout");
export const blank = (v?: string | null) => (v && v.trim() ? v.trim() : null);

export async function validAssignee(s: Session, userId?: string | null) {
  if (!userId) return null;
  const m = await prisma.membership.findFirst({ where: { orgId: s.orgId, userId, active: true } });
  if (!m) throw new AppError("Selected user is not part of this organization.");
  return userId;
}
/** Confirms a related record belongs to the caller's organization (blocks cross-tenant references). */
export async function assertInOrg(s: Session, rel: { companyId?: string | null; contactId?: string | null; leadId?: string | null; dealId?: string | null }) {
  const checks: Promise<unknown>[] = [];
  const bad = () => { throw new AppError("Related record not found."); };
  if (rel.companyId) checks.push(prisma.company.findFirst({ where: { id: rel.companyId, orgId: s.orgId } }).then((r) => r ?? bad()));
  if (rel.contactId) checks.push(prisma.contact.findFirst({ where: { id: rel.contactId, orgId: s.orgId } }).then((r) => r ?? bad()));
  if (rel.leadId) checks.push(prisma.lead.findFirst({ where: { id: rel.leadId, orgId: s.orgId } }).then((r) => r ?? bad()));
  if (rel.dealId) checks.push(prisma.deal.findFirst({ where: { id: rel.dealId, orgId: s.orgId } }).then((r) => r ?? bad()));
  await Promise.all(checks);
}
