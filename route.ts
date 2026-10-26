import { prisma } from "@/lib/db";
import { getSession, ownScope } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ results: [] });
  const c = { contains: q, mode: "insensitive" as const };
  const [leads, contacts, companies, deals] = await Promise.all([
    prisma.lead.findMany({ where: { ...ownScope(s, "assignedToId"), OR: [{ name: c }, { email: c }, { companyName: c }] }, take: 5, select: { id: true, name: true, companyName: true } }),
    prisma.contact.findMany({ where: { orgId: s.orgId, OR: [{ firstName: c }, { lastName: c }, { email: c }] }, take: 5, select: { id: true, firstName: true, lastName: true, email: true } }),
    prisma.company.findMany({ where: { orgId: s.orgId, name: c }, take: 4, select: { id: true, name: true } }),
    prisma.deal.findMany({ where: { ...ownScope(s, "ownerId"), title: c }, take: 5, select: { id: true, title: true } }),
  ]);
  return Response.json({ results: [
    ...leads.map((l) => ({ type: "Lead", label: l.name, sub: l.companyName ?? "", href: `/leads/${l.id}` })),
    ...contacts.map((x) => ({ type: "Contact", label: `${x.firstName} ${x.lastName}`.trim(), sub: x.email ?? "", href: `/contacts/${x.id}` })),
    ...companies.map((x) => ({ type: "Company", label: x.name, sub: "", href: `/companies?q=${encodeURIComponent(x.name)}` })),
    ...deals.map((x) => ({ type: "Deal", label: x.title, sub: "", href: `/deals/${x.id}` })),
  ] });
}
