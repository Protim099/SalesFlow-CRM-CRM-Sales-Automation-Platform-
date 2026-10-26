"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export type FilterField = { name: string; label: string; options: { value: string; label: string }[] };

/** URL-driven filter bar: state lives in the query string so filters are shareable and server-rendered. */
export function FilterBar({ fields, placeholder = "Search…" }: { fields: FilterField[]; placeholder?: string }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const first = useRef(true);
  const push = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    n.delete("page");
    router.push(`${path}?${n.toString()}`);
  };
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => { if ((sp.get("q") ?? "") !== q.trim()) push({ q: q.trim() }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const active = fields.some((f) => sp.get(f.name)) || sp.get("q");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Search" className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      {fields.map((f) => (
        <Select key={f.name} aria-label={f.label} value={sp.get(f.name) ?? ""} onChange={(e) => push({ [f.name]: e.target.value })} className="w-auto min-w-[8.5rem]">
          <option value="">{f.label}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ))}
      {active && <button onClick={() => { setQ(""); router.push(path); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /> Clear</button>}
    </div>
  );
}

function href(base: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const n = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) n.set(k, v);
  return `${base}?${n.toString()}`;
}

export function SortHeader({ base, params, field, label }: { base: string; params: Record<string, string | undefined>; field: string; label: string }) {
  const active = (params.sort ?? "createdAt") === field;
  const dir = params.dir === "asc" ? "asc" : "desc";
  return (
    <Link href={href(base, params, { sort: field, dir: active && dir === "desc" ? "asc" : "desc", page: undefined })} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
      {label}{active && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </Link>
  );
}

export function Pagination({ base, params, page, pageSize, total }: { base: string; params: Record<string, string | undefined>; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
      <span>{from}–{to} of {total.toLocaleString()}</span>
      <div className="flex items-center gap-1">
        {page > 1 ? <Link aria-label="Previous page" href={href(base, params, { page: String(page - 1) })} className="rounded-md border p-1.5 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></Link> : <span className="rounded-md border p-1.5 opacity-40"><ChevronLeft className="h-4 w-4" /></span>}
        <span className="px-2">Page {page} / {pages}</span>
        {page < pages ? <Link aria-label="Next page" href={href(base, params, { page: String(page + 1) })} className="rounded-md border p-1.5 hover:bg-muted"><ChevronRight className="h-4 w-4" /></Link> : <span className="rounded-md border p-1.5 opacity-40"><ChevronRight className="h-4 w-4" /></span>}
      </div>
    </div>
  );
}
