import type { Role } from "./constants";

export type Permission =
  | "records:viewAll" // see every lead/deal/task in the organization
  | "records:delete"
  | "leads:assign"
  | "automation:manage"
  | "reports:team"
  | "team:manage"
  | "settings:manage";

const MANAGER: Permission[] = ["records:viewAll", "records:delete", "leads:assign", "automation:manage", "reports:team"];
const ADMIN: Permission[] = [...MANAGER, "team:manage", "settings:manage"];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set(ADMIN),
  SALES_MANAGER: new Set(MANAGER),
  SALES_REP: new Set<Permission>(),
};

export const can = (role: Role, permission: Permission) => MATRIX[role].has(permission);
