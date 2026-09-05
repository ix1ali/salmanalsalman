"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { scope, lastPeriods } from "@/lib/selectors";
import { KWD, dateShort, methodLabel, monthAr, num } from "@/lib/format";
import { Chip, Empty, PageHeader, SearchBox, Select, useConfirm } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { PaymentForm } from "@/components/forms";
import { PrintOverlay, ReceiptDoc } from "@/components/print";
import type { Payment } from "@/lib/types";

export default function ReceiptsPage() {
  const { data, update, activeBuilding } = useStore();
  const { user, allow } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("all");
  const [printing, setPrinting] = useState<Payment | null>(null);
  const [adding, setAdding] = useState(false);

  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);
  const periods = useMemo(() => lastPeriods(12).reverse(), []);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.payments
      .filter((p) => period === "all" || p.period === period)
      .filter((p) => {
        if (!needle) return true;
        return (
          p.receiptNo.includes(needle) ||
          (unitById.get(p.unitId)?.number ?? "").toLowerCase().includes(needle) ||
          (tenantById.get(p.tenantId)?.name ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }, [s.payments, q, period, unitById, tenantById]);

  const total = list.reduce((a, p) => a + p.amount, 0);

  const exportCsv = () => {
    const rows = [
      ["رقم الوصل", "الشهر", "المستأجر", "الوحدة", "المبلغ", "تاريخ الدفع", "الطريقة", "المرجع"],
      ...list.map((p) => [
        p.receiptNo, monthAr(p.period), tenantById.get(p.tenantId)?.name ?? "",
        unitById.get(p.unitId)?.number ?? "", String(p.amount), p.paidAt, methodLabel[p.method], p.reference ?? "",
      ]),
    ];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `الوصولات-${period === "all" ? "الكل" : period}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const remove = async (p: Payment) => {
    if (!(await confirm("حذف الوصل", `سيتم حذف الوصل ${p.receiptNo} وتعود قيمته كمتأخرات.`))) return;
    update((d) => { d.payments = d.payments.filter((x) => x.id !== p.id); },
      { action: "حذف وصل", detail: p.receiptNo, actor: user?.username });
  };

  return (
    <div className="space-y-4">
      {dialog}
      <PageHeader
        title="الوصولات"
        subtitle={`${num(list.length)} وصل · ${KWD(total)}`}
        icon="receipt"
        actions={
          <>
            {allow("data.export") && (
              <button className="btn btn-ghost btn-sm" onClick={exportCsv}><Icon name="download" size={15} /> تصدير</button>
            )}
            {allow("receipts.create") && (
              <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> دفعة</button>
            )}
          </>
        }
      />

      <div className="flex gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="رقم الوصل، الشقة، المستأجر…" />
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto">
          <option value="all">كل الأشهر</option>
          {periods.map((p) => <option key={p} value={p}>{monthAr(p)}</option>)}
        </Select>
      </div>

      {list.length ? (
        <div className="space-y-1.5">
          {list.map((p) => (
            <div key={p.id} className="card flex items-center gap-3 p-2.5">
              <button
                onClick={() => setPrinting(p)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--ok-050)] text-[var(--ok)]"
                aria-label="عرض الوصل"
              >
                <Icon name="receipt" size={19} />
              </button>
              <button onClick={() => setPrinting(p)} className="min-w-0 flex-1 text-right">
                <p className="truncate text-[13.5px] font-extrabold">{tenantById.get(p.tenantId)?.name ?? "—"}</p>
                <p className="truncate text-[11.5px] text-[var(--muted)]">
                  شقة {unitById.get(p.unitId)?.number ?? "—"} · {monthAr(p.period)} · {dateShort(p.paidAt)}
                </p>
              </button>
              <div className="shrink-0 text-left">
                <p className="text-[13px] font-extrabold tabular-nums">{KWD(p.amount, false)}</p>
                <Chip tone="slate">{p.receiptNo}</Chip>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button className="btn btn-icon btn-ghost !p-1.5" onClick={() => setPrinting(p)} aria-label="طباعة">
                  <Icon name="print" size={14} />
                </button>
                {allow("finance.edit") && (
                  <button className="btn btn-icon btn-danger !p-1.5" onClick={() => remove(p)} aria-label="حذف">
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon="receipt"
          title="ما فيه وصولات"
          body="سجّل أول دفعة إيجار ليصدر الوصل تلقائيًا."
          action={allow("receipts.create") ? <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> تسجيل دفعة</button> : undefined}
        />
      )}

      {adding && <PaymentForm open onClose={() => setAdding(false)} />}
      <PrintOverlay
        open={!!printing}
        onClose={() => setPrinting(null)}
        fileTitle={printing ? `وصل ${printing.receiptNo}` : ""}
      >
        {printing && <ReceiptDoc payment={printing} />}
      </PrintOverlay>
    </div>
  );
}
