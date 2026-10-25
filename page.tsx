import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requirePageAccess } from "@/lib/auth";
import { fmtDate, initials } from "@/lib/utils";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { AddMemberButton, MemberControls } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const s = await requirePageAccess("team:manage");
  const members = await prisma.membership.findMany({ where: { orgId: s.orgId }, include: { user: true }, orderBy: [{ active: "desc" }, { createdAt: "asc" }] });
  return (
    <>
      <PageHeader title="Team & roles" description="Admins manage everything. Sales managers see all records, run automation and reports. Sales reps work with their own leads, deals and tasks." actions={<AddMemberButton />} />
      <Card><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Member</th><th>Status</th><th>Joined</th><th className="text-right">Role & access</th></tr></thead>
        <tbody>{members.map((m) => (
          <tr key={m.id}>
            <td><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials(m.user.name)}</span><div><p className="font-medium">{m.user.name}{m.userId === s.userId && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</p><p className="text-xs text-muted-foreground">{m.user.email}</p></div></div></td>
            <td><Badge className={m.active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/10 text-slate-600"}>{m.active ? "Active" : "Deactivated"}</Badge></td>
            <td className="text-muted-foreground">{fmtDate(m.createdAt)}</td>
            <td><MemberControls userId={m.userId} role={m.role} active={m.active} self={m.userId === s.userId} /></td>
          </tr>))}</tbody>
      </table></div></Card>
    </>
  );
}
