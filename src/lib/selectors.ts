import type { AppData, Contract, Expense, Payment, Tenant, Unit } from "./types";

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
  const tenants = all ? data.tenants : data.tenants.filter((t) => tenantIds.has(t.id));
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
 * Unpaid months for every active contract, looking back at most 12 months
 * and never before the contract start.
 */
export function arrears(data: AppData, s: Scope, lookback = 12): Arrear[] {
  const now = new Date();
  const periods = lastPeriods(lookback, now);
  const paidKey = new Set(s.payments.map((p) => `${p.contractId ?? p.unitId}|${p.period}`));
  const unitById = new Map(data.units.map((u) => [u.id, u]));
  const tenantById = new Map(data.tenants.map((t) => [t.id, t]));

  const out: Arrear[] = [];
  for (const c of s.contracts) {
    if (c.status === "terminated") continue;
    const start = c.startDate.slice(0, 7);
    const end = c.endDate.slice(0, 7);
    const missing = periods.filter((p) => p >= start && p <= end && !paidKey.has(`${c.id}|${p}`));
    if (!missing.length) continue;
    out.push({
      contract: c,
      unit: unitById.get(c.unitId),
      tenant: tenantById.get(c.tenantId),
      missing,
      amount: missing.length * c.rent,
    });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export interface Kpis {
  totalUnits: number;
  occupied: number;
  vacant: number;
  maintenance: number;
  reserved: number;
  occupancyRate: number;
  monthlyRentRoll: number;
  collectedThisMonth: number;
  expectedThisMonth: number;
  collectionRate: number;
  expensesThisMonth: number;
  netThisMonth: number;
  arrearsTotal: number;
  arrearsCount: number;
  expiringSoon: number;
  openTickets: number;
  tenantsCount: number;
}

export function kpis(data: AppData, buildingId: string): Kpis {
  const s = scope(data, buildingId);
  const p = periodOf(new Date());
  const active = s.contracts.filter((c) => c.status === "active");
  const monthlyRentRoll = active.reduce((a, c) => a + c.rent, 0);
  const collectedThisMonth = s.payments.filter((x) => x.period === p).reduce((a, x) => a + x.amount, 0);
  const expensesThisMonth = s.expenses.filter((e) => e.date.slice(0, 7) === p).reduce((a, e) => a + e.amount, 0);
  const ar = arrears(data, s);
  const alertDays = data.settings.contractAlertDays;
  const now = Date.now();
  const expiringSoon = active.filter((c) => {
    const d = new Date(c.endDate).getTime() - now;
    return d >= 0 && d <= alertDays * 86400000;
  }).length;
  const tickets = buildingId === "all" ? data.tickets : data.tickets.filter((t) => t.buildingId === buildingId);

  const by = (st: Unit["status"]) => s.units.filter((u) => u.status === st).length;
  const totalUnits = s.units.length;
  const occupied = by("occupied");

  return {
    totalUnits,
    occupied,
    vacant: by("vacant"),
    maintenance: by("maintenance"),
    reserved: by("reserved"),
    occupancyRate: totalUnits ? (occupied / totalUnits) * 100 : 0,
    monthlyRentRoll,
    collectedThisMonth,
    expectedThisMonth: monthlyRentRoll,
    collectionRate: monthlyRentRoll ? (collectedThisMonth / monthlyRentRoll) * 100 : 0,
    expensesThisMonth,
    netThisMonth: collectedThisMonth - expensesThisMonth,
    arrearsTotal: ar.reduce((a, x) => a + x.amount, 0),
    arrearsCount: ar.length,
    expiringSoon,
    openTickets: tickets.filter((t) => t.status === "new" || t.status === "in_progress").length,
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

/** Occupancy + income breakdown per floor, used by the 3D tower. */
export interface FloorStat {
  floorId: string;
  level: number;
  name: string;
  units: Unit[];
  occupied: number;
  vacant: number;
  maintenance: number;
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
        maintenance: units.filter((u) => u.status === "maintenance").length,
        rent: units.reduce((a, u) => a + (u.status === "occupied" ? u.baseRent : 0), 0),
      };
    })
    .sort((a, b) => b.level - a.level);
}

export function tenantOfUnit(data: AppData, unitId: string) {
  const c = data.contracts.find((x) => x.unitId === unitId && x.status === "active")
    ?? data.contracts.find((x) => x.unitId === unitId);
  if (!c) return { contract: undefined, tenant: undefined };
  return { contract: c, tenant: data.tenants.find((t) => t.id === c.tenantId) };
}

export function unitBalance(data: AppData, unitId: string) {
  const { contract } = tenantOfUnit(data, unitId);
  if (!contract) return { due: 0, missing: [] as string[] };
  const s = scope(data, contract.buildingId);
  const a = arrears(data, s).find((x) => x.contract.id === contract.id);
  return { due: a?.amount ?? 0, missing: a?.missing ?? [] };
}
