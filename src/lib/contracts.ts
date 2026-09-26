import type { AppData, Contract, PayMethod, Tenant } from "./types";
import { uid } from "./crypto";
import { thisPeriod } from "./format";

/**
 * العقود بالشهر — لا بتاريخ نهاية.
 *
 * العقد يسري من شهر بدايته ويستمر شهرًا بعد شهر إلى أن يُحذف المستأجر أو يُعدَّل.
 * التعديل من شهر معيّن لا يمسّ ما قبله: النسخة القديمة تبقى في الأشهر السابقة
 * كما كانت، والنسخة الجديدة تبدأ من الشهر المختار وتنتقل للأشهر التالية.
 *
 * العقد المفتوح `endDate = ""`. العقد المنتهي (نسخة قديمة أو مستأجر محذوف)
 * حالته "terminated" وتاريخ نهايته آخر يوم فيه.
 */

/** قيمة تُحفظ في قاعدة البيانات مكان «بلا نهاية» لأن العمود إلزامي. */
export const OPEN_END = "2099-12-31";

export const isOpen = (c: Contract) => c.status !== "terminated";
export const startPeriod = (c: Contract) => c.startDate.slice(0, 7);
const endPeriod = (c: Contract) => (isOpen(c) || !c.endDate ? "9999-12" : c.endDate.slice(0, 7));

/** هل العقد ساري في هذا الشهر؟ */
export const covers = (c: Contract, period: string) => startPeriod(c) <= period && endPeriod(c) >= period;

/** العقد كما يُقرأ من قاعدة البيانات: المفتوح بلا نهاية، والحالة إمّا ساري أو منتهٍ. */
export function normalizeContract(c: Contract): Contract {
  if (c.status === "terminated") return c;
  return { ...c, status: "active", endDate: "" };
}

export const prevPeriod = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const lastDayOf = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${p}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};

const newer = (a: Contract, b: Contract) =>
  a.startDate > b.startDate || (a.startDate === b.startDate && a.createdAt > b.createdAt);

/**
 * عقود الشهر: عقد واحد لكل وحدة — الأحدث بدايةً إن تداخل عقدان على الوحدة نفسها
 * (بيانات قديمة كان يُنهى فيها العقد دون تعديل تاريخه).
 */
export function monthContracts(contracts: Contract[], period: string): Contract[] {
  const byUnit = new Map<string, Contract>();
  for (const c of contracts) {
    if (!covers(c, period)) continue;
    const cur = byUnit.get(c.unitId);
    if (!cur || newer(c, cur)) byUnit.set(c.unitId, c);
  }
  return [...byUnit.values()];
}

/** عقد الوحدة الساري في الشهر فقط — مستأجر يبدأ لاحقًا لا يظهر قبل شهره. */
export function currentContract(data: AppData, unitId: string, period = thisPeriod()): Contract | undefined {
  return monthContracts(data.contracts.filter((c) => c.unitId === unitId), period)[0];
}

/** هل العقد يبدأ بعد هذا الشهر؟ */
export const isUpcoming = (c: Contract, period = thisPeriod()) => startPeriod(c) > period;

/**
 * حالة الوحدات تتبع الشهر الحالي: مشغولة إن كان عليها عقد ساري هذا الشهر.
 * تُستدعى عند التحميل حتى تنتقل الوحدة لـ«مشغولة» تلقائيًا حين يحلّ شهر المستأجر الجديد.
 * الوحدات التي لم يُسجَّل عليها أي عقد تبقى كما هي.
 */
export function syncUnitStatuses(d: AppData, period = thisPeriod()): AppData {
  const withContract = new Set(d.contracts.map((c) => c.unitId));
  const busy = new Set(monthContracts(d.contracts, period).map((c) => c.unitId));
  return {
    ...d,
    units: d.units.map((u) => {
      if (!withContract.has(u.id) || (u.status !== "occupied" && u.status !== "vacant")) return u;
      const status = busy.has(u.id) ? "occupied" : "vacant";
      return u.status === status ? u : { ...u, status };
    }),
  };
}

/** عقد الوحدة في الشهر، وإلا عقدها المفتوح القادم. */
export function unitContract(data: AppData, unitId: string, period = thisPeriod()): Contract | undefined {
  const own = data.contracts.filter((c) => c.unitId === unitId);
  return monthContracts(own, period)[0]
    ?? own.filter(isOpen).sort((a, b) => (newer(a, b) ? -1 : 1))[0];
}

