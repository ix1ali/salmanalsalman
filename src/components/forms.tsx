"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "./Toast";
import { Field, Select, Sheet, TextArea, TextInput } from "./ui";
import { BANKS } from "./print";
import { Icon } from "./Icons";
import { uid } from "@/lib/crypto";
import { EXPENSE_ORDER, addMonths, expenseLabel, floorName, kindLabel, methodLabel, monthAr, statusLabel, thisPeriod, todayISO } from "@/lib/format";
import type {
  Building, Contract, Expense, ExpenseCategory, PayMethod, Tenant, Unit, UnitKind, UnitStatus,
} from "@/lib/types";

const nextSeq = (list: string[], prefix: string) => {
  const max = list.reduce((m, s) => {
    const n = Number(String(s).replace(prefix, "").trim());
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}${max + 1}`;
};

/* ============================== وحدة / شقة ============================== */

export function UnitForm({
  open, onClose, buildingId, floorId, unit,
}: { open: boolean; onClose: () => void; buildingId: string; floorId?: string; unit?: Unit }) {
  const { data, update } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const floors = data.floors.filter((f) => f.buildingId === buildingId).sort((a, b) => b.level - a.level);

  const [f, setF] = useState({
    number: unit?.number ?? "",
    floorId: unit?.floorId ?? floorId ?? floors[0]?.id ?? "",
    kind: (unit?.kind ?? "apartment") as UnitKind,
    status: (unit?.status ?? "vacant") as UnitStatus,
    area: unit?.area ?? 90,
    rooms: unit?.rooms ?? 2,
    bathrooms: unit?.bathrooms ?? 1,
    balconies: unit?.balconies ?? 1,
    baseRent: unit?.baseRent ?? 200,
    meterNo: unit?.meterNo ?? "",
    notes: unit?.notes ?? "",
  });

  const save = () => {
    if (!f.number.trim()) return toast("أدخل رقم الوحدة", "error");
    if (!f.floorId) return toast("اختر الدور", "error");
    const dup = data.units.some((u) => u.buildingId === buildingId && u.number === f.number.trim() && u.id !== unit?.id);
    if (dup) return toast("رقم الوحدة مكرر في هذه العمارة", "error");

    update(
      (d) => {
        if (unit) {
          const t = d.units.find((u) => u.id === unit.id);
          if (t) Object.assign(t, { ...f, number: f.number.trim() });
        } else {
          d.units.push({
            id: uid("u-"), buildingId, createdAt: new Date().toISOString(),
            ...f, number: f.number.trim(),
          });
        }
      },
      { action: unit ? "تعديل وحدة" : "إضافة وحدة", detail: f.number, actor: user?.username }
    );
    toast(unit ? "تم حفظ التعديلات" : "تمت إضافة الوحدة");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={unit ? `تعديل الوحدة ${unit.number}` : "إضافة وحدة"}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save}><Icon name="check" size={16} /> حفظ</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="رقم الوحدة" required>
          <TextInput value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} placeholder="مثال: 305" />
        </Field>
        <Field label="الدور" required>
          <Select value={f.floorId} onChange={(e) => setF({ ...f, floorId: e.target.value })}>
            {floors.map((fl) => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
          </Select>
        </Field>
        <Field label="النوع">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as UnitKind })}>
            {(Object.keys(kindLabel) as UnitKind[]).map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}
          </Select>
        </Field>
        <Field label="الحالة">
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as UnitStatus })}>
            {(Object.keys(statusLabel) as UnitStatus[]).map((k) => <option key={k} value={k}>{statusLabel[k]}</option>)}
          </Select>
        </Field>
        <Field label="المساحة (م²)">
          <TextInput type="number" value={f.area} onChange={(e) => setF({ ...f, area: +e.target.value })} />
        </Field>
        <Field label="الإيجار الشهري (د.ك)">
          <TextInput type="number" value={f.baseRent} onChange={(e) => setF({ ...f, baseRent: +e.target.value })} />
        </Field>
        <Field label="عدد الغرف">
          <TextInput type="number" value={f.rooms} onChange={(e) => setF({ ...f, rooms: +e.target.value })} />
        </Field>
        <Field label="عدد الحمامات">
          <TextInput type="number" value={f.bathrooms} onChange={(e) => setF({ ...f, bathrooms: +e.target.value })} />
        </Field>
        <Field label="عدد البلكونات">
          <TextInput type="number" value={f.balconies} onChange={(e) => setF({ ...f, balconies: +e.target.value })} />
        </Field>
        <Field label="رقم عداد الكهرباء">
          <TextInput value={f.meterNo} onChange={(e) => setF({ ...f, meterNo: e.target.value })} dir="ltr" />
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <TextArea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  );
}

/* ========================= إضافة عدة وحدات دفعة ========================= */

export function BulkUnitsForm({
  open, onClose, buildingId,
}: { open: boolean; onClose: () => void; buildingId: string }) {
  const { data, update } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const floors = data.floors.filter((f) => f.buildingId === buildingId).sort((a, b) => b.level - a.level);

  const [f, setF] = useState({
    floorId: floors[0]?.id ?? "",
    count: 12,
    startAt: 1,
    kind: "apartment" as UnitKind,
    area: 95,
    rooms: 2,
    baseRent: 200,
  });

  const floor = floors.find((x) => x.id === f.floorId);
  const preview = useMemo(() => {
    if (!floor) return [];
    return Array.from({ length: Math.max(0, Math.min(60, f.count)) }, (_, i) => {
      const n = f.startAt + i;
      return floor.level < 0 ? `ب${String(n).padStart(2, "0")}`
        : floor.level === 0 ? `أ${String(n).padStart(2, "0")}`
        : `${floor.level}${String(n).padStart(2, "0")}`;
    });
  }, [floor, f.count, f.startAt]);

  const save = () => {
    if (!floor) return toast("اختر الدور", "error");
    const existing = new Set(data.units.filter((u) => u.buildingId === buildingId).map((u) => u.number));
    const fresh = preview.filter((n) => !existing.has(n));
    if (!fresh.length) return toast("كل الأرقام موجودة مسبقًا", "error");
    update(
      (d) => {
        fresh.forEach((number) => {
          d.units.push({
            id: uid("u-"), buildingId, floorId: floor.id, number,
            kind: f.kind, status: "vacant", area: f.area, rooms: f.rooms,
            bathrooms: f.rooms >= 3 ? 2 : 1, balconies: f.rooms >= 2 ? 1 : 0,
            baseRent: f.baseRent, createdAt: new Date().toISOString(),
          });
        });
      },
      { action: "إضافة وحدات", detail: `${fresh.length} وحدة في ${floor.name}`, actor: user?.username }
    );
    toast(`تمت إضافة ${fresh.length} وحدة`);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="إضافة عدة وحدات دفعة واحدة"
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save}><Icon name="plus" size={16} /> إضافة {preview.length} وحدة</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الدور" required>
          <Select value={f.floorId} onChange={(e) => setF({ ...f, floorId: e.target.value })}>
            {floors.map((fl) => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
          </Select>
        </Field>
        <Field label="عدد الوحدات">
          <TextInput type="number" min={1} max={60} value={f.count} onChange={(e) => setF({ ...f, count: +e.target.value })} />
        </Field>
        <Field label="يبدأ الترقيم من">
          <TextInput type="number" min={1} value={f.startAt} onChange={(e) => setF({ ...f, startAt: +e.target.value })} />
        </Field>
        <Field label="النوع">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as UnitKind })}>
            {(Object.keys(kindLabel) as UnitKind[]).map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}
          </Select>
        </Field>
        <Field label="المساحة (م²)">
          <TextInput type="number" value={f.area} onChange={(e) => setF({ ...f, area: +e.target.value })} />
        </Field>
        <Field label="الإيجار (د.ك)">
          <TextInput type="number" value={f.baseRent} onChange={(e) => setF({ ...f, baseRent: +e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 rounded-xl bg-[var(--surface-2)] p-3">
        <p className="mb-1.5 text-[12px] font-bold text-[var(--muted)]">الأرقام التي ستُنشأ</p>
        <div className="flex flex-wrap gap-1">
          {preview.slice(0, 30).map((n) => (
            <span key={n} className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold shadow-[var(--sh-1)]">{n}</span>
          ))}
          {preview.length > 30 && <span className="text-[11px] text-[var(--muted)]">+{preview.length - 30}</span>}
        </div>
      </div>
    </Sheet>
  );
}

/* ================================ الدور ================================= */

export function FloorForm({ open, onClose, buildingId }: { open: boolean; onClose: () => void; buildingId: string }) {
  const { data, update } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const existing = data.floors.filter((f) => f.buildingId === buildingId);
  const [level, setLevel] = useState(() => Math.max(0, ...existing.map((f) => f.level)) + 1);
  const [name, setName] = useState("");

  const save = () => {
    if (existing.some((f) => f.level === level)) return toast("هذا الدور موجود مسبقًا", "error");
    update(
      (d) => {
        d.floors.push({
          id: uid("f-"), buildingId, level,
          name: name.trim() || floorName(level),
          order: existing.length,
        });
      },
      { action: "إضافة دور", detail: name || floorName(level), actor: user?.username }
    );
    toast("تمت إضافة الدور");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="إضافة دور"
      footer={<button className="btn btn-primary w-full" onClick={save}><Icon name="plus" size={16} /> إضافة</button>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="رقم الدور" hint="السرداب = -1، الأرضي = 0" required>
          <TextInput type="number" value={level} onChange={(e) => setLevel(+e.target.value)} />
        </Field>
        <Field label="اسم الدور" hint={`الافتراضي: ${floorName(level)}`}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={floorName(level)} />
        </Field>
      </div>
    </Sheet>
  );
}

/* =============================== العمارة =============================== */

export function BuildingForm({
  open, onClose, building,
}: { open: boolean; onClose: () => void; building?: Building }) {
  const { update } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({
    name: building?.name ?? "",
    code: building?.code ?? "",
    area: building?.area ?? "",
    block: building?.block ?? "",
    street: building?.street ?? "",
    buildingNo: building?.buildingNo ?? "",
    ownerName: building?.ownerName ?? "",
    paciNo: building?.paciNo ?? "",
    landArea: building?.landArea ?? 0,
    builtArea: building?.builtArea ?? 0,
    color: building?.color ?? "var(--primary)",
    notes: building?.notes ?? "",
  });
  const [floorsCount, setFloorsCount] = useState(4);
  const [basement, setBasement] = useState(true);
  const [ground, setGround] = useState(true);

  const save = () => {
    if (!f.name.trim()) return toast("أدخل اسم العمارة", "error");
    update(
      (d) => {
        if (building) {
          const t = d.buildings.find((b) => b.id === building.id);
          if (t) Object.assign(t, f);
        } else {
          const id = uid("b-");
          d.buildings.push({ id, ...f, createdAt: new Date().toISOString() });
          const levels: number[] = [];
          if (basement) levels.push(-1);
          if (ground) levels.push(0);
          for (let i = 1; i <= floorsCount; i++) levels.push(i);
          levels.forEach((level, i) =>
            d.floors.push({ id: uid("f-"), buildingId: id, level, name: floorName(level), order: i })
          );
        }
      },
      { action: building ? "تعديل عمارة" : "إضافة عمارة", detail: f.name, actor: user?.username }
    );
    toast(building ? "تم حفظ التعديلات" : "تمت إضافة العمارة");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={building ? `تعديل ${building.name}` : "إضافة عمارة"}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save}><Icon name="check" size={16} /> حفظ</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="اسم العمارة" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: عمارة تراب" /></Field>
        <Field label="الرمز"><TextInput value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} dir="ltr" placeholder="TRB" /></Field>
        <Field label="المنطقة"><TextInput value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="حولي" /></Field>
        <Field label="القطعة"><TextInput value={f.block} onChange={(e) => setF({ ...f, block: e.target.value })} placeholder="قطعة 4" /></Field>
        <Field label="الشارع"><TextInput value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })} /></Field>
        <Field label="رقم القسيمة"><TextInput value={f.buildingNo} onChange={(e) => setF({ ...f, buildingNo: e.target.value })} /></Field>
        <Field label="اسم المالك"><TextInput value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} /></Field>
        <Field label="الرقم الآلي (PACI)"><TextInput value={f.paciNo} onChange={(e) => setF({ ...f, paciNo: e.target.value })} dir="ltr" /></Field>
        <Field label="مساحة الأرض (م²)"><TextInput type="number" value={f.landArea} onChange={(e) => setF({ ...f, landArea: +e.target.value })} /></Field>
        <Field label="المساحة المبنية (م²)"><TextInput type="number" value={f.builtArea} onChange={(e) => setF({ ...f, builtArea: +e.target.value })} /></Field>
        <Field label="اللون المميز">
          <div className="flex items-center gap-2">
            <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--line-strong)] bg-white p-1" />
            <TextInput value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} dir="ltr" />
          </div>
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2"><TextArea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>

      {!building && (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold">
            <Icon name="layers" size={15} /> إنشاء الأدوار تلقائيًا
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="عدد الأدوار المتكررة">
              <TextInput type="number" min={0} max={40} value={floorsCount} onChange={(e) => setFloorsCount(+e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 self-end rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[13px] font-bold">
              <input type="checkbox" checked={basement} onChange={(e) => setBasement(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              سرداب
            </label>
            <label className="flex items-center gap-2 self-end rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[13px] font-bold">
              <input type="checkbox" checked={ground} onChange={(e) => setGround(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              دور أرضي
            </label>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* =============================== المستأجر =============================== */

export function TenantForm({
  open, onClose, tenant, onSaved,
}: { open: boolean; onClose: () => void; tenant?: Tenant; onSaved?: (id: string) => void }) {
  const { data, update } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({
    name: tenant?.name ?? "",
    civilId: tenant?.civilId ?? "",
    phone: tenant?.phone ?? "",
    phone2: tenant?.phone2 ?? "",
    nationality: tenant?.nationality ?? "",
    email: tenant?.email ?? "",
    workplace: tenant?.workplace ?? "",
    emergencyContact: tenant?.emergencyContact ?? "",
    notes: tenant?.notes ?? "",
  });

  const save = () => {
    if (!f.name.trim()) return toast("أدخل اسم المستأجر", "error");
    if (f.civilId && !/^\d{12}$/.test(f.civilId)) return toast("الرقم المدني لازم ١٢ رقم", "error");
    if (f.civilId && data.tenants.some((t) => t.civilId === f.civilId && t.id !== tenant?.id))
      return toast("الرقم المدني مسجل لمستأجر آخر", "error");

    const id = tenant?.id ?? uid("t-");
    update(
      (d) => {
        if (tenant) {
          const t = d.tenants.find((x) => x.id === tenant.id);
          if (t) Object.assign(t, f);
        } else {
          d.tenants.push({ id, ...f, active: true, createdAt: new Date().toISOString() });
        }
      },
      { action: tenant ? "تعديل مستأجر" : "إضافة مستأجر", detail: f.name, actor: user?.username }
    );
    toast(tenant ? "تم حفظ التعديلات" : "تمت إضافة المستأجر");
    onSaved?.(id);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={tenant ? `تعديل ${tenant.name}` : "إضافة مستأجر"}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save}><Icon name="check" size={16} /> حفظ</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الاسم الكامل" required className="sm:col-span-2">
          <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="الرقم المدني" hint="١٢ رقم">
          <TextInput value={f.civilId} onChange={(e) => setF({ ...f, civilId: e.target.value.replace(/\D/g, "").slice(0, 12) })} dir="ltr" inputMode="numeric" />
        </Field>
        <Field label="الجنسية"><TextInput value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} /></Field>
        <Field label="رقم الهاتف" required>
          <TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 12) })} dir="ltr" inputMode="tel" />
        </Field>
        <Field label="هاتف بديل">
          <TextInput value={f.phone2} onChange={(e) => setF({ ...f, phone2: e.target.value.replace(/\D/g, "").slice(0, 12) })} dir="ltr" inputMode="tel" />
        </Field>
        <Field label="جهة العمل"><TextInput value={f.workplace} onChange={(e) => setF({ ...f, workplace: e.target.value })} /></Field>
        <Field label="البريد الإلكتروني"><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} dir="ltr" /></Field>
        <Field label="جهة اتصال للطوارئ" className="sm:col-span-2">
          <TextInput value={f.emergencyContact} onChange={(e) => setF({ ...f, emergencyContact: e.target.value })} />
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <TextArea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  );
}

/* ================================ العقد ================================= */

export function ContractForm({
  open, onClose, contract, presetUnitId, presetBuildingId,
}: { open: boolean; onClose: () => void; contract?: Contract; presetUnitId?: string; presetBuildingId?: string }) {
  const { data, update } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const [newTenant, setNewTenant] = useState(false);

  const unitsAvailable = useMemo(
    () =>
      data.units.filter(
        (u) =>
          (presetBuildingId ? u.buildingId === presetBuildingId : true) &&
          (u.id === contract?.unitId || u.id === presetUnitId || !data.contracts.some((c) => c.unitId === u.id && c.status === "active"))
      ),
    [data.units, data.contracts, contract?.unitId, presetUnitId, presetBuildingId]
  );

  const startUnit = presetUnitId ?? contract?.unitId ?? unitsAvailable[0]?.id ?? "";
  const unitRent = data.units.find((u) => u.id === startUnit)?.baseRent ?? 0;

  const [f, setF] = useState({
    unitId: startUnit,
    tenantId: contract?.tenantId ?? "",
    startDate: contract?.startDate ?? todayISO(),
    endDate: contract?.endDate ?? addMonths(todayISO(), 12),
    rent: contract?.rent ?? unitRent,
    deposit: contract?.deposit ?? unitRent,
    dueDay: contract?.dueDay ?? 1,
    payMethod: (contract?.payMethod ?? "cash") as PayMethod,
    durationText: contract?.durationText ?? "سنة",
    occupants: contract?.occupants ?? 0,
    signedAt: contract?.signedAt ?? todayISO(),
  });

  const [nt, setNt] = useState({ name: "", civilId: "", phone: "", nationality: "" });

  const save = () => {
    if (!f.unitId) return toast("اختر الوحدة", "error");
    let tenantId = f.tenantId;
    if (newTenant) {
      if (!nt.name.trim() || !nt.phone.trim()) return toast("أدخل اسم المستأجر ورقم هاتفه", "error");
      tenantId = uid("t-");
    }
    if (!tenantId) return toast("اختر المستأجر", "error");
    if (new Date(f.endDate) <= new Date(f.startDate)) return toast("تاريخ النهاية يجب أن يكون بعد البداية", "error");

    const unit = data.units.find((u) => u.id === f.unitId);
    if (!unit) return;

    update(
      (d) => {
        if (newTenant) {
          d.tenants.push({ id: tenantId, ...nt, active: true, createdAt: new Date().toISOString() });
        }
        if (contract) {
          const c = d.contracts.find((x) => x.id === contract.id);
          if (c) Object.assign(c, { ...f, tenantId });
        } else {
          // إنهاء أي عقد ساري على نفس الوحدة
          d.contracts.forEach((c) => {
            if (c.unitId === f.unitId && c.status === "active") c.status = "terminated";
          });
          d.contracts.push({
            id: uid("c-"),
            no: nextSeq(d.contracts.map((c) => c.no), "ع-"),
            buildingId: unit.buildingId,
            ...f,
            tenantId,
            status: "active",
            createdAt: new Date().toISOString(),
          });
          const u = d.units.find((x) => x.id === f.unitId);
          if (u) u.status = "occupied";
        }
      },
      { action: contract ? "تعديل عقد" : "عقد جديد", detail: `وحدة ${unit.number}`, actor: user?.username }
    );
    toast(contract ? "تم حفظ العقد" : "تم إنشاء العقد");
    onClose();
  };

  const unitLabel = (id: string) => {
    const u = data.units.find((x) => x.id === id);
    const b = data.buildings.find((x) => x.id === u?.buildingId);
    return u ? `${u.number} — ${b?.name ?? ""} (${kindLabel[u.kind]})` : "";
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={contract ? `تعديل العقد ${contract.no}` : "عقد إيجار جديد"}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save}><Icon name="file" size={16} /> حفظ العقد</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الوحدة" required className="sm:col-span-2">
          <Select
            value={f.unitId}
            onChange={(e) => {
              const u = data.units.find((x) => x.id === e.target.value);
              setF({ ...f, unitId: e.target.value, rent: u?.baseRent ?? f.rent, deposit: u?.baseRent ?? f.deposit });
            }}
          >
            {unitsAvailable.map((u) => <option key={u.id} value={u.id}>{unitLabel(u.id)}</option>)}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <div className="mb-2 flex gap-1.5">
            <button className={`btn btn-sm ${!newTenant ? "btn-soft" : "btn-ghost"}`} onClick={() => setNewTenant(false)}>مستأجر موجود</button>
            <button className={`btn btn-sm ${newTenant ? "btn-soft" : "btn-ghost"}`} onClick={() => setNewTenant(true)}>مستأجر جديد</button>
          </div>
          {newTenant ? (
            <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3 sm:grid-cols-2">
              <Field label="الاسم" required><TextInput value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} /></Field>
              <Field label="رقم الهاتف" required><TextInput value={nt.phone} onChange={(e) => setNt({ ...nt, phone: e.target.value.replace(/\D/g, "") })} dir="ltr" inputMode="tel" /></Field>
              <Field label="الرقم المدني"><TextInput value={nt.civilId} onChange={(e) => setNt({ ...nt, civilId: e.target.value.replace(/\D/g, "").slice(0, 12) })} dir="ltr" inputMode="numeric" /></Field>
              <Field label="الجنسية"><TextInput value={nt.nationality} onChange={(e) => setNt({ ...nt, nationality: e.target.value })} /></Field>
            </div>
          ) : (
            <Field label="المستأجر" required>
              <Select value={f.tenantId} onChange={(e) => setF({ ...f, tenantId: e.target.value })}>
                <option value="">— اختر —</option>
                {data.tenants.map((t) => <option key={t.id} value={t.id}>{t.name} {t.civilId ? `— ${t.civilId}` : ""}</option>)}
              </Select>
            </Field>
          )}
        </div>

        <Field label="تاريخ البداية" required><TextInput type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label="تاريخ النهاية" required>
          <div className="flex gap-1.5">
            <TextInput type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
            <button className="btn btn-ghost btn-sm shrink-0" onClick={() => setF({ ...f, endDate: addMonths(f.startDate, 12) })}>سنة</button>
          </div>
        </Field>
        <Field label="الإيجار الشهري (د.ك)" required><TextInput type="number" value={f.rent} onChange={(e) => setF({ ...f, rent: +e.target.value })} /></Field>
        <Field label="التأمين (د.ك)"><TextInput type="number" value={f.deposit} onChange={(e) => setF({ ...f, deposit: +e.target.value })} /></Field>
        <Field label="يوم الاستحقاق من كل شهر" hint="حسب العقد المعتمد: قبل يوم 5">
          <TextInput type="number" min={1} max={28} value={f.dueDay} onChange={(e) => setF({ ...f, dueDay: +e.target.value })} />
        </Field>
        <Field label="مدة العقد كتابةً" hint="تُطبع في العقد">
          <TextInput value={f.durationText} onChange={(e) => setF({ ...f, durationText: e.target.value })} placeholder="سنة" />
        </Field>
        <Field label="عدد الساكنين المسموح به">
          <TextInput type="number" min={0} max={20} value={f.occupants} onChange={(e) => setF({ ...f, occupants: +e.target.value })} />
        </Field>
        <Field label="تاريخ تحرير العقد">
          <TextInput type="date" value={f.signedAt} onChange={(e) => setF({ ...f, signedAt: e.target.value })} />
        </Field>
        <Field label="طريقة الدفع">
          <Select value={f.payMethod} onChange={(e) => setF({ ...f, payMethod: e.target.value as PayMethod })}>
            {(Object.keys(methodLabel) as PayMethod[]).map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
          </Select>
        </Field>
        <p className="sm:col-span-2 rounded-xl bg-[var(--surface-2)] p-3 text-[12px] leading-relaxed text-[var(--muted)]">
          تُطبع بنود العقد المعتمدة لدى المكتب تلقائيًا مع كل عقد (تسعة عشر بندًا)، ولا حاجة لكتابتها هنا.
        </p>
      </div>
    </Sheet>
  );
}

/* ============================== الدفعة/الوصل ============================== */

export function PaymentForm({
  open, onClose, presetContractId, presetPeriod,
}: { open: boolean; onClose: () => void; presetContractId?: string; presetPeriod?: string }) {
  const { data, update, activeBuilding } = useStore();
  const { user } = useAuth();
  const toast = useToast();

  const contracts = useMemo(
    () => data.contracts.filter((c) => c.status !== "terminated" && (activeBuilding === "all" || c.buildingId === activeBuilding)),
    [data.contracts, activeBuilding]
  );

  const first = presetContractId ?? contracts[0]?.id ?? "";
  const [contractId, setContractId] = useState(first);
  const contract = data.contracts.find((c) => c.id === contractId);

  const [f, setF] = useState({
    period: presetPeriod ?? thisPeriod(),
    amount: contract?.rent ?? 0,
    paidAt: todayISO(),
    method: (contract?.payMethod ?? "cash") as PayMethod,
    reference: "",
    bank: "",
    notes: "",
  });

  const onContract = (id: string) => {
    setContractId(id);
    const c = data.contracts.find((x) => x.id === id);
    if (c) setF((p) => ({ ...p, amount: c.rent, method: c.payMethod }));
  };

  const save = () => {
    if (!contract) return toast("اختر العقد", "error");
    if (f.amount <= 0) return toast("أدخل مبلغًا صحيحًا", "error");
    const dup = data.payments.some((p) => p.contractId === contract.id && p.period === f.period);
    if (dup) return toast(`${monthAr(f.period)} مسدد مسبقًا لهذا العقد`, "error");

    update(
      (d) => {
        d.payments.unshift({
          id: uid("p-"),
          receiptNo: nextSeq(d.payments.map((p) => p.receiptNo), "و-"),
          buildingId: contract.buildingId,
          unitId: contract.unitId,
          tenantId: contract.tenantId,
          contractId: contract.id,
          ...f,
          createdBy: user?.username ?? "—",
          createdAt: new Date().toISOString(),
        });
      },
      { action: "تسجيل دفعة", detail: `${monthAr(f.period)} — ${f.amount} د.ك`, actor: user?.username }
    );
    toast("تم تسجيل الدفعة وإصدار الوصل");
    onClose();
  };

  const label = (c: Contract) => {
    const u = data.units.find((x) => x.id === c.unitId);
    const t = data.tenants.find((x) => x.id === c.tenantId);
    return `${u?.number ?? "—"} · ${t?.name ?? "—"}`;
  };

  const periods = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = -1; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="تسجيل دفعة إيجار"
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save}><Icon name="receipt" size={16} /> حفظ وإصدار وصل</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العقد / الوحدة" required className="sm:col-span-2">
          <Select value={contractId} onChange={(e) => onContract(e.target.value)}>
            <option value="">— اختر —</option>
            {contracts.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
          </Select>
        </Field>
        <Field label="عن شهر" required>
          <Select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}>
            {periods.map((p) => <option key={p} value={p}>{monthAr(p)}</option>)}
          </Select>
        </Field>
        <Field label="المبلغ (د.ك)" required>
          <TextInput type="number" step="0.001" value={f.amount} onChange={(e) => setF({ ...f, amount: +e.target.value })} />
        </Field>
        <Field label="تاريخ الدفع" required><TextInput type="date" value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} /></Field>
        <Field label="طريقة الدفع">
          <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PayMethod })}>
            {(Object.keys(methodLabel) as PayMethod[]).map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
          </Select>
        </Field>
        <Field label={f.method === "cheque" ? "رقم الشيك" : "رقم العملية / المرجع"}>
          <TextInput value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} dir="ltr" />
        </Field>
        <Field label="على بنك" hint="يُطبع في الوصل عند الدفع بشيك">
          <Select value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })}>
            <option value="">—</option>
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2"><TextArea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Sheet>
  );
}

/* =============================== المصروف =============================== */

export function ExpenseForm({ open, onClose, expense }: { open: boolean; onClose: () => void; expense?: Expense }) {
  const { data, update, activeBuilding } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({
    buildingId: expense?.buildingId ?? (activeBuilding !== "all" ? activeBuilding : data.buildings[0]?.id ?? ""),
    category: (expense?.category ?? "maintenance") as ExpenseCategory,
    title: expense?.title ?? "",
    amount: expense?.amount ?? 0,
    date: expense?.date ?? todayISO(),
    vendor: expense?.vendor ?? "",
    method: (expense?.method ?? "cash") as PayMethod,
    notes: expense?.notes ?? "",
  });

  const save = () => {
    if (!f.title.trim()) return toast("أدخل بيان المصروف", "error");
    if (f.amount <= 0) return toast("أدخل مبلغًا صحيحًا", "error");
    update(
      (d) => {
        if (expense) {
          const t = d.expenses.find((x) => x.id === expense.id);
          if (t) Object.assign(t, f);
        } else {
          d.expenses.unshift({ id: uid("e-"), ...f, createdAt: new Date().toISOString() });
        }
      },
      { action: expense ? "تعديل مصروف" : "إضافة مصروف", detail: `${f.title} — ${f.amount}`, actor: user?.username }
    );
    toast("تم الحفظ");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={expense ? "تعديل مصروف" : "إضافة مصروف"}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save}><Icon name="check" size={16} /> حفظ</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العمارة" required>
          <Select value={f.buildingId} onChange={(e) => setF({ ...f, buildingId: e.target.value })}>
            {data.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="التصنيف" required>
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ExpenseCategory })}>
            {EXPENSE_ORDER.map((c) => <option key={c} value={c}>{expenseLabel[c]}</option>)}
          </Select>
        </Field>
        <Field label="البيان" required className="sm:col-span-2">
          <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: فاتورة كهرباء شهر ٥" />
        </Field>
        <Field label="المبلغ (د.ك)" required><TextInput type="number" step="0.001" value={f.amount} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></Field>
        <Field label="التاريخ" required><TextInput type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="الجهة / المورد"><TextInput value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
        <Field label="طريقة الدفع">
          <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PayMethod })}>
            {(Object.keys(methodLabel) as PayMethod[]).map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
          </Select>
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2"><TextArea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Sheet>
  );
}
