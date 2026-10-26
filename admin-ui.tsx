"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/dialog";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CURRENCIES, ROLES, ROLE_LABEL, STAGE_KINDS, type Role, type StageKind } from "@/lib/constants";
import { changePasswordAction, createStageAction, deleteStageAction, moveStageAction, updateOrgAction, updateProfileAction, updateSourcesAction, updateStageAction, addMemberAction, setMemberActiveAction, updateMemberRoleAction } from "@/actions/settings";
import { memberSchema, orgSchema, passwordChangeSchema, profileSchema } from "@/lib/validators";
import type { z } from "zod";

const done = (r: { ok: boolean; error?: string }, msg: string, router: ReturnType<typeof useRouter>) => { if (!r.ok) toast.error(r.error); else { toast.success(msg); router.refresh(); } return r.ok; };

export function OrgForm({ org }: { org: { name: string; currency: string; timezone: string; monthlyTarget: number } }) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof orgSchema>>({ resolver: zodResolver(orgSchema), defaultValues: org });
  return (
    <Card><CardHeader><CardTitle>Company profile</CardTitle></CardHeader><CardBody>
      <form onSubmit={handleSubmit(async (v) => done(await updateOrgAction(v), "Company updated", router))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Company name" error={errors.name?.message}><Input {...register("name")} /></Field>
        <Field label="Currency"><Select {...register("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Time zone label"><Input {...register("timezone")} /></Field>
        <Field label="Monthly sales target" error={errors.monthlyTarget?.message}><Input type="number" min={0} {...register("monthlyTarget", { valueAsNumber: true })} /></Field>
        <div className="sm:col-span-2"><Button type="submit" loading={isSubmitting}>Save changes</Button></div>
      </form></CardBody></Card>
  );
}

export function SourcesEditor({ sources }: { sources: string[] }) {
  const router = useRouter();
  const [list, setList] = useState(sources);
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const add = () => { const t = v.trim(); if (t && !list.some((x) => x.toLowerCase() === t.toLowerCase())) setList([...list, t]); setV(""); };
  return (
    <Card><CardHeader><CardTitle>Lead sources</CardTitle></CardHeader><CardBody className="space-y-3">
      <div className="flex flex-wrap gap-2">{list.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">{s}<button aria-label={`Remove ${s}`} onClick={() => setList(list.filter((x) => x !== s))}><X className="h-3 w-3" /></button></span>)}</div>
      <div className="flex gap-2"><Input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add a source (e.g. Webinar)" className="max-w-xs" /><Button variant="outline" onClick={add}><Plus className="h-4 w-4" /> Add</Button></div>
      <Button loading={busy} onClick={async () => { setBusy(true); done(await updateSourcesAction(list), "Sources saved", router); setBusy(false); }}>Save sources</Button>
    </CardBody></Card>
  );
}

type Stage = { id: string; name: string; kind: StageKind; probability: number; deals: number };
export function StagesEditor({ stages }: { stages: Stage[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, Stage>>({});
  const [nw, setNw] = useState({ name: "", kind: "OPEN" as StageKind, probability: 20 });
  const cur = (s: Stage) => draft[s.id] ?? s;
  const patch = (s: Stage, p: Partial<Stage>) => setDraft((d) => ({ ...d, [s.id]: { ...cur(s), ...p } }));
  return (
    <Card><CardHeader><CardTitle>Sales stages</CardTitle></CardHeader><CardBody className="space-y-3">
      {stages.map((s, i) => { const c = cur(s); const dirty = !!draft[s.id]; return (
        <div key={s.id} className="flex flex-wrap items-center gap-2">
          <div className="flex"><Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={async () => done(await moveStageAction(s.id, -1), "Reordered", router)}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Move down" disabled={i === stages.length - 1} onClick={async () => done(await moveStageAction(s.id, 1), "Reordered", router)}><ArrowDown className="h-4 w-4" /></Button></div>
          <Input className="w-40" aria-label="Stage name" value={c.name} onChange={(e) => patch(s, { name: e.target.value })} />
          <Select className="w-auto" aria-label="Stage type" value={c.kind} onChange={(e) => patch(s, { kind: e.target.value as StageKind })}>{STAGE_KINDS.map((k) => <option key={k} value={k}>{k === "OPEN" ? "Open" : k === "WON" ? "Won (closed)" : "Lost (closed)"}</option>)}</Select>
          <Input className="w-20" type="number" min={0} max={100} aria-label="Probability" value={c.probability} onChange={(e) => patch(s, { probability: Number(e.target.value) })} /><span className="text-xs text-muted-foreground">%</span>
          {dirty && <Button size="sm" onClick={async () => { if (done(await updateStageAction(s.id, { name: c.name, kind: c.kind, probability: c.probability }), "Stage saved", router)) setDraft((d) => { const n = { ...d }; delete n[s.id]; return n; }); }}>Save</Button>}
          <span className="text-xs text-muted-foreground">{s.deals} deal{s.deals === 1 ? "" : "s"}</span>
          <ConfirmDialog title={`Delete “${s.name}”?`} description="Stages with deals can't be deleted. This cannot be undone." onConfirm={async () => { done(await deleteStageAction(s.id), "Stage deleted", router); }} trigger={<Button size="icon" variant="ghost" aria-label="Delete stage"><Trash2 className="h-4 w-4 text-destructive" /></Button>} />
        </div>); })}
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Input className="w-40" placeholder="New stage name" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
        <Select className="w-auto" value={nw.kind} onChange={(e) => setNw({ ...nw, kind: e.target.value as StageKind })}>{STAGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</Select>
        <Input className="w-20" type="number" min={0} max={100} value={nw.probability} onChange={(e) => setNw({ ...nw, probability: Number(e.target.value) })} />
        <Button variant="outline" onClick={async () => { if (done(await createStageAction(nw), "Stage added", router)) setNw({ name: "", kind: "OPEN", probability: 20 }); }}><Plus className="h-4 w-4" /> Add stage</Button>
      </div>
    </CardBody></Card>
  );
}

export function ProfileForms({ name, emailNotifications }: { name: string; emailNotifications: boolean }) {
  const router = useRouter();
  const p = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { name, emailNotifications } });
  const pw = useForm<z.infer<typeof passwordChangeSchema>>({ resolver: zodResolver(passwordChangeSchema) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Profile & notifications</CardTitle></CardHeader><CardBody>
        <form onSubmit={p.handleSubmit(async (v) => done(await updateProfileAction(v), "Profile saved", router))} className="space-y-4" noValidate>
          <Field label="Display name" error={p.formState.errors.name?.message}><Input {...p.register("name")} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" {...p.register("emailNotifications")} /> Email me about assigned leads, reminders and automation alerts</label>
          <Button type="submit" loading={p.formState.isSubmitting}>Save</Button>
        </form></CardBody></Card>
      <Card><CardHeader><CardTitle>Change password</CardTitle></CardHeader><CardBody>
        <form onSubmit={pw.handleSubmit(async (v) => { if (done(await changePasswordAction(v), "Password updated", router)) pw.reset(); })} className="space-y-4" noValidate>
          <Field label="Current password" error={pw.formState.errors.current?.message}><Input type="password" autoComplete="current-password" {...pw.register("current")} /></Field>
          <Field label="New password" error={pw.formState.errors.next?.message}><Input type="password" autoComplete="new-password" {...pw.register("next")} /></Field>
          <Button type="submit" loading={pw.formState.isSubmitting}>Update password</Button>
        </form></CardBody></Card>
    </div>
  );
}

export function AddMemberButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof memberSchema>>({ resolver: zodResolver(memberSchema), defaultValues: { role: "SALES_REP" } });
  return (
    <>
      <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add member</Button>
      <Modal open={open} onOpenChange={setOpen} title="Add team member" description="Create their account with a temporary password and share it securely; they can change it in Settings.">
        <form onSubmit={handleSubmit(async (v) => { if (done(await addMemberAction(v), "Member added", router)) { setOpen(false); reset(); } })} className="space-y-4" noValidate>
          <Field label="Full name" error={errors.name?.message}><Input {...register("name")} /></Field>
          <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
          <Field label="Temporary password" error={errors.password?.message}><Input type="text" autoComplete="off" {...register("password")} /></Field>
          <Field label="Role"><Select {...register("role")}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={isSubmitting}>Add member</Button></div>
        </form>
      </Modal>
    </>
  );
}

export function MemberControls({ userId, role, active, self }: { userId: string; role: Role; active: boolean; self: boolean }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-end gap-2">
      <Select className="w-auto" aria-label="Role" value={role} onChange={async (e) => done(await updateMemberRoleAction(userId, e.target.value as Role), "Role updated", router)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
      {active ? <ConfirmDialog confirmLabel="Deactivate" title="Deactivate this member?" description="They will be signed out and unable to log in. Their records stay in the system. You can reactivate them later."
        onConfirm={async () => { done(await setMemberActiveAction(userId, false), "Member deactivated", router); }} trigger={<Button size="sm" variant="outline" disabled={self}>Deactivate</Button>} />
        : <Button size="sm" variant="outline" onClick={async () => done(await setMemberActiveAction(userId, true), "Member reactivated", router)}>Reactivate</Button>}
    </div>
  );
}
