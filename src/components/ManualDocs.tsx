"use client";

import { useState } from "react";
import { Field, Select, TextArea, TextInput } from "./ui";
import { Icon } from "./Icons";
import { BANKS, PrintOverlay, ReceiptSheet } from "./print";
import { ManualContractSheet } from "./ManualContract";
import { useStore } from "@/lib/store";
import { monthAr, thisPeriod, todayISO } from "@/lib/format";
import { lastPeriods } from "@/lib/selectors";

/* =========================== وصل يدوي =========================== */

/** وصل تكتب بياناته بنفسك — لأي مبلغ أو شخص خارج سجل النظام. */
export function ManualReceipt() {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    no: "",
    from: "",
    amount: 0,
    payKind: "cash" as "cash" | "cheque",
    cheque: "",
    bank: "",
    unitNo: "",
    floor: "",
    monthText: monthAr(thisPeriod()),
    date: todayISO(),
    notes: "",
  });

  const periods = lastPeriods(15).reverse();
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="card p-3.5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ok-050)] text-[var(--ok)]">
          <Icon name="receipt" size={19} />
        </span>
        <div>
          <p className="t-section">وصل يدوي</p>
          <p className="text-[11.5px] text-[var(--muted)]">اكتب البيانات بنفسك — لأي مبلغ أو شخص</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="وصلنا من السيد / السادة" required className="sm:col-span-2">
          <TextInput value={f.from} onChange={(e) => set("from", e.target.value)} placeholder="اسم من دفع المبلغ" />
        </Field>
        <Field label="المبلغ (د.ك)" required>
          <TextInput type="number" step="0.001" value={f.amount || ""} onChange={(e) => set("amount", +e.target.value)} />
        </Field>
        <Field label="رقم الوصل">
          <TextInput value={f.no} onChange={(e) => set("no", e.target.value)} placeholder="اتركه فارغًا للكتابة باليد" dir="ltr" />
        </Field>
        <Field label="طريقة الدفع">
          <Select value={f.payKind} onChange={(e) => set("payKind", e.target.value)}>
            <option value="cash">نقدًا</option>
            <option value="cheque">شيك</option>
          </Select>
        </Field>
        {f.payKind === "cheque" ? (
          <>
            <Field label="رقم الشيك">
              <TextInput value={f.cheque} onChange={(e) => set("cheque", e.target.value)} dir="ltr" />
            </Field>
            <Field label="على بنك" className="sm:col-span-2">
              <Select value={f.bank} onChange={(e) => set("bank", e.target.value)}>
                <option value="">—</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </Field>
          </>
        ) : <div className="hidden sm:block" />}
        <Field label="وذلك عن إيجار شقة رقم">
          <TextInput value={f.unitNo} onChange={(e) => set("unitNo", e.target.value)} />
        </Field>
        <Field label="الدور">
          <TextInput value={f.floor} onChange={(e) => set("floor", e.target.value)} />
        </Field>
        <Field label="عن شهر">
          <Select value={f.monthText} onChange={(e) => set("monthText", e.target.value)}>
            {periods.map((p) => <option key={p} value={monthAr(p)}>{monthAr(p)}</option>)}
            <option value="">— أخرى —</option>
          </Select>
        </Field>
        <Field label="التاريخ">
          <TextInput type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <TextArea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>

      <button className="btn btn-primary mt-3 w-full" onClick={() => setOpen(true)} disabled={!f.from.trim()}>
        <Icon name="print" size={16} /> عرض وطباعة الوصل
      </button>
      <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
        هذا الوصل للطباعة فقط ولا يُسجَّل ضمن تحصيل الشهر.
      </p>

      <PrintOverlay open={open} onClose={() => setOpen(false)} fileTitle={`وصل — ${f.from || "يدوي"}`}>
        <ReceiptSheet
          f={{
            no: f.no,
            from: f.from,
            amount: f.amount,
            method: f.payKind === "cheque" ? (f.cheque || "شيك") : "نقدًا",
            bank: f.bank,
            unitNo: f.unitNo,
            floor: f.floor,
            monthText: f.monthText,
            date: f.date,
            notes: f.notes || undefined,
          }}
        />
      </PrintOverlay>
    </div>
  );
}

/* =========================== عقد يدوي =========================== */

