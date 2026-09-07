"use client";

import { sb } from "./cloud";
import type {
  AppData, AuditEntry, Building, Contract, ContractStatus, DocKind, DocMeta, Expense,
  ExpenseCategory, Floor, Memo, OwnerType, PayMethod, Payment, Role, Tenant, Unit,
  UnitKind, UnitStatus, User,
} from "./types";

/* ============================ الافتراضيات ============================ */

export const DEFAULT_SETTINGS: AppData["settings"] = {
  orgName: "إدارة عقار سلمان السلمان",
  ownerFullName: "سلمان محمد أحمد السلمان",
  currency: "KWD",
  sessionMinutes: 43200,
  reminderDaysBeforeDue: 3,
  contractAlertDays: 45,
  trackingStartPeriod: new Date().toISOString().slice(0, 7),
  dueDay: 5,
  lateFee: 200,
  supervisorFee: 5,
};

/** بيانات فارغة تُعرض قبل تسجيل الدخول أو قبل اكتمال التحميل. */
export const emptyData = (): AppData => ({
  version: 5,
  users: [], buildings: [], floors: [], units: [], tenants: [], contracts: [],
  payments: [], expenses: [], docs: [], memos: [], audit: [],
  settings: { ...DEFAULT_SETTINGS },
});

/* ============================= المحوّلات ============================= */

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? undefined : String(v));
const n = (v: unknown) => (v == null ? undefined : Number(v));
const str = (v: unknown, d = "") => (v == null ? d : String(v));
const nb = (v: unknown, d = 0) => (v == null ? d : Number(v));

/**
 * وصف جدول واحد: اسمه في قاعدة البيانات، ومفتاحه في بيانات التطبيق،
 * وتحويل الصف في الاتجاهين. هذا هو كل ما يربط النظام بـ Supabase.
 */
export interface Coll<K extends keyof AppData> {
  key: K;
  table: string;
  order?: { col: string; asc: boolean };
  limit?: number;
  /** الجداول التي تُدار عبر تسجيل الدخول لا تُحذف صفوفها بالمزامنة العادية. */
  fromRow: (r: Row) => AppData[K] extends (infer T)[] ? T : never;
  toRow: (x: AppData[K] extends (infer T)[] ? T : never) => Row;
}

const buildings: Coll<"buildings"> = {
  key: "buildings", table: "buildings", order: { col: "created_at", asc: true },
  fromRow: (r): Building => ({
    id: str(r.id), name: str(r.name), code: str(r.code), area: str(r.area),
    block: str(r.block), street: str(r.street), buildingNo: str(r.building_no),
    parcel: s(r.parcel), ownerName: str(r.owner_name), paciNo: s(r.paci_no),
    landArea: n(r.land_area), builtArea: n(r.built_area), notes: s(r.notes),
    color: str(r.color, "#123a6b"), createdAt: str(r.created_at),
  }),
  toRow: (b: Building) => ({
    id: b.id, name: b.name, code: b.code, area: b.area, block: b.block, street: b.street,
    building_no: b.buildingNo, parcel: b.parcel ?? null, owner_name: b.ownerName,
    paci_no: b.paciNo ?? null, land_area: b.landArea ?? null, built_area: b.builtArea ?? null,
    notes: b.notes ?? null, color: b.color, created_at: b.createdAt,
  }),
};

const floors: Coll<"floors"> = {
  key: "floors", table: "floors", order: { col: "sort_order", asc: true },
  fromRow: (r): Floor => ({
    id: str(r.id), buildingId: str(r.building_id), level: nb(r.level),
    name: str(r.name), order: nb(r.sort_order),
  }),
  toRow: (f: Floor) => ({
    id: f.id, building_id: f.buildingId, level: f.level, name: f.name, sort_order: f.order,
  }),
};

const units: Coll<"units"> = {
  key: "units", table: "units", order: { col: "number", asc: true },
  fromRow: (r): Unit => ({
    id: str(r.id), buildingId: str(r.building_id), floorId: str(r.floor_id),
    number: str(r.number), kind: str(r.kind, "apartment") as UnitKind,
    status: str(r.status, "vacant") as UnitStatus,
    area: n(r.area), rooms: n(r.rooms), bathrooms: n(r.bathrooms), balconies: n(r.balconies),
    baseRent: nb(r.base_rent), meterNo: s(r.meter_no), notes: s(r.notes),
    flagged: Boolean(r.flagged), flagNote: s(r.flag_note), flaggedAt: s(r.flagged_at),
    createdAt: str(r.created_at),
  }),
  toRow: (u: Unit) => ({
    id: u.id, building_id: u.buildingId, floor_id: u.floorId, number: u.number,
    kind: u.kind, status: u.status, area: u.area ?? null, rooms: u.rooms ?? null,
    bathrooms: u.bathrooms ?? null, balconies: u.balconies ?? null, base_rent: u.baseRent,
    meter_no: u.meterNo ?? null, notes: u.notes ?? null, flagged: !!u.flagged,
    flag_note: u.flagNote ?? null, flagged_at: u.flaggedAt ?? null, created_at: u.createdAt,
  }),
};

