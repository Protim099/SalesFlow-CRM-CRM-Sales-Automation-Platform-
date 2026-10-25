import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultSources, defaultStageRows } from "../src/lib/defaults";

const prisma = new PrismaClient();
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86400000);

const FIRST = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Lucas", "Mia", "Amir", "Nadia", "Rahim", "Farah", "Kenji", "Aiko", "Carlos", "Lucia", "Hans"];
const LAST = ["Smith", "Johnson", "Brown", "Khan", "Rahman", "Garcia", "Miller", "Davis", "Tanaka", "Silva", "Müller", "Chowdhury", "Patel", "Nguyen", "Wilson"];
const COMPANIES = [["Northwind Traders", "Retail"], ["Globex Logistics", "Logistics"], ["Initech Software", "SaaS"], ["Umbrella Health", "Healthcare"], ["Stark Fabrication", "Manufacturing"], ["Wayne Capital", "Finance"], ["Hooli Cloud", "SaaS"], ["Soylent Foods", "Food & Beverage"], ["Acme Education", "Education"], ["Pied Piper Media", "Media"], ["Vandelay Imports", "Retail"], ["Cyberdyne Robotics", "Technology"]];
const LOSS = ["Chose a competitor", "Budget cut", "No decision / went silent", "Price too high", "Missing feature"];

