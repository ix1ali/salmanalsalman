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
    }, { action: "إزالة تنبيه", detail: `شقة ${number}`, actor: user?.username });
    toast("تم شيل التنبيه");
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="التنبيهات"
        subtitle={`${num(flagged.length)} شقة عليها تنبيه`}
        icon="alert"
      />

      {flagged.length ? (
        <ul className="space-y-2">
          {flagged.map((u) => {
            const t = tenantOfUnit(data, u.id).tenant;
            const b = data.buildings.find((x) => x.id === u.buildingId);
            return (
              <li key={u.id} className="card overflow-hidden">
                <button
                  onClick={() => setOpenUnit(u.id)}
                  className="flex w-full items-start gap-3 p-3 text-right"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#d64550] text-[13px] font-extrabold text-white">
                    {u.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-extrabold text-[#b3303b]">{u.flagNote}</span>
                    <span className="block text-[11.5px] text-[var(--muted)]">
                      {b?.name} · {t?.name ?? "فاضية"} · منذ {dateShort(u.flaggedAt)}
                    </span>
                  </span>
                  <Icon name="chevronLeft" size={16} className="mt-1 shrink-0 text-[var(--muted)]" />
                </button>
                {allow("flags.edit") && (
                  <button
                    onClick={() => clear(u.id, u.number)}
                    className="w-full border-t border-[var(--line)] bg-[var(--surface-2)] py-2 text-[12.5px] font-extrabold text-[var(--ok)]"
                  >
                    <Icon name="check" size={14} className="ml-1 inline-block align-middle" />
                    تم الحل — شيل التنبيه
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty
          icon="checkCircle"
          title="ما فيه أي تنبيه"
          body="كل الشقق تمام. لتعليم شقة، افتحها من صفحة الشقق واضغط «علّم الشقة بتنبيه»."
        />
      )}

      <UnitSheet unitId={openUnit} onClose={() => setOpenUnit(null)} />
    </div>
  );
}
