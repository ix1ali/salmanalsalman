"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { scope } from "@/lib/selectors";
import { markPaid, unmarkPaid } from "@/lib/payments";
import {
  EXPENSE_ORDER, KWD, amount, dateShort, expenseLabel, methodLabel, monthAr, num, thisPeriod,
} from "@/lib/format";
import {
  Empty, Money, MonthPicker, Panel, Select, TabBar, useConfirm,
} from "@/components/ui";
import { Icon } from "@/components/Icons";
import { ExpenseForm } from "@/components/forms";
import IssueDoc from "@/components/IssueDoc";
import {
  CollectionSheetDoc, ContractDoc, PrintOverlay, ReceiptSheet, ReceiptsBatchDoc,
  receiptOfContract, receiptOfPayment, type ReceiptFields,
} from "@/components/print";
import type { Contract, Expense, ExpenseCategory, Payment } from "@/lib/types";

type Tab = "sheet" | "receipts" | "contracts" | "expenses" | "issue";
type Doc =
  | { k: "sheet" } | { k: "batch" }
  | { k: "receipt"; f: ReceiptFields } | { k: "contract"; c: Contract };

export default function FinancesPage() {
  const { data, update, activeBuilding } = useStore();
  const { user, allow } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [tab, setTab] = useState<Tab>("sheet");
  const [period, setPeriod] = useState(thisPeriod());
  const [filter, setFilter] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [cat, setCat] = useState<"all" | ExpenseCategory>("all");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [addExpense, setAddExpense] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && ["sheet", "receipts", "contracts", "expenses", "issue"].includes(t)) setTab(t as Tab);
    if (t === "arrears") { setTab("sheet"); setFilter("unpaid"); }
  }, []);

  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;
  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);
  const floorById = useMemo(() => new Map(data.floors.map((f) => [f.id, f])), [data.floors]);

  /* ------------------ صفوف الشهر: كل عقد ساري ومعه حالة سداده ------------------ */
  const groups = useMemo(() => {
    const paidMap = new Map(s.payments.filter((p) => p.period === period).map((p) => [p.contractId ?? p.unitId, p]));
    const floors = data.floors
      .filter((f) => activeBuilding === "all" || f.buildingId === activeBuilding)
      .sort((a, b) => a.level - b.level);

    return floors
      .map((f) => ({
        floor: f,
        rows: s.contracts
          .filter((c) => c.status === "active" && unitById.get(c.unitId)?.floorId === f.id)
          .filter((c) => c.startDate.slice(0, 7) <= period && c.endDate.slice(0, 7) >= period)
          .map((c) => ({ c, unit: unitById.get(c.unitId), tenant: tenantById.get(c.tenantId), payment: paidMap.get(c.id) }))
          .sort((a, b) => (a.unit?.number ?? "").localeCompare(b.unit?.number ?? "", "ar", { numeric: true })),
      }))
      .filter((g) => g.rows.length);
  }, [s.contracts, s.payments, data.floors, activeBuilding, period, unitById, tenantById]);

  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  const totals = useMemo(() => {
    const due = rows.reduce((a, r) => a + r.c.rent, 0);
    const got = rows.filter((r) => r.payment).reduce((a, r) => a + r.c.rent, 0);
    return { due, got, left: Math.max(0, due - got), count: rows.length, paid: rows.filter((r) => r.payment).length };
  }, [rows]);

  const shown = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          rows: g.rows.filter((r) => (filter === "all" ? true : filter === "paid" ? !!r.payment : !r.payment)),
        }))
        .filter((g) => g.rows.length),
    [groups, filter]
  );

  /* --------------------------- تأكيد السداد وإلغاؤه --------------------------- */
  const toggle = async (c: Contract, payment: Payment | undefined) => {
    const unitNo = unitById.get(c.unitId)?.number ?? "";
    const name = tenantById.get(c.tenantId)?.name ?? "";
    const ok = payment
      ? await confirm("إلغاء تأكيد السداد", `سيُحذف وصل ${payment.receiptNo} لشهر ${monthAr(period)} — شقة ${unitNo}.`)
      : await confirm(
          "تأكيد السداد",
          `تسجيل استلام إيجار ${monthAr(period)} من ${name} — شقة ${unitNo} بمبلغ ${KWD(c.rent)}.`,
          false
        );
    if (!ok) return;

    update(
      (d) => (payment ? unmarkPaid(d, c.id, period) : markPaid(d, c, period, user?.username ?? "—")),
      {
        action: payment ? "إلغاء تأكيد سداد" : "تأكيد سداد",
        detail: `${unitNo} — ${monthAr(period)}`,
        actor: user?.username,
      }
    );
    toast(payment ? "تم إلغاء التأكيد" : "تم تأكيد السداد");
  };

  /* -------- وصولات الشهر: لكل عقد وصل، سواء سُدِّد أو لم يُسدَّد بعد -------- */
  const receiptItems = useMemo<ReceiptFields[]>(
    () => rows.map((r) => (r.payment ? receiptOfPayment(data, r.payment) : receiptOfContract(data, r.c, period))),
    [rows, data, period]
  );

  /* --------------------------------- عقود --------------------------------- */
  const contracts = useMemo(
    () => s.contracts.filter((c) => c.status === "active").sort((a, b) =>
      (unitById.get(a.unitId)?.number ?? "").localeCompare(unitById.get(b.unitId)?.number ?? "", "ar", { numeric: true })),
    [s.contracts, unitById]
  );

  /* ------------------------------- مصروفات -------------------------------- */
  const expenses = useMemo(
    () => s.expenses.filter((e) => e.date.slice(0, 7) === period)
      .filter((e) => cat === "all" || e.category === cat)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [s.expenses, period, cat]
  );
  const spent = useMemo(
    () => s.expenses.filter((e) => e.date.slice(0, 7) === period).reduce((a, e) => a + e.amount, 0),
    [s.expenses, period]
  );

  const removeExpense = async (e: Expense) => {
    if (!(await confirm("حذف المصروف", `سيتم حذف «${e.title}» بمبلغ ${KWD(e.amount)}.`))) return;
    update((d) => { d.expenses = d.expenses.filter((x) => x.id !== e.id); },
      { action: "حذف مصروف", detail: e.title, actor: user?.username });
    toast("تم الحذف");
  };

  return (
    <div className="space-y-3">
      {dialog}

      <TabBar
        value={tab}
        onChange={setTab}
        options={[
          { value: "sheet", label: "الكشف المالي", icon: "checkCircle" },
          { value: "receipts", label: "الوصولات", icon: "receipt" },
          { value: "contracts", label: "العقود", icon: "file" },
          { value: "expenses", label: "المصروفات", icon: "wallet" },
          ...(allow("receipts.create") ? [{ value: "issue" as const, label: "إصدار مستند", icon: "print" as const }] : []),
        ]}
      />

      {tab !== "issue" && (
        <div className="flex items-center justify-between gap-2">
          <MonthPicker value={period} onChange={setPeriod} />
          <div className="flex shrink-0 items-center gap-1.5">
            {period !== thisPeriod() && (
              <button className="btn btn-ghost btn-sm" onClick={() => setPeriod(thisPeriod())}>هذا الشهر</button>
            )}
            {tab === "sheet" && allow("reports.view") && (
              <button className="btn btn-ghost btn-sm" onClick={() => setDoc({ k: "sheet" })}>
                <Icon name="print" size={13} /> طباعة الكشف
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================ الكشف المالي ============================ */}
      {tab === "sheet" && (
        <>
          {/* الأرقام الثلاثة هي الفلتر نفسه — اضغط أيًّا منها لتصفية القائمة */}
          <Panel flush>
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--line)]">
              {([
                ["all", "المستحق", totals.due, "var(--ink)"],
                ["paid", "المحصَّل", totals.got, "var(--ok)"],
                ["unpaid", "المتبقي", totals.left, totals.left ? "var(--danger)" : "var(--muted)"],
              ] as const).map(([key, label, value, color]) => {
                const on = filter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className="relative px-2 py-3 text-center transition"
                    style={{ background: on ? "var(--surface-2)" : "transparent" }}
                  >
                    <p className="num text-[16px] font-bold leading-none" style={{ color }}>
                      {amount(value)}<span className="text-[9.5px] font-semibold opacity-55"> د.ك</span>
                    </p>
                    <p className="t-xs mt-1" style={{ color: on ? "var(--ink)" : "var(--muted)", fontWeight: on ? 700 : 400 }}>
                      {label}
                    </p>
                    {on && <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: "var(--primary)" }} />}
                  </button>
                );
              })}
            </div>
          </Panel>

          <p className="t-xs px-1 text-[var(--muted)]">
            {filter === "unpaid" ? "لم يُسدَّد" : filter === "paid" ? "سُدِّد" : "كل الوحدات"}
            {" · "}
            <b className="text-[var(--ink-2)]">
              {num(filter === "paid" ? totals.paid : filter === "unpaid" ? totals.count - totals.paid : totals.count)}
            </b>{" "}
            من {num(totals.count)} وحدة
          </p>

          {shown.length ? (
            <div className="panel">
              {shown.map((g) => (
                <div key={g.floor.id}>
                  <p className="border-b border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-1.5 text-[11.5px] font-bold text-[var(--muted)]">
                    {g.floor.name}
                  </p>
                  {g.rows.map((r) => {
                    const isPaid = !!r.payment;
                    return (
                      <div
                        key={r.c.id}
                        className="row"
                        style={isPaid ? { background: "var(--ok-050)" } : undefined}
                      >
                        {allow("receipts.create") ? (
                          <button
                            onClick={() => toggle(r.c, r.payment)}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border-2 transition active:scale-95"
                            style={{
                              borderColor: isPaid ? "var(--ok)" : "var(--line-strong)",
                              background: isPaid ? "var(--ok)" : "#fff",
                              color: "#fff",
                            }}
                            aria-label={isPaid ? "إلغاء تأكيد السداد" : "تأكيد السداد"}
                          >
                            {isPaid && <Icon name="check" size={18} strokeWidth={3} />}
                          </button>
                        ) : (
                          <span className="dot shrink-0" style={{ background: isPaid ? "var(--ok)" : "var(--line-strong)" }} />
                        )}
                        <span className="num min-w-[34px] shrink-0 text-[12.5px] font-bold text-[var(--ink-2)]">{r.unit?.number}</span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{r.tenant?.name ?? "—"}</span>
                        <Money v={r.c.rent} size="sm" tone={isPaid ? "var(--ok)" : "var(--ink-2)"} className="shrink-0" />
                        {allow("reports.view") && (
                          <button
                            onClick={() => setDoc({
                              k: "receipt",
                              f: r.payment ? receiptOfPayment(data, r.payment) : receiptOfContract(data, r.c, period),
                            })}
                            className="btn btn-icon btn-ghost !border-transparent !bg-transparent !p-1 shrink-0 text-[var(--muted)]"
                            aria-label="طباعة الوصل"
                          >
                            <Icon name="print" size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty
                icon="checkCircle"
                title={filter === "unpaid" ? "تم تحصيل كامل إيجارات الشهر" : "لا توجد عقود سارية في هذا الشهر"}
              />
            </div>
          )}
        </>
      )}

      {/* ============================== الوصولات ============================== */}
      {tab === "receipts" && (
        <>
          {receiptItems.length > 0 && allow("reports.view") && (
            <button className="btn btn-primary w-full" onClick={() => setDoc({ k: "batch" })}>
              <Icon name="print" size={15} /> طباعة جميع وصولات {monthAr(period)} ({num(receiptItems.length)})
            </button>
          )}
          <p className="t-xs px-1 text-[var(--muted)]">
            لكل مستأجر وصل في هذا الشهر — سُدِّد أو لم يُسدَّد بعد. تُطبع الصفحة بوصلين ليُقصّ الورق نصفين.
          </p>

          {rows.length ? (
            <div className="panel">
              {rows.map((r) => {
                const isPaid = !!r.payment;
                return (
                  <button
                    key={r.c.id}
                    onClick={() => setDoc({
                      k: "receipt",
                      f: r.payment ? receiptOfPayment(data, r.payment) : receiptOfContract(data, r.c, period),
                    })}
                    className="row row-link"
                  >
                    <span className="num min-w-[34px] shrink-0 text-[12.5px] font-bold text-[var(--ink-2)]">
                      {r.unit?.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{r.tenant?.name ?? "—"}</span>
                      <span className="t-xs block text-[var(--muted)]">
                        {isPaid
                          ? `${r.payment!.receiptNo} · ${dateShort(r.payment!.paidAt)} · ${methodLabel[r.payment!.method]}`
                          : "لم يُسدَّد بعد — وصل للتوزيع"}
                      </span>
                    </span>
                    <Money v={r.c.rent} size="sm" tone={isPaid ? "var(--ok)" : "var(--ink-2)"} className="shrink-0" />
                    <Icon name="print" size={14} className="shrink-0 text-[var(--faint)]" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="card">
              <Empty icon="receipt" title={`لا توجد عقود سارية في ${monthAr(period)}`} />
            </div>
          )}
        </>
      )}

      {/* =============================== العقود =============================== */}
      {tab === "contracts" && (
        <div className="panel">
          {contracts.length ? contracts.map((c) => (
            <button key={c.id} onClick={() => setDoc({ k: "contract", c })} className="row row-link">
              <span className="num min-w-[34px] shrink-0 text-[12.5px] font-bold text-[var(--ink-2)]">
                {unitById.get(c.unitId)?.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{tenantById.get(c.tenantId)?.name ?? "—"}</span>
                <span className="t-xs block text-[var(--muted)]">
                  {floorById.get(unitById.get(c.unitId)?.floorId ?? "")?.name} · ينتهي {dateShort(c.endDate)}
                </span>
              </span>
              <Money v={c.rent} size="sm" className="shrink-0" />
              <Icon name="print" size={14} className="shrink-0 text-[var(--faint)]" />
            </button>
          )) : <Empty icon="file" title="لا توجد عقود سارية" />}
        </div>
      )}

      {/* ============================== المصروفات ============================== */}
      {tab === "expenses" && (
        <>
          <Panel flush>
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--line)] border-b border-[var(--line)]">
              {[
                ["الدخل", totals.got, "var(--ok)"],
                ["المصروفات", spent, "var(--gold-600)"],
                ["الصافي", totals.got - spent, totals.got - spent >= 0 ? "var(--primary)" : "var(--danger)"],
              ].map(([l, v, c]) => (
                <div key={l as string} className="px-2 py-2.5 text-center">
                  <p className="num text-[16px] font-bold leading-none" style={{ color: c as string }}>
                    {amount(v as number)}<span className="text-[9.5px] font-semibold opacity-55"> د.ك</span>
                  </p>
                  <p className="t-xs mt-1 text-[var(--muted)]">{l as string}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <Select value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory | "all")} className="!w-auto !py-1 !text-[12.5px]">
                <option value="all">كل البنود</option>
                {EXPENSE_ORDER.map((c) => <option key={c} value={c}>{expenseLabel[c]}</option>)}
              </Select>
              {allow("finance.edit") && (
                <button className="btn btn-primary btn-sm" onClick={() => setAddExpense(true)}>
                  <Icon name="plus" size={13} /> مصروف
                </button>
              )}
            </div>
          </Panel>

          <div className="panel">
            {expenses.length ? expenses.map((e) => (
              <div key={e.id} className="row">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{e.title}</span>
                  <span className="t-xs block text-[var(--muted)]">
                    {expenseLabel[e.category]} · {dateShort(e.date)}{e.vendor ? ` · ${e.vendor}` : ""}
                  </span>
                </span>
                <Money v={e.amount} size="sm" tone="var(--gold-600)" className="shrink-0" />
                {allow("finance.edit") && (
                  <span className="flex shrink-0 gap-0.5">
                    <button className="btn btn-icon btn-ghost !border-transparent !bg-transparent !p-1" onClick={() => setEditExpense(e)} aria-label="تعديل">
                      <Icon name="edit" size={13} />
                    </button>
                    <button className="btn btn-icon btn-ghost !border-transparent !bg-transparent !p-1 text-[var(--danger)]" onClick={() => removeExpense(e)} aria-label="حذف">
                      <Icon name="trash" size={13} />
                    </button>
                  </span>
                )}
              </div>
            )) : (
              <Empty
                icon="wallet"
                title={`لا توجد مصروفات في ${monthAr(period)}`}
                body="أضف فواتير الكهرباء والرواتب والصيانة لتُخصم من الدخل ويظهر الصافي."
              />
            )}
          </div>
        </>
      )}

      {/* ============================ إصدار مستند ============================ */}
      {tab === "issue" && allow("receipts.create") && <IssueDoc />}

      {/* ============================== المستندات ============================== */}
      <PrintOverlay open={doc?.k === "sheet"} onClose={() => setDoc(null)} fileTitle={`كشف التحصيل — ${monthAr(period)}`}>
        <CollectionSheetDoc buildingId={buildingId} period={period} />
      </PrintOverlay>

      <PrintOverlay open={doc?.k === "batch"} onClose={() => setDoc(null)} fileTitle={`وصولات ${monthAr(period)}`} flush>
        <ReceiptsBatchDoc items={receiptItems} />
      </PrintOverlay>

      <PrintOverlay
        open={doc?.k === "receipt"} onClose={() => setDoc(null)}
        fileTitle={doc?.k === "receipt" ? `وصل — ${doc.f.from}` : ""}
      >
        {doc?.k === "receipt" && <ReceiptSheet f={doc.f} />}
      </PrintOverlay>

      <PrintOverlay
        open={doc?.k === "contract"} onClose={() => setDoc(null)}
        fileTitle={doc?.k === "contract" ? `عقد ${doc.c.no}` : ""}
      >
        {doc?.k === "contract" && <ContractDoc contract={doc.c} />}
      </PrintOverlay>

      {addExpense && <ExpenseForm open onClose={() => setAddExpense(false)} />}
      {editExpense && <ExpenseForm open onClose={() => setEditExpense(null)} expense={editExpense} />}
    </div>
  );
}
