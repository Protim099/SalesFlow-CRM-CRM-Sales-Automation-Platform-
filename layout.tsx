import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  return <AppShell user={{ name: s.name, email: s.email, role: s.role }} orgName={s.org.name}>{children}</AppShell>;
}
