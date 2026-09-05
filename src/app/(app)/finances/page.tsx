"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, lastPeriods, monthlySeries, scope } from "@/lib/selectors";
import {
  EXPENSE_ORDER, KWD, amount, dateShort, expenseLabel, methodLabel, monthAr,
  monthsLabel, num, pct, thisPeriod,
} from "@/lib/format";
import {
  Chip, Empty, Money, PageHeader, Progress, SearchBox, Segmented, Select, useConfirm,
} from "@/components/ui";
import { BarChart } from "@/components/Charts";
import { Icon } from "@/components/Icons";
import { ExpenseForm, PaymentForm } from "@/components/forms";
import { ManualContract, ManualReceipt } from "@/components/ManualDocs";
import type { Expense, ExpenseCategory } from "@/lib/types";

type Tab = "collect" | "expenses" | "profit" | "arrears" | "forms";

export default function FinancesPage() {
  const { data, update, activeBuilding } = useStore();
  const { user, allow } = useAuth();
  const { confirm, dialog } = useConfirm();

  const [tab, setTab] = useState<Tab>("collect");
  const [period, setPeriod] = useState(thisPeriod());
  const [q, setQ] = useState("");
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [cat, setCat] = useState<"all" | ExpenseCategory>("all");
  const [payFor, setPayFor] = useState<{ contractId: string; period: string } | null>(null);
  const [addExpense, setAddExpense] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && ["collect", "expenses", "profit", "arrears", "forms"].includes(t)) setTab(t as Tab);
  }, []);

  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const periods = useMemo(() => lastPeriods(13).reverse(), []);
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);

  /* --------------------------- كشف تحصيل الشهر --------------------------- */
  const sheet = useMemo(() => {
    const paid = new Map(s.payments.filter((p) => p.period === period).map((p) => [p.contractId ?? p.unitId, p]));
    const needle = q.trim().toLowerCase();
    return s.contracts
      .filter((c) => c.status === "active" && c.startDate.slice(0, 7) <= period && c.endDate.slice(0, 7) >= period)
      .map((c) => ({
        contract: c,
        unit: unitById.get(c.unitId),
        tenant: tenantById.get(c.tenantId),
        payment: paid.get(c.id),
      }))
      .filter((r) => {
        if (onlyUnpaid && r.payment) return false;
        if (!needle) return true;
        return (
          (r.unit?.number ?? "").toLowerCase().includes(needle) ||
          (r.tenant?.name ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (!a.payment !== !b.payment) return a.payment ? 1 : -1;
        return (a.unit?.number ?? "").localeCompare(b.unit?.number ?? "", "ar", { numeric: true });
      });
  }, [s.contracts, s.payments, period, q, onlyUnpaid, unitById, tenantById]);

  const totals = useMemo(() => {
    const active = s.contracts.filter(
      (c) => c.status === "active" && c.startDate.slice(0, 7) <= period && c.endDate.slice(0, 7) >= period
    );
    const due = active.reduce((a, c) => a + c.rent, 0);
    const monthPays = s.payments.filter((p) => p.period === period);
    const got = monthPays.reduce((a, p) => a + p.amount, 0);
    const spent = s.expenses.filter((e) => e.date.slice(0, 7) === period).reduce((a, e) => a + e.amount, 0);
    return {
      due, got, spent, net: got - spent,
      left: Math.max(0, due - got),
      count: active.length,
      paidCount: monthPays.length,
    };
  }, [s.contracts, s.payments, s.expenses, period]);

  const ar = useMemo(() => arrears(data, s), [data, s]);
  const arTotal = ar.reduce((a, x) => a + x.amount, 0);

  /* ------------------------------ المصروفات ------------------------------ */
  const expenses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.expenses
      .filter((e) => e.date.slice(0, 7) === period)
      .filter((e) => cat === "all" || e.category === cat)
      .filter((e) => !needle || e.title.toLowerCase().includes(needle) || (e.vendor ?? "").toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [s.expenses, q, period, cat]);

  const expenseByCat = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    s.expenses.filter((e) => e.date.slice(0, 7) === period)
      .forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return EXPENSE_ORDER.filter((c) => m.get(c)).map((c) => ({ cat: c, value: m.get(c)! }));
  }, [s.expenses, period]);

  const monthExpenseTotal = expenseByCat.reduce((a, x) => a + x.value, 0);

  /* -------------------------------- الأرباح ------------------------------- */
  const series = useMemo(() => monthlySeries(data, activeBuilding, 12), [data, activeBuilding]);
  const year = period.slice(0, 4);
  const yearly = useMemo(() => {
    const income = s.payments.filter((p) => p.period.startsWith(year)).reduce((a, p) => a + p.amount, 0);
    const spent = s.expenses.filter((e) => e.date.startsWith(year)).reduce((a, e) => a + e.amount, 0);
    const potential = s.contracts.filter((c) => c.status === "active").reduce((a, c) => a + c.rent, 0) * 12;
    return { income, spent, net: income - spent, potential };
  }, [s.payments, s.expenses, s.contracts, year]);

  const removeExpense = async (e: Expense) => {
    if (!(await confirm("حذف المصروف", `سيتم حذف «${e.title}».`))) return;
    update((d) => { d.expenses = d.expenses.filter((x) => x.id !== e.id); },
      { action: "حذف مصروف", detail: e.title, actor: user?.username });
  };

  const monthPicker = (
    <div className="flex items-center gap-2">
      <Icon name="calendar" size={16} className="shrink-0 text-[var(--muted)]" />
      <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
        {periods.map((p) => <option key={p} value={p}>{monthAr(p)}</option>)}
      </Select>
    </div>
  );

  return (
    <div className="space-y-3">
      {dialog}
      <PageHeader title="المالية" subtitle="التحصيل والمصروفات والأرباح" icon="wallet" />

      <Segmented
        value={tab}
        onChange={(v) => { setTab(v); setQ(""); }}
        options={[
          { value: "collect", label: "التحصيل" },
          { value: "expenses", label: "المصروفات" },
          { value: "profit", label: "الأرباح" },
          { value: "arrears", label: "لم يتم الدفع", count: ar.length },
          ...(allow("receipts.create") ? [{ value: "forms" as const, label: "نماذج يدوية" }] : []),
        ]}
      />

      {/* ============================== التحصيل ============================== */}
      {tab === "collect" && (
        <>
          {monthPicker}

          <div className="card card-lg p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] text-[var(--muted)]">المحصَّل</p>
                <Money v={totals.got} size="xl" tone="var(--ok)" />
              </div>
              <div className="text-left">
                <p className="text-[12px] text-[var(--muted)]">إجمالي المستحق</p>
                <Money v={totals.due} size="lg" className="text-[var(--muted)]" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={totals.due ? (totals.got / totals.due) * 100 : 0} tone={totals.left ? "gold" : "green"} height={10} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] font-bold" style={{ color: totals.left ? "var(--gold-600)" : "var(--ok)" }}>
                {totals.left ? <>المتبقي <Money v={totals.left} size="sm" tone="var(--gold-600)" /></> : "تم تحصيل كامل الإيجارات"}
              </p>
              <p className="text-[12px] text-[var(--muted)]">
                سُدِّدت {num(totals.paidCount)} وحدة من {num(totals.count)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <SearchBox value={q} onChange={setQ} placeholder="رقم الشقة أو اسم المستأجر…" />
            <button
              onClick={() => setOnlyUnpaid((v) => !v)}
              className={`btn btn-sm shrink-0 ${onlyUnpaid ? "btn-primary" : "btn-ghost"}`}
            >
              <Icon name="filter" size={14} /> غير المسدَّد
            </button>
          </div>

          {sheet.length ? (
            <ul className="space-y-1.5">
              {sheet.map((r) => (
                <li key={r.contract.id} className="card flex items-center gap-3 p-2.5">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[13px] font-extrabold text-white"
                    style={{ background: r.payment ? "var(--ok)" : "var(--gold)" }}
                  >
                    {r.unit?.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold">{r.tenant?.name ?? "—"}</p>
                    <p className="truncate text-[11.5px] text-[var(--muted)]">
                      {r.payment
                        ? `سُدِّد ${dateShort(r.payment.paidAt)} · ${methodLabel[r.payment.method]}`
                        : `المستحق ${KWD(r.contract.rent)}`}
                    </p>
                  </div>
                  {r.payment ? (
                    <Money v={r.payment.amount} size="sm" tone="var(--ok)" className="shrink-0" />
                  ) : allow("receipts.create") ? (
                    <button
                      className="btn btn-gold btn-sm shrink-0"
                      onClick={() => setPayFor({ contractId: r.contract.id, period })}
                    >
                      <Icon name="plus" size={14} /> تسجيل
                    </button>
                  ) : (
                    <Chip tone="gold">لم يُسدَّد</Chip>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="checkCircle" title={onlyUnpaid ? "تم تحصيل كامل إيجارات الشهر" : "لا توجد عقود سارية في هذا الشهر"} />
          )}
        </>
      )}

      {/* ============================= المصروفات ============================= */}
      {tab === "expenses" && (
        <>
          {monthPicker}

          <div className="card card-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] text-[var(--muted)]">مصروفات {monthAr(period)}</p>
                <Money v={monthExpenseTotal} size="xl" tone="var(--gold-600)" />
              </div>
              {allow("finance.edit") && (
                <button className="btn btn-primary btn-sm shrink-0" onClick={() => setAddExpense(true)}>
                  <Icon name="plus" size={15} /> إضافة
                </button>
              )}
            </div>

            {expenseByCat.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
                {expenseByCat.map((x) => (
                  <li key={x.cat}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-[var(--ink-2)]">{expenseLabel[x.cat]}</span>
                      <Money v={x.value} size="sm" tone="var(--gold-600)" />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                      <div
                        className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-700"
                        style={{ width: `${(x.value / monthExpenseTotal) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <SearchBox value={q} onChange={setQ} placeholder="البيان أو الجهة…" />
            <Select value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory | "all")} className="!w-auto">
              <option value="all">كل البنود</option>
              {EXPENSE_ORDER.map((c) => <option key={c} value={c}>{expenseLabel[c]}</option>)}
            </Select>
          </div>

          {expenses.length ? (
            <ul className="space-y-1.5">
              {expenses.map((e) => (
                <li key={e.id} className="card flex items-center gap-3 p-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--gold-050)] text-[var(--gold-600)]">
                    <Icon name="arrowUp" size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{e.title}</p>
                    <p className="truncate text-[11.5px] text-[var(--muted)]">
                      {expenseLabel[e.category]} · {dateShort(e.date)}{e.vendor ? ` · ${e.vendor}` : ""}
                    </p>
                  </div>
                  <Money v={e.amount} size="sm" tone="var(--gold-600)" className="shrink-0" />
                  {allow("finance.edit") && (
                    <div className="flex shrink-0 gap-1">
                      <button className="btn btn-icon btn-ghost !p-1.5" onClick={() => setEditExpense(e)} aria-label="تعديل">
                        <Icon name="edit" size={14} />
                      </button>
                      <button className="btn btn-icon btn-danger !p-1.5" onClick={() => removeExpense(e)} aria-label="حذف">
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              icon="wallet"
              title={`لا توجد مصروفات في ${monthAr(period)}`}
              body="أضف فواتير الكهرباء والرواتب والصيانة لتُخصم من الدخل ويظهر صافي الربح."
              action={allow("finance.edit") ? <button className="btn btn-primary btn-sm" onClick={() => setAddExpense(true)}><Icon name="plus" size={14} /> إضافة مصروف</button> : undefined}
            />
          )}
        </>
      )}

      {/* ============================== الأرباح ============================== */}
      {tab === "profit" && (
        <>
          {monthPicker}

          {/* صافي الشهر */}
          <div className="card card-lg overflow-hidden">
            <div className="bg-[var(--primary)] p-4 text-white">
              <p className="text-[12px] text-white/70">صافي ربح {monthAr(period)}</p>
              <p className="display mt-1 text-[30px] leading-none" style={{ color: totals.net >= 0 ? "var(--gold)" : "#ff9aa4" }}>
                {amount(totals.net)} <span className="text-[15px] opacity-70">د.ك</span>
              </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--line)]">
              {[
                ["الدخل", totals.got, "var(--ok)", "arrowDown"],
                ["المصروفات", totals.spent, "var(--gold-600)", "arrowUp"],
                ["الصافي", totals.net, totals.net >= 0 ? "var(--primary)" : "#b3303b", "trend"],
              ].map(([l, v, c, ic]) => (
                <div key={l as string} className="p-3 text-center">
                  <Icon name={ic as string} size={15} className="mx-auto mb-1" style={{ color: c as string }} />
                  <Money v={v as number} size="sm" tone={c as string} />
                  <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">{l as string}</p>
                </div>
              ))}
            </div>
          </div>

          {/* الرسم */}
          <div className="card card-lg p-4">
            <p className="mb-2 text-[14px] font-extrabold">الدخل والمصروفات — ١٢ شهرًا</p>
            <BarChart
              points={series.map((m) => ({ label: monthAr(m.period).split(" ")[0].slice(0, 3), a: m.income, b: m.expense }))}
              aLabel="الدخل" bLabel="المصروفات" height={200}
            />
          </div>

          {/* جدول شهري */}
          <div className="card card-lg overflow-hidden">
            <p className="p-4 pb-2 text-[14px] font-extrabold">تفصيل الأشهر</p>
            <ul className="divide-y divide-[var(--line)]">
              {[...series].reverse().map((m) => (
                <li key={m.period} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-[74px] shrink-0 text-[12.5px] font-bold">{monthAr(m.period)}</span>
                  <span className="flex-1 text-[12px]">
                    <span className="text-[var(--muted)]">دخل </span>
                    <Money v={m.income} size="sm" tone="var(--ok)" />
                  </span>
                  <span className="flex-1 text-[12px]">
                    <span className="text-[var(--muted)]">مصروف </span>
                    <Money v={m.expense} size="sm" tone="var(--gold-600)" />
                  </span>
                  <Money
                    v={m.net}
                    size="sm"
                    className="shrink-0"
                    tone={m.net >= 0 ? "var(--primary)" : "#b3303b"}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* ملخص السنة */}
          <div className="card card-lg p-4">
            <p className="mb-3 text-[14px] font-extrabold">ملخص سنة {year}</p>
            <div className="space-y-2">
              {[
                ["إجمالي الدخل المحصَّل", yearly.income, "var(--ok)"],
                ["إجمالي المصروفات", yearly.spent, "var(--gold-600)"],
                ["صافي الربح", yearly.net, yearly.net >= 0 ? "var(--primary)" : "#b3303b"],
              ].map(([l, v, c]) => (
                <div key={l as string} className="flex items-center justify-between border-b border-[var(--line)] py-2 last:border-0">
                  <span className="text-[12.5px] font-semibold text-[var(--ink-2)]">{l as string}</span>
                  <Money v={v as number} tone={c as string} />
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-[var(--surface-2)] p-3">
              <p className="text-[11.5px] text-[var(--muted)]">
                الدخل السنوي المتوقع من العقود السارية{" "}
                <Money v={yearly.potential} size="sm" className="text-[var(--ink)]" /> — وهو ما سيتحقق إذا سُدِّدت
                جميع الإيجارات طوال السنة.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ============================ لم يتم الدفع ============================ */}
      {tab === "arrears" && (
        <>
          <div className="card card-lg flex items-center justify-between p-4">
            <div>
              <p className="text-[12px] text-[var(--muted)]">إجمالي المتأخرات</p>
              <Money v={arTotal} size="xl" tone="#b3303b" />
            </div>
            <Chip tone="rose">{num(ar.length)} مستأجر</Chip>
          </div>

          {ar.length ? (
            <ul className="space-y-1.5">
              {ar.map((a) => (
                <li key={a.contract.id} className="card p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--danger-050)] text-[12px] font-extrabold text-[#b3303b]">
                      {a.unit?.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-extrabold">{a.tenant?.name ?? "—"}</p>
                      <p className="truncate text-[11.5px] text-[var(--muted)]">
                        {a.missing.map(monthAr).slice(0, 3).join("، ")}
                        {a.missing.length > 3 ? ` وغيرها (${monthsLabel(a.missing.length)})` : ""}
                      </p>
                    </div>
                    <Money v={a.amount} className="shrink-0" tone="#b3303b" />
                  </div>
                  {a.tenant && allow("tenants.contact") && (
                    <div className="mt-2 flex gap-2">
                      <a href={`tel:${a.tenant.phone}`} className="btn btn-ghost btn-sm flex-1"><Icon name="phone" size={13} /> اتصال</a>
                      <a
                        href={`https://wa.me/965${a.tenant.phone}?text=${encodeURIComponent(
                          `السلام عليكم ${a.tenant.name}،\nتذكير بإيجار شقة ${a.unit?.number ?? ""} عن الأشهر: ${a.missing.map(monthAr).join("، ")}\nالمبلغ المستحق: ${KWD(a.amount)}\nشاكرين لكم حسن تعاونكم.`
                        )}`}
                        target="_blank" rel="noopener noreferrer"
                        className="btn btn-sm flex-1" style={{ background: "var(--ok-050)", color: "var(--ok)" }}
                      >
                        <Icon name="whatsapp" size={13} /> تذكير
                      </a>
                      {allow("receipts.create") && (
                        <button
                          className="btn btn-gold btn-sm"
                          onClick={() => setPayFor({ contractId: a.contract.id, period: a.missing[0] })}
                        >
                          تسجيل
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="checkCircle" title="لا توجد متأخرات" body="جميع المستأجرين منتظمون في السداد." />
          )}
        </>
      )}

      {/* ============================ نماذج يدوية ============================ */}
      {tab === "forms" && allow("receipts.create") && (
        <div className="space-y-3">
          <p className="rounded-xl bg-[var(--surface-2)] p-3 text-[12.5px] leading-relaxed text-[var(--muted)]">
            نماذج تكتب بياناتها بنفسك وتطبعها مباشرة — للحالات الخارجة عن سجل النظام.
            أما وصولات وعقود المستأجرين المسجّلين فتُطبع من قسم <b className="text-[var(--ink)]">الطباعة</b>.
          </p>
          <ManualReceipt />
          <ManualContract />
        </div>
      )}

      {payFor && (
        <PaymentForm open onClose={() => setPayFor(null)} presetContractId={payFor.contractId} presetPeriod={payFor.period} />
      )}
      {addExpense && <ExpenseForm open onClose={() => setAddExpense(false)} />}
      {editExpense && <ExpenseForm open onClose={() => setEditExpense(null)} expense={editExpense} />}
    </div>
  );
}
