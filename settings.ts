"use server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { safe, AppError } from "@/lib/errors";
import { requireSession, requirePermission } from "@/lib/auth";
import { leadSourcesSchema, memberSchema, orgSchema, passwordChangeSchema, profileSchema, stageSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { z } from "zod";
import type { Role, StageKind } from "@/lib/constants";
import { ROLES } from "@/lib/constants";
import { refresh } from "./_shared";

export async function updateOrgAction(input: z.infer<typeof orgSchema>) {
  return safe(async () => {
    const s = await requirePermission("settings:manage");
    const d = orgSchema.parse(input);
    await prisma.organization.update({ where: { id: s.orgId }, data: d });
    audit(s.orgId, s.userId, "org.update", "organization", s.orgId);
    refresh();
  });
}

export async function updateSourcesAction(sources: string[]) {
  return safe(async () => {
    const s = await requirePermission("settings:manage");
    const list = Array.from(new Set(leadSourcesSchema.parse(sources)));
    await prisma.organization.update({ where: { id: s.orgId }, data: { leadSources: list } });
    refresh();
  });
}

export async function createStageAction(input: { name: string; kind: StageKind; probability: number }) {
  return safe(async () => {
    const s = await requirePermission("settings:manage");
    const d = stageSchema.parse(input);
    const last = await prisma.dealStage.findFirst({ where: { orgId: s.orgId }, orderBy: { position: "desc" } });
    try { await prisma.dealStage.create({ data: { ...d, orgId: s.orgId, position: (last?.position ?? -1) + 1 } }); }
    catch (e) { if ((e as { code?: string }).code === "P2002") throw new AppError("A stage with that name already exists."); throw e; }
    refresh();
  });
}

export async function updateStageAction(id: string, input: { name: string; kind: StageKind; probability: number }) {
  return safe(async () => {
    const s = await requirePermission("settings:manage");
    const d = stageSchema.parse(input);
    try { const r = await prisma.dealStage.updateMany({ where: { id, orgId: s.orgId }, data: d }); if (!r.count) throw new AppError("Stage not found."); }
    catch (e) { if ((e as { code?: string }).code === "P2002") throw new AppError("A stage with that name already exists."); throw e; }
    refresh();
  });
}

export async function moveStageAction(id: string, dir: -1 | 1) {
  return safe(async () => {
    const s = await requirePermission("settings:manage");
    const stages = await prisma.dealStage.findMany({ where: { orgId: s.orgId }, orderBy: { position: "asc" } });
    const i = stages.findIndex((x) => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= stages.length) return;
    await prisma.$transaction([
      prisma.dealStage.update({ where: { id: stages[i].id }, data: { position: stages[j].position } }),
      prisma.dealStage.update({ where: { id: stages[j].id }, data: { position: stages[i].position } }),
    ]);
    refresh();
  });
}

export async function deleteStageAction(id: string) {
  return safe(async () => {
    const s = await requirePermission("settings:manage");
    const stage = await prisma.dealStage.findFirst({ where: { id, orgId: s.orgId }, include: { _count: { select: { deals: true } } } });
    if (!stage) throw new AppError("Stage not found.");
    if (stage._count.deals) throw new AppError("Move this stage's deals elsewhere before deleting it.");
    const sameKind = await prisma.dealStage.count({ where: { orgId: s.orgId, kind: stage.kind } });
    if (stage.kind !== "OPEN" && sameKind <= 1) throw new AppError(`Keep at least one ${stage.kind === "WON" ? "Won" : "Lost"} stage.`);
    await prisma.dealStage.delete({ where: { id } });
    refresh();
  });
}

export async function updateProfileAction(input: z.infer<typeof profileSchema>) {
  return safe(async () => {
    const s = await requireSession();
    const d = profileSchema.parse(input);
    await prisma.user.update({ where: { id: s.userId }, data: d });
    refresh();
  });
}

export async function changePasswordAction(input: z.infer<typeof passwordChangeSchema>) {
  return safe(async () => {
    const s = await requireSession();
    const d = passwordChangeSchema.parse(input);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: s.userId } });
    if (!(await bcrypt.compare(d.current, user.passwordHash))) throw new AppError("Current password is incorrect.");
    await prisma.user.update({ where: { id: s.userId }, data: { passwordHash: await bcrypt.hash(d.next, 12) } });
    audit(s.orgId, s.userId, "user.password", "user", s.userId);
  });
}

export async function addMemberAction(input: z.infer<typeof memberSchema>) {
  return safe(async () => {
    const s = await requirePermission("team:manage");
    const d = memberSchema.parse(input);
    const email = d.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    if (existing) throw new AppError("That email already belongs to an account.");
    const user = await prisma.user.create({ data: { email, name: d.name, passwordHash: await bcrypt.hash(d.password, 12), memberships: { create: { orgId: s.orgId, role: d.role } } } });
    audit(s.orgId, s.userId, "team.add", "user", user.id, { role: d.role });
    refresh();
  });
}

async function guardLastAdmin(orgId: string, userId: string) {
  const admins = await prisma.membership.findMany({ where: { orgId, role: "ADMIN", active: true } });
  if (admins.length === 1 && admins[0].userId === userId) throw new AppError("The organization needs at least one active admin.");
}

export async function updateMemberRoleAction(userId: string, role: Role) {
  return safe(async () => {
    const s = await requirePermission("team:manage");
    if (!ROLES.includes(role)) throw new AppError("Invalid role.");
    if (role !== "ADMIN") await guardLastAdmin(s.orgId, userId);
    const r = await prisma.membership.updateMany({ where: { userId, orgId: s.orgId }, data: { role } });
    if (!r.count) throw new AppError("Member not found.");
    audit(s.orgId, s.userId, "team.role", "user", userId, { role });
    refresh();
  });
}

export async function setMemberActiveAction(userId: string, active: boolean) {
  return safe(async () => {
    const s = await requirePermission("team:manage");
    if (!active) { if (userId === s.userId) throw new AppError("You can't deactivate yourself."); await guardLastAdmin(s.orgId, userId); }
    const r = await prisma.membership.updateMany({ where: { userId, orgId: s.orgId }, data: { active } });
    if (!r.count) throw new AppError("Member not found.");
    audit(s.orgId, s.userId, active ? "team.activate" : "team.deactivate", "user", userId);
    refresh();
  });
}
