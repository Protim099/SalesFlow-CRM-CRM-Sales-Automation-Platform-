"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, CalendarClock, GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { dealSchema, type DealInput } from "@/lib/validators";
import { createDealAction, moveDealAction, updateDealAction } from "@/actions/deals";
import { cn, fmtCompact, fmtDate, toInputDate } from "@/lib/utils";
import type { StageKind } from "@/lib/constants";

export type DealCard = { id: string; title: string; value: number; probability: number; expectedCloseAt: string | null; stageId: string; owner: string; ownerId: string | null; company: string; companyId: string | null; contactId: string | null; lossReason: string | null };
export type StageCol = { id: string; name: string; kind: StageKind; probability: number };
type Opt = { id: string; name: string };

export function DealFormDialog({ open, onOpenChange, deal, stages, members, contacts, companies, canAssign, defaultStageId }: { open: boolean; onOpenChange: (o: boolean) => void; deal?: DealCard; stages: StageCol[]; members: Opt[]; contacts: Opt[]; companies: Opt[]; canAssign: boolean; defaultStageId?: string }) {
  const router = useRouter();
  const first = stages.find((s) => s.kind === "OPEN") ?? stages[0];
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<DealInput>({
    resolver: zodResolver(dealSchema),
    values: { title: deal?.title ?? "", value: deal?.value ?? 0, probability: deal?.probability ?? first?.probability ?? 10, expectedCloseAt: toInputDate(deal?.expectedCloseAt), stageId: deal?.stageId ?? defaultStageId ?? first?.id ?? "", ownerId: deal?.ownerId ?? "", contactId: deal?.contactId ?? "", companyId: deal?.companyId ?? "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    const r = deal ? await updateDealAction(deal.id, v) : await createDealAction(v);
    if (!r.ok) return void toast.error(r.error);
    toast.success(deal ? "Deal updated" : "Deal created"); onOpenChange(false); if (!deal) reset(); router.refresh();
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={deal ? "Edit deal" : "New deal"} wide>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Title *" className="sm:col-span-2" error={errors.title?.message}><Input {...register("title")} autoFocus /></Field>
        <Field label="Value" error={errors.value?.message}><Input type="number" min={0} {...register("value", { valueAsNumber: true })} /></Field>
        <Field label="Win probability %" error={errors.probability?.message}><Input type="number" min={0} max={100} {...register("probability", { valueAsNumber: true })} /></Field>
        <Field label="Stage">
          <Select disabled={!!deal} {...register("stageId", { onChange: (e) => { const st = stages.find((x) => x.id === e.target.value); if (st) setValue("probability", st.probability); } })}>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Expected close date"><Input type="date" {...register("expectedCloseAt")} /></Field>
        {canAssign && <Field label="Owner"><Select {...register("ownerId")}><option value="">Me</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>}
        <Field label="Contact"><Select {...register("contactId")}><option value="">None</option>{contacts.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        <Field label="Company"><Select {...register("companyId")}><option value="">None</option>{companies.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" loading={isSubmitting}>{deal ? "Save" : "Create deal"}</Button></div>
      </form>
    </Modal>
  );
}

export function NewDealButton(props: Omit<React.ComponentProps<typeof DealFormDialog>, "open" | "onOpenChange" | "deal">) {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New deal</Button><DealFormDialog open={open} onOpenChange={setOpen} {...props} /></>;
}

export function KanbanBoard({ stages, deals: initial, currency }: { stages: StageCol[]; deals: DealCard[]; currency: string }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lossFor, setLossFor] = useState<{ deal: DealCard; stage: StageCol } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // keep in sync after router.refresh()
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) { setPrev(initial); setDeals(initial); }

  const commit = async (deal: DealCard, stage: StageCol, lossReason?: string) => {
    const snapshot = deals;
    setDeals((d) => d.map((x) => (x.id === deal.id ? { ...x, stageId: stage.id, probability: stage.probability, lossReason: lossReason ?? null } : x)));
    const r = await moveDealAction(deal.id, stage.id, lossReason);
    if (!r.ok) { setDeals(snapshot); toast.error(r.error); return false; }
    toast.success(`Moved to ${stage.name}`); router.refresh(); return true;
  };
  const onDrop = (stage: StageCol) => {
    setOver(null);
    const deal = deals.find((d) => d.id === dragId); setDragId(null);
    if (!deal || deal.stageId === stage.id) return;
    if (stage.kind === "LOST") { setReason(""); setLossFor({ deal, stage }); } else void commit(deal, stage);
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4" role="list" aria-label="Sales pipeline">
        {stages.map((st) => {
          const col = deals.filter((d) => d.stageId === st.id);
          const total = col.reduce((a, d) => a + d.value, 0);
          return (
            <section key={st.id} role="listitem" aria-label={st.name}
              onDragOver={(e) => { e.preventDefault(); setOver(st.id); }} onDragLeave={() => setOver((o) => (o === st.id ? null : o))} onDrop={() => onDrop(st)}
              className={cn("flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors", over === st.id && "border-primary bg-accent/50")}>
              <header className="flex items-center justify-between px-3 py-3">
                <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", st.kind === "WON" ? "bg-emerald-500" : st.kind === "LOST" ? "bg-rose-500" : "bg-indigo-500")} /><h3 className="text-sm font-semibold">{st.name}</h3><span className="rounded-full bg-card px-2 text-xs text-muted-foreground">{col.length}</span></div>
                <span className="text-xs font-medium text-muted-foreground">{fmtCompact(total)}</span>
              </header>
              <div className="min-h-[120px] flex-1 space-y-2 px-2 pb-2">
                {col.length === 0 && <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">Drop deals here</p>}
                {col.map((d) => (
                  <article key={d.id} draggable onDragStart={() => setDragId(d.id)} onDragEnd={() => { setDragId(null); setOver(null); }}
                    className={cn("cursor-grab rounded-md border bg-card p-3 shadow-soft active:cursor-grabbing", dragId === d.id && "opacity-50")}>
                    <div className="flex items-start gap-1.5"><GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/deals/${d.id}`} className="block truncate text-sm font-medium hover:text-primary" draggable={false}>{d.title}</Link>
                        {d.company && <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><Building2 className="h-3 w-3" />{d.company}</p>}
                        <div className="mt-2 flex items-center justify-between"><span className="text-sm font-semibold tabular-nums">{new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(d.value)}</span><span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">{d.probability}%</span></div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDate(d.expectedCloseAt)}</span><span className="truncate pl-2">{d.owner || "Unassigned"}</span></div>
                        {st.kind === "LOST" && d.lossReason && <p className="mt-2 rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-700 dark:text-rose-300">Lost: {d.lossReason}</p>}
                      </div></div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <Modal open={!!lossFor} onOpenChange={(o) => !o && setLossFor(null)} title="Mark deal as lost" description={lossFor ? `Why did “${lossFor.deal.title}” fall through?` : undefined}>
        <div className="space-y-4">
          <Field label="Loss reason *"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Chose a competitor, budget cut, no response…" autoFocus /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setLossFor(null)}>Cancel</Button>
            <Button variant="destructive" loading={busy} disabled={!reason.trim()} onClick={async () => { if (!lossFor) return; setBusy(true); const ok = await commit(lossFor.deal, lossFor.stage, reason); setBusy(false); if (ok) setLossFor(null); }}>Mark as lost</Button></div>
        </div>
      </Modal>
    </>
  );
}
