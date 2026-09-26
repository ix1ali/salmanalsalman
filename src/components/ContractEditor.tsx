"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "./Toast";
import { Field, MonthPicker, Select, Sheet, TextInput } from "./ui";
import { Icon } from "./Icons";
import { addContract, contractInput, editContract, monthContracts, startPeriod, type ContractInput } from "@/lib/contracts";
import { methodLabel, monthAr } from "@/lib/format";
import type { Contract, PayMethod } from "@/lib/types";

/**
 * نموذج واحد لإضافة مستأجر على وحدة أو تعديل بياناته — بلا تواريخ نهاية.
 * كل حفظ يسري من الشهر المختار وما بعده؛ الأشهر السابقة تبقى كما كانت.
 */
export default function ContractEditor({
  contract, unitId, period, onClose,
}: { contract?: Contract; unitId?: string; period: string; onClose: () => void }) {
  const { data, update, activeBuilding } = useStore();
  const { user } = useAuth();
  const toast = useToast();

  const [f, setF] = useState<ContractInput>(() => contractInput(data, contract, unitId));
  const [from, setFrom] = useState(period);
  const [more, setMore] = useState(false);
  const set = <K extends keyof ContractInput>(k: K, v: ContractInput[K]) => setF((p) => ({ ...p, [k]: v }));

  // الوحدات الشاغرة في الشهر المختار — لإضافة مستأجر جديد
  const vacant = useMemo(() => {
    if (contract) return [];
    const taken = new Set(monthContracts(data.contracts, from).map((c) => c.unitId));
    return data.units
      .filter((u) => (activeBuilding === "all" || u.buildingId === activeBuilding) && (!taken.has(u.id) || u.id === unitId))
      .sort((a, b) => a.number.localeCompare(b.number, "ar", { numeric: true }));
  }, [contract, data.contracts, data.units, activeBuilding, from, unitId]);

  const unit = data.units.find((u) => u.id === f.unitId);
  const splits = contract && from > startPeriod(contract);

  const save = () => {
    if (!f.unitId || !unit) return toast("اختر الشقة", "error");
    if (!f.name.trim()) return toast("اكتب اسم المستأجر", "error");
    update(
      (d) => (contract ? editContract(d, contract.id, f, from) : addContract(d, f, from)),
      {
        action: contract ? "تعديل مستأجر" : "إضافة مستأجر",
        detail: `شقة ${unit.number} — ${f.name.trim()} — من ${monthAr(from)}`,
        actor: user?.username,
      }
    );
    toast("تم الحفظ");
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={contract ? `تعديل — شقة ${unit?.number ?? ""}` : "إضافة مستأجر"}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save}><Icon name="check" size={16} /> حفظ</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {/* مستأجر جديد: أول سؤال من أي شهر يبدأ — اسمه يظهر من هذا الشهر وما بعده فقط */}
        {!contract && (
          <div className="rounded-xl border border-[var(--primary)] bg-[var(--primary-050)] p-3 sm:col-span-2">
            <p className="mb-2 text-[13.5px] font-bold">من أي شهر يبدأ المستأجر؟</p>
            <MonthPicker value={from} onChange={setFrom} />
            <p className="t-xs mt-2 leading-relaxed text-[var(--muted)]">
              اسمه يظهر في الكشف من {monthAr(from)} وما بعده فقط، ولا يظهر في الأشهر التي قبله.
            </p>
          </div>
        )}
        {!contract && (
          <Field label="الشقة" required className="sm:col-span-2">
            <Select
              value={f.unitId}
              onChange={(e) => {
                const u = data.units.find((x) => x.id === e.target.value);
                setF((p) => ({ ...p, unitId: e.target.value, rent: u?.baseRent ?? p.rent, deposit: u?.baseRent ?? p.deposit }));
              }}
            >
              <option value="">— اختر —</option>
              {vacant.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.number}{activeBuilding === "all" ? ` — ${data.buildings.find((b) => b.id === u.buildingId)?.name ?? ""}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="الاسم" required className="sm:col-span-2">
          <TextInput value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!contract} />
        </Field>
        <Field label="الإيجار الشهري (د.ك)" required>
          <TextInput type="number" inputMode="decimal" value={f.rent || ""} onChange={(e) => set("rent", +e.target.value)} />
        </Field>
        <Field label="رقم الهاتف">
          <TextInput value={f.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))} dir="ltr" inputMode="tel" />
        </Field>
        <Field label="الرقم المدني">
          <TextInput value={f.civilId} onChange={(e) => set("civilId", e.target.value.replace(/\D/g, "").slice(0, 12))} dir="ltr" inputMode="numeric" />
        </Field>

        {contract && (
          <>
            <Field label="يسري من شهر">
              <div><MonthPicker value={from} onChange={setFrom} /></div>
            </Field>
            <p className="t-xs rounded-lg bg-[var(--surface-2)] p-2.5 leading-relaxed text-[var(--muted)] sm:col-span-2">
              {splits
                ? `ما قبل ${monthAr(from)} يبقى كما هو، والتعديل يظهر من ${monthAr(from)} وما بعده.`
                : `يظهر في الكشف من ${monthAr(from)} ويستمر كل شهر تلقائيًا.`}
            </p>
          </>
        )}

        <button
          type="button"
          className="t-xs flex items-center gap-1 font-semibold text-[var(--primary)] sm:col-span-2"
          onClick={() => setMore((v) => !v)}
        >
          <Icon name="chevronDown" size={13} style={{ transform: more ? "rotate(180deg)" : "none" }} />
          بيانات إضافية تُطبع في العقد
        </button>
        {more && (
          <>
            <Field label="الجنسية"><TextInput value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></Field>
            <Field label="المهنة"><TextInput value={f.workplace} onChange={(e) => set("workplace", e.target.value)} /></Field>
            <Field label="التأمين (د.ك)">
              <TextInput type="number" inputMode="decimal" value={f.deposit || ""} onChange={(e) => set("deposit", +e.target.value)} />
            </Field>
            <Field label="عدد الساكنين">
              <TextInput type="number" min={0} max={20} value={f.occupants || ""} onChange={(e) => set("occupants", +e.target.value)} />
            </Field>
            <Field label="مدة العقد كتابةً">
              <TextInput value={f.durationText} onChange={(e) => set("durationText", e.target.value)} placeholder="سنة" />
            </Field>
            <Field label="تاريخ تحرير العقد">
              <TextInput type="date" value={f.signedAt} onChange={(e) => set("signedAt", e.target.value)} />
            </Field>
            <Field label="طريقة الدفع">
              <Select value={f.payMethod} onChange={(e) => set("payMethod", e.target.value as PayMethod)}>
                {(Object.keys(methodLabel) as PayMethod[]).map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
              </Select>
            </Field>
          </>
        )}
      </div>
    </Sheet>
  );
}
