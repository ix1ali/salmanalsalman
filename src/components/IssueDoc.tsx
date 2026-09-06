"use client";

import { useState } from "react";
import { Field, Select, Sheet, TextArea, TextInput } from "./ui";
import { Icon, type IconName } from "./Icons";
import { BANKS, ContractSheet, EvictionDoc, PrintOverlay, ReceiptSheet } from "./print";
import { useStore } from "@/lib/store";
import { monthAr, thisPeriod, todayISO } from "@/lib/format";
import { lastPeriods } from "@/lib/selectors";

type Kind = null | "receipt" | "contract" | "eviction";

/**
 * «إصدار مستند»: تختار نوع المستند أولًا، ثم تُملأ حقوله في ورقة واحدة
 * وتُطبع مباشرة — للحالات الخارجة عن سجل النظام.
 */
export default function IssueDoc() {
  const [kind, setKind] = useState<Kind>(null);

  const options: { k: Exclude<Kind, null>; icon: IconName; title: string; sub: string }[] = [
    { k: "receipt", icon: "receipt", title: "إصدار وصل", sub: "لأي مبلغ أو شخص خارج سجل النظام" },
    { k: "contract", icon: "file", title: "إصدار عقد", sub: "بنفس نص العقد المعتمد وبنوده" },
    { k: "eviction", icon: "logout", title: "طلب إخلاء", sub: "إقرار تسليم العين وبراءة الذمة" },
  ];

  return (
    <>
      <div className="panel">
        {options.map((o) => (
          <button key={o.k} onClick={() => setKind(o.k)} className="row row-link">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-050)] text-[var(--primary)]">
              <Icon name={o.icon} size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold">{o.title}</span>
              <span className="t-xs block text-[var(--muted)]">{o.sub}</span>
            </span>
            <Icon name="chevronLeft" size={15} className="shrink-0 text-[var(--faint)]" />
          </button>
        ))}
      </div>

      <p className="t-xs mt-2 leading-relaxed text-[var(--muted)]">
        هذه المستندات للطباعة فقط ولا تُسجَّل ضمن تحصيل الشهر أو عقود النظام.
        أما وصولات وعقود المستأجرين المسجّلين فتُطبع من قسم <b className="text-[var(--ink-2)]">الطباعة</b>.
      </p>

      {kind === "receipt" && <ReceiptForm onClose={() => setKind(null)} />}
      {kind === "contract" && <ContractFormSheet onClose={() => setKind(null)} />}
      {kind === "eviction" && <EvictionForm onClose={() => setKind(null)} />}
    </>
  );
}

/* ============================== وصل ============================== */

function ReceiptForm({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    no: "", from: "", amount: 0,
    payKind: "cash" as "cash" | "cheque",
    cheque: "", bank: "", unitNo: "", floor: "",
    monthText: monthAr(thisPeriod()), date: todayISO(), notes: "",
  });
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  const periods = lastPeriods(15).reverse();

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="إصدار وصل"
        footer={
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => setOpen(true)} disabled={!f.from.trim()}>
              <Icon name="print" size={15} /> عرض وطباعة
            </button>
            <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="وصلنا من السيد / السادة" required>
            <TextInput value={f.from} onChange={(e) => set("from", e.target.value)} placeholder="اسم من دفع المبلغ" autoFocus />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="المبلغ (د.ك)" required>
              <TextInput type="number" step="0.001" value={f.amount || ""} onChange={(e) => set("amount", +e.target.value)} />
            </Field>
            <Field label="التاريخ">
              <TextInput type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
          </div>

          <Field label="طريقة الدفع">
            <div className="flex gap-1.5">
              {(["cash", "cheque"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => set("payKind", k)}
                  data-on={f.payKind === k}
                  className="chip flex-1 justify-center !py-1.5"
                >
                  {k === "cash" ? "نقدًا" : "شيك"}
                </button>
              ))}
            </div>
          </Field>

          {f.payKind === "cheque" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="رقم الشيك">
                <TextInput value={f.cheque} onChange={(e) => set("cheque", e.target.value)} dir="ltr" />
              </Field>
              <Field label="على بنك">
                <Select value={f.bank} onChange={(e) => set("bank", e.target.value)}>
                  <option value="">—</option>
                  {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </Field>
            </div>
          )}

          <p className="divider-label pt-1">بيان الوصل</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="شقة رقم">
              <TextInput value={f.unitNo} onChange={(e) => set("unitNo", e.target.value)} />
            </Field>
            <Field label="الدور">
              <TextInput value={f.floor} onChange={(e) => set("floor", e.target.value)} />
            </Field>
            <Field label="عن شهر">
              <Select value={f.monthText} onChange={(e) => set("monthText", e.target.value)}>
                {periods.map((p) => <option key={p} value={monthAr(p)}>{monthAr(p)}</option>)}
                <option value="">— بدون —</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رقم الوصل" hint="اتركه فارغًا لكتابته باليد">
              <TextInput value={f.no} onChange={(e) => set("no", e.target.value)} dir="ltr" />
            </Field>
            <Field label="ملاحظات">
              <TextInput value={f.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </div>
      </Sheet>

      <PrintOverlay open={open} onClose={() => setOpen(false)} fileTitle={`وصل — ${f.from || "جديد"}`}>
        <ReceiptSheet
          f={{
            no: f.no, from: f.from, amount: f.amount,
            method: f.payKind === "cheque" ? (f.cheque || "شيك") : "نقدًا",
            bank: f.bank, unitNo: f.unitNo, floor: f.floor,
            monthText: f.monthText, date: f.date, notes: f.notes || undefined,
          }}
        />
      </PrintOverlay>
    </>
  );
}

/* ============================== عقد ============================== */

