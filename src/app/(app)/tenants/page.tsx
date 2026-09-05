"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, scope } from "@/lib/selectors";
import { KWD, dateShort, methodLabel, monthAr, num } from "@/lib/format";
import { Chip, Empty, KeyVal, PageHeader, SearchBox, Segmented, Sheet, useConfirm } from "@/components/ui";
import { Icon } from "@/components/Icons";
import DocsPanel from "@/components/DocsPanel";
import { ContractForm, PaymentForm, TenantForm } from "@/components/forms";
import type { Tenant } from "@/lib/types";

export default function TenantsPage() {
  const { data, activeBuilding } = useStore();
  const { allow } = useAuth();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"current" | "arrears" | "all">("current");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setOpenId(id);
  }, []);

  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const ar = useMemo(() => arrears(data, s), [data, s]);
  const arrearIds = useMemo(() => new Set(ar.map((a) => a.contract.tenantId)), [ar]);

  const activeTenantIds = useMemo(
    () => new Set(s.contracts.filter((c) => c.status === "active" || c.status === "upcoming").map((c) => c.tenantId)),
    [s.contracts]
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let base = activeBuilding === "all" ? data.tenants : data.tenants.filter((t) => s.tenantIds.has(t.id));
    if (tab === "current") base = base.filter((t) => activeTenantIds.has(t.id));
    if (tab === "arrears") base = base.filter((t) => arrearIds.has(t.id));
    if (needle)
      base = base.filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          t.phone.includes(needle) ||
          (t.civilId ?? "").includes(needle) ||
          (t.nationality ?? "").includes(needle)
      );
    return base.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [data.tenants, s.tenantIds, activeBuilding, tab, q, activeTenantIds, arrearIds]);

  const unitOf = (tenantId: string) => {
    const c = data.contracts.find((x) => x.tenantId === tenantId && (x.status === "active" || x.status === "upcoming"))
      ?? data.contracts.find((x) => x.tenantId === tenantId);
    return { contract: c, unit: data.units.find((u) => u.id === c?.unitId) };
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="المستأجرون"
        subtitle={`${num(list.length)} مستأجر`}
        icon="users"
        actions={
          allow("tenants.edit") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              <Icon name="plus" size={15} /> مستأجر
            </button>
          ) : undefined
        }
      />

      <SearchBox value={q} onChange={setQ} placeholder="الاسم، الهاتف، الرقم المدني…" />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "current", label: "الحاليون", count: activeTenantIds.size },
          ...(allow("finance.view") ? [{ value: "arrears" as const, label: "عليهم متأخرات", count: arrearIds.size }] : []),
          { value: "all", label: "الكل", count: activeBuilding === "all" ? data.tenants.length : s.tenants.length },
        ]}
      />

      {list.length ? (
        <div className="space-y-1.5">
          {list.map((t) => {
            const { unit } = unitOf(t.id);
            const due = ar.find((a) => a.contract.tenantId === t.id)?.amount ?? 0;
            return (
              <button
                key={t.id}
                onClick={() => setOpenId(t.id)}
                className="card flex w-full items-center gap-3 p-2.5 text-right transition hover:shadow-[var(--sh-2)] active:scale-[.99]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--primary-050)] text-[var(--primary)]">
                  <Icon name="user" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-extrabold">{t.name}</p>
                  <p className="truncate text-[11.5px] text-[var(--muted)]">
                    {unit ? `شقة ${unit.number}` : "بدون وحدة"} · {t.nationality || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-left">
                  {due > 0 ? (
                    <Chip tone="rose" icon="alert">{KWD(due, false)}</Chip>
                  ) : (
                    <span dir="ltr" className="text-[11.5px] font-bold text-[var(--muted)]">{t.phone}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty
          icon="users"
          title="ما فيه مستأجرين"
          body={q ? "جرّب كلمة بحث ثانية." : "أضف أول مستأجر لهذه العمارة."}
          action={allow("tenants.edit") ? <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> إضافة</button> : undefined}
        />
      )}

      {adding && <TenantForm open onClose={() => setAdding(false)} />}
      <TenantSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

/* ============================ تفاصيل المستأجر ============================ */

function TenantSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, update } = useStore();
  const { user, allow } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<"info" | "payments" | "docs">("info");
  const [editing, setEditing] = useState(false);
  const [newContract, setNewContract] = useState(false);
  const [newPayment, setNewPayment] = useState(false);

  const tenant = useMemo(() => data.tenants.find((t) => t.id === id) ?? null, [data.tenants, id]);
  const contracts = useMemo(
    () => data.contracts.filter((c) => c.tenantId === id).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [data.contracts, id]
  );
  const payments = useMemo(
    () => data.payments.filter((p) => p.tenantId === id).sort((a, b) => b.period.localeCompare(a.period)),
    [data.payments, id]
  );
  const active = contracts.find((c) => c.status === "active" || c.status === "upcoming");
  const unit = data.units.find((u) => u.id === active?.unitId);
  const building = data.buildings.find((b) => b.id === active?.buildingId);

  const due = useMemo(() => {
    if (!active) return { amount: 0, missing: [] as string[] };
    const s = scope(data, active.buildingId);
    const a = arrears(data, s).find((x) => x.contract.id === active.id);
    return { amount: a?.amount ?? 0, missing: a?.missing ?? [] };
  }, [data, active]);

  if (!tenant) return null;

  const remove = async () => {
    if (!(await confirm("حذف المستأجر", `سيتم حذف ${tenant.name} وكل عقوده ودفعاته.`))) return;
    update((d) => {
      d.tenants = d.tenants.filter((t) => t.id !== tenant.id);
      const unitIds = d.contracts.filter((c) => c.tenantId === tenant.id).map((c) => c.unitId);
      d.contracts = d.contracts.filter((c) => c.tenantId !== tenant.id);
      d.payments = d.payments.filter((p) => p.tenantId !== tenant.id);
      d.units.forEach((u) => { if (unitIds.includes(u.id) && u.status === "occupied") u.status = "vacant"; });
    }, { action: "حذف مستأجر", detail: tenant.name, actor: user?.username });
    onClose();
  };

  const totalPaid = payments.reduce((a, p) => a + p.amount, 0);

  return (
    <>
      {dialog}
      <Sheet open={!!id} onClose={onClose} wide title={tenant.name}>
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-l from-[var(--primary-050)] to-transparent p-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-white">
            <Icon name="user" size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-extrabold">{tenant.name}</h3>
            <p className="text-[12px] text-[var(--muted)]">
              {unit ? `${building?.name} · شقة ${unit.number}` : "غير مرتبط بوحدة"}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {due.amount > 0 ? <Chip tone="rose" icon="alert">متأخر {KWD(due.amount, false)}</Chip> : <Chip tone="green" icon="check">منتظم</Chip>}
              {tenant.nationality && <Chip tone="slate">{tenant.nationality}</Chip>}
            </div>
          </div>
        </div>

        {allow("tenants.contact") && (
          <div className="mb-4 flex gap-2">
            <a href={`tel:${tenant.phone}`} className="btn btn-ghost btn-sm flex-1"><Icon name="phone" size={14} /> اتصال</a>
            <a
              href={`https://wa.me/965${tenant.phone}`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-sm flex-1" style={{ background: "var(--ok-050)", color: "var(--ok)" }}
            >
              <Icon name="whatsapp" size={14} /> واتساب
            </a>
            {allow("finance.view") && due.amount > 0 && (
              <a
                href={`https://wa.me/965${tenant.phone}?text=${encodeURIComponent(
                  `السلام عليكم ${tenant.name}،\nتذكير بإيجار ${unit ? `شقة ${unit.number}` : ""} للأشهر: ${due.missing.map(monthAr).join("، ")}\nالمبلغ المستحق: ${KWD(due.amount)}\nشاكرين تعاونكم.`
                )}`}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-sm" style={{ background: "var(--warn-050)", color: "var(--gold-600)" }}
              >
                <Icon name="bell" size={14} /> تذكير
              </a>
            )}
          </div>
        )}

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "info", label: "المعلومات" },
            ...(allow("finance.view") ? [{ value: "payments" as const, label: "السجل المالي", count: payments.length }] : []),
            ...(allow("docs.view") ? [{ value: "docs" as const, label: "المستندات" }] : []),
          ]}
        />

        <div className="mt-3 space-y-4">
          {tab === "info" && (
            <>
              <div className="card p-3">
                <p className="mb-1.5 text-[13px] font-extrabold">البيانات الشخصية</p>
                <KeyVal k="الرقم المدني" v={<span dir="ltr">{tenant.civilId || "—"}</span>} icon="idCard" />
                <KeyVal k="الهاتف" v={<span dir="ltr">{tenant.phone}</span>} icon="phone" />
                {tenant.phone2 && <KeyVal k="هاتف بديل" v={<span dir="ltr">{tenant.phone2}</span>} icon="phone" />}
                <KeyVal k="الجنسية" v={tenant.nationality || "—"} icon="user" />
                <KeyVal k="جهة العمل" v={tenant.workplace || "—"} icon="building" />
                {tenant.email && <KeyVal k="البريد" v={<span dir="ltr">{tenant.email}</span>} icon="file" />}
                {tenant.emergencyContact && <KeyVal k="اتصال الطوارئ" v={tenant.emergencyContact} icon="alert" />}
                {tenant.notes && <KeyVal k="ملاحظات" v={tenant.notes} icon="file" />}
              </div>

              <div className="card p-3">
                <p className="mb-2 text-[13px] font-extrabold">العقود ({contracts.length})</p>
                {contracts.length ? (
                  <ul className="space-y-1.5">
                    {contracts.map((c) => {
                      const u = data.units.find((x) => x.id === c.unitId);
                      return (
                        <li key={c.id} className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-2)] p-2.5">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[12px] font-extrabold shadow-[var(--sh-1)]">
                            {u?.number ?? "—"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-bold">{c.no} · {KWD(c.rent, false)} د.ك</p>
                            <p className="text-[11px] text-[var(--muted)]">{dateShort(c.startDate)} — {dateShort(c.endDate)}</p>
                          </div>
                          <Chip tone={c.status === "active" ? "green" : c.status === "upcoming" ? "sky" : "slate"}>
                            {c.status === "active" ? "ساري" : c.status === "upcoming" ? "قادم" : c.status === "expired" ? "منتهي" : "مفسوخ"}
                          </Chip>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-[12.5px] text-[var(--muted)]">ما فيه عقود</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {allow("tenants.edit") && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Icon name="edit" size={14} /> تعديل</button>
                )}
                {allow("contracts.edit") && (
                  <button className="btn btn-soft btn-sm" onClick={() => setNewContract(true)}><Icon name="file" size={14} /> عقد جديد</button>
                )}
                {allow("receipts.create") && active && (
                  <button className="btn btn-soft btn-sm" onClick={() => setNewPayment(true)}><Icon name="receipt" size={14} /> تسجيل دفعة</button>
                )}
                {allow("tenants.edit") && (
                  <button className="btn btn-danger btn-sm mr-auto" onClick={remove}><Icon name="trash" size={14} /> حذف</button>
                )}
              </div>
            </>
          )}

          {tab === "payments" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="card p-3 text-center">
                  <p className="text-[11px] text-[var(--muted)]">إجمالي المدفوع</p>
                  <p className="display text-[17px] tabular-nums">{KWD(totalPaid, false)}</p>
                </div>
                <div className="card p-3 text-center">
                  <p className="text-[11px] text-[var(--muted)]">المتأخر</p>
                  <p className="display text-[17px] tabular-nums" style={{ color: due.amount ? "#b3303b" : undefined }}>
                    {KWD(due.amount, false)}
                  </p>
                </div>
              </div>

              {due.missing.length > 0 && (
                <div className="rounded-2xl bg-[var(--danger-050)] p-3">
                  <p className="mb-1.5 text-[12.5px] font-extrabold text-[#b3303b]">أشهر غير مسددة</p>
                  <div className="flex flex-wrap gap-1">
                    {due.missing.map((m) => (
                      <span key={m} className="rounded-lg bg-white px-2 py-0.5 text-[11.5px] font-bold text-[#b3303b]">{monthAr(m)}</span>
                    ))}
                  </div>
                </div>
              )}

              {payments.length ? (
                <ul className="space-y-2">
                  {payments.map((p) => (
                    <li key={p.id} className="card flex items-center gap-3 p-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--ok-050)] text-[var(--ok)]">
                        <Icon name="receipt" size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold">{monthAr(p.period)}</p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {dateShort(p.paidAt)} · {methodLabel[p.method]} · {p.receiptNo}
                        </p>
                      </div>
                      <span className="text-[13px] font-extrabold tabular-nums">{KWD(p.amount, false)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-[13px] text-[var(--muted)]">لا توجد دفعات</p>
              )}
            </>
          )}

          {tab === "docs" && (
            <DocsPanel ownerType="tenant" ownerId={tenant.id} defaultKind="civil_id" compact />
          )}
        </div>
      </Sheet>

      {editing && <TenantForm open onClose={() => setEditing(false)} tenant={tenant} />}
      {newContract && <ContractForm open onClose={() => setNewContract(false)} />}
      {newPayment && active && <PaymentForm open onClose={() => setNewPayment(false)} presetContractId={active.id} />}
    </>
  );
}
