"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, scope } from "@/lib/selectors";
import { KWD, dateShort, methodLabel, monthAr, monthsLabel, num, thisPeriod } from "@/lib/format";
import {
  Empty, Field, Filters, KeyVal, Money, PageHeader, Panel, SearchBox, Sheet, TextInput, useConfirm,
} from "@/components/ui";
import { Icon } from "@/components/Icons";
import DocsPanel from "@/components/DocsPanel";
import { ContractForm, PaymentForm, TenantForm } from "@/components/forms";
import { PrintOverlay, TenantStatementDoc, TenantsRegisterDoc } from "@/components/print";

type Tab = "all" | "unpaid";

export default function TenantsPage() {
  const { data, activeBuilding } = useStore();
  const { allow } = useAuth();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [printRegister, setPrintRegister] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setOpenId(id);
  }, []);

  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const ar = useMemo(() => arrears(data, s), [data, s]);
  const dueByTenant = useMemo(() => new Map(ar.map((a) => [a.contract.tenantId, a])), [ar]);

  const activeIds = useMemo(
    () => new Set(s.contracts.filter((c) => c.status === "active").map((c) => c.tenantId)),
    [s.contracts]
  );

  // «لم يُسدَّد» = عقد ساري بلا دفعة مسجّلة لهذا الشهر — نفس تعريف الكشف المالي
  const unpaidIds = useMemo(() => {
    const p = thisPeriod();
    const paid = new Set(s.payments.filter((x) => x.period === p).map((x) => x.contractId));
    return new Set(
      s.contracts.filter((c) => c.status === "active" && !paid.has(c.id)).map((c) => c.tenantId)
    );
  }, [s.contracts, s.payments]);

  const unitOf = useMemo(() => {
    const m = new Map<string, string>();
    s.contracts.filter((c) => c.status === "active").forEach((c) => {
      const u = data.units.find((x) => x.id === c.unitId);
      if (u) m.set(c.tenantId, u.number);
    });
    return m;
  }, [s.contracts, data.units]);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    let base = activeBuilding === "all" ? data.tenants : data.tenants.filter((t) => s.tenantIds.has(t.id));
    if (tab === "unpaid") base = base.filter((t) => unpaidIds.has(t.id));
    if (n) base = base.filter((t) =>
      t.name.toLowerCase().includes(n) || t.phone.includes(n) ||
      (t.civilId ?? "").includes(n) || (t.nationality ?? "").includes(n) ||
      (unitOf.get(t.id) ?? "").includes(n)
    );
    return base.sort((a, b) => {
      const ua = unitOf.get(a.id) ?? "zz", ub = unitOf.get(b.id) ?? "zz";
      return ua.localeCompare(ub, "ar", { numeric: true });
    });
  }, [data.tenants, s.tenantIds, activeBuilding, tab, q, unpaidIds, unitOf]);

  return (
    <div className="space-y-3">
      <PageHeader
        title="المستأجرون"
        subtitle={`${num(list.length)} من ${num(activeIds.size)} مستأجر حالي`}
        actions={
          <>
            {allow("reports.view") && (
              <button className="btn btn-ghost btn-sm" onClick={() => setPrintRegister(true)}>
                <Icon name="print" size={13} /> السجل
              </button>
            )}
            {allow("tenants.edit") && (
              <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                <Icon name="plus" size={14} /> مستأجر
              </button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="الاسم، رقم الشقة، الهاتف، الرقم المدني…" />
        <Filters
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "الكل", count: activeBuilding === "all" ? data.tenants.length : s.tenants.length },
            ...(allow("finance.view")
              ? [{ value: "unpaid" as const, label: `لم يُسدَّد ${monthAr(thisPeriod()).split(" ")[0]}`, count: unpaidIds.size }]
              : []),
          ]}
        />
      </div>

      {list.length ? (
        <div className="panel">
          {list.map((t) => {
            const unit = unitOf.get(t.id);
            const due = dueByTenant.get(t.id);
            return (
              <button key={t.id} onClick={() => setOpenId(t.id)} className="row row-link">
                <span className="num grid h-8 w-9 shrink-0 place-items-center rounded-md bg-[var(--surface-3)] text-[11.5px] font-bold text-[var(--ink-2)]">
                  {unit ?? "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{t.name}</span>
                  <span className="t-xs block truncate text-[var(--muted)]">
                    {t.nationality || "—"}{t.workplace ? ` · ${t.workplace}` : ""}
                  </span>
                </span>
                {due ? (
                  <Money v={due.amount} size="sm" tone="var(--danger)" className="shrink-0" />
                ) : (
                  <span className="num t-xs shrink-0 text-[var(--muted)]" dir="ltr">{t.phone}</span>
                )}
                <Icon name="chevronLeft" size={14} className="shrink-0 text-[var(--faint)]" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <Empty icon="users" title="لا يوجد مستأجرون" body={q ? "جرّب كلمة بحث أخرى." : undefined} />
        </div>
      )}

      {adding && <TenantForm open onClose={() => setAdding(false)} />}
      <TenantSheet id={openId} onClose={() => setOpenId(null)} />

      <PrintOverlay open={printRegister} onClose={() => setPrintRegister(false)} fileTitle="سجل المستأجرين">
        <TenantsRegisterDoc buildingId={activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding} />
      </PrintOverlay>
    </div>
  );
}

/* ============================ تفاصيل المستأجر ============================ */

function TenantSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, update } = useStore();
  const { user, allow } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [newContract, setNewContract] = useState(false);
  const [newPayment, setNewPayment] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const tenant = useMemo(() => data.tenants.find((t) => t.id === id) ?? null, [data.tenants, id]);
  const contracts = useMemo(
    () => data.contracts.filter((c) => c.tenantId === id).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [data.contracts, id]
  );
  const payments = useMemo(
    () => data.payments.filter((p) => p.tenantId === id).sort((a, b) => b.period.localeCompare(a.period)),
    [data.payments, id]
  );
  const active = contracts.find((c) => c.status === "active");
  const unit = data.units.find((u) => u.id === active?.unitId);
  const building = data.buildings.find((b) => b.id === active?.buildingId);

  const due = useMemo(() => {
    if (!active) return { amount: 0, missing: [] as string[] };
    const a = arrears(data, scope(data, active.buildingId)).find((x) => x.contract.id === active.id);
    return { amount: a?.amount ?? 0, missing: a?.missing ?? [] };
  }, [data, active]);

  if (!tenant) return null;
  const totalPaid = payments.reduce((a, p) => a + p.amount, 0);

  const remove = async () => {
    if (!(await confirm("حذف المستأجر", `سيتم حذف ${tenant.name} وجميع عقوده ودفعاته.`))) return;
    update((d) => {
      const unitIds = d.contracts.filter((c) => c.tenantId === tenant.id).map((c) => c.unitId);
      d.tenants = d.tenants.filter((t) => t.id !== tenant.id);
      d.contracts = d.contracts.filter((c) => c.tenantId !== tenant.id);
      d.payments = d.payments.filter((p) => p.tenantId !== tenant.id);
      d.units.forEach((u) => { if (unitIds.includes(u.id) && u.status === "occupied") u.status = "vacant"; });
    }, { action: "حذف مستأجر", detail: tenant.name, actor: user?.username });
    onClose();
  };

  return (
    <>
      {dialog}
      <Sheet open={!!id} onClose={onClose} wide title={tenant.name}>
        {/* الحالة */}
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold">
              {unit ? `شقة ${unit.number}` : "بدون وحدة"}
              <span className="t-xs mr-1.5 font-normal text-[var(--muted)]">{building?.name}</span>
            </p>
            {active && (
              <p className="t-xs mt-0.5 text-[var(--muted)]">
                العقد {dateShort(active.startDate)} — {dateShort(active.endDate)}
              </p>
            )}
          </div>
          {allow("finance.view") && (
            <div className="shrink-0 text-left">
              {due.amount > 0
                ? <><Money v={due.amount} size="sm" tone="var(--danger)" /><p className="t-xs text-[var(--muted)]">{monthsLabel(due.missing.length)}</p></>
                : <span className="tag" style={{ background: "var(--ok-050)", color: "var(--ok)" }}>منتظم</span>}
            </div>
          )}
        </div>

        {/* الاتصال */}
        {allow("tenants.contact") && (
          <div className="mb-3 flex gap-2">
            <a href={`tel:${tenant.phone}`} className="btn btn-ghost btn-sm flex-1"><Icon name="phone" size={13} /> اتصال</a>
            <a
              href={`https://wa.me/965${tenant.phone}`} target="_blank" rel="noopener noreferrer"
              className="btn btn-sm flex-1" style={{ background: "var(--ok-050)", color: "var(--ok)" }}
            >
              <Icon name="whatsapp" size={13} /> واتساب
            </a>
            {allow("reports.view") && (
              <button className="btn btn-ghost btn-sm" onClick={() => setPrinting(true)}>
                <Icon name="print" size={13} /> كشف حساب
              </button>
            )}
          </div>
        )}

        {/* البيانات */}
        <Panel title="البيانات الشخصية" className="mb-3">
          <KeyVal k="الرقم المدني" v={<span dir="ltr">{tenant.civilId || "—"}</span>} />
          <KeyVal k="رقم الهاتف" v={<span dir="ltr">{tenant.phone}</span>} />
          {tenant.phone2 && <KeyVal k="هاتف بديل" v={<span dir="ltr">{tenant.phone2}</span>} />}
          <KeyVal k="الجنسية" v={tenant.nationality || "—"} />
          <KeyVal k="المهنة" v={tenant.workplace || "—"} />
          {tenant.emergencyContact && <KeyVal k="اتصال الطوارئ" v={tenant.emergencyContact} />}
          {tenant.notes && <KeyVal k="ملاحظات" v={tenant.notes} />}
        </Panel>

        {/* المالية */}
        {allow("finance.view") && (
          <Panel
            title="السجل المالي"
            className="mb-3"
            flush
            action={
              allow("receipts.create") && active ? (
                <button className="btn btn-gold btn-sm" onClick={() => setNewPayment(due.missing[0] ?? "")}>
                  <Icon name="plus" size={13} /> دفعة
                </button>
              ) : undefined
            }
          >
            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[var(--line)] border-b border-[var(--line)]">
              <div className="p-3 text-center">
                <Money v={totalPaid} size="lg" />
                <p className="t-xs mt-0.5 text-[var(--muted)]">إجمالي المسدَّد</p>
              </div>
              <div className="p-3 text-center">
                <Money v={due.amount} size="lg" tone={due.amount ? "var(--danger)" : "var(--muted)"} />
                <p className="t-xs mt-0.5 text-[var(--muted)]">المتأخر</p>
              </div>
            </div>
            {due.missing.length > 0 && (
              <p className="t-xs border-b border-[var(--line)] bg-[var(--danger-050)] px-3.5 py-2 font-semibold text-[var(--danger)]">
                غير مسدَّد: {due.missing.map(monthAr).join("، ")}
              </p>
            )}
            {payments.length ? (
              payments.slice(0, 8).map((p) => (
                <div key={p.id} className="row">
                  <Icon name="check" size={14} className="shrink-0 text-[var(--ok)]" />
                  <span className="flex-1 text-[13px]">{monthAr(p.period)}</span>
                  <span className="t-xs text-[var(--muted)]">{methodLabel[p.method]} · {p.receiptNo}</span>
                  <Money v={p.amount} size="sm" />
                </div>
              ))
            ) : (
              <p className="t-sm px-3.5 py-4 text-center text-[var(--muted)]">لا توجد دفعات مسجّلة</p>
            )}
          </Panel>
        )}

        {/* العقود */}
        <Panel title={`العقود (${num(contracts.length)})`} className="mb-3" flush>
          {contracts.length ? contracts.map((c) => {
            const u = data.units.find((x) => x.id === c.unitId);
            return (
              <div key={c.id} className="row">
                <span className="num grid h-7 w-8 shrink-0 place-items-center rounded bg-[var(--surface-3)] text-[11px] font-bold">
                  {u?.number ?? "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold">{c.no} · {KWD(c.rent)}</span>
                  <span className="t-xs block text-[var(--muted)]">{dateShort(c.startDate)} — {dateShort(c.endDate)}</span>
                </span>
                <span className="tag" style={
                  c.status === "active" ? { background: "var(--ok-050)", color: "var(--ok)" }
                    : { background: "var(--steel-050)", color: "var(--steel)" }
                }>
                  {c.status === "active" ? "ساري" : c.status === "expired" ? "منتهي" : c.status === "terminated" ? "مفسوخ" : "قادم"}
                </span>
              </div>
            );
          }) : <p className="t-sm px-3.5 py-4 text-center text-[var(--muted)]">لا توجد عقود</p>}
        </Panel>

        {/* المستندات */}
        {allow("docs.view") && (
          <div className="panel mb-3">
            <button onClick={() => setShowDocs((v) => !v)} className="panel-head w-full !border-b-0 text-right">
              <span className="panel-title">مستندات المستأجر</span>
              <Icon name="chevronDown" size={15} className="text-[var(--faint)]" style={{ transform: showDocs ? "rotate(180deg)" : "none" }} />
            </button>
            {showDocs && (
              <div className="border-t border-[var(--line)] p-3.5">
                <DocsPanel ownerType="tenant" ownerId={tenant.id} defaultKind="civil_id" compact />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {allow("tenants.edit") && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Icon name="edit" size={13} /> تعديل</button>
          )}
          {allow("contracts.edit") && (
            <button className="btn btn-ghost btn-sm" onClick={() => setNewContract(true)}><Icon name="file" size={13} /> عقد جديد</button>
          )}
          {allow("tenants.edit") && (
            <button className="btn btn-danger btn-sm mr-auto" onClick={remove}><Icon name="trash" size={13} /> حذف</button>
          )}
        </div>
      </Sheet>

      {editing && <TenantForm open onClose={() => setEditing(false)} tenant={tenant} />}
      {newContract && <ContractForm open onClose={() => setNewContract(false)} />}
      {newPayment !== null && active && (
        <PaymentForm open onClose={() => setNewPayment(null)} presetContractId={active.id} presetPeriod={newPayment || undefined} />
      )}
      <PrintOverlay open={printing} onClose={() => setPrinting(false)} fileTitle={`كشف حساب — ${tenant.name}`}>
        <TenantStatementDoc tenantId={tenant.id} />
      </PrintOverlay>
    </>
  );
}
