"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { floorStats, kpis } from "@/lib/selectors";
import { KWD, num, pct } from "@/lib/format";
import { Chip, Empty, KeyVal, PageHeader, Progress, Sheet, useConfirm } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { BuildingForm, FloorForm } from "@/components/forms";
import DocsPanel from "@/components/DocsPanel";
import type { Building } from "@/lib/types";

export default function BuildingsPage() {
  const { data, update, setActiveBuilding } = useStore();
  const { user, allow } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addFloor, setAddFloor] = useState(false);

  const building = data.buildings.find((b) => b.id === openId) ?? null;
  const floors = useMemo(() => (openId ? floorStats(data, openId) : []), [data, openId]);

  const removeBuilding = async (b: Building) => {
    const units = data.units.filter((u) => u.buildingId === b.id).length;
    if (!(await confirm("حذف العمارة", `سيتم حذف ${b.name} و${units} وحدة وكل العقود والدفعات المرتبطة. لا يمكن التراجع.`))) return;
    update((d) => {
      d.buildings = d.buildings.filter((x) => x.id !== b.id);
      d.floors = d.floors.filter((x) => x.buildingId !== b.id);
      d.units = d.units.filter((x) => x.buildingId !== b.id);
      d.contracts = d.contracts.filter((x) => x.buildingId !== b.id);
      d.payments = d.payments.filter((x) => x.buildingId !== b.id);
      d.expenses = d.expenses.filter((x) => x.buildingId !== b.id);
    }, { action: "حذف عمارة", detail: b.name, actor: user?.username });
    setOpenId(null);
    setActiveBuilding("all");
  };

  const removeFloor = async (floorId: string, name: string) => {
    const units = data.units.filter((u) => u.floorId === floorId);
    if (!(await confirm("حذف الدور", `سيتم حذف ${name} و${units.length} وحدة داخله.`))) return;
    const unitIds = new Set(units.map((u) => u.id));
    update((d) => {
      d.floors = d.floors.filter((f) => f.id !== floorId);
      d.units = d.units.filter((u) => u.floorId !== floorId);
      d.contracts = d.contracts.filter((c) => !unitIds.has(c.unitId));
      d.payments = d.payments.filter((p) => !unitIds.has(p.unitId));
    }, { action: "حذف دور", detail: name, actor: user?.username });
  };

  return (
    <div className="space-y-4">
      {dialog}
      <PageHeader
        title="العمارات"
        subtitle={`${num(data.buildings.length)} عمارة · ${num(data.units.length)} وحدة`}
        icon="building"
        actions={
          allow("buildings.edit") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> عمارة</button>
          ) : undefined
        }
      />

      {data.buildings.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.buildings.map((b) => {
            const k = kpis(data, b.id);
            return (
              <div key={b.id} className="card card-lg overflow-hidden">
                <div className="h-1.5 w-full" style={{ background: b.color }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: b.color }}>
                        <Icon name="building" size={21} />
                      </span>
                      <div>
                        <h3 className="text-[15px] font-extrabold">{b.name}</h3>
                        <p className="text-[11.5px] text-[var(--muted)]">
                          {b.area} · {b.block} · {b.buildingNo}
                        </p>
                      </div>
                    </div>
                    <Chip tone={k.occupancyRate >= 85 ? "green" : k.occupancyRate >= 60 ? "amber" : "rose"}>
                      {pct(k.occupancyRate)}
                    </Chip>
                  </div>

                  <div className="mt-3">
                    <Progress value={k.occupancyRate} tone={k.occupancyRate >= 85 ? "green" : "amber"} />
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {[
                      ["وحدات", num(k.totalUnits)],
                      ["مؤجرة", num(k.occupied)],
                      ["فاضية", num(k.vacant)],
                      ...(allow("finance.view") ? [["الدخل", KWD(k.monthlyRentRoll, false)]] : [["أدوار", num(data.floors.filter((f) => f.buildingId === b.id).length)]]),
                    ].map(([l, v]) => (
                      <div key={l} className="rounded-xl bg-[var(--surface-2)] p-2">
                        <p className="display text-[14px] tabular-nums">{v}</p>
                        <p className="text-[10.5px] text-[var(--muted)]">{l}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-soft btn-sm flex-1" onClick={() => setOpenId(b.id)}>
                      <Icon name="eye" size={14} /> التفاصيل
                    </button>
                    <Link
                      href="/apartments"
                      onClick={() => setActiveBuilding(b.id)}
                      className="btn btn-ghost btn-sm flex-1"
                    >
                      <Icon name="grid" size={14} /> الشقق
                    </Link>
                    {allow("buildings.edit") && (
                      <button className="btn btn-ghost btn-icon !p-2" onClick={() => setEditing(b)} aria-label="تعديل">
                        <Icon name="edit" size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          icon="building"
          title="ما فيه عمارات"
          body="أضف عمارتك الأولى وحدد عدد الأدوار، ثم أضف الوحدات."
          action={allow("buildings.edit") ? <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> إضافة عمارة</button> : undefined}
        />
      )}

      {adding && <BuildingForm open onClose={() => setAdding(false)} />}
      {editing && <BuildingForm open onClose={() => setEditing(null)} building={editing} />}

      <Sheet open={!!building} onClose={() => setOpenId(null)} wide title={building?.name ?? ""}>
        {building && (
          <div className="space-y-4">
            <div className="card p-3">
              <p className="mb-1.5 text-[13px] font-extrabold">بيانات العمارة</p>
              <KeyVal k="المالك" v={building.ownerName || "—"} icon="user" />
              <KeyVal k="المنطقة" v={building.area || "—"} icon="building" />
              <KeyVal k="القطعة / الشارع" v={`${building.block || "—"} · ${building.street || "—"}`} icon="info" />
              <KeyVal k="رقم القسيمة" v={building.buildingNo || "—"} icon="door" />
              <KeyVal k="الرقم الآلي" v={<span dir="ltr">{building.paciNo || "—"}</span>} icon="idCard" />
              <KeyVal k="مساحة الأرض" v={building.landArea ? `${num(building.landArea)} م²` : "—"} icon="ruler" />
              <KeyVal k="المساحة المبنية" v={building.builtArea ? `${num(building.builtArea)} م²` : "—"} icon="ruler" />
              {building.notes && <KeyVal k="ملاحظات" v={building.notes} icon="file" />}
            </div>

            <div className="card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-extrabold">الأدوار ({floors.length})</p>
                {allow("buildings.edit") && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setAddFloor(true)}>
                    <Icon name="plus" size={14} /> دور
                  </button>
                )}
              </div>
              <ul className="space-y-1.5">
                {floors.map((f) => (
                  <li key={f.floorId} className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-2)] p-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[12px] font-extrabold shadow-[var(--sh-1)]">
                      {f.level < 0 ? "س" : f.level === 0 ? "أ" : f.level}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold">{f.name}</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {num(f.units.length)} وحدة · مؤجرة {num(f.occupied)} · فاضية {num(f.vacant)}
                      </p>
                    </div>
                    {allow("buildings.edit") && (
                      <button className="btn btn-icon btn-danger !p-1.5" onClick={() => removeFloor(f.floorId, f.name)} aria-label="حذف الدور">
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </li>
                ))}
                {!floors.length && <p className="py-4 text-center text-[12.5px] text-[var(--muted)]">ما فيه أدوار</p>}
              </ul>
            </div>

            {allow("docs.view") && (
              <DocsPanel ownerType="building" ownerId={building.id} buildingId={building.id} defaultKind="deed" title="وثائق العمارة" />
            )}

            <div className="flex gap-2">
              <button className="btn btn-soft btn-sm" onClick={() => { setActiveBuilding(building.id); setOpenId(null); }}>
                <Icon name="check" size={14} /> تعيينها كعمارة نشطة
              </button>
              {allow("buildings.edit") && (
                <button className="btn btn-danger btn-sm mr-auto" onClick={() => removeBuilding(building)}>
                  <Icon name="trash" size={14} /> حذف العمارة
                </button>
              )}
            </div>
          </div>
        )}
      </Sheet>

      {addFloor && building && <FloorForm open onClose={() => setAddFloor(false)} buildingId={building.id} />}
    </div>
  );
}
