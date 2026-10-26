import { redirect } from "next/navigation";
import { Workflow } from "lucide-react";
import { getSession } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/dashboard");
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 p-10 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold"><Workflow className="h-6 w-6" /> SalesFlow CRM</div>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">Close more deals with a pipeline that runs itself.</h2>
          <p className="text-indigo-100">Leads, contacts, follow-ups and automation in one clean workspace built for small and growing sales teams.</p>
        </div>
        <p className="text-sm text-indigo-200">© {new Date().getFullYear()} SalesFlow CRM</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="flex items-center justify-center p-6">{children}</div>
    </div>
  );
}
