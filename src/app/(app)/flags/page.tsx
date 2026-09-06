"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { tenantOfUnit } from "@/lib/selectors";
import { dateShort, num } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icons";
import UnitSheet from "@/components/UnitSheet";

export default function FlagsPage() {
  const { data, update, activeBuilding } = useStore();
  const { user, allow } = useAuth();
  const toast = useToast();
  const [openUnit, setOpenUnit] = useState<string | null>(null);

  const flagged = useMemo(
    () =>
      data.units
        .filter((u) => u.flagged && (activeBuilding === "all" || u.buildingId === activeBuilding))
        .sort((a, b) => (b.flaggedAt ?? "").localeCompare(a.flaggedAt ?? "")),
    [data.units, activeBuilding]
  );

  const clear = (id: string, number: string) => {
    update((d) => {
      const u = d.units.find((x) => x.id === id);
      if (u) { u.flagged = false; u.flagNote = undefined; u.flaggedAt = undefined; }
    }, { action: "إزالة تنبيه", detail: `الوحدة ${number}`, actor: user?.username });
    toast("تمت إزالة التنبيه");
  };

  return (
    <div className="space-y-3">
      <PageHeader title="التنبيهات" subtitle={`${num(flagged.length)} وحدة عليها ملاحظة`} />

      {flagged.length ? (
        <div className="panel">
          {flagged.map((u) => {
            const t = tenantOfUnit(data, u.id).tenant;
            const b = data.buildings.find((x) => x.id === u.buildingId);
            return (
              <div key={u.id} className="row !items-start">
                <span className="num grid h-8 w-9 shrink-0 place-items-center rounded-md bg-[var(--danger-050)] text-[11.5px] font-bold text-[var(--danger)]">
                  {u.number}
                </span>
                <button onClick={() => setOpenUnit(u.id)} className="min-w-0 flex-1 text-right">
                  <span className="block text-[13.5px] font-semibold">{u.flagNote}</span>
                  <span className="t-xs block truncate text-[var(--muted)]">
                    {b?.name} · {t?.name ?? "شاغرة"} · منذ {dateShort(u.flaggedAt)}
                  </span>
                </button>
                {allow("flags.edit") && (
                  <button
                    onClick={() => clear(u.id, u.number)}
                    className="btn btn-ghost btn-sm shrink-0 !text-[var(--ok)]"
                  >
                    <Icon name="check" size={13} /> تمت المعالجة
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <Empty
            icon="checkCircle"
            title="لا توجد ملاحظات"
            body="جميع الوحدات في وضع سليم. لإضافة ملاحظة، افتح الوحدة من صفحة الشقق واختر «إضافة ملاحظة تنبيه»."
          />
        </div>
      )}

      <UnitSheet unitId={openUnit} onClose={() => setOpenUnit(null)} />
    </div>
  );
}