/* ================================ التعديل ================================ */

export interface ContractInput {
  unitId: string;
  name: string;
  civilId: string;
  phone: string;
  nationality: string;
  workplace: string;
  rent: number;
  deposit: number;
  occupants: number;
  durationText: string;
  signedAt: string;
  payMethod: PayMethod;
}

const TENANT_KEYS = ["name", "civilId", "phone", "nationality", "workplace"] as const;
const CONTRACT_KEYS = ["rent", "deposit", "occupants", "durationText", "signedAt", "payMethod"] as const;

const tenantPart = (f: ContractInput) => ({
  name: f.name.trim(),
  civilId: f.civilId.trim(),
  phone: f.phone.trim(),
  nationality: f.nationality.trim() || undefined,
  workplace: f.workplace.trim() || undefined,
});

const contractPart = (f: ContractInput) => ({
  rent: +f.rent || 0,
  deposit: +f.deposit || 0,
  occupants: +f.occupants || undefined,
  durationText: f.durationText.trim() || undefined,
  signedAt: f.signedAt || undefined,
  payMethod: f.payMethod,
});

const nextNo = (d: AppData) => {
  const max = d.contracts.reduce((m, c) => {
    const n = Number(String(c.no).replace("ع-", "").trim());
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `ع-${max + 1}`;
};

/** الوحدة مشغولة ما دام عليها عقد ساري هذا الشهر (المستأجر القادم لا يشغلها قبل شهره). */
function syncUnit(d: AppData, unitId: string) {
  const u = d.units.find((x) => x.id === unitId);
  if (u) u.status = currentContract(d, unitId) ? "occupied" : "vacant";
}

/** المستأجر نشط ما دام له عقد مفتوح؛ ويُحذف إن لم يبقَ له أي عقد. */
function syncTenant(d: AppData, tenantId: string) {
  const has = d.contracts.filter((c) => c.tenantId === tenantId);
  if (!has.length) {
    d.tenants = d.tenants.filter((t) => t.id !== tenantId);
    return;
  }
  const t = d.tenants.find((x) => x.id === tenantId);
  if (t) t.active = has.some(isOpen);
}

/** ينهي العقد في آخر يوم قبل `from`؛ وإن لم يكن قد بدأ بعد يُحذف مع دفعاته. */
function endBefore(d: AppData, c: Contract, from: string) {
  if (from <= startPeriod(c)) {
    d.contracts = d.contracts.filter((x) => x.id !== c.id);
    d.payments = d.payments.filter((p) => p.contractId !== c.id);
    return;
  }
  const end = lastDayOf(prevPeriod(from));
  if (isOpen(c) || c.endDate > end) {
    c.status = "terminated";
    c.endDate = end;
  }
  d.payments = d.payments.filter((p) => !(p.contractId === c.id && p.period >= from));
}

/** مستأجر جديد على وحدة، يسري من الشهر `from` وما بعده. */
export function addContract(d: AppData, f: ContractInput, from: string): Contract | undefined {
  const unit = d.units.find((u) => u.id === f.unitId);
  if (!unit) return;
  // أي عقد على الوحدة نفسها يتوقف قبل هذا الشهر
  d.contracts
    .filter((c) => c.unitId === unit.id && (covers(c, from) || startPeriod(c) > from))
    .forEach((c) => endBefore(d, c, from));

  const now = new Date().toISOString();
  const tenant: Tenant = { id: uid("t-"), buildingId: unit.buildingId, ...tenantPart(f), active: true, createdAt: now };
  d.tenants.push(tenant);
  const contract: Contract = {
    id: uid("c-"),
    no: nextNo(d),
    buildingId: unit.buildingId,
    unitId: unit.id,
    tenantId: tenant.id,
    startDate: `${from}-01`,
    endDate: "",
    firstRentedAt: `${from}-01`,
    dueDay: d.settings.dueDay || 5,
    ...contractPart(f),
    status: "active",
    createdAt: now,
  };
  d.contracts.push(contract);
  syncUnit(d, unit.id);
  return contract;
}

/**
 * تعديل عقد من الشهر `from`.
 * إن كان `from` هو شهر بداية العقد يُعدَّل في مكانه، وإلا تبقى النسخة القديمة
 * للأشهر السابقة وتبدأ نسخة جديدة من `from` — وتنتقل إليها دفعات ذلك الشهر وما بعده.
 */
export function editContract(d: AppData, contractId: string, f: ContractInput, from: string) {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c) return;
  const t = d.tenants.find((x) => x.id === c.tenantId);
  const tp = tenantPart(f);
  const cp = contractPart(f);
  const tenantChanged = !t || TENANT_KEYS.some((k) => (t[k] ?? "") !== (tp[k] ?? ""));
  const contractChanged = CONTRACT_KEYS.some((k) => (c[k] ?? "") !== (cp[k] ?? ""));
  if (!tenantChanged && !contractChanged) return;

  /** المستأجر لهذه النسخة: يُعدَّل في مكانه إن لم تشاركه نسخة أخرى، وإلا نسخة جديدة منه. */
  const tenantFor = (target: Contract) => {
    if (!tenantChanged) return c.tenantId;
    const shared = d.contracts.some((x) => x.id !== target.id && x.tenantId === c.tenantId);
    if (t && !shared) {
      Object.assign(t, tp);
      return t.id;
    }
    const nt: Tenant = {
      ...(t ?? { buildingId: c.buildingId, active: true }),
      ...tp,
      id: uid("t-"),
      active: true,
      createdAt: new Date().toISOString(),
    };
    d.tenants.push(nt);
    return nt.id;
  };

  if (from <= startPeriod(c)) {
    Object.assign(c, cp);
    c.tenantId = tenantFor(c);
    d.payments.forEach((p) => { if (p.contractId === c.id) p.tenantId = c.tenantId; });
  } else {
    const next: Contract = {
      ...c,
      ...cp,
      id: uid("c-"),
      no: nextNo(d),
      startDate: `${from}-01`,
      createdAt: new Date().toISOString(),
    };
    d.contracts.push(next);
    next.tenantId = tenantFor(next);
    // دفعات هذا الشهر وما بعده تنتقل للنسخة الجديدة
    d.payments.forEach((p) => {
      if (p.contractId === c.id && p.period >= from) { p.contractId = next.id; p.tenantId = next.tenantId; }
    });
    c.status = "terminated";
    c.endDate = lastDayOf(prevPeriod(from));
  }
  syncTenant(d, t?.id ?? c.tenantId);
  syncUnit(d, c.unitId);
}

/** حذف المستأجر من الشهر `from` وما بعده؛ الأشهر السابقة تبقى كما هي. */
export function removeContract(d: AppData, contractId: string, from: string) {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c) return;
  endBefore(d, c, from);
  syncTenant(d, c.tenantId);
  syncUnit(d, c.unitId);
}

