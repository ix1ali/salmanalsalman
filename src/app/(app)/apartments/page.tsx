"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { tenantOfUnit } from "@/lib/selectors";
import { KWD, num, pct } from "@/lib/format";
import { Empty, PageHeader, SearchBox, Sheet } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icons";
import UnitSheet from "@/components/UnitSheet";
import { BulkUnitsForm, FloorForm, UnitForm } from "@/components/forms";
import type { Unit } from "@/lib/types";

type Filter = "all" | "occupied" | "vacant" | "flagged";

const STATE = {
  occupied: { label: "مؤجرة", fg: "var(--ok)", bg: "var(--ok-050)" },
  vacant:   { label: "شاغرة", fg: "var(--gold-600)", bg: "var(--gold-050)" },
  flagged:  { label: "ملاحظة", fg: "var(--danger)", bg: "var(--danger-050)" },
} as const;

const stateOf = (u: Unit) => (u.flagged ? "flagged" : u.status === "occupied" ? "occupied" : "vacant");

/** حلقة نسبة صغيرة بجانب اسم الدور. */
function Ring({ value, size = 34 }: { value: number; size?: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = v === 100 ? "var(--ok)" : v >= 50 ? "var(--primary)" : "var(--gold)";
  return (
    <svg viewBox="0 0 36 36" style={{ width: size, height: size }} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="5" />
      <circle
        cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        style={{ transition: "stroke-dasharray .5s ease" }}
      />
    </svg>
  );
}

export default function ApartmentsPage() {
  const { data, activeBuilding } = useStore();
  const { allow } = useAuth();

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

  const rate = counts.all ? ((counts.occupied + counts.flagged) / counts.all) * 100 : 0;
  const needle = q.trim().toLowerCase();

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
          const all = units
            .filter((u) => u.floorId === f.id)
            .sort((a, b) => a.number.localeCompare(b.number, "ar", { numeric: true }));
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

  const stats: { label: string; value: string; icon: IconName; fg: string; bg: string }[] = [
    { label: "إجمالي الوحدات", value: num(counts.all), icon: "building", fg: "var(--primary)", bg: "var(--primary-050)" },
    { label: "مؤجرة", value: num(counts.occupied + counts.flagged), icon: "users", fg: "var(--ok)", bg: "var(--ok-050)" },
    { label: "شاغرة", value: num(counts.vacant), icon: "home", fg: "var(--gold-600)", bg: "var(--gold-050)" },
  ];

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
        subtitle={building.name}
        actions={
          allow("units.edit") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen("menu")}>
              <Icon name="plus" size={14} /> إضافة
            </button>
          ) : undefined
        }
      />

      {/* ============================ أرقام العقار ============================ */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card flex items-center gap-2.5 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: s.bg, color: s.fg }}>
              <Icon name={s.icon} size={17} />
            </span>
            <span className="min-w-0">
              <span className="num block text-[19px] font-bold leading-none">{s.value}</span>
              <span className="t-xs block truncate text-[var(--muted)]">{s.label}</span>
            </span>
          </div>
        ))}
        <div className="card flex items-center gap-2.5 p-3">
          <Ring value={rate} size={36} />
          <span className="min-w-0">
            <span className="num block text-[19px] font-bold leading-none">{pct(rate)}</span>
            <span className="t-xs block truncate text-[var(--muted)]">نسبة الإشغال</span>
          </span>
        </div>
      </div>

      <SearchBox value={q} onChange={setQ} placeholder="رقم الشقة، اسم المستأجر، الهاتف…" />

      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {chips.map((c) => (
          <button key={c.v} onClick={() => setFilter(c.v)} data-on={filter === c.v} className="chip shrink-0">
            {c.label}<span className="chip-n num">{c.n}</span>
          </button>
        ))}
      </div>

      {/* ============================== الأدوار ============================== */}
      {floors.length ? (
        <div className="space-y-2">
          {floors.map((f) => {
            const open = matched ? true : openFloors.includes(f.id);
            const occ = f.all.filter((u) => u.status === "occupied").length;
            const vac = f.all.length - occ;
            const r = f.all.length ? (occ / f.all.length) * 100 : 0;
            return (
              <div key={f.id} className="card overflow-hidden">
                <button
                  onClick={() => toggle(f.id)}
                  className="flex w-full items-center gap-3 p-3 text-right transition hover:bg-[var(--surface-2)]"
                  aria-expanded={open}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-050)] text-[var(--primary)]">
                    <Icon name="layers" size={17} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold">{f.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="t-xs text-[var(--muted)]">{num(f.all.length)} وحدة</span>
                      <span className="tag" style={{ background: "var(--ok-050)", color: "var(--ok)" }}>
                        {num(occ)} مؤجرة
                      </span>
                      {vac > 0 && (
                        <span className="tag" style={{ background: "var(--gold-050)", color: "var(--gold-600)" }}>
                          {num(vac)} شاغرة
                        </span>
                      )}
                      {matched && <span className="t-xs text-[var(--primary)]">{num(f.shown.length)} نتيجة</span>}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    <Ring value={r} />
                    <span className="num hidden text-[12.5px] font-bold text-[var(--ink-2)] sm:block">{pct(r)}</span>
                    <Icon
                      name="chevronDown" size={16}
                      className="text-[var(--faint)] transition-transform"
                      style={{ transform: open ? "rotate(180deg)" : "none" }}
                    />
                  </span>
                </button>

                {open && (
                  <div className="border-t border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                    {f.shown.length ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {f.shown.map((u) => <UnitCard key={u.id} unit={u} onOpen={setOpenUnit} />)}
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

/** بطاقة الوحدة: الرقم، اسم ساكنها، إيجارها، وحالتها. */
function UnitCard({ unit, onOpen }: { unit: Unit; onOpen: (id: string) => void }) {
  const { data } = useStore();
  const { allow } = useAuth();
  const { tenant } = tenantOfUnit(data, unit.id);
  const st = STATE[stateOf(unit)];

  return (
    <button
      onClick={() => onOpen(unit.id)}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-right transition hover:border-[var(--line-strong)] hover:shadow-[var(--sh-1)] active:scale-[.98]"
    >
      <p className="num text-[18px] font-bold leading-none text-[var(--ink)]">{unit.number}</p>
      <p className="mt-1.5 truncate text-[12.5px] font-semibold text-[var(--ink-2)]">
        {tenant?.name ?? "—"}
      </p>
      {allow("finance.view") && (
        <p className="num t-xs mt-0.5 text-[var(--muted)]">{KWD(unit.baseRent)}</p>
      )}
      <span
        className="tag mt-2 inline-flex"
        style={{ background: st.bg, color: st.fg }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.fg }} />
        {st.label}
      </span>
    </button>
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
