"use server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { safe, AppError } from "@/lib/errors";
import { createSession, destroySession, clientIp } from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { defaultSources, defaultStageRows } from "@/lib/defaults";
import { slugify } from "@/lib/utils";

const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO5y9RQ1bq0b6pS1d5wEoYb8ZP1u2yN1e";

export async function loginAction(input: { email: string; password: string }) {
  return safe(async () => {
    const d = loginSchema.parse(input);
    const email = d.email.toLowerCase();
    rateLimit(`login:${clientIp()}:${email}`, 8, 15 * 60_000);
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await bcrypt.compare(d.password, user?.passwordHash ?? DUMMY_HASH); // constant-ish time
    if (!user || !valid) throw new AppError("Invalid email or password.");
    const m = await prisma.membership.findFirst({ where: { userId: user.id, active: true }, orderBy: { createdAt: "asc" } });
    if (!m) throw new AppError("Your account is deactivated. Contact your administrator.");
    await createSession(user.id, m.orgId);
    audit(m.orgId, user.id, "auth.login", "user", user.id);
  });
}

export async function registerAction(input: { orgName: string; name: string; email: string; password: string }) {
  return safe(async () => {
    const d = registerSchema.parse(input);
    rateLimit(`register:${clientIp()}`, 5, 60 * 60_000);
    const email = d.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw new AppError("An account with this email already exists.");
    const passwordHash = await bcrypt.hash(d.password, 12);
    const base = slugify(d.orgName);
    const slug = (await prisma.organization.findUnique({ where: { slug: base } })) ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;
    const { orgId, userId } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: d.orgName, slug, leadSources: defaultSources() } });
      const user = await tx.user.create({ data: { email, name: d.name, passwordHash } });
      await tx.membership.create({ data: { userId: user.id, orgId: org.id, role: "ADMIN" } });
      await tx.dealStage.createMany({ data: defaultStageRows(org.id) });
      return { orgId: org.id, userId: user.id };
    });
    await createSession(userId, orgId);
    audit(orgId, userId, "org.create", "organization", orgId);
  });
}

export async function logoutAction() {
  destroySession();
}