/** عقد إيجار تكتب بياناته بنفسك بنفس نص العقد المعتمد. */
export function ManualContract() {
  const { data } = useStore();
  const b = data.buildings[0];
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    tenantName: "",
    civilId: "",
    nationality: "",
    job: "",
    phone: "",
    area: b?.area ?? "حولي الجنوبي",
    block: (b?.block ?? "قطعة 10").replace("قطعة", "").trim(),
    street: (b?.street ?? "شارع موسى بن نصير").replace("شارع", "").trim(),
    buildingNo: (b?.buildingNo ?? "37").replace(/\D+/g, "") || "37",
    floor: "",
    unitNo: "",
    duration: "سنة",
    startDate: todayISO(),
    endDate: "",
    rent: 0,
    deposit: 0,
    dueDay: data.settings.dueDay,
    occupants: 0,
    signedAt: todayISO(),
  });

  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="card p-3.5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary)]">
          <Icon name="file" size={19} />
        </span>
        <div>
          <p className="t-section">عقد يدوي</p>
          <p className="text-[11.5px] text-[var(--muted)]">نفس نص العقد المعتمد ببيانات تكتبها بنفسك</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="اسم المستأجر" required className="sm:col-span-2">
          <TextInput value={f.tenantName} onChange={(e) => set("tenantName", e.target.value)} />
        </Field>
        <Field label="الرقم المدني"><TextInput value={f.civilId} onChange={(e) => set("civilId", e.target.value)} dir="ltr" /></Field>
        <Field label="الجنسية"><TextInput value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></Field>
        <Field label="المهنة"><TextInput value={f.job} onChange={(e) => set("job", e.target.value)} /></Field>
        <Field label="رقم الهاتف"><TextInput value={f.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" /></Field>

        <Field label="المنطقة"><TextInput value={f.area} onChange={(e) => set("area", e.target.value)} /></Field>
        <Field label="قطعة رقم"><TextInput value={f.block} onChange={(e) => set("block", e.target.value)} /></Field>
        <Field label="الشارع"><TextInput value={f.street} onChange={(e) => set("street", e.target.value)} /></Field>
        <Field label="عمارة رقم"><TextInput value={f.buildingNo} onChange={(e) => set("buildingNo", e.target.value)} /></Field>
        <Field label="الدور"><TextInput value={f.floor} onChange={(e) => set("floor", e.target.value)} /></Field>
        <Field label="شقة رقم"><TextInput value={f.unitNo} onChange={(e) => set("unitNo", e.target.value)} /></Field>

        <Field label="مدة العقد"><TextInput value={f.duration} onChange={(e) => set("duration", e.target.value)} /></Field>
        <Field label="القيمة الإيجارية الشهرية (د.ك)" required>
          <TextInput type="number" step="0.001" value={f.rent || ""} onChange={(e) => set("rent", +e.target.value)} />
        </Field>
        <Field label="يبدأ بتاريخ"><TextInput type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
        <Field label="وينتهي بتاريخ"><TextInput type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
        <Field label="التأمين (د.ك)">
          <TextInput type="number" step="0.001" value={f.deposit || ""} onChange={(e) => set("deposit", +e.target.value)} />
        </Field>
        <Field label="عدد الساكنين">
          <TextInput type="number" min={0} value={f.occupants || ""} onChange={(e) => set("occupants", +e.target.value)} />
        </Field>
        <Field label="يوم الاستحقاق"><TextInput type="number" min={1} max={28} value={f.dueDay} onChange={(e) => set("dueDay", +e.target.value)} /></Field>
        <Field label="تاريخ تحرير العقد"><TextInput type="date" value={f.signedAt} onChange={(e) => set("signedAt", e.target.value)} /></Field>
      </div>

      <button className="btn btn-primary mt-3 w-full" onClick={() => setOpen(true)} disabled={!f.tenantName.trim()}>
        <Icon name="print" size={16} /> عرض وطباعة العقد
      </button>
      <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
        هذا العقد للطباعة فقط ولا يُسجَّل ضمن عقود النظام.
      </p>

      <PrintOverlay open={open} onClose={() => setOpen(false)} fileTitle={`عقد إيجار — ${f.tenantName || "يدوي"}`}>
        <ManualContractSheet f={f} />
      </PrintOverlay>
    </div>
  );
}
