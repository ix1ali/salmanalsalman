import type { AppData, Contract, Expense, Payment, Tenant, Unit } from "./types";
import { currentContract, monthContracts } from "./contracts";

export interface Scope {
  units: Unit[];
  contracts: Contract[];
  payments: Payment[];
  expenses: Expense[];
  tenantIds: Set<string>;
  tenants: Tenant[];
}

/** Narrow the whole dataset to one building (or all buildings). */
export function scope(data: AppData, buildingId: string): Scope {
  const all = buildingId === "all";
  const units = all ? data.units : data.units.filter((u) => u.buildingId === buildingId);
  const contracts = all ? data.contracts : data.contracts.filter((c) => c.buildingId === buildingId);
  const payments = all ? data.payments : data.payments.filter((p) => p.buildingId === buildingId);
  const expenses = all ? data.expenses : data.expenses.filter((e) => e.buildingId === buildingId);
  const tenantIds = new Set(contracts.map((c) => c.tenantId));
  // المستأجر يتبع عقاره مباشرة؛ ويبقى شرط العقد لبيانات قديمة بلا عقار محدَّد
  const tenants = all
    ? data.tenants
    : data.tenants.filter((t) => t.buildingId === buildingId || (!t.buildingId && tenantIds.has(t.id)));
  return { units, contracts, payments, expenses, tenantIds, tenants };
}

export const periodOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function lastPeriods(n: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(periodOf(new Date(from.getFullYear(), from.getMonth() - i, 1)));
  return out;
}

export interface Arrear {
  contract: Contract;
  unit?: Unit;
  tenant?: Tenant;
  missing: string[];
  amount: number;
}

/**
 * الأشهر غير المسدَّدة — من قائمة الكشف المالي نفسها لكل شهر.
 *
 * لا تُحتسب أي متأخرات قبل `settings.trackingStartPeriod` — وهو الشهر الذي بدأ
 * فيه استخدام النظام — حتى لا تظهر مطالبات عن فترة كانت تُدار على الورق.
 */
export function arrears(data: AppData, s: Scope, lookback = 24): Arrear[] {
  const from = data.settings.trackingStartPeriod ?? "0000-00";
  const periods = lastPeriods(lookback).filter((p) => p >= from);
  const paidKey = new Set(s.payments.map((p) => `${p.contractId ?? p.unitId}|${p.period}`));
  const unitById = new Map(data.units.map((u) => [u.id, u]));
  const tenantById = new Map(data.tenants.map((t) => [t.id, t]));

  const byContract = new Map<string, Arrear>();
  for (const p of periods) {
    for (const c of monthContracts(s.contracts, p)) {
      if (paidKey.has(`${c.id}|${p}`)) continue;
      const a = byContract.get(c.id)
        ?? { contract: c, unit: unitById.get(c.unitId), tenant: tenantById.get(c.tenantId), missing: [], amount: 0 };
      a.missing.push(p);
      a.amount += c.rent;
      byContract.set(c.id, a);
    }
  }
  return [...byContract.values()].sort((a, b) => b.amount - a.amount);
}

/** مجموع المتأخرات لمجموعة عقود (نسخ عقد الشقة أو المستأجر) مرتّبة بالشهر. */
export function arrearsOf(list: Arrear[], match: (c: Contract) => boolean) {
  const hit = list.filter((a) => match(a.contract));
  return {
    amount: hit.reduce((x, a) => x + a.amount, 0),
    missing: hit.flatMap((a) => a.missing).sort(),
  };
}

export interface Kpis {
  totalUnits: number;
  occupied: number;
  vacant: number;
  occupancyRate: number;
  monthlyRentRoll: number;
  collectedThisMonth: number;
  expectedThisMonth: number;
  collectionRate: number;
  expensesThisMonth: number;
  netThisMonth: number;
  arrearsTotal: number;
  arrearsCount: number;
  flaggedUnits: number;
  tenantsCount: number;
}

export function kpis(data: AppData, buildingId: string): Kpis {
  const s = scope(data, buildingId);
  const p = periodOf(new Date());
  const active = monthContracts(s.contracts, p);
  const monthlyRentRoll = active.reduce((a, c) => a + c.rent, 0);
  const collectedThisMonth = s.payments.filter((x) => x.period === p).reduce((a, x) => a + x.amount, 0);
  const expensesThisMonth = s.expenses.filter((e) => e.date.slice(0, 7) === p).reduce((a, e) => a + e.amount, 0);
  const ar = arrears(data, s);

  const by = (st: Unit["status"]) => s.units.filter((u) => u.status === st).length;
  const totalUnits = s.units.length;
  const occupied = by("occupied");

  return {
    totalUnits,
    occupied,
    vacant: by("vacant"),
    occupancyRate: totalUnits ? (occupied / totalUnits) * 100 : 0,
    monthlyRentRoll,
    collectedThisMonth,
    expectedThisMonth: monthlyRentRoll,
    collectionRate: monthlyRentRoll ? (collectedThisMonth / monthlyRentRoll) * 100 : 0,
    expensesThisMonth,
    netThisMonth: collectedThisMonth - expensesThisMonth,
    arrearsTotal: ar.reduce((a, x) => a + x.amount, 0),
    arrearsCount: ar.length,
    flaggedUnits: s.units.filter((u) => u.flagged).length,
    tenantsCount: new Set(active.map((c) => c.tenantId)).size,
  };
}

export interface MonthPoint { period: string; income: number; expense: number; net: number }

export function monthlySeries(data: AppData, buildingId: string, months = 6): MonthPoint[] {
  const s = scope(data, buildingId);
  return lastPeriods(months).map((period) => {
    const income = s.payments.filter((p) => p.period === period).reduce((a, p) => a + p.amount, 0);
    const expense = s.expenses.filter((e) => e.date.slice(0, 7) === period).reduce((a, e) => a + e.amount, 0);
    return { period, income, expense, net: income - expense };
  });
}

/** Occupancy + income breakdown per floor. */
export interface FloorStat {
  floorId: string;
  level: number;
  name: string;
  units: Unit[];
  occupied: number;
  vacant: number;
  flagged: number;
  rent: number;
}

export function floorStats(data: AppData, buildingId: string): FloorStat[] {
  const floors = data.floors.filter((f) => f.buildingId === buildingId);
  return floors
    .map((f) => {
      const units = data.units.filter((u) => u.floorId === f.id);
      return {
        floorId: f.id,
        level: f.level,
        name: f.name,
        units,
        occupied: units.filter((u) => u.status === "occupied").length,
        vacant: units.filter((u) => u.status === "vacant").length,
        flagged: units.filter((u) => u.flagged).length,
        rent: units.reduce((a, u) => a + (u.status === "occupied" ? u.baseRent : 0), 0),
      };
    })
    .sort((a, b) => b.level - a.level);
}

/** مستأجر الوحدة هذا الشهر — من يبدأ في شهر لاحق لا يظهر قبله. */
export function tenantOfUnit(data: AppData, unitId: string) {
  const c = currentContract(data, unitId);
  if (!c) return { contract: undefined, tenant: undefined };
  return { contract: c, tenant: data.tenants.find((t) => t.id === c.tenantId) };
}

/** متأخرات الشقة بكل نسخ عقودها. */
export function unitBalance(data: AppData, unitId: string) {
  const unit = data.units.find((u) => u.id === unitId);
  if (!unit) return { due: 0, missing: [] as string[] };
  const r = arrearsOf(arrears(data, scope(data, unit.buildingId)), (c) => c.unitId === unitId);
  return { due: r.amount, missing: r.missing };
}