function ContractFormSheet({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const b = data.buildings[0];
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    tenantName: "", civilId: "", nationality: "", job: "", phone: "",
    area: b?.area ?? "حولي الجنوبي",
    block: (b?.block ?? "قطعة 10").replace("قطعة", "").trim(),
    street: (b?.street ?? "شارع موسى بن نصير").replace("شارع", "").trim(),
    buildingNo: (b?.buildingNo ?? "37").replace(/\D+/g, "") || "37",
    floor: "", unitNo: "", duration: "سنة",
    startDate: todayISO(), endDate: "", rent: 0, deposit: 0,
    dueDay: data.settings.dueDay, occupants: 0, signedAt: todayISO(),
  });
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        wide
        title="إصدار عقد"
        footer={
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => setOpen(true)} disabled={!f.tenantName.trim()}>
              <Icon name="print" size={15} /> عرض وطباعة
            </button>
            <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="divider-label">الطرف الثاني (المستأجر)</p>
          <Field label="الاسم" required>
            <TextInput value={f.tenantName} onChange={(e) => set("tenantName", e.target.value)} autoFocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="الرقم المدني"><TextInput value={f.civilId} onChange={(e) => set("civilId", e.target.value)} dir="ltr" /></Field>
            <Field label="رقم الهاتف"><TextInput value={f.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" /></Field>
            <Field label="الجنسية"><TextInput value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></Field>
            <Field label="المهنة"><TextInput value={f.job} onChange={(e) => set("job", e.target.value)} /></Field>
          </div>

          <p className="divider-label pt-1">العين المؤجرة</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="الدور"><TextInput value={f.floor} onChange={(e) => set("floor", e.target.value)} /></Field>
            <Field label="شقة رقم"><TextInput value={f.unitNo} onChange={(e) => set("unitNo", e.target.value)} /></Field>
            <Field label="المنطقة"><TextInput value={f.area} onChange={(e) => set("area", e.target.value)} /></Field>
            <Field label="قطعة"><TextInput value={f.block} onChange={(e) => set("block", e.target.value)} /></Field>
            <Field label="الشارع"><TextInput value={f.street} onChange={(e) => set("street", e.target.value)} /></Field>
            <Field label="عمارة رقم"><TextInput value={f.buildingNo} onChange={(e) => set("buildingNo", e.target.value)} /></Field>
          </div>

          <p className="divider-label pt-1">شروط العقد</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="القيمة الإيجارية الشهرية (د.ك)" required>
              <TextInput type="number" step="0.001" value={f.rent || ""} onChange={(e) => set("rent", +e.target.value)} />
            </Field>
            <Field label="التأمين (د.ك)">
              <TextInput type="number" step="0.001" value={f.deposit || ""} onChange={(e) => set("deposit", +e.target.value)} />
            </Field>
            <Field label="يبدأ بتاريخ"><TextInput type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
            <Field label="وينتهي بتاريخ"><TextInput type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
            <Field label="مدة العقد"><TextInput value={f.duration} onChange={(e) => set("duration", e.target.value)} /></Field>
            <Field label="عدد الساكنين">
              <TextInput type="number" min={0} value={f.occupants || ""} onChange={(e) => set("occupants", +e.target.value)} />
            </Field>
            <Field label="يوم الاستحقاق">
              <TextInput type="number" min={1} max={28} value={f.dueDay} onChange={(e) => set("dueDay", +e.target.value)} />
            </Field>
            <Field label="تاريخ تحرير العقد">
              <TextInput type="date" value={f.signedAt} onChange={(e) => set("signedAt", e.target.value)} />
            </Field>
          </div>

          <p className="t-xs rounded-lg bg-[var(--surface-2)] p-2.5 leading-relaxed text-[var(--muted)]">
            تُطبع البنود التسعة عشر المعتمدة لدى المكتب تلقائيًا مع العقد.
          </p>
        </div>
      </Sheet>

      <PrintOverlay open={open} onClose={() => setOpen(false)} fileTitle={`عقد إيجار — ${f.tenantName || "جديد"}`}>
        <ContractSheet f={f} />
      </PrintOverlay>
    </>
  );
}

/* =========================== طلب إخلاء =========================== */

function EvictionForm({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const [contractId, setContractId] = useState("");
  const [date, setDate] = useState(todayISO());

  const contracts = data.contracts.filter((c) => c.status === "active");
  const label = (c: (typeof contracts)[number]) => {
    const u = data.units.find((x) => x.id === c.unitId);
    const t = data.tenants.find((x) => x.id === c.tenantId);
    return `${u?.number ?? "—"} — ${t?.name ?? "—"}`;
  };
  const c = contracts.find((x) => x.id === contractId);

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="طلب إخلاء"
        footer={
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => setOpen(true)} disabled={!c}>
              <Icon name="print" size={15} /> عرض وطباعة
            </button>
            <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="المستأجر / الوحدة" required>
            <Select value={contractId} onChange={(e) => setContractId(e.target.value)}>
              <option value="">— اختر —</option>
              {contracts.map((x) => <option key={x.id} value={x.id}>{label(x)}</option>)}
            </Select>
          </Field>
          <Field label="تاريخ الإخلاء">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <p className="t-xs rounded-lg bg-[var(--surface-2)] p-2.5 leading-relaxed text-[var(--muted)]">
            يتضمّن الإقرار تسليم العين خالية من المتاع، وبراءة الذمة من وزارة الكهرباء والماء.
          </p>
        </div>
      </Sheet>

      <PrintOverlay open={open} onClose={() => setOpen(false)} fileTitle={`طلب إخلاء — ${c ? label(c) : ""}`}>
        {c && <EvictionDoc unitId={c.unitId} tenantId={c.tenantId} date={date} />}
      </PrintOverlay>
    </>
  );
}
