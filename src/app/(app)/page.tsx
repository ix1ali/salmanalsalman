"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, kpis, scope } from "@/lib/selectors";
import { KWD, dateShort, monthAr, num, pct, thisPeriod } from "@/lib/format";
import { Progress } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icons";

export default function DashboardPage() {
  const { data, activeBuilding } = useStore();
  const { user, allow } = useAuth();

  const k = useMemo(() => kpis(data, activeBuilding), [data, activeBuilding]);
  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const ar = useMemo(() => arrears(data, s).slice(0, 5), [data, s]);

  const expiring = useMemo(() => {
    const now = Date.now();
    const lim = data.settings.contractAlertDays * 86400000;
    return s.contracts
      .filter((c) => c.status === "active")
      .map((c) => ({ c, left: new Date(c.endDate).getTime() - now }))
      .filter((x) => x.left >= 0 && x.left <= lim)
      .sort((a, b) => a.left - b.left)
      .slice(0, 3);
  }, [s.contracts, data.settings.contractAlertDays]);

  const buildingName = activeBuilding === "all" ? "كل العمارات" : data.buildings.find((b) => b.id === activeBuilding)?.name;
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);
  const remaining = Math.max(0, k.expectedThisMonth - k.collectedThisMonth);

  return (
    <div className="space-y-3">
      {/* الشقق */}
      <div className="anim-up overflow-hidden rounded-[22px] bg-[var(--primary)] p-5 text-white">
        <p className="text-[12.5px] text-white/70">أهلًا {user?.displayName}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold text-white/90">
          <Icon name="building" size={14} /> {buildingName}
        </p>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="display text-4xl leading-none">{num(k.occupied)}</p>
            <p className="mt-1 text-[12px] text-white/70">شقة مؤجرة من {num(k.totalUnits)}</p>
          </div>
          <div className="text-left">
            <p className="display text-2xl leading-none text-[var(--gold)]">{num(k.vacant)}</p>
            <p className="mt-1 text-[12px] text-white/70">فاضية</p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-700" style={{ width: `${k.occupancyRate}%` }} />
        </div>
        <p className="mt-1.5 text-[11.5px] text-white/70">نسبة الإشغال {pct(k.occupancyRate)}</p>
      </div>

      {/* إيجار الشهر */}
      {allow("finance.view") && (
        <Link href="/finances" className="card card-lg block p-4 transition hover:shadow-[var(--sh-2)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">إيجار {monthAr(thisPeriod())}</p>
            <span className="text-[12px] font-bold text-[var(--primary)]">افتح ‹</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="display text-[26px] leading-none text-[var(--ok)]">{KWD(k.collectedThisMonth, false)}</p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">تم تحصيله</p>
            </div>
            <div className="text-left">
              <p className="display text-[20px] leading-none text-[var(--gold-600)]">{KWD(remaining, false)}</p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">باقي</p>
            </div>
          </div>
          <div className="mt-3">
            <Progress value={k.collectionRate} tone={remaining ? "gold" : "green"} height={10} />
          </div>
        </Link>
      )}

      {/* اختصارات */}
      <div className="grid grid-cols-4 gap-2">
        {([
          ["/apartments", "grid", "الشقق"],
          allow("finance.view") && ["/finances", "wallet", "الإيجارات"],
          allow("reports.view") && ["/print", "print", "الطباعة"],
          allow("flags.view") && ["/flags", "alert", "التنبيهات"],
          ["/tenants", "users", "المستأجرون"],
        ].filter(Boolean) as [string, IconName, string][])
          .slice(0, 4)
          .map(([href, icon, label]) => (
            <Link key={href} href={href} className="card flex flex-col items-center gap-1.5 p-3 transition active:scale-[.96]">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary)]">
                <Icon name={icon} size={18} />
              </span>
              <span className="text-[11px] font-bold text-[var(--ink-2)]">{label}</span>
            </Link>
          ))}
      </div>

      {/* تنبيهات الشقق */}
      {allow("flags.view") && k.flaggedUnits > 0 && (
        <Link href="/flags" className="card flex items-center gap-3 border-r-4 border-r-[#d64550] p-3 transition hover:shadow-[var(--sh-2)]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--danger-050)] text-[#b3303b]">
            <Icon name="alert" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-extrabold">{num(k.flaggedUnits)} شقة عليها تنبيه</p>
            <p className="text-[11.5px] text-[var(--muted)]">اضغط لعرضها</p>
          </div>
          <Icon name="chevronLeft" size={16} className="text-[var(--muted)]" />
        </Link>
      )}

      {/* متأخرات */}
      {allow("finance.view") && ar.length > 0 && (
        <div className="card card-lg p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">ما دفعوا</p>
            <Link href="/finances?tab=arrears" className="text-[12px] font-bold text-[var(--primary)]">الكل ‹</Link>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {ar.map((a) => (
              <li key={a.contract.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--danger-050)] text-[11px] font-extrabold text-[#b3303b]">
                  {a.unit?.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{a.tenant?.name ?? "—"}</p>
                  <p className="text-[11.5px] text-[var(--muted)]">{a.missing.length} شهر</p>
                </div>
                <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-[#b3303b]">{KWD(a.amount, false)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* عقود تنتهي */}
      {allow("contracts.view") && expiring.length > 0 && (
        <div className="card card-lg p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">عقود تنتهي قريب</p>
            <Link href="/print" className="text-[12px] font-bold text-[var(--primary)]">طباعة ‹</Link>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {expiring.map(({ c, left }) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--gold-050)] text-[11px] font-extrabold text-[var(--gold-600)]">
                  {unitById.get(c.unitId)?.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{tenantById.get(c.tenantId)?.name ?? "—"}</p>
                  <p className="text-[11.5px] text-[var(--muted)]">ينتهي {dateShort(c.endDate)}</p>
                </div>
                <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-[var(--gold-600)]">
                  {Math.ceil(left / 86400000)} يوم
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
