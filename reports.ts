import { prisma } from "./db";
import { ownScope, type Session } from "./auth";
import { can } from "./permissions";
import { monthKey, monthLabel, pct } from "./utils";

export type ReportData = Awaited<ReturnType<typeof getReport>>;

export async function getReport(s: Session, days: number) {
  const since = new Date(Date.now() - days * 86400000);
  const leadWhere = { ...ownScope(s, "assignedToId"), createdAt: { gte: since } };
  const dealScope = ownScope(s, "ownerId");

  const [leads, closedDeals, openDeals, stages, members, doneTasks] = await Promise.all([
    prisma.lead.findMany({ where: leadWhere, select: { source: true, status: true, assignedToId: true } }),
    prisma.deal.findMany({ where: { ...dealScope, closedAt: { gte: since } }, include: { stage: true, owner: { select: { name: true } } } }),
    prisma.deal.findMany({ where: { ...dealScope, stage: { kind: "OPEN" } }, select: { value: true, probability: true } }),
    prisma.dealStage.findMany({ where: { orgId: s.orgId }, orderBy: { position: "asc" } }),
    prisma.membership.findMany({ where: { orgId: s.orgId, active: true }, include: { user: { select: { id: true, name: true } } } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { orgId: s.orgId, completedAt: { gte: since } }, _count: { _all: true } }),
  ]);

  const won = closedDeals.filter((d) => d.stage.kind === "WON");
  const lost = closedDeals.filter((d) => d.stage.kind === "LOST");
  const revenue = won.reduce((a, d) => a + d.value, 0);

  const monthly = new Map<string, { won: number; lost: number }>();
  const months = Math.max(2, Math.min(13, Math.ceil(days / 30)));
  for (let i = months - 1; i >= 0; i--) { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); monthly.set(monthKey(d), { won: 0, lost: 0 }); }
  for (const d of closedDeals) { const m = monthly.get(monthKey(d.closedAt!)); if (m) (d.stage.kind === "WON" ? (m.won += d.value) : (m.lost += d.value)); }
  const revenueByMonth = [...monthly].map(([k, v]) => ({ month: monthLabel(k), revenue: v.won, lost: v.lost }));

  const sourceMap = new Map<string, { leads: number; converted: number }>();
  for (const l of leads) { const x = sourceMap.get(l.source) ?? { leads: 0, converted: 0 }; x.leads++; if (l.status === "CONVERTED") x.converted++; sourceMap.set(l.source, x); }
  const sources = [...sourceMap].map(([source, v]) => ({ source, ...v, rate: pct(v.converted, v.leads) })).sort((a, b) => b.leads - a.leads);

  const count = (st: string[]) => leads.filter((l) => st.includes(l.status)).length;
  const funnel = [
    { stage: "Leads", count: leads.length },
    { stage: "Contacted+", count: count(["CONTACTED", "QUALIFIED", "CONVERTED"]) },
    { stage: "Qualified+", count: count(["QUALIFIED", "CONVERTED"]) },
    { stage: "Converted", count: count(["CONVERTED"]) },
    { stage: "Deals won", count: won.length },
  ];

  const lossReasons = new Map<string, number>();
  for (const d of lost) lossReasons.set(d.lossReason || "Not specified", (lossReasons.get(d.lossReason || "Not specified") ?? 0) + 1);

  const viewAll = can(s.role, "reports:team");
  const doneMap = new Map(doneTasks.map((t) => [t.assigneeId, t._count._all]));
  const team = members.filter((m) => viewAll || m.userId === s.userId).map((m) => {
    const mine = won.filter((d) => d.ownerId === m.userId);
    const myLeads = leads.filter((l) => l.assignedToId === m.userId);
    return { name: m.user.name, leads: myLeads.length, converted: myLeads.filter((l) => l.status === "CONVERTED").length, dealsWon: mine.length, revenue: mine.reduce((a, d) => a + d.value, 0), tasksDone: doneMap.get(m.userId) ?? 0 };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    days, revenue, wonCount: won.length, lostCount: lost.length,
    winRate: pct(won.length, won.length + lost.length), avgDeal: won.length ? Math.round(revenue / won.length) : 0,
    pipelineValue: openDeals.reduce((a, d) => a + d.value, 0), weighted: Math.round(openDeals.reduce((a, d) => a + (d.value * d.probability) / 100, 0)),
    totalLeads: leads.length, conversionRate: pct(count(["CONVERTED"]), leads.length),
    revenueByMonth, sources, funnel, team, stages: stages.map((x) => x.name),
    lossReasons: [...lossReasons].map(([reason, n]) => ({ reason, count: n })).sort((a, b) => b.count - a.count),
    deals: closedDeals.map((d) => ({ title: d.title, outcome: d.stage.kind, value: d.value, owner: d.owner?.name ?? "", closedAt: d.closedAt!, lossReason: d.lossReason ?? "" })),
  };
}
