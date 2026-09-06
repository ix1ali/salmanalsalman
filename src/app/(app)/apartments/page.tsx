"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { tenantOfUnit } from "@/lib/selectors";
import { kindLabel, num } from "@/lib/format";
import { Empty, Filters, Money, PageHeader, SearchBox, Sheet } from "@/components/ui";
import { Icon } from "@/components/Icons";
import UnitSheet from "@/components/UnitSheet";
import { BulkUnitsForm, FloorForm, UnitForm } from "@/components/forms";
import type { Unit } from "@/lib/types";
import { UNIT_COLOR, unitColor } from "@/lib/unitColor";

type Filter = "all" | "occupied" | "vacant" | "flagged";

export default function ApartmentsPage() {
  const { data, activeBuilding } = useStore();
  const { allow } = useAuth();

  // العقار يُختار من الشريط العلوي — لا تكرار هنا
  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;
  const building = data.buildings.find((b) => b.id === buildingId);

  const [openFloors, setOpenFloors] = useState<string[]>([]);
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState<null | "menu" | "single" | "bulk" | "floor">(null);

  const units = useMemo(() => data.units.filter((u) => u.buildingId === buildingId), [data.units, buildingId]);

  const counts = useMemo(() => ({
    all: units.length,
    occupied: units.filter((u) => u.status === "occupied" && !u.flagged).length,
    vacant: units.filter((u) => u.status === "vacant" && !u.flagged).length,
    flagged: units.filter((u) => u.flagged).length,
  }), [units]);

  const needle = q.trim().toLowerCase();

  /** الوحدات المطابقة للبحث والفلتر — null يعني «كل شيء». */
  const matched = useMemo(() => {
    if (!needle && filter === "all") return null;
    const set = new Set<string>();
    units.forEach((u) => {
      if (filter === "occupied" && !(u.status === "occupied" && !u.flagged)) return;
      if (filter === "vacant" && !(u.status === "vacant" && !u.flagged)) return;
      if (filter === "flagged" && !u.flagged) return;
      if (needle) {
        const t = tenantOfUnit(data, u.id).tenant;
        const hit =
          u.number.toLowerCase().includes(needle) ||
          (t?.name ?? "").toLowerCase().includes(needle) ||
          (t?.phone ?? "").includes(needle) ||
          (t?.civilId ?? "").includes(needle);
        if (!hit) return;
      }
      set.add(u.id);
    });
    return set;
  }, [needle, filter, units, data]);

  const floors = useMemo(
    () =>
      data.floors
        .filter((f) => f.buildingId === buildingId)
        .sort((a, b) => b.level - a.level)
        .map((f) => {
          const all = units.filter((u) => u.floorId === f.id);
          return { ...f, all, shown: matched ? all.filter((u) => matched.has(u.id)) : all };
        })
        .filter((f) => (matched ? f.shown.length : true)),
    [data.floors, buildingId, units, matched]
  );

  const toggle = (id: string) =>
    setOpenFloors((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (!building) {
    return (
      <Empty icon="building" title="لا توجد عقارات مسجّلة" body="أضف أول عقار للبدء."
        action={<a href="/buildings" className="btn btn-primary"><Icon name="plus" size={15} /> إضافة عقار</a>} />
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="الشقق"
        subtitle={`${num(units.length)} وحدة · ${num(counts.occupied + counts.flagged)} مؤجرة · ${num(counts.vacant)} شاغرة`}
        actions={
          allow("units.edit") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen("menu")}>
              <Icon name="plus" size={14} /> إضافة
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="رقم الشقة، اسم المستأجر، الهاتف…" />
        <Filters
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "الكل", count: counts.all },
            { value: "occupied", label: "مؤجرة", count: counts.occupied },
            { value: "vacant", label: "شاغرة", count: counts.vacant },
            ...(counts.flagged ? [{ value: "flagged" as const, label: "ملاحظة", count: counts.flagged }] : []),
          ]}
        />
      </div>

      {floors.length ? (
        <div className="panel">
          {floors.map((f, i) => {
            const open = matched ? true : openFloors.includes(f.id);
            const occ = f.all.filter((u) => u.status === "occupied").length;
            const rate = f.all.length ? (occ / f.all.length) * 100 : 0;
            return (
              <div key={f.id} className={i ? "border-t border-[var(--line)]" : ""}>
                <button
                  onClick={() => toggle(f.id)}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-right transition hover:bg-[var(--surface-2)]"
                  aria-expanded={open}
                >
                  <Icon
                    name="chevronDown" size={15}
                    className="shrink-0 text-[var(--faint)] transition-transform"
                    style={{ transform: open ? "rotate(180deg)" : "none" }}
                  />
                  <span className="w-[54px] shrink-0 text-[14px] font-bold">{f.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${rate}%`, background: rate === 100 ? "var(--ok)" : "var(--primary)" }} />
                  </span>
                  {matched && <span className="t-xs shrink-0 text-[var(--muted)]">{num(f.shown.length)} نتيجة</span>}
                  <span className="num w-[42px] shrink-0 text-left text-[12px] font-semibold text-[var(--muted)]">{num(occ)}/{num(f.all.length)}</span>
                  {f.all.some((u) => u.flagged) && <span className="dot" style={{ background: UNIT_COLOR.flagged }} />}
                </button>

                {open && (
                  <div className="border-t border-[var(--line)] bg-[var(--surface-2)] p-2">
                    {f.shown.length ? (
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
                        {f.shown.map((u) => <UnitTile key={u.id} unit={u} onOpen={setOpenUnit} />)}
                      </div>
                    ) : (
                      <p className="t-sm py-3 text-center text-[var(--muted)]">لا توجد وحدات في هذا الدور</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card"><Empty icon="search" title="لا توجد نتائج مطابقة" /></div>
      )}

      <UnitSheet unitId={openUnit} onClose={() => setOpenUnit(null)} />

      {addOpen === "menu" && allow("units.edit") && <AddMenu onClose={() => setAddOpen(null)} onPick={setAddOpen} />}
      {addOpen === "single" && <UnitForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
      {addOpen === "bulk" && <BulkUnitsForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
      {addOpen === "floor" && <FloorForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
    </div>
  );
}

/** بطاقة الوحدة: الرقم بارز، الاسم تحته، والإيجار — والحالة شريط لوني رفيع. */
function UnitTile({ unit, onOpen }: { unit: Unit; onOpen: (id: string) => void }) {
  const { data } = useStore();
  const { allow } = useAuth();
  const { tenant } = tenantOfUnit(data, unit.id);
  const c = unitColor(unit);

  return (
    <button
      onClick={() => onOpen(unit.id)}
      className="relative overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-right transition hover:border-[var(--line-strong)] active:scale-[.98]"
    >
      <span className="absolute inset-y-0 right-0 w-[3px]" style={{ background: c }} />
      <div className="pr-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="num t-title leading-none">{unit.number}</span>
          {unit.flagged && <Icon name="alert" size={12} strokeWidth={2.4} style={{ color: UNIT_COLOR.flagged }} />}
        </div>
        <p className="t-xs mt-1 truncate text-[var(--muted)]">
          {tenant?.name ?? (unit.kind === "apartment" ? "شاغرة" : kindLabel[unit.kind])}
        </p>
        {allow("finance.view") && (
          <Money v={unit.baseRent} size="xs" className="mt-0.5 text-[var(--ink-2)]" />
        )}
      </div>
    </button>
  );
}

function AddMenu({ onClose, onPick }: { onClose: () => void; onPick: (k: "single" | "bulk" | "floor") => void }) {
  const items: [("single" | "bulk" | "floor"), string, string, string][] = [
    ["single", "door", "وحدة واحدة", "رقمها ومساحتها وقيمة إيجارها"],
    ["bulk", "box", "مجموعة وحدات", "مثال: اثنتا عشرة شقة في دور واحد"],
    ["floor", "layers", "دور جديد", "إضافة دور إلى العقار"],
  ];
  return (
    <Sheet open onClose={onClose} title="ما الذي تريد إضافته؟">
      <div className="-mx-4 -my-3.5">
        {items.map(([k, icon, title, sub]) => (
          <button key={k} onClick={() => onPick(k)} className="row row-link">
            <Icon name={icon} size={18} className="shrink-0 text-[var(--muted)]" />
            <span className="flex-1">
              <span className="block text-[13.5px] font-semibold">{title}</span>
              <span className="t-xs block text-[var(--muted)]">{sub}</span>
            </span>
            <Icon name="chevronLeft" size={15} className="text-[var(--faint)]" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
