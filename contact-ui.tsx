"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/dialog";
import { companySchema, contactSchema, type CompanyInput, type ContactInput } from "@/lib/validators";
import { deleteCompanyAction, deleteContactAction, saveCompanyAction, saveContactAction } from "@/actions/contacts";

export type ContactRow = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; jobTitle: string | null; companyId: string | null; tags: string[] };
export type CompanyRow = { id: string; name: string; website: string | null; industry: string | null; phone: string | null; address: string | null; tags: string[] };

export function ContactFormButton({ contact, companies, canDelete, icon }: { contact?: ContactRow; companies: { id: string; name: string }[]; canDelete?: boolean; icon?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    values: { firstName: contact?.firstName ?? "", lastName: contact?.lastName ?? "", email: contact?.email ?? "", phone: contact?.phone ?? "", jobTitle: contact?.jobTitle ?? "", companyId: contact?.companyId ?? "", tags: contact?.tags.join(", ") ?? "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    const r = await saveContactAction(contact?.id ?? null, v);
    if (!r.ok) return void toast.error(r.error);
    toast.success(contact ? "Contact updated" : "Contact created"); setOpen(false); router.refresh();
  });
  return (
    <>
      {icon ? <Button variant="ghost" size="icon" aria-label="Edit contact" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /></Button> : <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New contact</Button>}
      {contact && canDelete && <ConfirmDialog title="Delete contact?" description={`${contact.firstName} ${contact.lastName} will be removed. Linked deals are kept but unlinked.`}
        onConfirm={async () => { const r = await deleteContactAction(contact.id); if (!r.ok) return void toast.error(r.error); toast.success("Contact deleted"); router.refresh(); }}
        trigger={<Button variant="ghost" size="icon" aria-label="Delete contact"><Trash2 className="h-4 w-4 text-destructive" /></Button>} />}
      <Modal open={open} onOpenChange={setOpen} title={contact ? "Edit contact" : "New contact"} wide>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="First name *" error={errors.firstName?.message}><Input {...register("firstName")} autoFocus /></Field>
          <Field label="Last name"><Input {...register("lastName")} /></Field>
          <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
          <Field label="Phone"><Input {...register("phone")} /></Field>
          <Field label="Job title"><Input {...register("jobTitle")} /></Field>
          <Field label="Company"><Select {...register("companyId")}><option value="">None</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Tags" className="sm:col-span-2" hint="Comma separated, e.g. vip, decision-maker"><Input {...register("tags")} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={isSubmitting}>Save</Button></div>
        </form>
      </Modal>
    </>
  );
}

export function CompanyFormButton({ company, canDelete, icon }: { company?: CompanyRow; canDelete?: boolean; icon?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    values: { name: company?.name ?? "", website: company?.website ?? "", industry: company?.industry ?? "", phone: company?.phone ?? "", address: company?.address ?? "", tags: company?.tags.join(", ") ?? "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    const r = await saveCompanyAction(company?.id ?? null, v);
    if (!r.ok) return void toast.error(r.error);
    toast.success(company ? "Company updated" : "Company created"); setOpen(false); router.refresh();
  });
  return (
    <>
      {icon ? <Button variant="ghost" size="icon" aria-label="Edit company" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /></Button> : <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New company</Button>}
      {company && canDelete && <ConfirmDialog title="Delete company?" description={`${company.name} will be removed. Its contacts and deals are kept but unlinked.`}
        onConfirm={async () => { const r = await deleteCompanyAction(company.id); if (!r.ok) return void toast.error(r.error); toast.success("Company deleted"); router.refresh(); }}
        trigger={<Button variant="ghost" size="icon" aria-label="Delete company"><Trash2 className="h-4 w-4 text-destructive" /></Button>} />}
      <Modal open={open} onOpenChange={setOpen} title={company ? "Edit company" : "New company"} wide>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Name *" error={errors.name?.message}><Input {...register("name")} autoFocus /></Field>
          <Field label="Industry"><Input {...register("industry")} /></Field>
          <Field label="Website"><Input {...register("website")} placeholder="https://" /></Field>
          <Field label="Phone"><Input {...register("phone")} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input {...register("address")} /></Field>
          <Field label="Tags" className="sm:col-span-2" hint="Comma separated"><Input {...register("tags")} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={isSubmitting}>Save</Button></div>
        </form>
      </Modal>
    </>
  );
}
