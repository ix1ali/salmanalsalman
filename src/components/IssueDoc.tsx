"use client";

import { useMemo, useState } from "react";
import { Field, Select, Sheet, TextInput } from "./ui";
import { Icon, type IconName } from "./Icons";
import { BANKS, ContractSheet, EvictionSheet, PrintOverlay, ReceiptSheet } from "./print";
import { useStore } from "@/lib/store";
import { MONTH_NAMES, todayISO } from "@/lib/format";

type Kind = null | "receipt" | "contract" | "eviction";

/**
 * «إصدار مستند»: تختار نوع المستند أولًا، ثم تُملأ حقوله في ورقة واحدة
 * وتُطبع مباشرة. لك أن تختار اسمًا من السجل ليُملأ عنك، أو تكتب كل شيء بيدك.
 */
export default function IssueDoc() {
  const [kind, setKind] = useState<Kind>(null);

  const options: { k: Exclude<Kind, null>; icon: IconName; title: string; sub: string }[] = [
    { k: "receipt", icon: "receipt", title: "إصدار وصل", sub: "باسم من السجل أو باسم تكتبه بنفسك" },
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
        أما وصولات وعقود المستأجرين المسجّلين فتُطبع من تبويبَي{" "}
        <b className="text-[var(--ink-2)]">الوصولات</b> و<b className="text-[var(--ink-2)]">العقود</b>.
      </p>

      {kind === "receipt" && <ReceiptForm onClose={() => setKind(null)} />}
      {kind === "contract" && <ContractFormSheet onClose={() => setKind(null)} />}
      {kind === "eviction" && <EvictionForm onClose={() => setKind(null)} />}
    </>
  );
}

/* ============================ مبدّل المصدر ============================ */

function SourcePick({ value, onChange }: { value: "list" | "manual"; onChange: (v: "list" | "manual") => void }) {
  return (
    <Field label="البيانات">
      <div className="flex gap-1.5">
        {([["list", "اختيار اسم من السجل"], ["manual", "كتابة يدوية"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => onChange(k)} data-on={value === k} className="chip flex-1 justify-center !py-2">
            {l}
          </button>
        ))}
      </div>
    </Field>
  );
}

const YEARS = (() => {
  const y = new Date().getFullYear();
  return [y - 3, y - 2, y - 1, y, y + 1, y + 2];
})();

/* ============================== وصل ============================== */

