"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Pencil, Plus, RotateCw, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/dialog";
import { CONDITION_FIELDS, LEAD_STATUSES, PRIORITIES, STATUS_LABEL, TASK_TYPES, TRIGGERS, TRIGGER_LABEL, type Trigger } from "@/lib/constants";
import { ruleSchema, type ActionDef, type Condition, type RuleInput } from "@/lib/validators";
import { deleteRuleAction, retryRunAction, saveRuleAction, toggleRuleAction } from "@/actions/automation";

export type RuleRow = { id: string; name: string; trigger: Trigger; conditions: Condition[]; actions: ActionDef[]; active: boolean };
const ACTION_LABEL: Record<ActionDef["type"], string> = { ASSIGN_ROUND_ROBIN: "Auto-assign lead (round-robin)", CREATE_TASK: "Create follow-up task", SEND_EMAIL: "Send email notification", SET_LEAD_STATUS: "Update lead status", NOTIFY_OWNER: "Send in-app notification" };
const OP_LABEL = { eq: "is", neq: "is not", gte: "≥", lte: "≤", contains: "contains" } as const;
export const describeAction = (a: ActionDef) => ({ ASSIGN_ROUND_ROBIN: "Assign to least-busy rep", CREATE_TASK: `Task “${(a as { title?: string }).title}” in ${(a as { dueInDays?: number }).dueInDays}d`, SEND_EMAIL: `Email ${(a as { to?: string }).to}`, SET_LEAD_STATUS: `Set status ${(a as { status?: string }).status}`, NOTIFY_OWNER: "Notify owner" } as const)[a.type];

function newAction(type: ActionDef["type"]): ActionDef {
  switch (type) {
    case "ASSIGN_ROUND_ROBIN": return { type };
    case "CREATE_TASK": return { type, title: "Follow up with {{name}}", dueInDays: 2, taskType: "CALL", priority: "MEDIUM" };
    case "SEND_EMAIL": return { type, to: "owner", subject: "New lead: {{name}}", body: "Hi,\n\n{{name}} just entered your pipeline (value {{value}}). Please follow up soon." };
    case "SET_LEAD_STATUS": return { type, status: "CONTACTED" };
    case "NOTIFY_OWNER": return { type, message: "{{name}} needs your attention" };
  }
}

