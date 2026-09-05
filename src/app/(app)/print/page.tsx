"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { lastPeriods, scope } from "@/lib/selectors";
import { KWD, dateShort, monthAr, num, todayISO } from "@/lib/format";
import { Empty, PageHeader, SearchBox, Segmented, Select, TextInput } from "@/components/ui";
import { Icon } from "@/components/Icons";
import {
  BuildingStatementDoc, ContractDoc, EvictionDoc, PrintOverlay, ReceiptDoc,
  TenantStatementDoc, TenantsRegisterDoc,
} from "@/components/print";
import type { Contract, Payment } from "@/lib/types";

type Tab = "contracts" | "receipts" | "statements" | "eviction";
type Doc =
  | { kind: "contract"; contract: Contract }
  | { kind: "receipt"; payment: Payment }
  | { kind: "buildingStatement" }
  | { kind: "tenantStatement" }
  | { kind: "register" }
  | { kind: "eviction"; unitId: string; tenantId?: string };

export default function PrintPage() {
  const { data, activeBuilding } = useStore();
  const { allow } = useAuth();

  const [tab, setTab] = useState<Tab>("contracts");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState(lastPeriods(1)[0]);
  const [tenantId, setTenantId] = useState("");
  const [evictContract, setEvictContract] = useState("");
  const [evictDate, setEvictDate] = useState(todayISO());
  const [bId, setBId] = useState(activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding);
  const [doc, setDoc] = useState<Doc | null>(null);

  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const periods = useMemo(() => lastPeriods(13).reverse(), []);
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);
  const needle = q.trim().toLowerCase();

  const activeContracts = useMemo(
    () =>
      s.contracts
        .filter((c) => c.status === "active" || c.status === "upcoming")
        .sort((a, b) =>
          (unitById.get(a.unitId)?.number ?? "").localeCompare(unitById.get(b.unitId)?.number ?? "", "ar", { numeric: true })
        ),
    [s.contracts, unitById]
  );

  const contracts = useMemo(
    () =>
      activeContracts.filter((c) =>
        !needle ||
        (unitById.get(c.unitId)?.number ?? "").toLowerCase().includes(needle) ||
        (tenantById.get(c.tenantId)?.name ?? "").toLowerCase().includes(needle)
      ),
    [activeContracts, needle, unitById, tenantById]
  );

  const receipts = useMemo(
    () =>
      s.payments
        .filter((p) => p.period === period)
        .filter((p) =>
          !needle ||
          p.receiptNo.includes(needle) ||
          (unitById.get(p.unitId)?.number ?? "").toLowerCase().includes(needle) ||
          (tenantById.get(p.tenantId)?.name ?? "").toLowerCase().includes(needle)
        )
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    [s.payments, period, needle, unitById, tenantById]
  );

  const tenants = useMemo(
    () => data.tenants.filter((t) => activeBuilding === "all" || s.tenantIds.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [data.tenants, s.tenantIds, activeBuilding]
  );

  if (!allow("reports.view") && !allow("contracts.view") && !allow("receipts.view")) {
    return <Empty icon="lock" title="غير مصرح لك بهذا القسم" />;
  }

  const label = (c: Contract) =>
    `${unitById.get(c.unitId)?.number ?? "—"} — ${tenantById.get(c.tenantId)?.name ?? "—"}`;

  const evictC = data.contracts.find((c) => c.id === evictContract);

  return (
    <div className="space-y-3">
      <PageHeader title="الطباعة" subtitle="العقود والوصولات والكشوفات والنماذج" icon="print" />

      <Segmented
        value={tab}
        onChange={(v) => { setTab(v); setQ(""); }}
        options={[
          { value: "contracts", label: "العقود" },
          { value: "receipts", label: "الوصولات" },
          { value: "statements", label: "الكشوفات" },
          { value: "eviction", label: "طلب إخلاء" },
        ]}
      />

      {/* ============================ العقود ============================ */}
      {tab === "contracts" && (
        <>
          <SearchBox value={q} onChange={setQ} placeholder="رقم الشقة أو اسم المستأجر…" />
          {contracts.length ? (
            <ul className="space-y-1.5">
              {contracts.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setDoc({ kind: "contract", contract: c })}
                    className="card flex w-full items-center gap-3 p-3 text-right transition hover:shadow-[var(--sh-2)] active:scale-[.99]"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-050)] text-[13px] font-extrabold text-[var(--primary)]">
                      {unitById.get(c.unitId)?.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-extrabold">
                        {tenantById.get(c.tenantId)?.name ?? "—"}
                      </span>
                      <span className="block truncate text-[11.5px] text-[var(--muted)]">
                        {KWD(c.rent)} · ينتهي {dateShort(c.endDate)}
                      </span>
                    </span>
                    <span className="btn btn-primary btn-sm shrink-0">
                      <Icon name="print" size={14} /> طباعة
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="file" title="لا توجد عقود سارية" />
          )}
        </>
      )}

      {/* =========================== الوصولات =========================== */}
      {tab === "receipts" && (
        <>
          <div className="flex items-center gap-2">
            <Icon name="calendar" size={16} className="shrink-0 text-[var(--muted)]" />
            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => <option key={p} value={p}>{monthAr(p)}</option>)}
            </Select>
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="رقم الوصل أو الشقة…" />
          {receipts.length ? (
            <ul className="space-y-1.5">
              {receipts.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setDoc({ kind: "receipt", payment: p })}
                    className="card flex w-full items-center gap-3 p-3 text-right transition hover:shadow-[var(--sh-2)] active:scale-[.99]"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--ok-050)] text-[var(--ok)]">
                      <Icon name="receipt" size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-extrabold">
                        {tenantById.get(p.tenantId)?.name ?? "—"}
                      </span>
                      <span className="block truncate text-[11.5px] text-[var(--muted)]">
                        شقة {unitById.get(p.unitId)?.number} · {p.receiptNo} · {KWD(p.amount)}
                      </span>
                    </span>
                    <span className="btn btn-primary btn-sm shrink-0">
                      <Icon name="print" size={14} /> طباعة
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="receipt" title={`لا توجد وصولات في ${monthAr(period)}`} />
          )}
        </>
      )}

      {/* =========================== الكشوفات =========================== */}
      {tab === "statements" && (
        <div className="space-y-3">
          <div className="card card-lg p-4">
            <p className="mb-1 text-[14px] font-extrabold">الكشف المالي الشهري</p>
            <p className="mb-3 text-[12px] text-[var(--muted)]">المقبوضات والمصروفات وصافي الدخل في شهر واحد.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.buildings.length > 1 && (
                <Select value={bId} onChange={(e) => setBId(e.target.value)}>
                  {data.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              )}
              <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                {periods.map((p) => <option key={p} value={p}>{monthAr(p)}</option>)}
              </Select>
            </div>
            <button className="btn btn-primary mt-3 w-full" onClick={() => setDoc({ kind: "buildingStatement" })}>
              <Icon name="print" size={16} /> عرض وطباعة
            </button>
          </div>

          <div className="card card-lg p-4">
            <p className="mb-1 text-[14px] font-extrabold">كشف حساب مستأجر</p>
            <p className="mb-3 text-[12px] text-[var(--muted)]">كل ما سدّده المستأجر وما تبقى عليه.</p>
            <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">— اختر المستأجر —</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <button
              className="btn btn-primary mt-3 w-full"
              disabled={!tenantId}
              onClick={() => setDoc({ kind: "tenantStatement" })}
            >
              <Icon name="print" size={16} /> عرض وطباعة
            </button>
          </div>

          <div className="card card-lg p-4">
            <p className="mb-1 text-[14px] font-extrabold">سجل المستأجرين</p>
            <p className="mb-3 text-[12px] text-[var(--muted)]">
              جدول شامل بجميع الوحدات المؤجرة وبيانات مستأجريها ومدد عقودهم.
            </p>
            {data.buildings.length > 1 && (
              <Select value={bId} onChange={(e) => setBId(e.target.value)}>
                {data.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            )}
            <button className="btn btn-primary mt-3 w-full" onClick={() => setDoc({ kind: "register" })}>
              <Icon name="print" size={16} /> عرض وطباعة
            </button>
          </div>
        </div>
      )}

      {/* ========================== طلب الإخلاء ========================== */}
      {tab === "eviction" && (
        <div className="space-y-3">
          <div className="card card-lg p-4">
            <p className="mb-1 text-[14px] font-extrabold">إقرار إخلاء وتسليم العين المؤجرة</p>
            <p className="mb-3 text-[12px] text-[var(--muted)]">
              يُطبع ليوقّعه المستأجر عند تسليم الوحدة، ويشمل تعهده بتسليم براءة الذمة من وزارة الكهرباء والماء.
            </p>
            <label className="label">المستأجر / الوحدة</label>
            <Select value={evictContract} onChange={(e) => setEvictContract(e.target.value)}>
              <option value="">— اختر —</option>
              {activeContracts.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
            </Select>
            <label className="label mt-3">تاريخ الإخلاء</label>
            <TextInput type="date" value={evictDate} onChange={(e) => setEvictDate(e.target.value)} />
            <button
              className="btn btn-primary mt-3 w-full"
              disabled={!evictC}
              onClick={() => evictC && setDoc({ kind: "eviction", unitId: evictC.unitId, tenantId: evictC.tenantId })}
            >
              <Icon name="print" size={16} /> عرض وطباعة
            </button>
          </div>
          <p className="text-center text-[11.5px] text-[var(--muted)]">
            {num(activeContracts.length)} عقد ساري
          </p>
        </div>
      )}

      {/* =========================== المستندات =========================== */}
      <PrintOverlay
        open={doc?.kind === "contract"}
        onClose={() => setDoc(null)}
        fileTitle={doc?.kind === "contract" ? `عقد إيجار ${doc.contract.no}` : ""}
      >
        {doc?.kind === "contract" && <ContractDoc contract={doc.contract} />}
      </PrintOverlay>

      <PrintOverlay
        open={doc?.kind === "receipt"}
        onClose={() => setDoc(null)}
        fileTitle={doc?.kind === "receipt" ? `وصل ${doc.payment.receiptNo}` : ""}
      >
        {doc?.kind === "receipt" && <ReceiptDoc payment={doc.payment} />}
      </PrintOverlay>

      <PrintOverlay
        open={doc?.kind === "buildingStatement"}
        onClose={() => setDoc(null)}
        fileTitle={`كشف ${data.buildings.find((b) => b.id === bId)?.name ?? ""} — ${monthAr(period)}`}
      >
        <BuildingStatementDoc buildingId={bId} period={period} />
      </PrintOverlay>

      <PrintOverlay
        open={doc?.kind === "tenantStatement"}
        onClose={() => setDoc(null)}
        fileTitle={`كشف حساب — ${tenantById.get(tenantId)?.name ?? ""}`}
      >
        {tenantId && <TenantStatementDoc tenantId={tenantId} />}
      </PrintOverlay>

      <PrintOverlay
        open={doc?.kind === "register"}
        onClose={() => setDoc(null)}
        fileTitle={`سجل المستأجرين — ${data.buildings.find((b) => b.id === bId)?.name ?? ""}`}
      >
        <TenantsRegisterDoc buildingId={bId} />
      </PrintOverlay>

      <PrintOverlay
        open={doc?.kind === "eviction"}
        onClose={() => setDoc(null)}
        fileTitle={`طلب إخلاء — ${evictC ? label(evictC) : ""}`}
      >
        {doc?.kind === "eviction" && (
          <EvictionDoc unitId={doc.unitId} tenantId={doc.tenantId} date={evictDate} />
        )}
      </PrintOverlay>
    </div>
  );
}
