"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "./Toast";
import { Field, MonthPicker, Select, Sheet, TextInput } from "./ui";
import { Icon } from "./Icons";
import {
  addContract, contractInput, editContract, entryDate, entryDateError, monthContracts, moveEntry, startPeriod,
  type ContractInput,
} from "@/lib/contracts";
import { dateShort, methodLabel, monthAr, thisPeriod, todayISO } from "@/lib/format";
import type { Contract, PayMethod } from "@/lib/types";

/**
 * نموذج واحد لإضافة مستأجر على وحدة أو تعديل بياناته — بلا تواريخ نهاية.
 * «تاريخ الدخول» يحدد أول شهر يظهر فيه المستأجر، ويمكن تعديله لاحقًا.
 * تغيير الإيجار وحده يُسأل عن الشهر الذي يسري منه؛ الأشهر السابقة تبقى بالإيجار القديم.
 */
export default function ContractEditor({
  contract, unitId, period, onClose,
}: { contract?: Contract; unitId?: string; period: string; onClose: () => void }) {
  const { data, update, activeBuilding } = useStore();
  const { user } = useAuth();
  const toast = useToast();

  const [f, setF] = useState<ContractInput>(() => contractInput(data, contract, unitId));
  const firstEntry = contract ? entryDate(data, contract) : "";
  const [entry, setEntry] = useState(() => firstEntry || (period === thisPeriod() ? todayISO() : `${period}-01`));
  const [rentFrom, setRentFrom] = useState(period);
  const from = entry.slice(0, 7);
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
  const rentChanged = !!contract && (+f.rent || 0) !== contract.rent;
  const entryChanged = !!contract && entry !== firstEntry;
  const splits = rentChanged && rentFrom > startPeriod(contract!);

  const save = () => {
    if (!f.unitId || !unit) return toast("اختر الشقة", "error");
    if (!f.name.trim()) return toast("اكتب اسم المستأجر", "error");
    if (!entry) return toast("اختر تاريخ الدخول", "error");
    if (entryChanged) {
      const err = entryDateError(data, contract!.id, entry);
      if (err) return toast(err, "error");
    }
    update(
      (d) => {
        if (!contract) return void addContract(d, f, entry);
        if (entryChanged) moveEntry(d, contract.id, entry);
        const cur = d.contracts.find((x) => x.id === contract.id);
        if (!cur) return;
        // تصحيح البيانات يسري على العقد كله؛ الإيجار الجديد من الشهر المختار فقط
        editContract(d, cur.id, f, rentChanged ? rentFrom : startPeriod(cur));
      },
      {
        action: contract ? "تعديل مستأجر" : "إضافة مستأجر",
        detail: `شقة ${unit.number} — ${f.name.trim()} — الدخول ${dateShort(entry)}${splits ? ` — الإيجار من ${monthAr(rentFrom)}` : ""}`,
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
        <Field label="تاريخ الدخول" required className="sm:col-span-2">
          <TextInput type="date" value={entry} onChange={(e) => setEntry(e.target.value)} />
        </Field>
        <p className="t-xs rounded-lg bg-[var(--surface-2)] p-2.5 leading-relaxed text-[var(--muted)] sm:col-span-2">
          {entry
            ? `يظهر اسمه من ${monthAr(from)} وما بعده فقط — في الكشف والشقق والمستأجرين — ولا يظهر في الأشهر السابقة.`
            : "اختر تاريخ دخول المستأجر."}
        </p>

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

        {rentChanged && (
          <>
            <Field label="الإيجار الجديد يسري من شهر" className="sm:col-span-2">
              <div><MonthPicker value={rentFrom} onChange={setRentFrom} /></div>
            </Field>
            <p className="t-xs rounded-lg bg-[var(--surface-2)] p-2.5 leading-relaxed text-[var(--muted)] sm:col-span-2">
              {splits
                ? `ما قبل ${monthAr(rentFrom)} يبقى بالإيجار القديم ${contract!.rent} د.ك، والجديد من ${monthAr(rentFrom)} وما بعده.`
                : "الإيجار الجديد يسري على العقد من تاريخ الدخول."}
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
