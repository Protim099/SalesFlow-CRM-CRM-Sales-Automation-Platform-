"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { BarChart3, Bell, Building2, CheckSquare, ChevronsLeft, ChevronsRight, KanbanSquare, LayoutDashboard, LogOut, Menu as MenuIcon, Moon, Search, Settings, Sun, Target, UserCog, Users, Workflow, Zap } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { logoutAction } from "@/actions/auth";
import { markNotificationsReadAction } from "@/actions/activity";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";

type User = { name: string; email: string; role: Role };
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Target },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/automation", label: "Automation", icon: Zap, perm: "automation:manage" as const },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/team", label: "Team", icon: UserCog, perm: "team:manage" as const },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ user, orgName, children }: { user: User; orgName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("sf-collapsed") === "1"); } catch {} }, []);
  useEffect(() => setMobile(false), [pathname]);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem("sf-collapsed", c ? "0" : "1"); } catch {} return !c; });
  const items = NAV.filter((n) => !n.perm || can(user.role, n.perm));

  const nav = (
    <nav className="flex-1 space-y-1 p-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground", collapsed && "justify-center px-2")}>
            <Icon className="h-4 w-4 shrink-0" />{!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-card transition-[width] lg:flex", collapsed ? "w-[68px]" : "w-60")}>
        <div className={cn("flex h-14 items-center gap-2 border-b px-4 font-semibold", collapsed && "justify-center px-0")}>
          <Workflow className="h-5 w-5 shrink-0 text-primary" />{!collapsed && <span className="truncate">{orgName}</span>}
        </div>
        {nav}
        <button onClick={toggle} className="m-3 flex items-center justify-center gap-2 rounded-md p-2 text-xs text-muted-foreground hover:bg-muted" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-card shadow-xl">
            <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold"><Workflow className="h-5 w-5 text-primary" />{orgName}</div>
            {nav}
          </aside>
        </div>
      )}
      <div className={cn("transition-[padding]", collapsed ? "lg:pl-[68px]" : "lg:pl-60")}>
        <Topbar user={user} onMenu={() => setMobile(true)} />
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function Topbar({ user, onMenu }: { user: User; onMenu: () => void }) {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu"><MenuIcon className="h-5 w-5" /></Button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          <Sun className="hidden h-4 w-4 dark:block" /><Moon className="h-4 w-4 dark:hidden" />
        </Button>
        <NotificationCenter />
        <Menu>
          <MenuTrigger asChild>
            <button className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-label="Account menu">{initials(user.name)}</button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel><span className="block font-medium text-foreground">{user.name}</span>{user.email}<span className="block">{ROLE_LABEL[user.role]}</span></MenuLabel>
            <MenuSeparator />
            <MenuItem onSelect={() => router.push("/settings")}><Settings className="h-4 w-4" /> Settings</MenuItem>
            <MenuItem danger onSelect={async () => { await logoutAction(); router.push("/login"); router.refresh(); }}><LogOut className="h-4 w-4" /> Sign out</MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}

type Hit = { type: string; label: string; sub: string; href: string };
function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal }); if (r.ok) setHits((await r.json()).results); } catch {}
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search leads, contacts, deals…" aria-label="Global search" className="h-9 w-full rounded-md border bg-muted/50 pl-9 pr-3 text-sm focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-11 max-h-80 overflow-auto rounded-md border bg-card p-1 shadow-lg">
          {hits.length === 0 ? <p className="px-3 py-4 text-center text-sm text-muted-foreground">No results</p> : hits.map((h, i) => (
            <Link key={i} href={h.href} onClick={() => { setOpen(false); setQ(""); }} className="flex items-center justify-between gap-3 rounded px-3 py-2 text-sm hover:bg-muted">
              <span className="truncate"><span className="font-medium">{h.label}</span>{h.sub && <span className="ml-2 text-muted-foreground">{h.sub}</span>}</span>
              <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent-foreground">{h.type}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type Note = { id: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string };
function NotificationCenter() {
  const [data, setData] = useState<{ unread: number; items: Note[] }>({ unread: 0, items: [] });
  const router = useRouter();
  const load = async () => { try { const r = await fetch("/api/notifications", { cache: "no-store" }); if (r.ok) setData(await r.json()); } catch {} };
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);
  return (
    <Menu onOpenChange={(o) => { if (o) load(); }}>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications, ${data.unread} unread`} className="relative">
          <Bell className="h-4 w-4" />{data.unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">{data.unread > 9 ? "9+" : data.unread}</span>}
        </Button>
      </MenuTrigger>
      <MenuContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-sm font-medium">Notifications</span>
          {data.unread > 0 && <button className="text-xs text-primary hover:underline" onClick={async () => { await markNotificationsReadAction(); toast.success("All caught up"); load(); }}>Mark all read</button>}
        </div>
        <div className="max-h-80 overflow-auto p-1">
          {data.items.length === 0 ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing new</p> : data.items.map((n) => (
            <MenuItem key={n.id} className="flex-col items-start gap-0.5" onSelect={() => n.href && router.push(n.href)}>
              <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
              {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
            </MenuItem>
          ))}
        </div>
      </MenuContent>
    </Menu>
  );
}
