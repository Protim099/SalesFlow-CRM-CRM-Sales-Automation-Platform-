import type { Metadata } from "next";
import Link from "next/link";
import { Download, Target } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { leadOrder, leadWhere, type LeadParams } from "@/lib/lead-query";
import { LEAD_STATUSES, PRIORITIES, STATUS_LABEL } from "@/lib/constants";
import { fmtDate, fmtMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { FilterBar, Pagination, SortHeader } from "@/components/filters";
import { ImportLeadsButton, LeadActions, NewLeadButton, PriorityBadge, StatusBadge, type LeadRow } from "@/components/lead-ui";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";
const PAGE = 12;

export default async function LeadsPage({ searchParams }: { searchParams: LeadParams }) {
  const s = await requireSession();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const where = leadWhere(s, searchParams);
  const canAssign = can(s.role, "leads:assign");
  const [total, leads, members] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, orderBy: leadOrder(searchParams), skip: (page - 1) * PAGE, take: PAGE, include: { assignedTo: { select: { name: true } } } }),
    prisma.membership.findMany({ where: { orgId: s.orgId, active: true }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  const people = members.map((m) => ({ id: m.user.id, name: m.user.name }));
  const exportQs = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  const rows: (LeadRow & { assignee: string })[] = leads.map((l) => ({ id: l.id, name: l.name, email: l.email, phone: l.phone, companyName: l.companyName, source: l.source, status: l.status, priority: l.priority, value: l.value, notes: l.notes, followUpAt: l.followUpAt?.toISOString() ?? null, assignedToId: l.assignedToId, archived: !!l.archivedAt, assignee: l.assignedTo?.name ?? "" }));
  const p = searchParams as Record<string, string | undefined>;

  return (
    <>
      <PageHeader title="Leads" description={`${total.toLocaleString()} ${searchParams.archived === "1" ? "archived" : "active"} leads`}
        actions={<><ImportLeadsButton /><Button variant="outline" asChild><a href={`/api/leads/export?${exportQs}`}><Download className="h-4 w-4" /> Export</a></Button><NewLeadButton members={people} sources={s.org.leadSources} canAssign={canAssign} /></>} />
      <Card>
        <div className="border-b p-4">
          <FilterBar placeholder="Search name, email, company…" fields={[
            { name: "status", label: "All statuses", options: LEAD_STATUSES.map((v) => ({ value: v, label: STATUS_LABEL[v] })) },
            { name: "priority", label: "All priorities", options: PRIORITIES.map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() })) },
            { name: "source", label: "All sources", options: s.org.leadSources.map((v) => ({ value: v, label: v })) },
            ...(canAssign ? [{ name: "assignee", label: "Any owner", options: [{ value: "none", label: "Unassigned" }, ...people.map((m) => ({ value: m.id, label: m.name }))] }] : []),
            { name: "archived", label: "Active", options: [{ value: "1", label: "Archived" }] },
          ]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Target className="h-5 w-5" />} title="No leads found" hint="Try different filters, import a CSV, or add your first lead." action={<NewLeadButton members={people} sources={s.org.leadSources} canAssign={canAssign} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr>
                <th><SortHeader base="/leads" params={p} field="name" label="Lead" /></th><th><SortHeader base="/leads" params={p} field="status" label="Status" /></th>
                <th><SortHeader base="/leads" params={p} field="priority" label="Priority" /></th><th>Source</th>
                <th className="text-right"><SortHeader base="/leads" params={p} field="value" label="Value" /></th><th>Owner</th>
                <th><SortHeader base="/leads" params={p} field="followUpAt" label="Follow-up" /></th><th className="w-12"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>{rows.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/leads/${l.id}`} className="font-medium hover:text-primary">{l.name}</Link><p className="text-xs text-muted-foreground">{[l.companyName, l.email].filter(Boolean).join(" · ")}</p></td>
                  <td><StatusBadge status={l.status} /></td><td><PriorityBadge priority={l.priority} /></td>
                  <td className="text-muted-foreground">{l.source}</td><td className="text-right tabular-nums">{fmtMoney(l.value, s.org.currency)}</td>
                  <td className="text-muted-foreground">{l.assignee || "—"}</td><td className="text-muted-foreground">{fmtDate(l.followUpAt)}</td>
                  <td><LeadActions lead={l} members={people} sources={s.org.leadSources} canAssign={canAssign} canDelete={can(s.role, "records:delete")} /></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
        {total > 0 && <Pagination base="/leads" params={p} page={page} pageSize={PAGE} total={total} />}
      </Card>
    </>
  );
}