const tenants: Coll<"tenants"> = {
  key: "tenants", table: "tenants", order: { col: "name", asc: true },
  fromRow: (r): Tenant => ({
    id: str(r.id), buildingId: str(r.building_id), name: str(r.name),
    civilId: str(r.civil_id), phone: str(r.phone),
    phone2: s(r.phone2), nationality: s(r.nationality), email: s(r.email),
    workplace: s(r.workplace), emergencyContact: s(r.emergency_contact), notes: s(r.notes),
    active: r.active !== false, createdAt: str(r.created_at),
  }),
  toRow: (t: Tenant) => ({
    id: t.id, building_id: t.buildingId || null, name: t.name,
    civil_id: t.civilId || null, phone: t.phone,
    phone2: t.phone2 ?? null, nationality: t.nationality ?? null, email: t.email ?? null,
    workplace: t.workplace ?? null, emergency_contact: t.emergencyContact ?? null,
    notes: t.notes ?? null, active: t.active, created_at: t.createdAt,
  }),
};

const contracts: Coll<"contracts"> = {
  key: "contracts", table: "contracts", order: { col: "created_at", asc: true },
  fromRow: (r): Contract => ({
    id: str(r.id), no: str(r.no), buildingId: str(r.building_id), unitId: str(r.unit_id),
    tenantId: str(r.tenant_id), startDate: str(r.start_date), endDate: str(r.end_date),
    firstRentedAt: s(r.first_rented_at), signedAt: s(r.signed_at), durationText: s(r.duration_text),
    occupants: n(r.occupants), rent: nb(r.rent), deposit: nb(r.deposit), dueDay: nb(r.due_day, 1),
    payMethod: str(r.pay_method, "cash") as PayMethod,
    status: str(r.status, "active") as ContractStatus,
    terms: s(r.terms), createdAt: str(r.created_at),
  }),
  toRow: (c: Contract) => ({
    id: c.id, no: c.no, building_id: c.buildingId, unit_id: c.unitId, tenant_id: c.tenantId,
    start_date: c.startDate, end_date: c.endDate, first_rented_at: c.firstRentedAt ?? null,
    signed_at: c.signedAt ?? null, duration_text: c.durationText ?? null,
    occupants: c.occupants ?? null, rent: c.rent, deposit: c.deposit, due_day: c.dueDay,
    pay_method: c.payMethod, status: c.status, terms: c.terms ?? null, created_at: c.createdAt,
  }),
};

const payments: Coll<"payments"> = {
  key: "payments", table: "payments", order: { col: "created_at", asc: false },
  fromRow: (r): Payment => ({
    id: str(r.id), receiptNo: str(r.receipt_no), buildingId: str(r.building_id),
    unitId: str(r.unit_id), tenantId: str(r.tenant_id), contractId: s(r.contract_id),
    period: str(r.period), amount: nb(r.amount), paidAt: str(r.paid_at),
    method: str(r.method, "cash") as PayMethod, reference: s(r.reference), bank: s(r.bank),
    notes: s(r.notes), createdBy: str(r.created_by), createdAt: str(r.created_at),
  }),
  toRow: (p: Payment) => ({
    id: p.id, receipt_no: p.receiptNo, building_id: p.buildingId, unit_id: p.unitId,
    tenant_id: p.tenantId, contract_id: p.contractId ?? null, period: p.period,
    amount: p.amount, paid_at: p.paidAt, method: p.method, reference: p.reference ?? null,
    bank: p.bank ?? null, notes: p.notes ?? null, created_by: p.createdBy, created_at: p.createdAt,
  }),
};

