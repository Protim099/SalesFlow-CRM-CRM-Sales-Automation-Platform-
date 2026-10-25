"use server";
import { prisma } from "@/lib/db";
import { safe, AppError } from "@/lib/errors";
import { requireSession, requirePermission, ownScope, type Session } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { leadSchema, type LeadInput } from "@/lib/validators";
import { parseDate } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { runAutomations } from "@/lib/automation";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";
import { blank, refresh, validAssignee } from "./_shared";

async function ownedLead(s: Session, id: string) {
  const lead = await prisma.lead.findFirst({ where: { id, ...ownScope(s, "assignedToId") } });
  if (!lead) throw new AppError("Lead not found.");
  return lead;
}

export async function createLeadAction(input: LeadInput) {
  return safe(async () => {
    const s = await requireSession();
    const d = leadSchema.parse(input);
    const assignedToId = can(s.role, "leads:assign") ? await validAssignee(s, d.assignedToId || null) : s.userId;
    const lead = await prisma.lead.create({ data: {
      orgId: s.orgId, name: d.name, email: blank(d.email)?.toLowerCase() ?? null, phone: blank(d.phone), companyName: blank(d.companyName),
      source: d.source, status: d.status, priority: d.priority, value: d.value, notes: blank(d.notes), followUpAt: parseDate(d.followUpAt), assignedToId,
    } });
    audit(s.orgId, s.userId, "lead.create", "lead", lead.id);
    await runAutomations("LEAD_CREATED", s.orgId, "lead", lead.id, String(lead.createdAt.getTime()));
    refresh();
    return { id: lead.id };
  });
}

export async function updateLeadAction(id: string, input: LeadInput) {
  return safe(async () => {
    const s = await requireSession();
    const d = leadSchema.parse(input);
    const existing = await ownedLead(s, id);
    const assignedToId = can(s.role, "leads:assign") ? await validAssignee(s, d.assignedToId || null) : existing.assignedToId;
    const lead = await prisma.lead.update({ where: { id }, data: {
      name: d.name, email: blank(d.email)?.toLowerCase() ?? null, phone: blank(d.phone), companyName: blank(d.companyName),
      source: d.source, status: d.status, priority: d.priority, value: d.value, notes: blank(d.notes), followUpAt: parseDate(d.followUpAt), assignedToId,
    } });
    audit(s.orgId, s.userId, "lead.update", "lead", id);
    if (existing.status !== lead.status) await runAutomations("LEAD_STATUS_CHANGED", s.orgId, "lead", id, String(lead.updatedAt.getTime()));
    refresh();
  });
}

export async function setLeadStatusAction(id: string, status: LeadStatus) {
  return safe(async () => {
    const s = await requireSession();
    if (!LEAD_STATUSES.includes(status)) throw new AppError("Invalid status.");
    const existing = await ownedLead(s, id);
    if (existing.status === status) return;
    const lead = await prisma.lead.update({ where: { id }, data: { status } });
    await prisma.activity.create({ data: { orgId: s.orgId, type: "SYSTEM", subject: `Status changed: ${existing.status} → ${status}`, userId: s.userId, leadId: id } });
    audit(s.orgId, s.userId, "lead.status", "lead", id, { from: existing.status, to: status });
    await runAutomations("LEAD_STATUS_CHANGED", s.orgId, "lead", id, String(lead.updatedAt.getTime()));
    refresh();
  });
}

export async function assignLeadAction(id: string, userId: string) {
  return safe(async () => {
    const s = await requirePermission("leads:assign");
    await ownedLead(s, id);
    const assignedToId = await validAssignee(s, userId);
    await prisma.lead.update({ where: { id }, data: { assignedToId } });
    audit(s.orgId, s.userId, "lead.assign", "lead", id, { to: assignedToId });
    refresh();
  });
}

export async function archiveLeadAction(id: string, archived: boolean) {
  return safe(async () => {
    const s = await requireSession();
    await ownedLead(s, id);
    await prisma.lead.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    audit(s.orgId, s.userId, archived ? "lead.archive" : "lead.restore", "lead", id);
    refresh();
  });
}

export async function deleteLeadAction(id: string) {
  return safe(async () => {
    const s = await requirePermission("records:delete");
    await ownedLead(s, id);
    await prisma.lead.delete({ where: { id } });
    audit(s.orgId, s.userId, "lead.delete", "lead", id);
    refresh();
  });
}

/** Converts a lead into Contact (+Company) and an open Deal in the first pipeline stage. */
export async function convertLeadAction(id: string) {
  return safe(async () => {
    const s = await requireSession();
    const lead = await ownedLead(s, id);
    if (lead.status === "CONVERTED") throw new AppError("This lead was already converted.");
    const stage = await prisma.dealStage.findFirst({ where: { orgId: s.orgId, kind: "OPEN" }, orderBy: { position: "asc" } });
    if (!stage) throw new AppError("Create an open pipeline stage in Settings first.");
    const dealId = await prisma.$transaction(async (tx) => {
      let companyId: string | null = null;
      if (lead.companyName) {
        const ex = await tx.company.findFirst({ where: { orgId: s.orgId, name: { equals: lead.companyName, mode: "insensitive" } } });
        companyId = ex?.id ?? (await tx.company.create({ data: { orgId: s.orgId, name: lead.companyName } })).id;
      }
      const [firstName, ...rest] = lead.name.trim().split(/\s+/);
      const contact = await tx.contact.create({ data: { orgId: s.orgId, firstName, lastName: rest.join(" "), email: lead.email, phone: lead.phone, companyId } });
      const deal = await tx.deal.create({ data: {
        orgId: s.orgId, title: `${lead.companyName || lead.name} — Opportunity`, value: lead.value, probability: stage.probability,
        stageId: stage.id, ownerId: lead.assignedToId ?? s.userId, contactId: contact.id, companyId, leadId: lead.id,
      } });
      await tx.lead.update({ where: { id }, data: { status: "CONVERTED", contactId: contact.id, convertedAt: new Date() } });
      await tx.activity.create({ data: { orgId: s.orgId, type: "SYSTEM", subject: "Lead converted to contact and deal", userId: s.userId, leadId: id, contactId: contact.id, dealId: deal.id } });
      return deal.id;
    });
    audit(s.orgId, s.userId, "lead.convert", "lead", id, { dealId });
    refresh();
    return { dealId };
  });
}
