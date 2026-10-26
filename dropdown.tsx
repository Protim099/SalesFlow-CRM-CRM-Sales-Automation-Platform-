"use client";
import * as React from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuContent = ({ className, ...p }: React.ComponentProps<typeof M.Content>) => (
  <M.Portal><M.Content align="end" sideOffset={6} className={cn("z-50 min-w-[11rem] rounded-md border bg-card p-1 text-sm shadow-lg", className)} {...p} /></M.Portal>
);
export const MenuItem = ({ className, danger, ...p }: React.ComponentProps<typeof M.Item> & { danger?: boolean }) => (
  <M.Item className={cn("flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-1.5 outline-none data-[highlighted]:bg-muted", danger && "text-destructive", className)} {...p} />
);
export const MenuLabel = ({ className, ...p }: React.ComponentProps<typeof M.Label>) => <M.Label className={cn("px-2.5 py-1.5 text-xs text-muted-foreground", className)} {...p} />;
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