const expenses: Coll<"expenses"> = {
  key: "expenses", table: "expenses", order: { col: "date", asc: false },
  fromRow: (r): Expense => ({
    id: str(r.id), buildingId: str(r.building_id),
    category: str(r.category, "other") as ExpenseCategory, title: str(r.title),
    amount: nb(r.amount), date: str(r.date), vendor: s(r.vendor),
    method: str(r.method, "cash") as PayMethod, notes: s(r.notes), createdAt: str(r.created_at),
  }),
  toRow: (e: Expense) => ({
    id: e.id, building_id: e.buildingId, category: e.category, title: e.title,
    amount: e.amount, date: e.date, vendor: e.vendor ?? null, method: e.method,
    notes: e.notes ?? null, created_at: e.createdAt,
  }),
};

const docs: Coll<"docs"> = {
  key: "docs", table: "docs", order: { col: "uploaded_at", asc: false },
  fromRow: (r): DocMeta => ({
    id: str(r.id), ownerType: str(r.owner_type, "unit") as OwnerType, ownerId: str(r.owner_id),
    buildingId: s(r.building_id), kind: str(r.kind, "other") as DocKind, title: str(r.title),
    fileName: str(r.file_name), mime: str(r.mime), size: nb(r.size),
    expiresAt: s(r.expires_at), uploadedBy: str(r.uploaded_by), uploadedAt: str(r.uploaded_at),
  }),
  toRow: (d: DocMeta) => ({
    id: d.id, owner_type: d.ownerType, owner_id: d.ownerId, building_id: d.buildingId ?? null,
    kind: d.kind, title: d.title, file_name: d.fileName, mime: d.mime, size: d.size,
    expires_at: d.expiresAt ?? null, uploaded_by: d.uploadedBy, uploaded_at: d.uploadedAt,
  }),
};

const memos: Coll<"memos"> = {
  key: "memos", table: "memos", order: { col: "created_at", asc: false },
  fromRow: (r): Memo => ({
    id: str(r.id), title: str(r.title), body: str(r.body), authorId: str(r.author_id),
    authorName: str(r.author_name), createdAt: str(r.created_at),
  }),
  toRow: (m: Memo) => ({
    id: m.id, title: m.title, body: m.body, author_id: m.authorId,
    author_name: m.authorName, created_at: m.createdAt,
  }),
};

const audit: Coll<"audit"> = {
  key: "audit", table: "audit_log", order: { col: "at", asc: false }, limit: 500,
  fromRow: (r): AuditEntry => ({
    id: str(r.id), at: str(r.at), actor: str(r.actor), action: str(r.action), detail: str(r.detail),
  }),
  toRow: (a: AuditEntry) => ({ id: a.id, at: a.at, actor: a.actor, action: a.action, detail: a.detail }),
};

const users: Coll<"users"> = {
  key: "users", table: "profiles", order: { col: "created_at", asc: true },
  fromRow: (r): User => ({
    id: str(r.id), username: str(r.username), displayName: str(r.display_name),
    role: str(r.role, "viewer") as Role, salt: "", hash: "",
    active: r.active !== false,
    buildingIds: Array.isArray(r.building_ids) ? (r.building_ids as string[]) : "all",
    phone: s(r.phone), createdAt: str(r.created_at), lastLoginAt: s(r.last_login_at),
  }),
  toRow: (u: User) => ({
    id: u.id, username: u.username, display_name: u.displayName, role: u.role,
    phone: u.phone ?? null, active: u.active,
    building_ids: u.buildingIds === "all" ? null : u.buildingIds,
    created_at: u.createdAt, last_login_at: u.lastLoginAt ?? null,
  }),
};

/** ترتيب الإدراج يحترم الارتباطات: الأب قبل الابن. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const COLLS: Coll<any>[] = [
  users, buildings, floors, units, tenants, contracts, payments, expenses, docs, memos, audit,
];

/** الجداول التي يشترك فيها الجميع لحظيًا. */
export const REALTIME_TABLES = COLLS.map((c) => c.table).concat("settings");

const settingsToRow = (x: AppData["settings"]) => ({
  id: 1,
  org_name: x.orgName, owner_full_name: x.ownerFullName, currency: x.currency,
  session_minutes: x.sessionMinutes, reminder_days_before_due: x.reminderDaysBeforeDue,
  contract_alert_days: x.contractAlertDays, tracking_start_period: x.trackingStartPeriod,
  due_day: x.dueDay, late_fee: x.lateFee, supervisor_fee: x.supervisorFee,
});

