"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "./Toast";
import { Chip, KeyVal, Sheet, Segmented, useConfirm, type Tone } from "./ui";
import { Icon } from "./Icons";
import DocsPanel from "./DocsPanel";
import { ContractForm, PaymentForm, TicketForm, UnitForm } from "./forms";
import { KWD, dateShort, kindLabel, methodLabel, monthAr, statusLabel } from "@/lib/format";
import { tenantOfUnit, unitBalance } from "@/lib/selectors";
import type { Unit, UnitStatus } from "@/lib/types";

export const statusTone: Record<UnitStatus, Tone> = {
  occupied: "teal", vacant: "amber", maintenance: "rose", reserved: "violet",
};

export default function UnitSheet({ unitId, onClose }: { unitId: string | null; onClose: () => void }) {
  const { data, update } = useStore();
  const { user, allow } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<"info" | "payments" | "docs">("info");
  const [editing, setEditing] = useState(false);
  const [newContract, setNewContract] = useState(false);
  const [newPayment, setNewPayment] = useState(false);
  const [newTicket, setNewTicket] = useState(false);

  const unit = useMemo(() => data.units.find((u) => u.id === unitId) ?? null, [data.units, unitId]);
  const floor = data.floors.find((f) => f.id === unit?.floorId);
  const building = data.buildings.find((b) => b.id === unit?.buildingId);
  const { contract, tenant } = useMemo(
    () => (unit ? tenantOfUnit(data, unit.id) : { contract: undefined, tenant: undefined }),
    [data, unit]
  );
  const balance = useMemo(() => (unit ? unitBalance(data, unit.id) : { due: 0, missing: [] }), [data, unit]);
  const payments = useMemo(
    () => data.payments.filter((p) => p.unitId === unitId).sort((a, b) => b.period.localeCompare(a.period)),
    [data.payments, unitId]
  );
  const tickets = useMemo(() => data.tickets.filter((t) => t.unitId === unitId), [data.tickets, unitId]);

  if (!unit) return null;

  const setStatus = (status: UnitStatus) => {
    update((d) => { const u = d.units.find((x) => x.id === unit.id); if (u) u.status = status; },
      { action: "تغيير حالة وحدة", detail: `${unit.number} → ${statusLabel[status]}`, actor: user?.username });
    toast(`الحالة الآن: ${statusLabel[status]}`);
  };

  const endContract = async () => {
    if (!contract) return;
    if (!(await confirm("إنهاء العقد", `سيتم إنهاء عقد ${tenant?.name ?? ""} وتصبح الوحدة فاضية.`))) return;
    update((d) => {
      const c = d.contracts.find((x) => x.id === contract.id);
      if (c) c.status = "terminated";
      const u = d.units.find((x) => x.id === unit.id);
      if (u) u.status = "vacant";
    }, { action: "إنهاء عقد", detail: `وحدة ${unit.number}`, actor: user?.username });
    toast("تم إنهاء العقد");
  };

  const removeUnit = async () => {
    if (!(await confirm("حذف الوحدة", `سيتم حذف الوحدة ${unit.number} وكل عقودها ودفعاتها. لا يمكن التراجع.`))) return;
    update((d) => {
      d.units = d.units.filter((u) => u.id !== unit.id);
      d.contracts = d.contracts.filter((c) => c.unitId !== unit.id);
      d.payments = d.payments.filter((p) => p.unitId !== unit.id);
      d.tickets = d.tickets.filter((t) => t.unitId !== unit.id);
    }, { action: "حذف وحدة", detail: unit.number, actor: user?.username });
    toast("تم حذف الوحدة");
    onClose();
  };

  return (
    <>
      {dialog}
      <Sheet open={!!unitId} onClose={onClose} wide title={`الوحدة ${unit.number}`}>
        {/* رأس */}
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-gradient-to-l from-[var(--primary-050)] to-transparent p-3">
          <div
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white shadow-[var(--sh-1)]"
            style={{ background: building?.color ?? "var(--primary)" }}
          >
            {unit.number}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-[15px] font-extrabold">{kindLabel[unit.kind]} {unit.number}</h3>
              <Chip tone={statusTone[unit.status]}>{statusLabel[unit.status]}</Chip>
              {balance.due > 0 && <Chip tone="rose" icon="alert">متأخر {KWD(balance.due, false)}</Chip>}
            </div>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              {building?.name} · {floor?.name}
            </p>
          </div>
        </div>

        {/* مواصفات */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          {[
            { icon: "ruler", v: unit.area ? `${unit.area}م²` : "—", l: "المساحة" },
            { icon: "bed", v: unit.rooms ?? "—", l: "غرف" },
            { icon: "bath", v: unit.bathrooms ?? "—", l: "حمام" },
            { icon: "wallet", v: KWD(unit.baseRent, false), l: "الإيجار" },
          ].map((x) => (
            <div key={x.l} className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2 text-center">
              <Icon name={x.icon} size={16} className="mx-auto text-[var(--muted)]" />
              <p className="mt-1 text-[13px] font-extrabold tabular-nums">{x.v}</p>
              <p className="text-[10.5px] text-[var(--muted)]">{x.l}</p>
            </div>
          ))}
        </div>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "info", label: "معلومات" },
            ...(allow("finance.view") ? [{ value: "payments" as const, label: "الدفعات", count: payments.length }] : []),
            ...(allow("docs.view") ? [{ value: "docs" as const, label: "المستندات" }] : []),
          ]}
        />

        <div className="mt-3">
          {tab === "info" && (
            <div className="space-y-4">
              {tenant && contract ? (
                <div className="card p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[13px] font-extrabold">
                    <Icon name="user" size={15} className="text-[var(--muted)]" /> المستأجر الحالي
                  </p>
                  <Link href={`/tenants?id=${tenant.id}`} className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-2)] p-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#1b4f8a] to-[#0b2545] text-[13px] font-extrabold text-white">
                      {tenant.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-extrabold">{tenant.name}</span>
                      <span className="block text-[11.5px] text-[var(--muted)]" dir="ltr">{tenant.civilId || "—"}</span>
                    </span>
                    <Icon name="chevronLeft" size={16} className="text-[var(--muted)]" />
                  </Link>

                  {allow("tenants.contact") && (
                    <div className="mt-2 flex gap-2">
                      <a href={`tel:${tenant.phone}`} className="btn btn-ghost btn-sm flex-1"><Icon name="phone" size={14} /> اتصال</a>
                      <a
                        href={`https://wa.me/965${tenant.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm flex-1"
                        style={{ background: "var(--ok-050)", color: "var(--ok)" }}
                      >
                        <Icon name="whatsapp" size={14} /> واتساب
                      </a>
                    </div>
                  )}

                  <div className="mt-3">
                    <KeyVal k="رقم العقد" v={contract.no} icon="file" />
                    <KeyVal k="من" v={dateShort(contract.startDate)} icon="calendar" />
                    <KeyVal k="إلى" v={dateShort(contract.endDate)} icon="calendar" />
                    <KeyVal k="الإيجار" v={KWD(contract.rent)} icon="wallet" />
                    <KeyVal k="التأمين" v={KWD(contract.deposit)} icon="lock" />
                    <KeyVal k="طريقة الدفع" v={methodLabel[contract.payMethod]} icon="card" />
                    {balance.missing.length > 0 && (
                      <KeyVal
                        k="أشهر غير مسددة"
                        v={<span className="text-[#b3303b]">{balance.missing.map(monthAr).join("، ")}</span>}
                        icon="alert"
                      />
                    )}
                  </div>

                  {allow("contracts.edit") && (
                    <div className="mt-3 flex gap-2">
                      <Link href={`/contracts?id=${contract.id}`} className="btn btn-ghost btn-sm flex-1"><Icon name="print" size={14} /> طباعة العقد</Link>
                      <button className="btn btn-danger btn-sm" onClick={endContract}><Icon name="x" size={14} /> إنهاء العقد</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card flex flex-col items-center p-5 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--warn-050)] text-[var(--gold-600)]">
                    <Icon name="door" size={22} />
                  </span>
                  <p className="mt-2 font-extrabold">الوحدة غير مؤجرة</p>
                  <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">ما فيه عقد ساري على هذه الوحدة</p>
                  {allow("contracts.edit") && (
                    <button className="btn btn-primary btn-sm mt-3" onClick={() => setNewContract(true)}>
                      <Icon name="plus" size={14} /> إنشاء عقد إيجار
                    </button>
                  )}
                </div>
              )}

              <div className="card p-3">
                <p className="mb-1.5 text-[13px] font-extrabold">تفاصيل الوحدة</p>
                <KeyVal k="النوع" v={kindLabel[unit.kind]} icon="grid" />
                <KeyVal k="الدور" v={floor?.name ?? "—"} icon="layers" />
                <KeyVal k="المساحة" v={unit.area ? `${unit.area} م²` : "—"} icon="ruler" />
                <KeyVal k="الغرف / الحمامات / البلكونات" v={`${unit.rooms ?? 0} / ${unit.bathrooms ?? 0} / ${unit.balconies ?? 0}`} icon="bed" />
                <KeyVal k="عداد الكهرباء" v={<span dir="ltr">{unit.meterNo || "—"}</span>} icon="info" />
                {unit.notes && <KeyVal k="ملاحظات" v={unit.notes} icon="file" />}
              </div>

              {tickets.length > 0 && (
                <div className="card p-3">
                  <p className="mb-1.5 text-[13px] font-extrabold">بلاغات الصيانة ({tickets.length})</p>
                  <ul className="space-y-1.5">
                    {tickets.slice(0, 5).map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-[12.5px]">
                        <Icon name="wrench" size={14} className="text-[var(--muted)]" />
                        <span className="flex-1 truncate">{t.title}</span>
                        <Chip tone={t.status === "done" ? "green" : t.status === "new" ? "rose" : "sky"}>
                          {t.status === "done" ? "تم" : t.status === "new" ? "جديد" : "جاري"}
                        </Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* إجراءات */}
              <div className="flex flex-wrap gap-2">
                {allow("units.edit") && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Icon name="edit" size={14} /> تعديل</button>
                    <select
                      className="select !w-auto !py-1.5 !text-[12px]"
                      value={unit.status}
                      onChange={(e) => setStatus(e.target.value as UnitStatus)}
                    >
                      {(Object.keys(statusLabel) as UnitStatus[]).map((s) => (
                        <option key={s} value={s}>{statusLabel[s]}</option>
                      ))}
                    </select>
                  </>
                )}
                {allow("receipts.create") && contract && (
                  <button className="btn btn-soft btn-sm" onClick={() => setNewPayment(true)}><Icon name="receipt" size={14} /> تسجيل دفعة</button>
                )}
                {allow("tickets.create") && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setNewTicket(true)}><Icon name="wrench" size={14} /> بلاغ صيانة</button>
                )}
                {allow("units.edit") && (
                  <button className="btn btn-danger btn-sm mr-auto" onClick={removeUnit}><Icon name="trash" size={14} /> حذف</button>
                )}
              </div>
            </div>
          )}

          {tab === "payments" && (
            <div>
              {payments.length ? (
                <ul className="space-y-2">
                  {payments.map((p) => (
                    <li key={p.id} className="card flex items-center gap-3 p-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--ok-050)] text-[var(--ok)]">
                        <Icon name="check" size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold">{monthAr(p.period)}</p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {dateShort(p.paidAt)} · {methodLabel[p.method]} · وصل {p.receiptNo}
                        </p>
                      </div>
                      <span className="text-[13px] font-extrabold tabular-nums">{KWD(p.amount, false)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-[13px] text-[var(--muted)]">لا توجد دفعات مسجلة</p>
              )}
            </div>
          )}

          {tab === "docs" && <DocsPanel ownerType="unit" ownerId={unit.id} buildingId={unit.buildingId} compact />}
        </div>
      </Sheet>

      {editing && <UnitForm open onClose={() => setEditing(false)} buildingId={unit.buildingId} unit={unit} />}
      {newContract && <ContractForm open onClose={() => setNewContract(false)} presetUnitId={unit.id} presetBuildingId={unit.buildingId} />}
      {newPayment && contract && <PaymentForm open onClose={() => setNewPayment(false)} presetContractId={contract.id} />}
      {newTicket && <TicketForm open onClose={() => setNewTicket(false)} presetUnitId={unit.id} />}
    </>
  );
}
