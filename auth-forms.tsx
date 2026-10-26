"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { loginAction, registerAction } from "@/actions/auth";
import { loginSchema, registerSchema } from "@/lib/validators";
import type { z } from "zod";

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const onSubmit = handleSubmit(async (v) => {
    setError("");
    const r = await loginAction(v);
    if (!r.ok) return setError(r.error);
    router.push("/dashboard"); router.refresh();
  });
  return (
    <div className="w-full max-w-sm space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1><p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace.</p></div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></Field>
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
      {demo && (
        <div className="rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Demo accounts (password: Password123!)</p>
          {[["Admin", "admin@salesflow.dev"], ["Manager", "manager@salesflow.dev"], ["Sales rep", "rep@salesflow.dev"]].map(([l, e]) => (
            <button key={e} type="button" className="block w-full rounded px-1 py-0.5 text-left hover:bg-muted" onClick={() => { setValue("email", e); setValue("password", "Password123!"); toast.info(`Filled ${l} credentials`); }}>{l}: {e}</button>
          ))}
        </div>
      )}
      <p className="text-center text-sm text-muted-foreground">New here? <Link href="/register" className="font-medium text-primary hover:underline">Create a workspace</Link></p>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });
  const onSubmit = handleSubmit(async (v) => {
    setError("");
    const r = await registerAction(v);
    if (!r.ok) return setError(r.error);
    toast.success("Workspace created"); router.push("/dashboard"); router.refresh();
  });
  return (
    <div className="w-full max-w-sm space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1><p className="mt-1 text-sm text-muted-foreground">You'll be the administrator.</p></div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Company name" error={errors.orgName?.message}><Input {...register("orgName")} /></Field>
        <Field label="Your name" error={errors.name?.message}><Input autoComplete="name" {...register("name")} /></Field>
        <Field label="Work email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message} hint="8+ characters with a letter and a number"><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" loading={isSubmitting}>Create workspace</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
    </div>
  );
}
