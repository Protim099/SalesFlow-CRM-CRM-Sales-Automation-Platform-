import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-semibold text-primary">404</p>
      <p className="text-muted-foreground">We couldn't find that page.</p>
      <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">Back to dashboard</Link>
    </div>
  );
}
