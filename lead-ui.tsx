"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowRightCircle, Eye, MoreHorizontal, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/card";
import { LEAD_STATUSES, PRIORITIES, PRIORITY_STYLE, STATUS_LABEL, STATUS_STYLE, type LeadStatus, type Priority } from "@/lib/constants";
import { leadSchema, type LeadInput } from "@/lib/validators";
import { archiveLeadAction, assignLeadAction, convertLeadAction, createLeadAction, deleteLeadAction, setLeadStatusAction, updateLeadAction } from "@/actions/leads";
import { toInputDate } from "@/lib/utils";

export type LeadRow = { id: string; name: string; email: string | null; phone: string | null; companyName: string | null; source: string; status: LeadStatus; priority: Priority; value: number; notes: string | null; followUpAt: string | null; assignedToId: string | null; archived: boolean };
type Member = { id: string; name: string };

export const StatusBadge = ({ status }: { status: LeadStatus }) => <Badge className={STATUS_STYLE[status]}>{STATUS_LABEL[status]}</Badge>;
export const PriorityBadge = ({ priority }: { priority: Priority }) => <Badge className={PRIORITY_STYLE[priority]}>{priority[0] + priority.slice(1).toLowerCase()}</Badge>;

export function LeadFormDialog({ open, onOpenChange, lead, members, sources, canAssign }: { open: boolean; onOpenChange: (o: boolean) => void; lead?: LeadRow; members: Member[]; sources: string[]; canAssign: boolean }) {
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    values: lead
      ? { name: lead.name, email: lead.email ?? "", phone: lead.phone ?? "", companyName: lead.companyName ?? "", source: lead.source, status: lead.status, priority: lead.priority, value: lead.value, notes: lead.notes ?? "", followUpAt: toInputDate(lead.followUpAt), assignedToId: lead.assignedToId ?? "" }
      : { name: "", email: "", phone: "", companyName: "", source: sources[0] ?? "Other", status: "NEW", priority: "MEDIUM", value: 0, notes: "", followUpAt: "", assignedToId: "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    const r = lead ? await updateLeadAction(lead.id, v) : await createLeadAction(v);
    if (!r.ok) return void toast.error(r.error);
    toast.success(lead ? "Lead updated" : "Lead created");
    onOpenChange(false); if (!lead) reset(); router.refresh();
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={lead ? "Edit lead" : "New lead"} description="Contact details, qualification and follow-up." wide>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name *" error={errors.name?.message}><Input {...register("name")} autoFocus /></Field>
        <Field label="Company" error={errors.companyName?.message}><Input {...register("companyName")} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
        <Field label="Phone" error={errors.phone?.message}><Input {...register("phone")} /></Field>
        <Field label="Source" error={errors.source?.message}><Select {...register("source")}>{Array.from(new Set([...sources, lead?.source ?? ""])).filter(Boolean).map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Estimated value" error={errors.value?.message}><Input type="number" min={0} step={1} {...register("value", { valueAsNumber: true })} /></Field>
        <Field label="Status"><Select {...register("status")}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select></Field>
        <Field label="Priority"><Select {...register("priority")}>{PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}</Select></Field>
        <Field label="Follow-up date"><Input type="date" {...register("followUpAt")} /></Field>
        {canAssign && <Field label="Assigned to"><Select {...register("assignedToId")}><option value="">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>}
        <Field label="Notes" className="sm:col-span-2" error={errors.notes?.message}><Textarea {...register("notes")} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{lead ? "Save changes" : "Create lead"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function NewLeadButton(props: { members: Member[]; sources: string[]; canAssign: boolean }) {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New lead</Button><LeadFormDialog open={open} onOpenChange={setOpen} {...props} /></>;
}

export function LeadActions({ lead, members, sources, canAssign, canDelete, detail }: { lead: LeadRow; members: Member[]; sources: string[]; canAssign: boolean; canDelete: boolean; detail?: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const run = async (p: Promise<{ ok: boolean; error?: string }>, ok: string) => { const r = await p; if (!r.ok) toast.error(r.error); else { toast.success(ok); router.refresh(); } return r; };
  return (
    <>
      <Menu>
        <MenuTrigger asChild><Button variant={detail ? "outline" : "ghost"} size={detail ? "default" : "icon"} aria-label="Lead actions"><MoreHorizontal className="h-4 w-4" />{detail && "Actions"}</Button></MenuTrigger>
        <MenuContent>
          {!detail && <MenuItem asChild><Link href={`/leads/${lead.id}`}><Eye className="h-4 w-4" /> View details</Link></MenuItem>}
          <MenuItem onSelect={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit</MenuItem>
          {lead.status !== "CONVERTED" && <MenuItem onSelect={async () => { const r = await convertLeadAction(lead.id); if (r.ok) { toast.success("Converted — deal created"); router.push(`/deals/${r.data.dealId}`); } else toast.error(r.error); }}><ArrowRightCircle className="h-4 w-4" /> Convert to deal</MenuItem>}
          {lead.status !== "QUALIFIED" && lead.status !== "CONVERTED" && <MenuItem onSelect={() => run(setLeadStatusAction(lead.id, "QUALIFIED"), "Marked qualified")}>Mark qualified</MenuItem>}
          {lead.status !== "UNQUALIFIED" && lead.status !== "CONVERTED" && <MenuItem onSelect={() => run(setLeadStatusAction(lead.id, "UNQUALIFIED"), "Marked unqualified")}>Mark unqualified</MenuItem>}
          {canAssign && members.length > 0 && <><MenuSeparator />{members.slice(0, 8).map((m) => <MenuItem key={m.id} disabled={m.id === lead.assignedToId} onSelect={() => run(assignLeadAction(lead.id, m.id), `Assigned to ${m.name}`)}>Assign → {m.name}</MenuItem>)}</>}
          <MenuSeparator />
          <MenuItem onSelect={() => run(archiveLeadAction(lead.id, !lead.archived), lead.archived ? "Lead restored" : "Lead archived")}>{lead.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}{lead.archived ? "Restore" : "Archive"}</MenuItem>
          {canDelete && <ConfirmDialog title="Delete this lead?" description={`“${lead.name}” and its notes, activities and tasks will be permanently removed. This cannot be undone.`}
            onConfirm={async () => { const r = await deleteLeadAction(lead.id); if (!r.ok) return void toast.error(r.error); toast.success("Lead deleted"); router.push("/leads"); router.refresh(); }}
            trigger={<MenuItem danger onSelect={(e) => e.preventDefault()}><Trash2 className="h-4 w-4" /> Delete</MenuItem>} />}
        </MenuContent>
      </Menu>
      <LeadFormDialog open={edit} onOpenChange={setEdit} lead={lead} members={members} sources={sources} canAssign={canAssign} />
    </>
  );
}

export function ImportLeadsButton() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; errorCount: number; errors: { row: number; message: string }[] } | null>(null);
  const [error, setError] = useState("");
  const upload = async () => {
    const file = ref.current?.files?.[0];
    if (!file) return setError("Choose a CSV file first.");
    setBusy(true); setError(""); setResult(null);
    const fd = new FormData(); fd.set("file", file);
    try {
      const r = await fetch("/api/leads/import", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "Import failed."); else { setResult(j); toast.success(`${j.imported} leads imported`); router.refresh(); }
    } catch { setError("Network error. Please try again."); } finally { setBusy(false); }
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Upload className="h-4 w-4" /> Import</Button>
      <Modal open={open} onOpenChange={setOpen} title="Import leads from CSV" description="Columns: Name (required), Email, Phone, Company, Source, Status, Priority, Value, Notes, Follow-up. Rows with an existing email are skipped.">
        <div className="space-y-4">
          <input ref={ref} type="file" accept=".csv,text/csv" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-foreground" />
          <a className="text-xs text-primary hover:underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent("Name,Email,Phone,Company,Source,Status,Priority,Value,Notes,Follow-up\nJane Cooper,jane@example.com,+1 555 0100,Acme Inc,Website,NEW,HIGH,12000,Met at expo,2026-12-01\n")}`} download="leads-template.csv">Download template</a>
          {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {result && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p><b>{result.imported}</b> imported · <b>{result.duplicates}</b> duplicates skipped · <b>{result.errorCount}</b> invalid</p>
              {result.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{result.errors.map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul>}
            </div>
          )}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Close</Button><Button onClick={upload} loading={busy}>Upload</Button></div>
        </div>
      </Modal>
    </>
  );
}
