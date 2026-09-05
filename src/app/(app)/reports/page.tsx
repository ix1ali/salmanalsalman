"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { floorStats, lastPeriods, monthlySeries, scope } from "@/lib/selectors";
import { KWD, expenseLabel, kindLabel, monthAr, num, pct, statusLabel, thisPeriod } from "@/lib/format";
import { Empty, PageHeader, Progress, ScrollTable, Segmented, Select } from "@/components/ui";
import { BarChart, HBars } from "@/components/Charts";
import { Icon } from "@/components/Icons";
import { BuildingStatementDoc, PrintOverlay, TenantStatementDoc } from "@/components/print";

type Tab = "monthly" | "rentroll" | "tenant" | "occupancy";

export default function ReportsPage() {
  const { data, activeBuilding } = useStore();
  const { allow } = useAuth();
  const [tab, setTab] = useState<Tab>("monthly");

  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;
  const [bId, setBId] = useState(buildingId);
  const [period, setPeriod] = useState(thisPeriod());
  const [tenantId, setTenantId] = useState("");
  const [printKind, setPrintKind] = useState<null | "building" | "tenant">(null);

  const periods = useMemo(() => lastPeriods(12).reverse(), []);
  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const series = useMemo(() => monthlySeries(data, activeBuilding, 12), [data, activeBuilding]);
  const floors = useMemo(() => floorStats(data, bId || buildingId), [data, bId, buildingId]);

  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);
  const buildingById = useMemo(() => new Map(data.buildings.map((b) => [b.id, b])), [data.buildings]);

  const rentRoll = useMemo(() => {
    return s.units
      .map((u) => {
        const c = data.contracts.find((x) => x.unitId === u.id && (x.status === "active" || x.status === "upcoming"));
        return { unit: u, contract: c, tenant: c ? tenantById.get(c.tenantId) : undefined };
      })
      .sort((a, b) => a.unit.number.localeCompare(b.unit.number, "ar", { numeric: true }));
  }, [s.units, data.contracts, tenantById]);

  const rentRollTotals = useMemo(
    () => ({
      potential: rentRoll.reduce((a, r) => a + r.unit.baseRent, 0),
      actual: rentRoll.reduce((a, r) => a + (r.contract?.rent ?? 0), 0),
      area: rentRoll.reduce((a, r) => a + (r.unit.area ?? 0), 0),
    }),
    [rentRoll]
  );

  const expenseYear = useMemo(() => {
    const y = new Date().getFullYear().toString();
    const map = new Map<string, number>();
    s.expenses.filter((e) => e.date.startsWith(y)).forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    const colors = ["var(--primary)", "var(--steel)", "var(--gold)", "var(--primary-600)", "var(--danger)", "#64748b", "var(--gold-600)", "var(--steel)"];
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([c, v], i) => ({
      label: expenseLabel[c as keyof typeof expenseLabel] ?? c, value: v, color: colors[i % colors.length],
    }));
  }, [s.expenses]);

  const exportRentRoll = () => {
    const rows = [
      ["الوحدة", "الدور", "النوع", "المساحة", "الحالة", "المستأجر", "الهاتف", "الإيجار المتعاقد", "الإيجار الأساسي"],
      ...rentRoll.map((r) => [
        r.unit.number,
        data.floors.find((f) => f.id === r.unit.floorId)?.name ?? "",
        kindLabel[r.unit.kind],
        String(r.unit.area ?? ""),
        statusLabel[r.unit.status],
        r.tenant?.name ?? "",
        r.tenant?.phone ?? "",
        String(r.contract?.rent ?? 0),
        String(r.unit.baseRent),
      ]),
    ];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `كشف-الإيجارات-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const tenantOptions = useMemo(
    () => data.tenants.filter((t) => activeBuilding === "all" || s.tenantIds.has(t.id)).sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [data.tenants, s.tenantIds, activeBuilding]
  );

  return (
    <div className="space-y-4">
      <PageHeader title="الكشوفات المالية" subtitle="تقارير جاهزة للطباعة والتصدير" icon="chart" />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "monthly", label: "كشف شهري" },
          { value: "rentroll", label: "كشف الإيجارات" },
          { value: "tenant", label: "كشف مستأجر" },
          { value: "occupancy", label: "الإشغال" },
        ]}
      />

      {tab === "monthly" && (
        <div className="space-y-4">
          <div className="card card-lg p-4">
            <h2 className="mb-3 text-[15px]">إصدار كشف مالي شهري</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">العمارة</label>
                <Select value={bId || buildingId} onChange={(e) => setBId(e.target.value)}>
                  {data.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">الشهر</label>
                <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {periods.map((p) => <option key={p} value={p}>{monthAr(p)}</option>)}
                </Select>
              </div>
            </div>
            <button className="btn btn-primary mt-3 w-full" onClick={() => setPrintKind("building")}>
              <Icon name="print" size={16} /> عرض وطباعة الكشف
            </button>
          </div>

          <div className="card card-lg p-4">
            <h2 className="mb-2 text-[15px]">الدخل والمصاريف — ١٢ شهر</h2>
            <BarChart
              points={series.map((m) => ({ label: monthAr(m.period).split(" ")[0].slice(0, 3), a: m.income, b: m.expense }))}
              aLabel="المقبوضات" bLabel="المصاريف" bColor="var(--gold)" height={210}
            />
          </div>

          <div className="card card-lg p-4">
            <h2 className="mb-3 text-[15px]">المصاريف السنوية حسب البند</h2>
            {expenseYear.length ? <HBars items={expenseYear} /> : <p className="py-6 text-center text-[13px] text-[var(--muted)]">لا توجد بيانات</p>}
          </div>

          <ScrollTable head={["الشهر", "المقبوضات", "المصاريف", "الصافي"]}>
            {[...series].reverse().map((m) => (
              <tr key={m.period}>
                <td className="td font-bold">{monthAr(m.period)}</td>
                <td className="td tabular-nums text-[var(--ok)]">{KWD(m.income, false)}</td>
                <td className="td tabular-nums text-[var(--gold-600)]">{KWD(m.expense, false)}</td>
                <td className="td font-extrabold tabular-nums" style={{ color: m.net >= 0 ? "var(--primary-700)" : "#b3303b" }}>
                  {KWD(m.net, false)}
                </td>
              </tr>
            ))}
          </ScrollTable>
        </div>
      )}

      {tab === "rentroll" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["الإيجار المتعاقد", KWD(rentRollTotals.actual, false), "var(--primary-050)", "var(--primary-700)"],
              ["الإيجار الكامل", KWD(rentRollTotals.potential, false), "#eef3f7", "#48607a"],
              ["الفاقد", KWD(rentRollTotals.potential - rentRollTotals.actual, false), "var(--danger-050)", "#b3303b"],
            ].map(([l, v, bg, c]) => (
              <div key={l} className="rounded-2xl p-3 text-center" style={{ background: bg }}>
                <p className="text-[11px] font-bold" style={{ color: c }}>{l}</p>
                <p className="display text-[15px] tabular-nums" style={{ color: c }}>{v}</p>
              </div>
            ))}
          </div>

          {allow("data.export") && (
            <button className="btn btn-ghost btn-sm" onClick={exportRentRoll}>
              <Icon name="download" size={15} /> تصدير Excel/CSV
            </button>
          )}

          <ScrollTable head={["الوحدة", "الدور", "النوع", "م²", "الحالة", "المستأجر", "الإيجار"]}>
            {rentRoll.map((r) => (
              <tr key={r.unit.id}>
                <td className="td font-extrabold">{r.unit.number}</td>
                <td className="td">{data.floors.find((f) => f.id === r.unit.floorId)?.name ?? "—"}</td>
                <td className="td">{kindLabel[r.unit.kind]}</td>
                <td className="td tabular-nums">{r.unit.area ?? "—"}</td>
                <td className="td">{statusLabel[r.unit.status]}</td>
                <td className="td">{r.tenant?.name ?? "—"}</td>
                <td className="td font-bold tabular-nums">{KWD(r.contract?.rent ?? r.unit.baseRent, false)}</td>
              </tr>
            ))}
          </ScrollTable>
        </div>
      )}

      {tab === "tenant" && (
        <div className="space-y-4">
          <div className="card card-lg p-4">
            <h2 className="mb-3 text-[15px]">كشف حساب مستأجر</h2>
            <label className="label">اختر المستأجر</label>
            <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">— اختر —</option>
              {tenantOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <button className="btn btn-primary mt-3 w-full" disabled={!tenantId} onClick={() => setPrintKind("tenant")}>
              <Icon name="print" size={16} /> عرض وطباعة الكشف
            </button>
          </div>
          {!tenantOptions.length && <Empty icon="users" title="ما فيه مستأجرين" />}
        </div>
      )}

      {tab === "occupancy" && (
        <div className="space-y-3">
          {data.buildings.length > 1 && (
            <Select value={bId || buildingId} onChange={(e) => setBId(e.target.value)}>
              {data.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          {floors.map((f) => {
            const rate = f.units.length ? (f.occupied / f.units.length) * 100 : 0;
            return (
              <div key={f.floorId} className="card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--bg-soft)]">
                      <Icon name="layers" size={15} />
                    </span>
                    <div>
                      <p className="text-[13.5px] font-extrabold">{f.name}</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {num(f.units.length)} وحدة · مؤجرة {num(f.occupied)} · فاضية {num(f.vacant)}
                        {f.maintenance ? ` · صيانة ${num(f.maintenance)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="display text-[15px] tabular-nums">{pct(rate)}</p>
                    {allow("finance.view") && <p className="text-[11px] text-[var(--muted)]">{KWD(f.rent, false)} د.ك</p>}
                  </div>
                </div>
                <Progress value={rate} tone={rate >= 80 ? "green" : rate >= 50 ? "amber" : "rose"} />
              </div>
            );
          })}
          {!floors.length && <Empty icon="building" title="ما فيه أدوار" />}
        </div>
      )}

      <PrintOverlay
        open={printKind === "building"}
        onClose={() => setPrintKind(null)}
        fileTitle={`كشف ${buildingById.get(bId || buildingId)?.name ?? ""} — ${monthAr(period)}`}
      >
        <BuildingStatementDoc buildingId={bId || buildingId} period={period} />
      </PrintOverlay>

      <PrintOverlay
        open={printKind === "tenant"}
        onClose={() => setPrintKind(null)}
        fileTitle={`كشف حساب — ${tenantById.get(tenantId)?.name ?? ""}`}
      >
        {tenantId && <TenantStatementDoc tenantId={tenantId} />}
      </PrintOverlay>
    </div>
  );
}
