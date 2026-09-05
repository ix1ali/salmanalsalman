"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, lastPeriods, scope } from "@/lib/selectors";
import { KWD, dateShort, expenseLabel, methodLabel, monthAr, num, pct, thisPeriod } from "@/lib/format";
import { Chip, Empty, PageHeader, Progress, SearchBox, Segmented, Select, useConfirm } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { ExpenseForm, PaymentForm } from "@/components/forms";
import type { Expense } from "@/lib/types";

type Tab = "collect" | "expenses" | "arrears";

export default function FinancesPage() {
  const { data, update, activeBuilding } = useStore();
  const { user, allow } = useAuth();
  const { confirm, dialog } = useConfirm();

  const [tab, setTab] = useState<Tab>("collect");
  const [period, setPeriod] = useState(thisPeriod());
  const [q, setQ] = useState("");
  const [payFor, setPayFor] = useState<{ contractId: string; period: string } | null>(null);
  const [addExpense, setAddExpense] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "arrears" || t === "expenses") setTab(t);
  }, []);

  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const periods = useMemo(() => lastPeriods(13).reverse(), []);
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);

  /** كشف تحصيل الشهر: صف لكل عقد ساري، مدفوع أو غير مدفوع. */
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
        if (!a.payment !== !b.payment) return a.payment ? 1 : -1;   // غير المسدد أولًا
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
    return { due, got, left: Math.max(0, due - got), count: active.length, paidCount: monthPays.length };
  }, [s.contracts, s.payments, period]);

  const ar = useMemo(() => arrears(data, s), [data, s]);

  const expenses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.expenses
      .filter((e) => e.date.slice(0, 7) === period)
      .filter((e) => !needle || e.title.toLowerCase().includes(needle) || (e.vendor ?? "").toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [s.expenses, q, period]);

  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);

  const removeExpense = async (e: Expense) => {
    if (!(await confirm("حذف المصروف", `سيتم حذف «${e.title}».`))) return;
    update((d) => { d.expenses = d.expenses.filter((x) => x.id !== e.id); },
      { action: "حذف مصروف", detail: e.title, actor: user?.username });
  };

  return (
    <div className="space-y-4">
      {dialog}
      <PageHeader title="المالية" subtitle="تحصيل الإيجار والمصاريف" icon="wallet" />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "collect", label: "التحصيل" },
          { value: "expenses", label: "المصاريف" },
          { value: "arrears", label: "المتأخرات", count: ar.length },
        ]}
      />

      {tab !== "arrears" && (
        <div className="flex items-center gap-2">
          <Icon name="calendar" size={16} className="shrink-0 text-[var(--muted)]" />
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => <option key={p} value={p}>{monthAr(p)}</option>)}
          </Select>
        </div>
      )}

      {/* ===================== التحصيل ===================== */}
      {tab === "collect" && (
        <>
          <div className="card card-lg p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] text-[var(--muted)]">المحصّل</p>
                <p className="display text-[26px] leading-none">{KWD(totals.got, false)}</p>
              </div>
              <div className="text-left">
                <p className="text-[12px] text-[var(--muted)]">المستحق</p>
                <p className="display text-[18px] leading-none text-[var(--muted)]">{KWD(totals.due, false)}</p>
              </div>
            </div>
            <div className="mt-3">
              <Progress value={totals.due ? (totals.got / totals.due) * 100 : 0} tone={totals.left ? "gold" : "green"} height={10} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] font-bold" style={{ color: totals.left ? "var(--gold-600)" : "var(--ok)" }}>
                {totals.left ? `باقي ${KWD(totals.left)}` : "تم تحصيل كل الإيجارات 👌"}
              </p>
              <p className="text-[12px] text-[var(--muted)]">
                سدّد {num(totals.paidCount)} من {num(totals.count)} · {pct(totals.due ? (totals.got / totals.due) * 100 : 0)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <SearchBox value={q} onChange={setQ} placeholder="رقم الشقة أو اسم المستأجر…" />
            <button
              onClick={() => setOnlyUnpaid((v) => !v)}
              className={`btn btn-sm shrink-0 ${onlyUnpaid ? "btn-primary" : "btn-ghost"}`}
            >
              <Icon name="filter" size={14} /> غير المسدد
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
                        ? `سدّد ${dateShort(r.payment.paidAt)} · ${methodLabel[r.payment.method]}`
                        : `مستحق ${KWD(r.contract.rent)}`}
                    </p>
                  </div>
                  {r.payment ? (
                    <Chip tone="green" icon="check">{KWD(r.payment.amount, false)}</Chip>
                  ) : allow("receipts.create") ? (
                    <button
                      className="btn btn-gold btn-sm shrink-0"
                      onClick={() => setPayFor({ contractId: r.contract.id, period })}
                    >
                      <Icon name="plus" size={14} /> تسجيل
                    </button>
                  ) : (
                    <Chip tone="gold">غير مسدد</Chip>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="checkCircle" title={onlyUnpaid ? "الكل سدّد هذا الشهر" : "ما فيه عقود سارية لهذا الشهر"} />
          )}
        </>
      )}

      {/* ===================== المصاريف ===================== */}
      {tab === "expenses" && (
        <>
          <div className="card card-lg flex items-center justify-between p-4">
            <div>
              <p className="text-[12px] text-[var(--muted)]">مصاريف {monthAr(period)}</p>
              <p className="display text-[24px] leading-none text-[var(--gold-600)]">{KWD(expenseTotal, false)}</p>
            </div>
            {allow("finance.edit") && (
              <button className="btn btn-primary btn-sm" onClick={() => setAddExpense(true)}>
                <Icon name="plus" size={15} /> مصروف
              </button>
            )}
          </div>

          <SearchBox value={q} onChange={setQ} placeholder="البيان أو المورد…" />

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
                  <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-[var(--gold-600)]">
                    {KWD(e.amount, false)}
                  </span>
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
              title={`ما فيه مصاريف في ${monthAr(period)}`}
              action={allow("finance.edit") ? <button className="btn btn-primary btn-sm" onClick={() => setAddExpense(true)}><Icon name="plus" size={14} /> إضافة</button> : undefined}
            />
          )}
        </>
      )}

      {/* ===================== المتأخرات ===================== */}
      {tab === "arrears" && (
        <>
          <div className="card card-lg flex items-center justify-between p-4">
            <div>
              <p className="text-[12px] text-[var(--muted)]">إجمالي المتأخرات</p>
              <p className="display text-[26px] leading-none text-[#b3303b]">
                {KWD(ar.reduce((a, x) => a + x.amount, 0), false)}
              </p>
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
                        {a.missing.length > 3 ? ` +${a.missing.length - 3}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-[#b3303b]">{KWD(a.amount, false)}</span>
                  </div>
                  {a.tenant && allow("tenants.contact") && (
                    <div className="mt-2 flex gap-2">
                      <a href={`tel:${a.tenant.phone}`} className="btn btn-ghost btn-sm flex-1"><Icon name="phone" size={13} /> اتصال</a>
                      <a
                        href={`https://wa.me/965${a.tenant.phone}?text=${encodeURIComponent(
                          `السلام عليكم ${a.tenant.name}،\nتذكير بإيجار شقة ${a.unit?.number ?? ""} للأشهر: ${a.missing.map(monthAr).join("، ")}\nالمبلغ المستحق: ${KWD(a.amount)}\nشاكرين تعاونكم.`
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
            <Empty icon="checkCircle" title="ما فيه متأخرات" body="كل المستأجرين منتظمين." />
          )}
        </>
      )}

      {/* روابط سريعة */}
      <div className="grid grid-cols-2 gap-2">
        {allow("receipts.view") && (
          <Link href="/receipts" className="card flex items-center gap-2.5 p-3 transition hover:shadow-[var(--sh-2)]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary)]">
              <Icon name="receipt" size={17} />
            </span>
            <span className="text-[13px] font-bold">الوصولات</span>
          </Link>
        )}
        {allow("reports.view") && (
          <Link href="/reports" className="card flex items-center gap-2.5 p-3 transition hover:shadow-[var(--sh-2)]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary)]">
              <Icon name="chart" size={17} />
            </span>
            <span className="text-[13px] font-bold">الكشوفات المالية</span>
          </Link>
        )}
      </div>

      {payFor && (
        <PaymentForm
          open
          onClose={() => setPayFor(null)}
          presetContractId={payFor.contractId}
          presetPeriod={payFor.period}
        />
      )}
      {addExpense && <ExpenseForm open onClose={() => setAddExpense(false)} />}
      {editExpense && <ExpenseForm open onClose={() => setEditExpense(null)} expense={editExpense} />}
    </div>
  );
}