/** إخلاء بتاريخ محدد: يبقى العقد ساريًا حتى شهر الإخلاء ثم تُفرَّغ الوحدة. */
export function vacateContract(d: AppData, contractId: string, date: string) {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c) return;
  const month = date.slice(0, 7);
  if (month < startPeriod(c)) return removeContract(d, contractId, startPeriod(c));
  c.status = "terminated";
  c.endDate = date;
  d.payments = d.payments.filter((p) => !(p.contractId === c.id && p.period > month));
  syncTenant(d, c.tenantId);
  syncUnit(d, c.unitId);
}

/** قيم النموذج من عقد قائم أو لوحدة فارغة. */
export function contractInput(d: AppData, c?: Contract, unitId?: string): ContractInput {
  const t = c ? d.tenants.find((x) => x.id === c.tenantId) : undefined;
  const unit = d.units.find((u) => u.id === (c?.unitId ?? unitId));
  return {
    unitId: c?.unitId ?? unitId ?? "",
    name: t?.name ?? "",
    civilId: t?.civilId ?? "",
    phone: t?.phone ?? "",
    nationality: t?.nationality ?? "",
    workplace: t?.workplace ?? "",
    rent: c?.rent ?? unit?.baseRent ?? 0,
    deposit: c?.deposit ?? unit?.baseRent ?? 0,
    occupants: c?.occupants ?? 0,
    durationText: c?.durationText ?? "سنة",
    signedAt: c?.signedAt ?? "",
    payMethod: c?.payMethod ?? "cash",
  };
}