function ReceiptForm({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<"list" | "manual">("list");
  const [contractId, setContractId] = useState("");
  const now = new Date();
  const [f, setF] = useState({
    no: "", from: "", amount: 0,
    payKind: "cash" as "cash" | "cheque",
    cheque: "", bank: "", unitNo: "", floor: "",
    mi: now.getMonth(), yr: now.getFullYear(),
    date: todayISO(), notes: "",
  });
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  const contracts = useMemo(
    () => data.contracts.filter((c) => c.status === "active").map((c) => {
      const u = data.units.find((x) => x.id === c.unitId);
      const t = data.tenants.find((x) => x.id === c.tenantId);
      const fl = data.floors.find((x) => x.id === u?.floorId);
      return { c, label: `${u?.number ?? "—"} — ${t?.name ?? "—"}`, unitNo: u?.number ?? "", floor: fl?.name ?? "", name: t?.name ?? "", rent: c.rent };
    }).sort((a, b) => a.unitNo.localeCompare(b.unitNo, "ar", { numeric: true })),
    [data]
  );

  const pickContract = (id: string) => {
    setContractId(id);
    const x = contracts.find((c) => c.c.id === id);
    if (!x) return;
    setF((p) => ({ ...p, from: x.name, unitNo: x.unitNo, floor: x.floor, amount: x.rent }));
  };

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
          <SourcePick value={src} onChange={setSrc} />

          {src === "list" && (
            <Field label="المستأجر" hint="تُملأ الحقول تلقائيًا ويمكنك تعديلها">
              <Select value={contractId} onChange={(e) => pickContract(e.target.value)}>
                <option value="">— اختر —</option>
                {contracts.map((x) => <option key={x.c.id} value={x.c.id}>{x.label}</option>)}
              </Select>
            </Field>
          )}

          <Field label="وصلنا من السيد / السادة" required>
            <TextInput value={f.from} onChange={(e) => set("from", e.target.value)} placeholder="اسم من دفع المبلغ" />
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
                <button key={k} onClick={() => set("payKind", k)} data-on={f.payKind === k} className="chip flex-1 justify-center !py-2">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="شقة رقم">
              <TextInput value={f.unitNo} onChange={(e) => set("unitNo", e.target.value)} />
            </Field>
            <Field label="الدور">
              <TextInput value={f.floor} onChange={(e) => set("floor", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="عن شهر">
              <Select value={f.mi} onChange={(e) => set("mi", +e.target.value)}>
                {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </Select>
            </Field>
            <Field label="سنة">
              <Select value={f.yr} onChange={(e) => set("yr", +e.target.value)}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
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
            monthText: `${MONTH_NAMES[f.mi]} ${f.yr}`, date: f.date, notes: f.notes || undefined,
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
  const [src, setSrc] = useState<"list" | "manual">("manual");
  const [tenantId, setTenantId] = useState("");
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

  const tenants = useMemo(
    () => [...data.tenants].sort((a, c) => a.name.localeCompare(c.name, "ar")),
    [data.tenants]
  );

  const pickTenant = (id: string) => {
    setTenantId(id);
    const t = data.tenants.find((x) => x.id === id);
    if (!t) return;
    setF((p) => ({
      ...p,
      tenantName: t.name, civilId: t.civilId ?? "", phone: t.phone ?? "",
      nationality: t.nationality ?? "", job: t.workplace ?? "",
    }));
  };

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
          <SourcePick value={src} onChange={setSrc} />
          {src === "list" && (
            <Field label="اختر من المستأجرين" hint="تُملأ بياناته الشخصية ويمكنك تعديلها">
              <Select value={tenantId} onChange={(e) => pickTenant(e.target.value)}>
                <option value="">— اختر —</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          )}

          <p className="divider-label">الطرف الثاني (المستأجر)</p>
          <Field label="الاسم" required>
            <TextInput value={f.tenantName} onChange={(e) => set("tenantName", e.target.value)} />
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
  const b = data.buildings[0];
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<"list" | "manual">("list");
  const [contractId, setContractId] = useState("");
  const [f, setF] = useState({
    tenantName: "", civilId: "", phone: "", unitNo: "", floor: "",
    area: b?.area ?? "حولي الجنوبي",
    block: b?.block ?? "قطعة 10",
    street: b?.street ?? "شارع موسى بن نصير",
    parcel: b?.parcel ?? "قسيمة رقم 21/79",
    buildingNo: b?.buildingNo ?? "عمارة رقم 37",
    date: todayISO(),
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const contracts = useMemo(
    () => data.contracts.filter((c) => c.status === "active").map((c) => {
      const u = data.units.find((x) => x.id === c.unitId);
      const t = data.tenants.find((x) => x.id === c.tenantId);
      const fl = data.floors.find((x) => x.id === u?.floorId);
      const bl = data.buildings.find((x) => x.id === c.buildingId);
      return { id: c.id, label: `${u?.number ?? "—"} — ${t?.name ?? "—"}`, t, u, fl, bl };
    }).sort((a, c) => a.label.localeCompare(c.label, "ar", { numeric: true })),
    [data]
  );

  const pick = (id: string) => {
    setContractId(id);
    const x = contracts.find((c) => c.id === id);
    if (!x) return;
    setF((p) => ({
      ...p,
      tenantName: x.t?.name ?? "", civilId: x.t?.civilId ?? "", phone: x.t?.phone ?? "",
      unitNo: x.u?.number ?? "", floor: x.fl?.name ?? "",
      area: x.bl?.area ?? p.area, block: x.bl?.block ?? p.block,
      street: x.bl?.street ?? p.street, parcel: x.bl?.parcel ?? p.parcel,
      buildingNo: x.bl?.buildingNo ?? p.buildingNo,
    }));
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        wide
        title="طلب إخلاء"
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
          <SourcePick value={src} onChange={setSrc} />

          {src === "list" && (
            <Field label="المستأجر / الوحدة" hint="تُملأ الحقول تلقائيًا ويمكنك تعديلها">
              <Select value={contractId} onChange={(e) => pick(e.target.value)}>
                <option value="">— اختر —</option>
                {contracts.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
            </Field>
          )}

          <p className="divider-label">المُقرّ</p>
          <Field label="الاسم" required>
            <TextInput value={f.tenantName} onChange={(e) => set("tenantName", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="الرقم المدني"><TextInput value={f.civilId} onChange={(e) => set("civilId", e.target.value)} dir="ltr" /></Field>
            <Field label="رقم الهاتف"><TextInput value={f.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" /></Field>
          </div>

          <p className="divider-label pt-1">العين المؤجرة</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="شقة رقم"><TextInput value={f.unitNo} onChange={(e) => set("unitNo", e.target.value)} /></Field>
            <Field label="الدور"><TextInput value={f.floor} onChange={(e) => set("floor", e.target.value)} /></Field>
            <Field label="المنطقة"><TextInput value={f.area} onChange={(e) => set("area", e.target.value)} /></Field>
            <Field label="القطعة"><TextInput value={f.block} onChange={(e) => set("block", e.target.value)} /></Field>
            <Field label="الشارع"><TextInput value={f.street} onChange={(e) => set("street", e.target.value)} /></Field>
            <Field label="القسيمة"><TextInput value={f.parcel} onChange={(e) => set("parcel", e.target.value)} /></Field>
            <Field label="العمارة"><TextInput value={f.buildingNo} onChange={(e) => set("buildingNo", e.target.value)} /></Field>
            <Field label="تاريخ الإخلاء"><TextInput type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
          </div>

          <p className="t-xs rounded-lg bg-[var(--surface-2)] p-2.5 leading-relaxed text-[var(--muted)]">
            يتضمّن الإقرار تسليم العين خالية من المتاع، وبراءة الذمة من وزارة الكهرباء والماء.
          </p>
        </div>
      </Sheet>

      <PrintOverlay open={open} onClose={() => setOpen(false)} fileTitle={`طلب إخلاء — ${f.tenantName || ""}`}>
        <EvictionSheet f={f} />
      </PrintOverlay>
    </>
  );
}
