"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "./Toast";
import { Field, KeyVal, Money, Sheet, TextArea, TextInput, useConfirm } from "./ui";
import { Icon } from "./Icons";
import DocsPanel from "./DocsPanel";
import { ContractForm, PaymentForm, UnitForm } from "./forms";
import { markPaid, unmarkPaid } from "@/lib/payments";
import { ContractDoc, EvictionDoc, PrintOverlay, ReceiptSheet, receiptOfContract, receiptOfPayment } from "./print";
import { KWD, addMonths, dateShort, kindLabel, methodLabel, monthAr, statusLabel, thisPeriod, todayISO } from "@/lib/format";
import { tenantOfUnit, unitBalance } from "@/lib/selectors";
import { unitColor } from "@/lib/unitColor";

export default function UnitSheet({ unitId, onClose }: { unitId: string | null; onClose: () => void }) {
  const { data, update } = useStore();
  const { user, allow } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [editing, setEditing] = useState(false);
  const [newContract, setNewContract] = useState(false);
  const [newPayment, setNewPayment] = useState<string | null>(null);
  const [printKind, setPrintKind] = useState<null | "contract" | "receipt" | "eviction">(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintText, setMaintText] = useState("");
  const [flagText, setFlagText] = useState("");
  const [showDocs, setShowDocs] = useState(false);
  const [showAllPays, setShowAllPays] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [vacateOpen, setVacateOpen] = useState(false);
  const [renewFrom, setRenewFrom] = useState("");
  const [renewTo, setRenewTo] = useState("");
  const [vacateDate, setVacateDate] = useState(todayISO());

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
  const thisMonthPaid = payments.find((p) => p.period === thisPeriod());

  if (!unit) return null;
  const color = unitColor(unit);

  const toggleFlag = () => {
    if (unit.flagged) {
      update((d) => {
        const u = d.units.find((x) => x.id === unit.id);
        if (u) { u.flagged = false; u.flagNote = undefined; u.flaggedAt = undefined; }
      }, { action: "إزالة تنبيه", detail: `الوحدة ${unit.number}`, actor: user?.username });
      toast("تم إزالة التنبيه");
    } else {
      setFlagText("");
      setFlagOpen(true);
    }
  };

  /** تحت الصيانة أو لا — تبديل واحد بضغطة، مع سبب اختياري. */
  const toggleMaintenance = () => {
    if (unit.maintenance) {
      update((d) => {
        const u = d.units.find((x) => x.id === unit.id);
        if (u) { u.maintenance = false; u.maintenanceNote = undefined; u.maintenanceAt = undefined; }
      }, { action: "إنهاء صيانة", detail: `الوحدة ${unit.number}`, actor: user?.username });
      toast("انتهت الصيانة");
    } else {
      setMaintText("");
      setMaintOpen(true);
    }
  };

  const saveMaintenance = () => {
    update((d) => {
      const u = d.units.find((x) => x.id === unit.id);
      if (u) {
        u.maintenance = true;
        u.maintenanceNote = maintText.trim() || undefined;
        u.maintenanceAt = new Date().toISOString();
      }
    }, { action: "تحويل إلى صيانة", detail: `${unit.number}${maintText.trim() ? ` — ${maintText.trim()}` : ""}`, actor: user?.username });
    toast("الشقة تحت الصيانة");
    setMaintOpen(false);
  };

  const saveFlag = () => {
    if (!flagText.trim()) return toast("يرجى كتابة سبب التنبيه", "error");
    update((d) => {
      const u = d.units.find((x) => x.id === unit.id);
      if (u) { u.flagged = true; u.flagNote = flagText.trim(); u.flaggedAt = new Date().toISOString(); }
    }, { action: "تعليم شقة", detail: `${unit.number} — ${flagText.trim()}`, actor: user?.username });
    toast("تمت إضافة الملاحظة");
    setFlagOpen(false);
  };

  /** إخلاء الشقة: ينتهي العقد وتعود الوحدة شاغرة جاهزة لمستأجر جديد. */
  const vacate = async () => {
    if (!contract) return;
    const ok = await confirm(
      `إخلاء شقة ${unit.number}`,
      `سينتهي عقد ${tenant?.name ?? "المستأجر"} وتصبح الشقة شاغرة جاهزة للتأجير. الوصولات السابقة تبقى محفوظة في السجل.`
    );
    if (!ok) return;
    update((d) => {
      const c = d.contracts.find((x) => x.id === contract.id);
      if (c) { c.status = "terminated"; c.endDate = vacateDate; }
      const u = d.units.find((x) => x.id === unit.id);
      if (u) { u.status = "vacant"; u.flagged = false; u.flagNote = undefined; u.flaggedAt = undefined; }
    }, { action: "إخلاء شقة", detail: `${unit.number} — ${tenant?.name ?? ""}`, actor: user?.username });
    toast("تم إخلاء الشقة");
    setVacateOpen(false);
  };

  const openRenew = () => {
    if (!contract) return;
    setRenewFrom(contract.endDate);
    setRenewTo(addMonths(contract.endDate, 12));
    setRenewOpen(true);
  };

  const renew = async () => {
    if (!contract) return;
    if (!renewFrom || !renewTo) return toast("حدّد تاريخ البداية والنهاية", "error");
    if (renewTo <= renewFrom) return toast("تاريخ النهاية يجب أن يكون بعد البداية", "error");
    update((d) => {
      const c = d.contracts.find((x) => x.id === contract.id);
      if (c) { c.startDate = renewFrom; c.endDate = renewTo; c.status = "active"; }
    }, { action: "تجديد عقد", detail: `شقة ${unit.number} — ${renewFrom} إلى ${renewTo}`, actor: user?.username });
    toast("تم تجديد العقد");
    setRenewOpen(false);
  };

  const removeUnit = async () => {
    if (!(await confirm("حذف الوحدة", `يتم حذف الوحدة ${unit.number} وكل عقودها ودفعاتها.`))) return;
    update((d) => {
      d.units = d.units.filter((u) => u.id !== unit.id);
      d.contracts = d.contracts.filter((c) => c.unitId !== unit.id);
      d.payments = d.payments.filter((p) => p.unitId !== unit.id);
    }, { action: "حذف شقة", detail: unit.number, actor: user?.username });
    toast("تم الحذف");
    onClose();
  };

  return (
    <>
      {dialog}
      <Sheet open={!!unitId} onClose={onClose} wide title={`شقة ${unit.number}`}>
        {/* رأس */}
        <div className="mb-4 flex items-center gap-3 rounded-lg border-2 p-3" style={{ borderColor: color }}>
          <div
            className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-[17px] font-bold text-white"
            style={{ background: color }}
          >
            {unit.number}
          </div>
          <div className="min-w-0 flex-1">
            <p className="t-title">
              {kindLabel[unit.kind]} {unit.number} · <span style={{ color }}>{statusLabel[unit.status]}</span>
            </p>
            <p className="text-[12px] text-[var(--muted)]">{building?.name} · {floor?.name}</p>
          </div>
        </div>

        {/* الصيانة */}
        {unit.maintenance && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg p-3" style={{ background: "var(--maint-050)" }}>
            <Icon name="wrench" size={18} className="mt-0.5 shrink-0" style={{ color: "var(--maint)" }} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold" style={{ color: "var(--maint)" }}>
                {unit.maintenanceNote || "تحت الصيانة"}
              </p>
              <p className="text-[11px]" style={{ color: "var(--maint)", opacity: .7 }}>
                منذ {dateShort(unit.maintenanceAt)}
              </p>
            </div>
          </div>
        )}

        {/* التنبيه */}
        {unit.flagged && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-[var(--danger-050)] p-3">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-[#b3303b]" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[#b3303b]">{unit.flagNote}</p>
              <p className="text-[11px] text-[#b3303b]/70">مُعلّمة منذ {dateShort(unit.flaggedAt)}</p>
            </div>
          </div>
        )}

        {/* أرقام الشقة */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          {[
            ["المساحة", unit.area ? `${unit.area}م²` : "—"],
            ["غرف", String(unit.rooms ?? "—")],
            ["حمام", String(unit.bathrooms ?? "—")],
            ["الإيجار", KWD(unit.baseRent)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-[var(--surface-2)] p-2 text-center">
              <p className="text-[13px] font-bold tabular-nums">{v}</p>
              <p className="text-[10.5px] text-[var(--muted)]">{l}</p>
            </div>
          ))}
        </div>

        {/* المستأجر */}
        {tenant && contract ? (
          <div className="card mb-3 p-3">
            <p className="mb-2 text-[13px] font-bold">المستأجر</p>
            <KeyVal k="الاسم" v={tenant.name} icon="user" />
            <KeyVal k="الرقم المدني" v={<span dir="ltr">{tenant.civilId || "—"}</span>} icon="idCard" />
            <KeyVal k="الهاتف" v={<span dir="ltr">{tenant.phone}</span>} icon="phone" />
            {allow("tenants.contact") && (
              <div className="mt-2.5 flex gap-2">
                <a href={`tel:${tenant.phone}`} className="btn btn-ghost btn-sm flex-1">
                  <Icon name="phone" size={14} /> اتصال
                </a>
                <a
                  href={`https://wa.me/965${tenant.phone}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-sm flex-1"
                  style={{ background: "var(--ok-050)", color: "var(--ok)" }}
                >
                  <Icon name="whatsapp" size={14} /> واتساب
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="card mb-3 flex flex-col items-center p-4 text-center">
            <p className="t-section">الوحدة شاغرة</p>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">لا يوجد عقد ساري على هذه الوحدة</p>
            {allow("contracts.edit") && (
              <button className="btn btn-primary btn-sm mt-3" onClick={() => setNewContract(true)}>
                <Icon name="plus" size={14} /> إنشاء عقد إيجار
              </button>
            )}
          </div>
        )}

        {/* العقد */}
        {contract && (
          <div className="card mb-3 p-3">
            <p className="mb-2 text-[13px] font-bold">العقد</p>
            <KeyVal k="من" v={dateShort(contract.startDate)} icon="calendar" />
            <KeyVal k="إلى" v={dateShort(contract.endDate)} icon="calendar" />
            <KeyVal k="الإيجار الشهري" v={KWD(contract.rent)} icon="wallet" />
            <KeyVal k="التأمين" v={KWD(contract.deposit)} icon="lock" />
            {allow("contracts.edit") && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button className="btn btn-ghost btn-sm flex-1" onClick={openRenew}>
                  <Icon name="refresh" size={14} /> تجديد العقد
                </button>
                <button
                  className="btn btn-danger btn-sm flex-1"
                  onClick={() => { setVacateDate(todayISO()); setVacateOpen(true); }}
                >
                  <Icon name="logout" size={14} /> إخلاء الشقة
                </button>
              </div>
            )}
          </div>
        )}

        {/* الإيجار والمستندات — كل إجراء مستقل عن الآخر */}
        {contract && allow("finance.view") && (
          <div className="panel mb-3">
            <div className="panel-head">
              <span className="panel-title">إيجار {monthAr(thisPeriod())}</span>
              <span className="tag" style={
                thisMonthPaid
                  ? { background: "var(--ok-050)", color: "var(--ok)" }
                  : { background: "var(--warn-050)", color: "var(--warn)" }
              }>
                {thisMonthPaid ? "تم السداد" : "لم يُسدَّد"}
              </span>
            </div>

            {balance.due > 0 && (
              <p className="t-sm border-b border-[var(--line)] bg-[var(--danger-050)] px-3.5 py-2 font-semibold text-[var(--danger)]">
                متأخر {KWD(balance.due)} — {balance.missing.map(monthAr).join("، ")}
              </p>
            )}

            <div className="grid gap-1.5 p-3 sm:grid-cols-3">
              {allow("receipts.create") && (
                <button
                  className={`btn ${thisMonthPaid ? "btn-ghost" : "btn-primary"}`}
                  onClick={async () => {
                    const ok = thisMonthPaid
                      ? await confirm("إلغاء تأكيد السداد", `سيُحذف وصل ${thisMonthPaid.receiptNo} لشهر ${monthAr(thisPeriod())} — شقة ${unit.number}.`)
                      : await confirm(
                          "تأكيد السداد",
                          `تسجيل استلام إيجار ${monthAr(thisPeriod())} من ${tenant?.name ?? "المستأجر"} — شقة ${unit.number} بمبلغ ${KWD(contract.rent)}.`,
                          false
                        );
                    if (!ok) return;
                    update(
                      (d) => (thisMonthPaid ? unmarkPaid(d, contract.id, thisPeriod()) : markPaid(d, contract, thisPeriod(), user?.username ?? "—")),
                      { action: thisMonthPaid ? "إلغاء تأكيد سداد" : "تأكيد سداد", detail: `شقة ${unit.number} — ${monthAr(thisPeriod())}`, actor: user?.username }
                    );
                    toast(thisMonthPaid ? "تم إلغاء التأكيد" : "تم تأكيد السداد");
                  }}
                >
                  <Icon name={thisMonthPaid ? "x" : "check"} size={15} />
                  {thisMonthPaid ? "إلغاء السداد" : "تم السداد"}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setPrintKind("receipt")}>
                <Icon name="print" size={15} /> طباعة الوصل
              </button>
              <button className="btn btn-ghost" onClick={() => setPrintKind("contract")}>
                <Icon name="print" size={15} /> طباعة العقد
              </button>
            </div>

            {allow("receipts.create") && (
              <button
                className="t-xs w-full border-t border-[var(--line)] py-2 font-semibold text-[var(--primary)]"
                onClick={() => setNewPayment(balance.missing[0] ?? thisPeriod())}
              >
                تسجيل دفعة بتفاصيل أخرى (مبلغ، شيك، تاريخ…)
              </button>
            )}

            {payments.length > 0 && (
              <>
                <div className="border-t border-[var(--line)]">
                  {(showAllPays ? payments : payments.slice(0, 3)).map((p) => (
                    <div key={p.id} className="row">
                      <Icon name="check" size={13} className="shrink-0 text-[var(--ok)]" />
                      <span className="flex-1 text-[12.5px]">{monthAr(p.period)}</span>
                      <span className="t-xs text-[var(--muted)]">{methodLabel[p.method]} · {p.receiptNo}</span>
                      <Money v={p.amount} size="sm" />
                    </div>
                  ))}
                </div>
                {payments.length > 3 && (
                  <button
                    className="t-xs w-full border-t border-[var(--line)] py-2 font-semibold text-[var(--primary)]"
                    onClick={() => setShowAllPays((v) => !v)}
                  >
                    {showAllPays ? "إخفاء" : `عرض كل الدفعات (${payments.length})`}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* تنبيه على الشقة */}
        {allow("flags.edit") && (
          <button
            onClick={toggleFlag}
            className="card mb-3 flex w-full items-center gap-3 p-3 text-right transition hover:bg-[var(--surface-2)]"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{
                background: unit.flagged ? "var(--steel-050)" : "var(--danger-050)",
                color: unit.flagged ? "var(--steel)" : "#b3303b",
              }}
            >
              <Icon name={unit.flagged ? "check" : "alert"} size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-[13.5px] font-semibold">
                {unit.flagged ? "إزالة التنبيه" : "إضافة ملاحظة تنبيه"}
              </span>
              <span className="block text-[11.5px] text-[var(--muted)]">
                {unit.flagged ? "تعود الوحدة إلى حالتها الطبيعية" : "تظهر الوحدة بالأحمر في القائمة مع سبب التنبيه"}
              </span>
            </span>
          </button>
        )}

        {/* تحت الصيانة */}
        {allow("units.edit") && (
          <button
            onClick={toggleMaintenance}
            className="card mb-3 flex w-full items-center gap-3 p-3 text-right transition hover:bg-[var(--surface-2)]"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{
                background: unit.maintenance ? "var(--ok-050)" : "var(--maint-050)",
                color: unit.maintenance ? "var(--ok)" : "var(--maint)",
              }}
            >
              <Icon name={unit.maintenance ? "check" : "wrench"} size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-[13.5px] font-semibold">
                {unit.maintenance ? "إنهاء الصيانة" : "تحويلها إلى صيانة"}
              </span>
              <span className="block text-[11.5px] text-[var(--muted)]">
                {unit.maintenance
                  ? "تعود الشقة إلى حالتها الطبيعية"
                  : "تُغطّى بالبنفسجي في المخطط وتُعدّ ضمن الصيانة"}
              </span>
            </span>
          </button>
        )}

        {/* المستندات */}
        {allow("docs.view") && (
          <div className="card mb-3 overflow-hidden">
            <button
              onClick={() => setShowDocs((v) => !v)}
              className="flex w-full items-center gap-2.5 p-3 text-right"
            >
              <Icon name="folder" size={17} className="text-[var(--muted)]" />
              <span className="flex-1 text-[13.5px] font-semibold">مستندات الوحدة</span>
              <Icon
                name="chevronDown"
                size={16}
                className="text-[var(--muted)]"
                style={{ transform: showDocs ? "rotate(180deg)" : "none" }}
              />
            </button>
            {showDocs && (
              <div className="border-t border-[var(--line)] p-3">
                <DocsPanel ownerType="unit" ownerId={unit.id} buildingId={unit.buildingId} compact />
              </div>
            )}
          </div>
        )}

        {/* تعديل / حذف */}
        {allow("units.edit") && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm flex-1" onClick={() => setEditing(true)}>
              <Icon name="edit" size={14} /> تعديل بيانات الوحدة
            </button>
            <button className="btn btn-danger btn-sm" onClick={removeUnit}>
              <Icon name="trash" size={14} /> حذف
            </button>
          </div>
        )}
      </Sheet>

      {/* سبب الصيانة */}
      {maintOpen && (
        <Sheet
          open
          onClose={() => setMaintOpen(false)}
          title={`صيانة شقة ${unit.number}`}
          footer={
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={saveMaintenance}>
                <Icon name="check" size={16} /> تحويلها إلى صيانة
              </button>
              <button className="btn btn-ghost" onClick={() => setMaintOpen(false)}>إلغاء</button>
            </div>
          }
        >
          <p className="mb-2 text-[13px] text-[var(--muted)]">ما نوع الصيانة؟ (اختياري)</p>
          <TextArea
            value={maintText}
            onChange={(e) => setMaintText(e.target.value)}
            placeholder="مثال: تغيير سخان الماء"
            rows={3}
            autoFocus
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {["دهان", "سباكة", "كهرباء", "تكييف", "تشطيب", "تنظيف عميق"].map((x) => (
              <button key={x} className="btn btn-ghost btn-sm" onClick={() => setMaintText(x)}>{x}</button>
            ))}
          </div>
        </Sheet>
      )}

      {/* نافذة كتابة التنبيه */}
      {flagOpen && (
        <Sheet
          open
          onClose={() => setFlagOpen(false)}
          title={`تنبيه على شقة ${unit.number}`}
          footer={
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={saveFlag}>
                <Icon name="check" size={16} /> حفظ التنبيه
              </button>
              <button className="btn btn-ghost" onClick={() => setFlagOpen(false)}>إلغاء</button>
            </div>
          }
        >
          <p className="mb-2 text-[13px] text-[var(--muted)]">ما السبب؟ تظهر الوحدة بالأحمر في قائمة الشقق.</p>
          <TextArea
            value={flagText}
            onChange={(e) => setFlagText(e.target.value)}
            placeholder="مثال: تسريب ماء في الحمام"
            rows={3}
            autoFocus
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {["تسريب ماء", "صيانة مكيف", "مستأجر متأخر", "تحتاج دهان", "شكوى جيران"].map((s) => (
              <button key={s} className="btn btn-ghost btn-sm" onClick={() => setFlagText(s)}>{s}</button>
            ))}
          </div>
        </Sheet>
      )}

      {/* تجديد العقد — بتاريخ بداية ونهاية */}
      {renewOpen && contract && (
        <Sheet
          open
          onClose={() => setRenewOpen(false)}
          title="تجديد العقد"
          footer={
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={renew}>
                <Icon name="check" size={16} /> حفظ التجديد
              </button>
              <button className="btn btn-ghost" onClick={() => setRenewOpen(false)}>إلغاء</button>
            </div>
          }
        >
          <p className="mb-3 text-[13px] text-[var(--muted)]">
            العقد الحالي ينتهي {dateShort(contract.endDate)}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="يبدأ بتاريخ" required>
              <TextInput type="date" value={renewFrom} onChange={(e) => setRenewFrom(e.target.value)} />
            </Field>
            <Field label="وينتهي بتاريخ" required>
              <TextInput type="date" value={renewTo} onChange={(e) => setRenewTo(e.target.value)} />
            </Field>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[6, 12, 24].map((m) => (
              <button
                key={m}
                className="btn btn-ghost btn-sm"
                onClick={() => setRenewTo(addMonths(renewFrom || contract.endDate, m))}
              >
                + {m} شهر
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* إخلاء الشقة */}
      {vacateOpen && contract && (
        <Sheet
          open
          onClose={() => setVacateOpen(false)}
          title={`إخلاء شقة ${unit.number}`}
          footer={
            <div className="flex gap-2">
              <button className="btn btn-danger flex-1" onClick={vacate}>
                <Icon name="logout" size={16} /> تأكيد الإخلاء
              </button>
              <button className="btn btn-ghost" onClick={() => setVacateOpen(false)}>إلغاء</button>
            </div>
          }
        >
          <p className="mb-3 text-[13px] leading-relaxed text-[var(--muted)]">
            سينتهي عقد <b className="text-[var(--ink)]">{tenant?.name}</b> وتعود الشقة شاغرة جاهزة
            للتأجير. الوصولات والسجل السابق تبقى محفوظة.
          </p>
          <Field label="تاريخ الإخلاء">
            <TextInput type="date" value={vacateDate} onChange={(e) => setVacateDate(e.target.value)} />
          </Field>
          <button className="btn btn-ghost btn-sm mt-3 w-full" onClick={() => setPrintKind("eviction")}>
            <Icon name="print" size={14} /> طباعة طلب الإخلاء للتوقيع
          </button>
        </Sheet>
      )}

      {editing && <UnitForm open onClose={() => setEditing(false)} buildingId={unit.buildingId} unit={unit} />}
      {newContract && <ContractForm open onClose={() => setNewContract(false)} presetUnitId={unit.id} presetBuildingId={unit.buildingId} />}
      {newPayment && contract && (
        <PaymentForm open onClose={() => setNewPayment(null)} presetContractId={contract.id} presetPeriod={newPayment} />
      )}

      <PrintOverlay
        open={printKind === "eviction"}
        onClose={() => setPrintKind(null)}
        fileTitle={`طلب إخلاء — ${tenant?.name ?? unit.number}`}
      >
        <EvictionDoc unitId={unit.id} tenantId={tenant?.id} date={vacateDate} />
      </PrintOverlay>

      <PrintOverlay
        open={printKind === "contract"}
        onClose={() => setPrintKind(null)}
        fileTitle={contract ? `عقد إيجار ${contract.no}` : ""}
      >
        {contract && <ContractDoc contract={contract} />}
      </PrintOverlay>

      {/* الوصل جاهز دائمًا: من دفعة الشهر إن سُجِّلت، وإلا وصل بقيمة العقد للتوزيع */}
      <PrintOverlay
        open={printKind === "receipt"}
        onClose={() => setPrintKind(null)}
        fileTitle={`وصل — ${tenant?.name ?? `شقة ${unit.number}`}`}
      >
        {contract && (
          <ReceiptSheet
            f={thisMonthPaid
              ? receiptOfPayment(data, thisMonthPaid)
              : receiptOfContract(data, contract, thisPeriod())}
          />
        )}
      </PrintOverlay>
    </>
  );
}
