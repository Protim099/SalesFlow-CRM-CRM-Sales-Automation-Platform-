"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import * as A from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Modal({ open, onOpenChange, title, description, children, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl focus:outline-none", wide ? "max-w-2xl" : "max-w-lg")}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div><D.Title className="text-lg font-semibold">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}</div>
            <D.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Confirmation dialog for destructive actions. `onConfirm` may be async; the dialog shows a spinner meanwhile. */
export function ConfirmDialog({ trigger, title, description, confirmLabel = "Delete", onConfirm }: { trigger: React.ReactNode; title: string; description: string; confirmLabel?: string; onConfirm: () => Promise<void> | void }) {
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  return (
    <A.Root open={open} onOpenChange={setOpen}>
      <A.Trigger asChild>{trigger}</A.Trigger>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <A.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-2xl">
          <A.Title className="text-lg font-semibold">{title}</A.Title>
          <A.Description className="mt-2 text-sm text-muted-foreground">{description}</A.Description>
          <div className="mt-6 flex justify-end gap-2">
            <A.Cancel asChild><Button variant="outline" disabled={busy}>Cancel</Button></A.Cancel>
            <Button variant="destructive" loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}>{confirmLabel}</Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
