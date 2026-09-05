"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { floorStats, tenantOfUnit } from "@/lib/selectors";
import { KWD, kindLabel, num, pct, statusLabel } from "@/lib/format";
import { Chip, Empty, PageHeader, SearchBox, Segmented } from "@/components/ui";
import { Icon } from "@/components/Icons";
import BuildingFacade, { STATUS_COLOR } from "@/components/BuildingFacade";
import UnitSheet, { statusTone } from "@/components/UnitSheet";
import { BulkUnitsForm, FloorForm, UnitForm } from "@/components/forms";
import type { Unit, UnitStatus } from "@/lib/types";

export default function ApartmentsPage() {
  const { data, activeBuilding, setActiveBuilding } = useStore();
  const { allow } = useAuth();

  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;
  const building = data.buildings.find((b) => b.id === buildingId);

  const [view, setView] = useState<"plan" | "list">("plan");
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | UnitStatus>("all");
  const [addOpen, setAddOpen] = useState<null | "menu" | "single" | "bulk" | "floor">(null);

  const floors = useMemo(() => floorStats(data, buildingId), [data, buildingId]);
  useEffect(() => setSelectedFloor(null), [buildingId]);

  const allUnits = useMemo(() => data.units.filter((u) => u.buildingId === buildingId), [data.units, buildingId]);

  const counts = useMemo(
    () => ({
      all: allUnits.length,
      occupied: allUnits.filter((u) => u.status === "occupied").length,
      vacant: allUnits.filter((u) => u.status === "vacant").length,
      maintenance: allUnits.filter((u) => u.status === "maintenance").length,
      reserved: allUnits.filter((u) => u.status === "reserved").length,
    }),
    [allUnits]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allUnits.filter((u) => {
      if (status !== "all" && u.status !== status) return false;
      if (!needle) return true;
      const t = tenantOfUnit(data, u.id).tenant;
      return (
        u.number.toLowerCase().includes(needle) ||
        (t?.name ?? "").toLowerCase().includes(needle) ||
        (t?.phone ?? "").includes(needle)
      );
    });
  }, [allUnits, q, status, data]);

  if (!building) {
    return (
      <Empty
        icon="building"
        title="ما فيه عمارات بعد"
        body="أضف عمارتك الأولى لتبدأ."
        action={<a href="/buildings" className="btn btn-primary"><Icon name="plus" size={16} /> إضافة عمارة</a>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={building.name}
        subtitle={`${num(allUnits.length)} وحدة · إشغال ${pct(counts.all ? (counts.occupied / counts.all) * 100 : 0)}`}
        icon="building"
        actions={
          allow("units.edit") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen("menu")}>
              <Icon name="plus" size={15} /> إضافة
            </button>
          ) : undefined
        }
      />

      {/* اختيار العمارة */}
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

      {/* ثلاثة أرقام فقط */}
      <div className="grid grid-cols-3 gap-2">
        {([
          ["occupied", "مؤجرة"],
          ["vacant", "فاضية"],
          ["maintenance", "صيانة"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setStatus(status === k ? "all" : k); setView("list"); }}
            className="card p-3 text-center transition active:scale-[.97]"
            style={status === k ? { borderColor: STATUS_COLOR[k] } : undefined}
          >
            <p className="display text-[20px] leading-none tabular-nums" style={{ color: STATUS_COLOR[k] }}>
              {num(counts[k])}
            </p>
            <p className="mt-1 text-[11.5px] text-[var(--muted)]">{label}</p>
          </button>
        ))}
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "plan", label: "مخطط العمارة" },
          { value: "list", label: "قائمة الوحدات", count: allUnits.length },
        ]}
      />

      {view === "plan" ? (
        <>
          <BuildingFacade
            floors={floors}
            selected={selectedFloor}
            onSelectFloor={(id) => setSelectedFloor(id || null)}
            onSelectUnit={setOpenUnit}
          />
          {!selectedFloor && (
            <p className="text-center text-[12px] text-[var(--muted)]">اضغط على أي دور لعرض شققه</p>
          )}
        </>
      ) : (
        <>
          <SearchBox value={q} onChange={setQ} placeholder="رقم الشقة أو اسم المستأجر…" />
          <Segmented
            value={status}
            onChange={setStatus}
            size="sm"
            options={[
              { value: "all", label: "الكل", count: counts.all },
              { value: "occupied", label: "مؤجرة", count: counts.occupied },
              { value: "vacant", label: "فاضية", count: counts.vacant },
              { value: "maintenance", label: "صيانة", count: counts.maintenance },
            ]}
          />

          {filtered.length ? (
            <div className="space-y-4">
              {floors
                .filter((f) => filtered.some((u) => u.floorId === f.floorId))
                .map((f) => (
                  <div key={f.floorId}>
                    <h3 className="mb-1.5 text-[13px] font-extrabold text-[var(--ink-2)]">{f.name}</h3>
                    <div className="space-y-1.5">
                      {filtered
                        .filter((u) => u.floorId === f.floorId)
                        .map((u) => <UnitRow key={u.id} unit={u} onOpen={setOpenUnit} />)}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <Empty icon="search" title="ما فيه نتائج" />
          )}
        </>
      )}

      <UnitSheet unitId={openUnit} onClose={() => setOpenUnit(null)} />

      {/* قائمة الإضافة */}
      {addOpen === "menu" && allow("units.edit") && (
        <AddMenu onClose={() => setAddOpen(null)} onPick={setAddOpen} />
      )}
      {addOpen === "single" && <UnitForm open onClose={() => setAddOpen(null)} buildingId={buildingId} floorId={selectedFloor ?? undefined} />}
      {addOpen === "bulk" && <BulkUnitsForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
      {addOpen === "floor" && <FloorForm open onClose={() => setAddOpen(null)} buildingId={buildingId} />}
    </div>
  );
}

/* ------------------------- قائمة الإضافة السريعة ------------------------- */

function AddMenu({ onClose, onPick }: { onClose: () => void; onPick: (k: "single" | "bulk" | "floor") => void }) {
  const items: [("single" | "bulk" | "floor"), string, string, string][] = [
    ["single", "door", "شقة واحدة", "أضف وحدة بأرقامها ومساحتها"],
    ["bulk", "box", "عدة شقق دفعة", "مثلاً ١٢ شقة في دور واحد"],
    ["floor", "layers", "دور جديد", "أضف دورًا للعمارة"],
  ];
  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-[#0b2545]/45" />
      <div className="anim-sheet relative w-full rounded-t-[26px] bg-white p-4 shadow-[var(--sh-3)] sm:max-w-sm sm:rounded-[24px]" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-center text-[15px] font-extrabold">ماذا تريد أن تضيف؟</p>
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

/* ------------------------------- صف وحدة ------------------------------- */

function UnitRow({ unit, onOpen }: { unit: Unit; onOpen: (id: string) => void }) {
  const { data } = useStore();
  const { allow } = useAuth();
  const { tenant } = tenantOfUnit(data, unit.id);
  const color = STATUS_COLOR[unit.status];
  return (
    <button
      onClick={() => onOpen(unit.id)}
      className="card flex w-full items-center gap-3 p-2.5 text-right transition hover:shadow-[var(--sh-2)] active:scale-[.99]"
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[13px] font-extrabold text-white"
        style={{ background: color }}
      >
        {unit.number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold">{tenant?.name ?? statusLabel[unit.status]}</p>
        <p className="truncate text-[11.5px] text-[var(--muted)]">
          {kindLabel[unit.kind]} · {unit.area ?? "—"}م² · {unit.rooms ?? 0} غرف
        </p>
      </div>
      <div className="shrink-0 text-left">
        {allow("finance.view") && <p className="text-[12.5px] font-extrabold tabular-nums">{KWD(unit.baseRent, false)}</p>}
        <Chip tone={statusTone[unit.status]}>{statusLabel[unit.status]}</Chip>
      </div>
    </button>
  );
}
