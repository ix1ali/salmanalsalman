"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { tenantOfUnit } from "@/lib/selectors";
import { num } from "@/lib/format";
import { Empty, PageHeader, SearchBox, Sheet } from "@/components/ui";
import { Icon } from "@/components/Icons";
import UnitSheet from "@/components/UnitSheet";
import { BulkUnitsForm, FloorForm, UnitForm } from "@/components/forms";
import type { Unit } from "@/lib/types";

type Filter = "all" | "occupied" | "vacant" | "flagged";

/** ألوان حالة الوحدة داخل مخطط العمارة. */
const TONE = {
  occupied: { bg: "var(--primary-050)", fg: "var(--primary-700)", bd: "transparent" },
  vacant:   { bg: "var(--gold-050)",    fg: "var(--gold-600)",    bd: "var(--gold)" },
  flagged:  { bg: "var(--danger-050)",  fg: "var(--danger)",      bd: "var(--danger)" },
} as const;

const toneOf = (u: Unit) => (u.flagged ? "flagged" : u.status === "occupied" ? "occupied" : "vacant");

export default function ApartmentsPage() {
  const { data, activeBuilding } = useStore();
  const { allow } = useAuth();

  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;
  const building = data.buildings.find((b) => b.id === buildingId);

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

  /** الوحدات المطابقة — الباقي يبهت ليبقى شكل العمارة كاملًا. */
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

  /** الأدوار من الأعلى إلى الأسفل — المخطط يُقرأ كما تُرى العمارة. */
  const floors = useMemo(
    () =>
      data.floors
        .filter((f) => f.buildingId === buildingId)
        .sort((a, b) => b.level - a.level)
        .map((f) => ({
          ...f,
          units: units
            .filter((u) => u.floorId === f.id)
            .sort((a, b) => a.number.localeCompare(b.number, "ar", { numeric: true })),
        })),
    [data.floors, buildingId, units]
  );

  if (!building) {
    return (
      <Empty icon="building" title="لا توجد عقارات مسجّلة" body="أضف أول عقار للبدء."
        action={<a href="/buildings" className="btn btn-primary"><Icon name="plus" size={15} /> إضافة عقار</a>} />
    );
  }

  const chips: { v: Filter; label: string; n: number }[] = [
    { v: "all", label: "الكل", n: counts.all },
    { v: "occupied", label: "مؤجرة", n: counts.occupied },
    { v: "vacant", label: "شاغرة", n: counts.vacant },
    ...(counts.flagged ? [{ v: "flagged" as const, label: "ملاحظة", n: counts.flagged }] : []),
  ];

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

      <SearchBox value={q} onChange={setQ} placeholder="رقم الشقة، اسم المستأجر، الهاتف…" />

      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {chips.map((c) => (
          <button key={c.v} onClick={() => setFilter(c.v)} data-on={filter === c.v} className="chip shrink-0">
            {c.label}<span className="chip-n num">{c.n}</span>
          </button>
        ))}
      </div>

      {/* ======================== مخطط العمارة ======================== */}
      <div className="panel overflow-hidden">
        {floors.map((f, i) => {
          const occ = f.units.filter((u) => u.status === "occupied").length;
          const rate = f.units.length ? (occ / f.units.length) * 100 : 0;
          return (
            <div key={f.id} className={i ? "border-t border-[var(--line)]" : ""}>
              <div className="flex items-center gap-2.5 px-3.5 pt-2.5">
                <span className="w-[52px] shrink-0 text-[13px] font-bold text-[var(--ink-2)]">{f.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <span
                    className="block h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${rate}%`, background: rate === 100 ? "var(--ok)" : "var(--primary)" }}
                  />
                </span>
                <span className="num w-[40px] shrink-0 text-left text-[11.5px] font-bold text-[var(--muted)]">
                  {num(occ)}/{num(f.units.length)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 px-3.5 pb-3 pt-2">
                {f.units.length ? f.units.map((u) => {
                  const t = TONE[toneOf(u)];
                  const dim = matched ? !matched.has(u.id) : false;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setOpenUnit(u.id)}
                      title={u.number}
                      className="grid h-[38px] min-w-[38px] place-items-center rounded-lg border px-2 text-[12px] font-bold transition active:scale-95"
                      style={{
                        background: t.bg, color: t.fg,
                        borderColor: t.bd,
                        borderStyle: toneOf(u) === "vacant" ? "dashed" : "solid",
                        opacity: dim ? 0.22 : 1,
                      }}
                    >
                      <span className="num truncate">{u.number}</span>
                    </button>
                  );
                }) : (
                  <p className="t-xs py-1.5 text-[var(--muted)]">لا توجد وحدات في هذا الدور</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* دليل الألوان */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pb-1">
        {([
          ["occupied", "مؤجرة"],
          ["vacant", "شاغرة"],
          ["flagged", "عليها ملاحظة"],
        ] as const).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
            <span
              className="h-3 w-3 rounded-[4px] border"
              style={{
                background: TONE[k].bg,
                borderColor: TONE[k].bd,
                borderStyle: k === "vacant" ? "dashed" : "solid",
              }}
            />
            {label}
          </span>
        ))}
      </div>

      <UnitSheet unitId={openUnit} onClose={() => setOpenUnit(null)} />

      {addOpen === "menu" && allow("units.edit") && <AddMenu onClose={() => setAddOpen(null)} onPick={setAddOpen} />}
      {addOpen === "single" && <UnitForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
      {addOpen === "bulk" && <BulkUnitsForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
      {addOpen === "floor" && <FloorForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
    </div>
  );
}

function AddMenu({
  onClose, onPick,
}: { onClose: () => void; onPick: (k: "single" | "bulk" | "floor") => void }) {
  const items = [
    { k: "single" as const, icon: "grid" as const, title: "شقة واحدة", sub: "إضافة وحدة بتفاصيلها" },
    { k: "bulk" as const, icon: "layers" as const, title: "عدة شقق دفعة واحدة", sub: "ترقيم تلقائي لدور كامل" },
    { k: "floor" as const, icon: "building" as const, title: "دور جديد", sub: "إضافة دور إلى العمارة" },
  ];
  return (
    <Sheet open onClose={onClose} title="إضافة">
      <div className="-mx-4 -my-3.5">
        {items.map((it) => (
          <button key={it.k} onClick={() => onPick(it.k)} className="row row-link">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-050)] text-[var(--primary)]">
              <Icon name={it.icon} size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold">{it.title}</span>
              <span className="t-xs block text-[var(--muted)]">{it.sub}</span>
            </span>
            <Icon name="chevronLeft" size={15} className="shrink-0 text-[var(--faint)]" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