async function main() {
  await prisma.organization.deleteMany({ where: { slug: "acme-demo" } });
  await prisma.user.deleteMany({ where: { email: { in: ["admin@salesflow.dev", "manager@salesflow.dev", "rep@salesflow.dev", "rep2@salesflow.dev"] } } });
  const hash = await bcrypt.hash("Password123!", 10);
  const org = await prisma.organization.create({ data: { name: "Acme Industries", slug: "acme-demo", currency: "USD", monthlyTarget: 60000, leadSources: defaultSources() } });
  const mk = async (email: string, name: string, role: "ADMIN" | "SALES_MANAGER" | "SALES_REP") =>
    prisma.user.create({ data: { email, name, passwordHash: hash, memberships: { create: { orgId: org.id, role } } } });
  const admin = await mk("admin@salesflow.dev", "Alex Admin", "ADMIN");
  const manager = await mk("manager@salesflow.dev", "Maya Manager", "SALES_MANAGER");
  const rep1 = await mk("rep@salesflow.dev", "Riley Rep", "SALES_REP");
  const rep2 = await mk("rep2@salesflow.dev", "Sam Seller", "SALES_REP");
  const sellers = [manager, rep1, rep2];

  await prisma.dealStage.createMany({ data: defaultStageRows(org.id) });
  const stages = await prisma.dealStage.findMany({ where: { orgId: org.id }, orderBy: { position: "asc" } });

  const companies = [];
  for (const [name, industry] of COMPANIES) companies.push(await prisma.company.create({ data: { orgId: org.id, name, industry, website: `https://${name.split(" ")[0].toLowerCase()}.example.com`, tags: [pick(["enterprise", "smb", "strategic", "partner"])] } }));

  const contacts = [];
  for (let i = 0; i < 28; i++) {
    const f = pick(FIRST), l = pick(LAST), c = pick(companies);
    contacts.push(await prisma.contact.create({ data: { orgId: org.id, firstName: f, lastName: l, email: `${f}.${l}${i}@${c.name.split(" ")[0].toLowerCase()}.example.com`.toLowerCase(), phone: `+1 555 01${String(i).padStart(2, "0")}`, jobTitle: pick(["CEO", "CTO", "VP Sales", "Procurement Lead", "Operations Manager"]), companyId: c.id, tags: rnd() > 0.6 ? ["decision-maker"] : [] } }));
  }

  const statuses = ["NEW", "NEW", "CONTACTED", "CONTACTED", "QUALIFIED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"] as const;
  const leads = [];
  for (let i = 0; i < 72; i++) {
    const f = pick(FIRST), l = pick(LAST), co = pick(COMPANIES)[0];
    leads.push(await prisma.lead.create({ data: {
      orgId: org.id, name: `${f} ${l}`, email: `${f}.${l}.lead${i}@example.com`.toLowerCase(), phone: `+1 555 02${String(i).padStart(2, "0")}`, companyName: co,
      source: pick(defaultSources()), status: pick(statuses), priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"] as const), value: Math.round((2000 + rnd() * 48000) / 500) * 500,
      followUpAt: rnd() > 0.5 ? daysAhead(Math.floor(rnd() * 14) - 2) : null, assignedToId: i % 11 === 0 ? null : pick(sellers).id, archivedAt: i % 17 === 0 ? daysAgo(5) : null, createdAt: daysAgo(Math.floor(rnd() * 170)),
      notes: rnd() > 0.7 ? "Interested in annual plan; asked for references." : null,
    } }));
  }

  const open = stages.filter((s) => s.kind === "OPEN"), won = stages.find((s) => s.kind === "WON")!, lost = stages.find((s) => s.kind === "LOST")!;
  const deals = [];
  for (let i = 0; i < 40; i++) {
    const roll = rnd();
    const stage = roll < 0.22 ? won : roll < 0.34 ? lost : pick(open);
    const closed = stage.kind !== "OPEN";
    const c = pick(companies), ct = contacts.find((x) => x.companyId === c.id) ?? pick(contacts);
    deals.push(await prisma.deal.create({ data: {
      orgId: org.id, title: `${c.name} — ${pick(["Annual license", "Pilot", "Expansion", "Platform rollout", "Support plan"])}`, value: Math.round((5000 + rnd() * 70000) / 500) * 500,
      probability: stage.probability, expectedCloseAt: daysAhead(Math.floor(rnd() * 60) - 10), stageId: stage.id, ownerId: pick(sellers).id, contactId: ct.id, companyId: c.id,
      closedAt: closed ? daysAgo(Math.floor(rnd() * 175)) : null, lossReason: stage.kind === "LOST" ? pick(LOSS) : null, createdAt: daysAgo(180 - Math.floor(rnd() * 60)),
    } }));
  }

  for (let i = 0; i < 36; i++) {
    const lead = pick(leads);
    await prisma.task.create({ data: { orgId: org.id, title: pick(["Intro call", "Send proposal", "Demo walkthrough", "Check in on contract", "Share pricing", "Follow-up email"]) + ` — ${lead.name}`, type: pick(["CALL", "MEETING", "EMAIL", "TASK"] as const), priority: pick(["LOW", "MEDIUM", "HIGH"] as const), dueAt: daysAhead(Math.floor(rnd() * 24) - 6), reminderAt: i % 6 === 0 ? daysAhead(0) : null, completedAt: rnd() > 0.65 ? daysAgo(Math.floor(rnd() * 20)) : null, assigneeId: pick(sellers).id, leadId: lead.id } });
  }
  for (let i = 0; i < 70; i++) {
    const lead = pick(leads), u = pick(sellers);
    if (rnd() > 0.5) await prisma.activity.create({ data: { orgId: org.id, type: pick(["CALL", "MEETING", "EMAIL"] as const), subject: pick(["Discovery call", "Pricing discussion", "Sent intro deck", "Demo scheduled", "Contract review"]), body: "Discussed requirements, timeline and budget.", userId: u.id, leadId: lead.id, occurredAt: daysAgo(Math.floor(rnd() * 30)) } });
    else await prisma.note.create({ data: { orgId: org.id, body: pick(["Prefers email over phone.", "Needs approval from finance.", "Evaluating two vendors.", "Strong champion on their side."]), authorId: u.id, leadId: lead.id, createdAt: daysAgo(Math.floor(rnd() * 30)) } });
  }

  await prisma.automationRule.createMany({ data: [
    { orgId: org.id, name: "Route new leads & schedule first call", trigger: "LEAD_CREATED", createdById: admin.id, conditions: [], actions: [{ type: "ASSIGN_ROUND_ROBIN" }, { type: "CREATE_TASK", title: "First call with {{name}}", dueInDays: 1, taskType: "CALL", priority: "HIGH" }] },
    { orgId: org.id, name: "Alert owner when a high-value lead is qualified", trigger: "LEAD_STATUS_CHANGED", createdById: admin.id, conditions: [{ field: "status", op: "eq", value: "QUALIFIED" }, { field: "value", op: "gte", value: 20000 }], actions: [{ type: "NOTIFY_OWNER", message: "High-value lead {{name}} is qualified ({{value}})" }, { type: "SEND_EMAIL", to: "owner", subject: "Qualified: {{name}}", body: "{{name}} is now qualified. Time to send a proposal." }] },
    { orgId: org.id, name: "Create contract follow-up when deal enters Negotiation", trigger: "DEAL_STAGE_CHANGED", createdById: admin.id, conditions: [{ field: "stage", op: "eq", value: "Negotiation" }], actions: [{ type: "CREATE_TASK", title: "Review contract terms for {{name}}", dueInDays: 3, taskType: "TASK", priority: "MEDIUM" }] },
  ] });
  await prisma.notification.createMany({ data: [admin, manager, rep1].map((u) => ({ orgId: org.id, userId: u.id, title: "Welcome to SalesFlow CRM 👋", body: "Your demo workspace is loaded with sample data.", href: "/dashboard" })) });
  console.log(`Seeded ${leads.length} leads, ${contacts.length} contacts, ${companies.length} companies, ${deals.length} deals.\nLogin: admin@salesflow.dev / manager@salesflow.dev / rep@salesflow.dev  —  Password123!`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
