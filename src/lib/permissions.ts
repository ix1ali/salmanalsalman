import type { Role } from "./types";

/** Everything the UI can gate on. Kept flat so it maps 1:1 to Supabase RLS later. */
export type Perm =
  | "dashboard.view"
  | "buildings.view" | "buildings.edit"
  | "units.view" | "units.edit"
  | "tenants.view" | "tenants.edit" | "tenants.contact"
  | "contracts.view" | "contracts.edit"
  | "finance.view" | "finance.edit"
  | "receipts.view" | "receipts.create"
  | "reports.view"
  | "docs.view" | "docs.upload" | "docs.delete"
  | "flags.view" | "flags.edit"
  | "memos.view" | "memos.create" | "memos.delete"
  | "users.manage"
  | "settings.manage"
  | "data.export";

const ADMIN: Perm[] = [
  "dashboard.view", "buildings.view", "buildings.edit", "units.view", "units.edit",
  "tenants.view", "tenants.edit", "tenants.contact", "contracts.view", "contracts.edit",
  "finance.view", "finance.edit", "receipts.view", "receipts.create", "reports.view",
  "docs.view", "docs.upload", "docs.delete", "flags.view", "flags.edit",
  "memos.view", "memos.create", "memos.delete",
  "users.manage", "settings.manage", "data.export",
];

/**
 * مشرف العقار: كل ما يفعله المدير داخل عقاراته المسندة إليه،
 * دون إدارة المستخدمين ولا إعدادات النظام ولا إضافة عقارات جديدة.
 */
const MANAGER: Perm[] = [
  "dashboard.view", "buildings.view", "units.view", "units.edit",
  "tenants.view", "tenants.edit", "tenants.contact", "contracts.view", "contracts.edit",
  "finance.view", "finance.edit", "receipts.view", "receipts.create", "reports.view",
  "docs.view", "docs.upload", "docs.delete", "flags.view", "flags.edit",
  "memos.view", "memos.create", "data.export",
];

const VIEWER: Perm[] = [
  "dashboard.view", "buildings.view", "units.view", "tenants.view", "tenants.contact",
  "contracts.view", "finance.view", "receipts.view", "reports.view", "docs.view",
  "flags.view", "memos.view", "data.export",
];

const GUARD: Perm[] = [
  "dashboard.view", "buildings.view", "units.view", "tenants.view", "tenants.contact",
  "flags.view", "flags.edit", "memos.view", "memos.create",
];

export const PERMS: Record<Role, Perm[]> = { admin: ADMIN, manager: MANAGER, viewer: VIEWER, guard: GUARD };

export const can = (role: Role | undefined, perm: Perm) =>
  !!role && PERMS[role].includes(perm);
