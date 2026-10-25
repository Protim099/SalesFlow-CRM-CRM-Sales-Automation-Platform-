"use server";
import { prisma } from "@/lib/db";
import { safe, AppError } from "@/lib/errors";
import { requireSession, requirePermission } from "@/lib/auth";
import { companySchema, contactSchema, type CompanyInput, type ContactInput } from "@/lib/validators";
import { parseTags } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { assertInOrg, blank, refresh } from "./_shared";

export async function saveContactAction(id: string | null, input: ContactInput) {
  return safe(async () => {
    const s = await requireSession();
    const d = contactSchema.parse(input);
    await assertInOrg(s, { companyId: d.companyId || null });
    const data = { firstName: d.firstName, lastName: d.lastName?.trim() ?? "", email: blank(d.email)?.toLowerCase() ?? null, phone: blank(d.phone), jobTitle: blank(d.jobTitle), companyId: blank(d.companyId), tags: parseTags(d.tags) };
    if (id) {
      const r = await prisma.contact.updateMany({ where: { id, orgId: s.orgId }, data });
      if (!r.count) throw new AppError("Contact not found.");
    } else {
      const c = await prisma.contact.create({ data: { ...data, orgId: s.orgId } });
      id = c.id;
    }
    audit(s.orgId, s.userId, id ? "contact.save" : "contact.create", "contact", id);
    refresh();
  });
}

export async function deleteContactAction(id: string) {
  return safe(async () => {
    const s = await requirePermission("records:delete");
    const r = await prisma.contact.deleteMany({ where: { id, orgId: s.orgId } });
    if (!r.count) throw new AppError("Contact not found.");
    audit(s.orgId, s.userId, "contact.delete", "contact", id);
    refresh();
  });
}

export async function saveCompanyAction(id: string | null, input: CompanyInput) {
  return safe(async () => {
    const s = await requireSession();
    const d = companySchema.parse(input);
    const data = { name: d.name, website: blank(d.website), industry: blank(d.industry), phone: blank(d.phone), address: blank(d.address), tags: parseTags(d.tags) };
    if (id) {
      const r = await prisma.company.updateMany({ where: { id, orgId: s.orgId }, data });
      if (!r.count) throw new AppError("Company not found.");
    } else {
      const c = await prisma.company.create({ data: { ...data, orgId: s.orgId } });
      id = c.id;
    }
    audit(s.orgId, s.userId, "company.save", "company", id);
    refresh();
  });
}

export async function deleteCompanyAction(id: string) {
  return safe(async () => {
    const s = await requirePermission("records:delete");
    const r = await prisma.company.deleteMany({ where: { id, orgId: s.orgId } });
    if (!r.count) throw new AppError("Company not found.");
    audit(s.orgId, s.userId, "company.delete", "company", id);
    refresh();
  });
}