const settingsFromRow = (r: Row): AppData["settings"] => ({
  orgName: str(r.org_name, DEFAULT_SETTINGS.orgName),
  ownerFullName: str(r.owner_full_name, DEFAULT_SETTINGS.ownerFullName),
  currency: str(r.currency, "KWD"),
  sessionMinutes: nb(r.session_minutes, 43200),
  reminderDaysBeforeDue: nb(r.reminder_days_before_due, 3),
  contractAlertDays: nb(r.contract_alert_days, 45),
  trackingStartPeriod: str(r.tracking_start_period, DEFAULT_SETTINGS.trackingStartPeriod),
  dueDay: nb(r.due_day, 5),
  lateFee: nb(r.late_fee, 200),
  supervisorFee: nb(r.supervisor_fee, 5),
});

/* ============================== القراءة ============================== */

/** يقرأ كل الجداول دفعة واحدة ويبني بيانات التطبيق. */
export async function fetchAll(): Promise<AppData> {
  const out = emptyData();

  const results = await Promise.all(
    COLLS.map(async (c) => {
      let q = sb().from(c.table).select("*");
      if (c.order) q = q.order(c.order.col, { ascending: c.order.asc });
      if (c.limit) q = q.limit(c.limit);
      const { data, error } = await q;
      if (error) throw error;
      return { key: c.key as keyof AppData, rows: (data ?? []).map((r) => c.fromRow(r as Row)) };
    })
  );
  results.forEach(({ key, rows }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[key] = rows;
  });

  const { data: st } = await sb().from("settings").select("*").eq("id", 1).maybeSingle();
  if (st) out.settings = settingsFromRow(st as Row);

  return out;
}

/** يعيد قراءة جدول واحد فقط — يُستعمل عند وصول تغيير لحظي. */
export async function fetchTable(table: string): Promise<Partial<AppData>> {
  if (table === "settings") {
    const { data } = await sb().from("settings").select("*").eq("id", 1).maybeSingle();
    return data ? { settings: settingsFromRow(data as Row) } : {};
  }
  const c = COLLS.find((x) => x.table === table);
  if (!c) return {};
  let q = sb().from(c.table).select("*");
  if (c.order) q = q.order(c.order.col, { ascending: c.order.asc });
  if (c.limit) q = q.limit(c.limit);
  const { data, error } = await q;
  if (error) throw error;
  return { [c.key]: (data ?? []).map((r) => c.fromRow(r as Row)) } as Partial<AppData>;
}

/* ============================== الكتابة ============================== */

const sameRow = (a: Row, b: Row) => JSON.stringify(a) === JSON.stringify(b);

/**
 * يقارن الحالة السابقة بالحالة الجديدة ويرسل الفرق فقط إلى Supabase.
 *
 * هذا هو الوصل الوحيد بين نموذج البيانات في الواجهة وقاعدة البيانات،
 * فتبقى كل شاشات النظام كما هي دون أن تعرف شيئًا عن السحابة.
 */
export async function pushDiff(prev: AppData, next: AppData): Promise<void> {
  const upserts: { table: string; rows: Row[] }[] = [];
  const deletes: { table: string; ids: string[] }[] = [];

  for (const c of COLLS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = new Map<string, Row>(((prev as any)[c.key] as any[]).map((x) => [x.id, c.toRow(x)]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const after = new Map<string, Row>(((next as any)[c.key] as any[]).map((x) => [x.id, c.toRow(x)]));

    const changed: Row[] = [];
    after.forEach((row, id) => {
      const old = before.get(id);
      if (!old || !sameRow(old, row)) changed.push(row);
    });
    const gone: string[] = [];
    before.forEach((_row, id) => { if (!after.has(id)) gone.push(id); });

    if (changed.length) upserts.push({ table: c.table, rows: changed });
    if (gone.length) deletes.push({ table: c.table, ids: gone });
  }

  // الحذف من الابن إلى الأب، والإضافة من الأب إلى الابن
  for (const d of [...deletes].reverse()) {
    const { error } = await sb().from(d.table).delete().in("id", d.ids);
    if (error) throw error;
  }
  for (const u of upserts) {
    const { error } = await sb().from(u.table).upsert(u.rows, { onConflict: "id" });
    if (error) throw error;
  }

  if (JSON.stringify(prev.settings) !== JSON.stringify(next.settings)) {
    const { error } = await sb().from("settings").upsert(settingsToRow(next.settings), { onConflict: "id" });
    if (error) throw error;
  }
}

/** يرفع بيانات كاملة إلى قاعدة فارغة (تهيئة أول مرة). */
export async function pushAll(data: AppData): Promise<void> {
  await pushDiff({ ...emptyData(), users: data.users }, { ...data });
}
