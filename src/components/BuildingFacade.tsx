"use client";

import React from "react";
import type { FloorStat } from "@/lib/selectors";
import type { Unit } from "@/lib/types";
import { Icon } from "./Icons";
import { statusLabel } from "@/lib/format";

export const STATUS_COLOR: Record<string, string> = {
  occupied: "#123a6b",   // كحلي = مؤجرة
  vacant: "#c9992e",     // ذهبي = فاضية
  maintenance: "#d64550", // أحمر = صيانة
  reserved: "#64748b",   // رمادي = محجوزة
};

/**
 * مخطط أمامي للعمارة: كل الأدوار ظاهرة دفعة واحدة، وكل شقة نافذة ملوّنة
 * حسب حالتها. الضغط على الدور يفتح شققه مباشرة تحته.
 */
export default function BuildingFacade({
  floors, selected, onSelectFloor, onSelectUnit,
}: {
  floors: FloorStat[];               // من الأعلى إلى الأسفل
  selected: string | null;
  onSelectFloor: (id: string) => void;
  onSelectUnit: (id: string) => void;
}) {
  const above = floors.filter((f) => f.level >= 0);
  const below = floors.filter((f) => f.level < 0);

  const row = (f: FloorStat) => {
    const on = f.floorId === selected;
    const shown = f.units;

    return (
      <div key={f.floorId}>
        <div
          className="floor-row"
          data-on={on}
          role="button"
          tabIndex={0}
          onClick={() => onSelectFloor(on ? "" : f.floorId)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectFloor(on ? "" : f.floorId)}
          aria-expanded={on}
        >
          {/* اسم الدور */}
          <div className="flex w-[74px] shrink-0 flex-col justify-center rounded-lg px-2 py-1"
               style={{ background: on ? "var(--primary)" : "transparent" }}>
            <span className="text-[12.5px] font-extrabold leading-tight"
                  style={{ color: on ? "#fff" : "var(--ink)" }}>
              {f.name}
            </span>
            <span className="text-[10.5px] tabular-nums leading-tight"
                  style={{ color: on ? "rgba(255,255,255,.75)" : "var(--muted)" }}>
              {f.units.length ? `${f.occupied}/${f.units.length}` : "—"}
            </span>
          </div>

          {/* شريط الدور بنوافذه */}
          <div className="floor-slab" style={{ minHeight: 34 }}>
            {shown.length ? (
              shown.map((u) => (
                <span
                  key={u.id}
                  className="win"
                  style={{ background: STATUS_COLOR[u.status], height: on ? 20 : 17 }}
                  title={`${u.number} — ${statusLabel[u.status]}`}
                />
              ))
            ) : (
              <span className="w-full text-center text-[10.5px] text-[var(--muted)]">لا توجد وحدات</span>
            )}
          </div>

          <Icon
            name="chevronDown"
            size={15}
            className="mt-2 shrink-0 transition-transform"
            style={{ color: "var(--muted)", transform: on ? "rotate(180deg)" : "none" }}
          />
        </div>

        {/* شقق الدور — تفتح مباشرة تحت الدور المضغوط */}
        {on && (
          <div className="anim-up mb-2 mt-1 rounded-2xl bg-white p-3 shadow-[var(--sh-1)]">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-extrabold">{f.name}</p>
              <p className="text-[11.5px] text-[var(--muted)]">
                مؤجرة {f.occupied} · فاضية {f.vacant}
                {f.maintenance ? ` · صيانة ${f.maintenance}` : ""}
              </p>
            </div>
            {f.units.length ? (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
                {f.units.map((u) => <UnitChip key={u.id} unit={u} onClick={() => onSelectUnit(u.id)} />)}
              </div>
            ) : (
              <p className="py-4 text-center text-[12.5px] text-[var(--muted)]">ما فيه وحدات في هذا الدور</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="facade">
        <div className="roof-cap mb-1.5" />
        {above.map(row)}
        {below.length > 0 && (
          <>
            <div className="ground-line my-1.5" />
            {below.map(row)}
          </>
        )}
        <div className="h-3" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] font-bold text-[var(--muted)]">
        {(["occupied", "vacant", "maintenance"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[2px]" style={{ background: STATUS_COLOR[k] }} />
            {statusLabel[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

function UnitChip({ unit, onClick }: { unit: Unit; onClick: () => void }) {
  const c = STATUS_COLOR[unit.status];
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl border py-2 transition active:scale-[.96]"
      style={{ borderColor: `${c}33`, background: `${c}0d` }}
    >
      <span className="display text-[14px] leading-none" style={{ color: c }}>{unit.number}</span>
      <span className="text-[10px] leading-none text-[var(--muted)]">{statusLabel[unit.status]}</span>
    </button>
  );
}
