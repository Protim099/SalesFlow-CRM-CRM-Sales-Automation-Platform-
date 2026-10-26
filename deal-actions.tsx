"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DealFormDialog, type DealCard, type StageCol } from "@/components/kanban";
import { deleteDealAction } from "@/actions/deals";

export function DealActions({ deal, stages, members, contacts, companies, canAssign, canDelete }: { deal: DealCard; stages: StageCol[]; members: { id: string; name: string }[]; contacts: { id: string; name: string }[]; companies: { id: string; name: string }[]; canAssign: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
      {canDelete && <ConfirmDialog title="Delete this deal?" description="The deal, its tasks and communication history will be permanently removed."
        onConfirm={async () => { const r = await deleteDealAction(deal.id); if (!r.ok) return void toast.error(r.error); toast.success("Deal deleted"); router.push("/pipeline"); router.refresh(); }}
        trigger={<Button variant="outline"><Trash2 className="h-4 w-4 text-destructive" /> Delete</Button>} />}
      <DealFormDialog open={open} onOpenChange={setOpen} deal={deal} stages={stages} members={members} contacts={contacts} companies={companies} canAssign={canAssign} />
    </div>
  );
}
