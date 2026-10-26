import { ZodError } from "zod";

export class AppError extends Error {}

export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** Wraps a server-action body: converts validation/domain errors into a typed result and hides internals. */
export async function safe<T = undefined>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ZodError) {
      return { ok: false, error: e.errors[0]?.message ?? "Invalid input", fieldErrors: e.flatten().fieldErrors };
    }
    if (e instanceof AppError) return { ok: false, error: e.message };
    // Let Next.js control-flow errors (redirect/notFound) pass through.
    if (typeof e === "object" && e && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[action error]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
