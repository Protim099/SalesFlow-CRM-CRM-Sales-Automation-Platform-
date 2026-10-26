import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { AppError } from "./errors";
import { can, type Permission } from "./permissions";
import type { Role } from "./constants";

export const SESSION_COOKIE = "sf_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  return new TextEncoder().encode(s);
}

export type Session = {
  userId: string; name: string; email: string; emailNotifications: boolean;
  orgId: string; role: Role;
  org: { id: string; name: string; currency: string; timezone: string; monthlyTarget: number; leadSources: string[] };
};

export async function createSession(userId: string, orgId: string) {
  const token = await new SignJWT({ uid: userId, oid: orgId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  cookies().set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}
export const destroySession = () => cookies().delete(SESSION_COOKIE);

/** Verifies the signed cookie AND re-checks the membership in the DB, so role changes/deactivation apply immediately. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let uid: string, oid: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    uid = String(payload.uid); oid = String(payload.oid);
  } catch { return null; }
  const m = await prisma.membership.findFirst({ where: { userId: uid, orgId: oid, active: true }, include: { user: true, org: true } });
  if (!m) return null;
  return {
    userId: m.user.id, name: m.user.name, email: m.user.email, emailNotifications: m.user.emailNotifications,
    orgId: m.orgId, role: m.role as Role,
    org: { id: m.org.id, name: m.org.name, currency: m.org.currency, timezone: m.org.timezone, monthlyTarget: m.org.monthlyTarget, leadSources: m.org.leadSources },
  };
});

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
export async function requirePermission(p: Permission): Promise<Session> {
  const s = await requireSession();
  if (!can(s.role, p)) throw new AppError("You don't have permission to do that.");
  return s;
}

/** Row-level scope: reps only see records they own; managers/admins see the whole organization. */
export const ownScope = (s: Session, field: "assignedToId" | "ownerId" | "assigneeId") =>
  can(s.role, "records:viewAll") ? { orgId: s.orgId } : { orgId: s.orgId, [field]: s.userId };

export function clientIp() {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** CSRF defence for route handlers: state-changing requests must come from our own origin. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients / same-origin GET navigations
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new AppError("Cross-origin request blocked.");
}

/** For pages: redirect (instead of throwing) when the role lacks access. */
export async function requirePageAccess(p: Permission): Promise<Session> {
  const s = await requireSession();
  if (!can(s.role, p)) redirect("/dashboard");
  return s;
}