export function RuleDialog({ open, onOpenChange, rule }: { open: boolean; onOpenChange: (o: boolean) => void; rule?: RuleRow }) {
  const router = useRouter();
  const [name, setName] = useState(rule?.name ?? "");
  const [trigger, setTrigger] = useState<Trigger>(rule?.trigger ?? "LEAD_CREATED");
  const [conditions, setConditions] = useState<Condition[]>(rule?.conditions ?? []);
  const [actions, setActions] = useState<ActionDef[]>(rule?.actions ?? [newAction("CREATE_TASK")]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const family = trigger === "DEAL_STAGE_CHANGED" ? "deal" : "lead";
  const fields = CONDITION_FIELDS[family];
  const patchAction = (i: number, p: Partial<ActionDef>) => setActions((a) => a.map((x, j) => (j === i ? ({ ...x, ...p } as ActionDef) : x)));

  const save = async () => {
    const input: RuleInput = { name, trigger, conditions, actions };
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.errors[0].message);
    setBusy(true); setError("");
    const r = await saveRuleAction(rule?.id ?? null, input);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(rule ? "Rule updated" : "Rule created"); onOpenChange(false); router.refresh();
  };
  const allowed = (Object.keys(ACTION_LABEL) as ActionDef["type"][]).filter((t) => family === "lead" || (t !== "ASSIGN_ROUND_ROBIN" && t !== "SET_LEAD_STATUS"));

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={rule ? "Edit automation rule" : "New automation rule"} description="WHEN something happens, IF conditions match, THEN run actions. Use {{name}}, {{status}}, {{value}}, {{owner}} in text." wide>
      <div className="space-y-5">
        <Field label="Rule name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Route & follow up new web leads" /></Field>
        <section className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">When</p>
          <Select value={trigger} onChange={(e) => { const t = e.target.value as Trigger; setTrigger(t); setConditions([]); if (t === "DEAL_STAGE_CHANGED") setActions((a) => a.filter((x) => x.type !== "ASSIGN_ROUND_ROBIN" && x.type !== "SET_LEAD_STATUS")); }}>{TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}</Select>
        </section>
        <section className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-primary">If (all must match)</p>
            <Button size="sm" variant="ghost" onClick={() => setConditions((c) => [...c, { field: fields[0].key, op: "eq", value: "" }])}><Plus className="h-3.5 w-3.5" /> Condition</Button></div>
          {conditions.length === 0 && <p className="text-xs text-muted-foreground">No conditions — the rule runs every time.</p>}
          {conditions.map((c, i) => {
            const f = fields.find((x) => x.key === c.field) ?? fields[0];
            const set = (p: Partial<Condition>) => setConditions((cs) => cs.map((x, j) => (j === i ? { ...x, ...p } : x)));
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select className="w-auto" value={c.field} onChange={(e) => set({ field: e.target.value, value: "" })}>{fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</Select>
                <Select className="w-auto" value={c.op} onChange={(e) => set({ op: e.target.value as Condition["op"] })}>{(Object.keys(OP_LABEL) as (keyof typeof OP_LABEL)[]).map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}</Select>
                {f.options ? <Select className="w-auto" value={String(c.value)} onChange={(e) => set({ value: e.target.value })}><option value="">Choose…</option>{f.options.map((o) => <option key={o}>{o}</option>)}</Select>
                  : <Input className="w-40" value={String(c.value)} onChange={(e) => set({ value: f.key === "value" ? Number(e.target.value) || 0 : e.target.value })} placeholder={f.key === "value" ? "10000" : "value"} />}
                <Button size="icon" variant="ghost" aria-label="Remove condition" onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </section>
        <section className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Then</p>
            <Select className="w-auto" value="" onChange={(e) => { if (e.target.value) setActions((a) => [...a, newAction(e.target.value as ActionDef["type"])]); }}><option value="">+ Add action…</option>{allowed.map((t) => <option key={t} value={t}>{ACTION_LABEL[t]}</option>)}</Select></div>
          {actions.map((a, i) => (
            <div key={i} className="space-y-2 rounded-md bg-muted/50 p-3">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">{i + 1}. {ACTION_LABEL[a.type]}</span><Button size="icon" variant="ghost" aria-label="Remove action" onClick={() => setActions((x) => x.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button></div>
              {a.type === "ASSIGN_ROUND_ROBIN" && <p className="text-xs text-muted-foreground">Gives unassigned leads to the active sales user with the fewest open leads. Already-assigned leads are left alone.</p>}
              {a.type === "CREATE_TASK" && <div className="grid gap-2 sm:grid-cols-3"><Input className="sm:col-span-3" value={a.title} onChange={(e) => patchAction(i, { title: e.target.value })} placeholder="Task title" />
                <Select value={a.taskType} onChange={(e) => patchAction(i, { taskType: e.target.value as never })}>{TASK_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
                <Select value={a.priority} onChange={(e) => patchAction(i, { priority: e.target.value as never })}>{PRIORITIES.map((t) => <option key={t}>{t}</option>)}</Select>
                <Input type="number" min={0} value={a.dueInDays} onChange={(e) => patchAction(i, { dueInDays: Number(e.target.value) || 0 })} aria-label="Due in days" title="Due in (days)" /></div>}
              {a.type === "SEND_EMAIL" && <div className="space-y-2"><Select value={a.to} onChange={(e) => patchAction(i, { to: e.target.value as never })}><option value="owner">To the record owner</option><option value="lead">To the lead's email</option></Select>
                <Input value={a.subject} onChange={(e) => patchAction(i, { subject: e.target.value })} placeholder="Subject" /><Textarea value={a.body} onChange={(e) => patchAction(i, { body: e.target.value })} /></div>}
              {a.type === "SET_LEAD_STATUS" && <Select value={a.status} onChange={(e) => patchAction(i, { status: e.target.value as never })}>{LEAD_STATUSES.map((t) => <option key={t} value={t}>{STATUS_LABEL[t]}</option>)}</Select>}
              {a.type === "NOTIFY_OWNER" && <Input value={a.message} onChange={(e) => patchAction(i, { message: e.target.value })} placeholder="Notification text" />}
            </div>
          ))}
        </section>
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={busy} onClick={save}>{rule ? "Save rule" : "Create rule"}</Button></div>
      </div>
    </Modal>
  );
}

export function NewRuleButton() {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New rule</Button>{open && <RuleDialog open={open} onOpenChange={setOpen} />}</>;
}

export function RuleControls({ rule }: { rule: RuleRow }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <button role="switch" aria-checked={rule.active} aria-label={rule.active ? "Disable rule" : "Enable rule"} onClick={async () => { const r = await toggleRuleAction(rule.id, !rule.active); if (!r.ok) toast.error(r.error); else { toast.success(rule.active ? "Rule paused" : "Rule enabled"); router.refresh(); } }}
        className={`relative h-5 w-9 rounded-full transition-colors ${rule.active ? "bg-primary" : "bg-muted-foreground/30"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${rule.active ? "left-[18px]" : "left-0.5"}`} /></button>
      <Button variant="ghost" size="icon" aria-label="Edit rule" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /></Button>
      <ConfirmDialog title="Delete rule?" description={`“${rule.name}” and its execution history will be removed.`} onConfirm={async () => { const r = await deleteRuleAction(rule.id); if (!r.ok) return void toast.error(r.error); toast.success("Rule deleted"); router.refresh(); }} trigger={<Button variant="ghost" size="icon" aria-label="Delete rule"><Trash2 className="h-4 w-4 text-destructive" /></Button>} />
      {edit && <RuleDialog open={edit} onOpenChange={setEdit} rule={rule} />}
    </div>
  );
}

export function RetryButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <Button size="sm" variant="outline" loading={busy} onClick={async () => { setBusy(true); const r = await retryRunAction(runId); setBusy(false); if (!r.ok) toast.error(r.error); else { toast.success("Retry finished"); router.refresh(); } }}><RotateCw className="h-3.5 w-3.5" /> Retry</Button>;
}
export { Mail, UserPlus };
