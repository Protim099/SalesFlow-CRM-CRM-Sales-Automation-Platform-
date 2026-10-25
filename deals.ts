"use server";
import { prisma } from "@/lib/db";
import { safe, AppError } from "@/lib/errors";
import { requireSession, requirePermission, ownScope, type Session } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dealSchema, type DealInput } from "@/lib/validators";
import { parseDate } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { runAutomations } from "@/lib/automation";
import { assertInOrg, blank, refresh, validAssignee } from "./_shared";

async function ownedDeal(s: Session, id: string) {
  const deal = await prisma.deal.findFirst({ where: { id, ...ownScope(s, "ownerId") }, include: { stage: true } });
  if (!deal) throw new AppError("Deal not found.");
  return deal;
}
async function stageOf(s: Session, id: string) {
  const st = await prisma.dealStage.findFirst({ where: { id, orgId: s.orgId } });
  if (!st) throw new AppError("Stage not found.");
  return st;
}

export async function createDealAction(input: DealInput) {
  return safe(async () => {
    const s = await requireSession();
    const d = dealSchema.parse(input);
    const stage = await stageOf(s, d.stageId);
    await assertInOrg(s, { contactId: d.contactId || null, companyId: d.companyId || null });
    const ownerId = can(s.role, "leads:assign") ? await validAssignee(s, d.ownerId || null) ?? s.userId : s.userId;
    const closed = stage.kind !== "OPEN";
    const deal = await prisma.deal.create({ data: {
      orgId: s.orgId, title: d.title, value: d.value, probability: stage.kind === "WON" ? 100 : stage.kind === "LOST" ? 0 : d.probability,
      expectedCloseAt: parseDate(d.expectedCloseAt), stageId: stage.id, ownerId, contactId: blank(d.contactId), companyId: blank(d.companyId),
      closedAt: closed ? new Date() : null, lossReason: stage.kind === "LOST" ? "Not specified" : null,
    } });
    audit(s.orgId, s.userId, "deal.create", "deal", deal.id);
    refresh();
    return { id: deal.id };
  });
}

export async function updateDealAction(id: string, input: DealInput) {
  return safe(async () => {
    const s = await requireSession();
    const d = dealSchema.parse(input);
    await ownedDeal(s, id);
    await assertInOrg(s, { contactId: d.contactId || null, companyId: d.companyId || null });
    const ownerId = can(s.role, "leads:assign") ? await validAssignee(s, d.ownerId || null) : undefined;
    await prisma.deal.update({ where: { id }, data: {
      title: d.title, value: d.value, probability: d.probability, expectedCloseAt: parseDate(d.expectedCloseAt),
      contactId: blank(d.contactId), companyId: blank(d.companyId), ...(ownerId !== undefined && { ownerId }),
    } });
    audit(s.orgId, s.userId, "deal.update", "deal", id);
    refresh();
  });
}

/** Drag-and-drop move. Moving to a LOST stage requires a reason; WON/LOST stamp closedAt. */
export async function moveDealAction(id: string, stageId: string, lossReason?: string) {
  return safe(async () => {
    const s = await requireSession();
    const deal = await ownedDeal(s, id);
    if (deal.stageId === stageId) return;
    const stage = await stageOf(s, stageId);
    if (stage.kind === "LOST" && !lossReason?.trim()) throw new AppError("Please provide a loss reason.");
    const updated = await prisma.deal.update({ where: { id }, data: {
      stageId, probability: stage.probability,
      closedAt: stage.kind === "OPEN" ? null : new Date(),
      lossReason: stage.kind === "LOST" ? lossReason!.trim().slice(0, 300) : null,
    } });
    await prisma.activity.create({ data: { orgId: s.orgId, type: "SYSTEM", subject: `Stage changed: ${deal.stage.name} → ${stage.name}`, body: stage.kind === "LOST" ? `Reason: ${lossReason}` : null, userId: s.userId, dealId: id, contactId: deal.contactId } });
    audit(s.orgId, s.userId, "deal.move", "deal", id, { from: deal.stage.name, to: stage.name });
    await runAutomations("DEAL_STAGE_CHANGED", s.orgId, "deal", id, String(updated.updatedAt.getTime()));
    refresh();
  });
}

export async function deleteDealAction(id: string) {
  return safe(async () => {
    const s = await requirePermission("records:delete");
    await ownedDeal(s, id);
    await prisma.deal.delete({ where: { id } });
    audit(s.orgId, s.userId, "deal.delete", "deal", id);
    refresh();
  });
}
