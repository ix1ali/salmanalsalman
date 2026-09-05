"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { tenantOfUnit } from "@/lib/selectors";
import { KWD, kindLabel, num } from "@/lib/format";
import { Empty, Money, PageHeader, SearchBox } from "@/components/ui";
import { Icon } from "@/components/Icons";
import UnitSheet from "@/components/UnitSheet";
import { BulkUnitsForm, FloorForm, UnitForm } from "@/components/forms";
import type { Unit } from "@/lib/types";
import { UNIT_COLOR, unitColor } from "@/lib/unitColor";

export default function ApartmentsPage() {
  const { data, activeBuilding, setActiveBuilding } = useStore();
  const { allow } = useAuth();

  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;
  const building = data.buildings.find((b) => b.id === buildingId);

  const [openFloors, setOpenFloors] = useState<string[]>([]);
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState<null | "menu" | "single" | "bulk" | "floor">(null);

  const units = useMemo(() => data.units.filter((u) => u.buildingId === buildingId), [data.units, buildingId]);

  const counts = useMemo(
    () => ({
      occupied: units.filter((u) => u.status === "occupied" && !u.flagged).length,
      vacant: units.filter((u) => u.status === "vacant" && !u.flagged).length,
      flagged: units.filter((u) => u.flagged).length,
    }),
    [units]
  );

  const floors = useMemo(
    () =>
      data.floors
        .filter((f) => f.buildingId === buildingId)
        .sort((a, b) => b.level - a.level)
        .map((f) => ({ ...f, units: units.filter((u) => u.floorId === f.id) })),
    [data.floors, buildingId, units]
  );

  // البحث يفتح كل الأدوار ويعرض المطابق فقط
  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return null;
    const set = new Set<string>();
    units.forEach((u) => {
      const t = tenantOfUnit(data, u.id).tenant;
      if (
        u.number.toLowerCase().includes(needle) ||
        (t?.name ?? "").toLowerCase().includes(needle) ||
        (t?.phone ?? "").includes(needle) ||
        (t?.civilId ?? "").includes(needle)
      ) set.add(u.id);
    });
    return set;
  }, [needle, units, data]);

  const toggle = (id: string) =>
    setOpenFloors((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (!building) {
    return (
      <Empty
        icon="building"
        title="لا توجد عقارات مسجّلة"
        body="أضف أول عقار للبدء."
        action={<a href="/buildings" className="btn btn-primary"><Icon name="plus" size={16} /> إضافة عمارة</a>}
      />
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="الشقق"
        subtitle={`${building.name} · ${num(units.length)} وحدة`}
        icon="grid"
        actions={
          allow("units.edit") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen("menu")}>
              <Icon name="plus" size={15} /> إضافة
            </button>
          ) : undefined
        }
      />

      {data.buildings.length > 1 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {data.buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBuilding(b.id)}
              className="shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition"
              style={{
                borderColor: b.id === buildingId ? "var(--primary)" : "var(--line)",
                background: b.id === buildingId ? "var(--primary)" : "var(--surface)",
                color: b.id === buildingId ? "#fff" : "var(--ink-2)",
              }}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <SearchBox value={q} onChange={setQ} placeholder="بحث بالاسم، رقم الشقة، الهاتف…" />

      {/* دليل مختصر */}
      <div className="flex items-center justify-center gap-4 rounded-xl bg-[var(--surface)] py-2 text-[12px] font-bold shadow-[var(--sh-1)]">
        <Legend color={UNIT_COLOR.occupied} label="مؤجرة" n={counts.occupied} />
        <Legend color={UNIT_COLOR.vacant} label="شاغرة" n={counts.vacant} />
        <Legend color={UNIT_COLOR.flagged} label="عليها ملاحظة" n={counts.flagged} />
      </div>

      {/* الأدوار */}
      <div className="space-y-2">
        {floors.map((f) => {
          const shown = matches ? f.units.filter((u) => matches.has(u.id)) : f.units;
          if (matches && !shown.length) return null;
          const open = matches ? true : openFloors.includes(f.id);
          const occ = f.units.filter((u) => u.status === "occupied").length;

          return (
            <div key={f.id} className="card overflow-hidden">
              <button
                onClick={() => toggle(f.id)}
                className="flex w-full items-center gap-3 p-3.5 text-right transition hover:bg-[var(--surface-2)]"
              >
                <Icon
                  name="chevronDown"
                  size={17}
                  className="shrink-0 text-[var(--muted)] transition-transform"
                  style={{ transform: open ? "rotate(180deg)" : "none" }}
                />
                <span className="flex-1">
                  <span className="block text-[15px] font-extrabold">{f.name}</span>
                  <span className="block text-[11.5px] text-[var(--muted)]">
                    {num(f.units.length)} وحدة · مؤجرة {num(occ)}
                  </span>
                </span>
                {f.units.some((u) => u.flagged) && (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--danger-050)] text-[#b3303b]">
                    <Icon name="alert" size={13} />
                  </span>
                )}
                <span
                  className="h-9 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: `linear-gradient(to bottom, ${UNIT_COLOR.occupied} ${
                      f.units.length ? (occ / f.units.length) * 100 : 0
                    }%, var(--line) 0)`,
                  }}
                />
              </button>

              {open && (
                <div className="border-t border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                  {shown.length ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {shown.map((u) => <UnitCard key={u.id} unit={u} onOpen={setOpenUnit} />)}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-[12.5px] text-[var(--muted)]">لا توجد وحدات في هذا الدور</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {matches && matches.size === 0 && <Empty icon="search" title="لا توجد نتائج مطابقة" />}

      <UnitSheet unitId={openUnit} onClose={() => setOpenUnit(null)} />

      {addOpen === "menu" && allow("units.edit") && <AddMenu onClose={() => setAddOpen(null)} onPick={setAddOpen} />}
      {addOpen === "single" && <UnitForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
      {addOpen === "bulk" && <BulkUnitsForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
      {addOpen === "floor" && <FloorForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
    </div>
  );
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="text-[var(--ink-2)]">{label}</span>
      <span className="tabular-nums" style={{ color }}>{num(n)}</span>
    </span>
  );
}

/** بطاقة الشقة: الرقم كبير، اسم المستأجر، الإيجار — بحدّ ملوّن حسب الحالة. */
function UnitCard({ unit, onOpen }: { unit: Unit; onOpen: (id: string) => void }) {
  const { data } = useStore();
  const { allow } = useAuth();
  const { tenant } = tenantOfUnit(data, unit.id);
  const c = unitColor(unit);

  return (
    <button
      onClick={() => onOpen(unit.id)}
      className="relative flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 bg-[var(--surface)] px-2 py-3 transition active:scale-[.97]"
      style={{ borderColor: c }}
    >
      {unit.flagged && (
        <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--danger-050)] text-[#b3303b]">
          <Icon name="alert" size={11} strokeWidth={2.4} />
        </span>
      )}
      <span className="display text-[20px] leading-none">{unit.number}</span>
      <span className="mt-1 line-clamp-1 text-[11px] text-[var(--muted)]">
        {tenant?.name ?? (unit.kind === "apartment" ? "شاغرة" : kindLabel[unit.kind])}
      </span>
      {allow("finance.view") && (
        <span className="text-[12px] font-extrabold tabular-nums" style={{ color: c }}>
          <Money v={unit.baseRent} size="sm" tone={c} />
        </span>
      )}
    </button>
  );
}

function AddMenu({ onClose, onPick }: { onClose: () => void; onPick: (k: "single" | "bulk" | "floor") => void }) {
  const items: [("single" | "bulk" | "floor"), string, string, string][] = [
    ["single", "door", "وحدة واحدة", "بياناتها ومساحتها وقيمة الإيجار"],
    ["bulk", "box", "مجموعة وحدات", "مثال: اثنتا عشرة شقة في دور واحد"],
    ["floor", "layers", "دور جديد", "إضافة دور جديد إلى العقار"],
  ];
  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-[#0b2545]/45" />
      <div
        className="anim-sheet relative w-full rounded-t-[26px] bg-white p-4 shadow-[var(--sh-3)] sm:max-w-sm sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-[15px] font-extrabold">ما الذي تريد إضافته؟</p>
        <div className="space-y-2">
          {items.map(([k, icon, title, sub]) => (
            <button
              key={k}
              onClick={() => onPick(k)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] p-3 text-right transition hover:bg-[var(--surface-2)]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary)]">
                <Icon name={icon} size={19} />
              </span>
              <span className="flex-1">
                <span className="block text-[13.5px] font-extrabold">{title}</span>
                <span className="block text-[11.5px] text-[var(--muted)]">{sub}</span>
              </span>
              <Icon name="chevronLeft" size={16} className="text-[var(--muted)]" />
            </button>
          ))}
        </div>
        <button className="btn btn-ghost mt-3 w-full" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  );
}
