"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, floorStats, kpis, lastPeriods, scope } from "@/lib/selectors";
import { amount, dateShort, monthAr, monthsLabel, num, pct, thisPeriod } from "@/lib/format";
import { Money, Progress } from "@/components/ui";
import { Gauge } from "@/components/Charts";
import { Icon, type IconName } from "@/components/Icons";

const GREG_FMT = new Intl.DateTimeFormat("ar-KW-u-nu-latn", {
  weekday: "long", day: "numeric", month: "long",
});

export default function DashboardPage() {
  const { data, activeBuilding } = useStore();
  const { user, allow } = useAuth();

  const k = useMemo(() => kpis(data, activeBuilding), [data, activeBuilding]);
  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const ar = useMemo(() => arrears(data, s).slice(0, 3), [data, s]);

  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;
  const floors = useMemo(
    () => floorStats(data, buildingId).filter((f) => f.units.length),
    [data, buildingId]
  );

  const expiring = useMemo(() => {
    const now = Date.now();
    const lim = data.settings.contractAlertDays * 86400000;
    return s.contracts
      .filter((c) => c.status === "active")
      .map((c) => ({ c, left: new Date(c.endDate).getTime() - now }))
      .filter((x) => x.left >= 0 && x.left <= lim)
      .sort((a, b) => a.left - b.left);
  }, [s.contracts, data.settings.contractAlertDays]);

  /* نسبة التحصيل شهرًا بشهر — المستحق من العقود السارية في ذلك الشهر */
  const trend = useMemo(
    () =>
      lastPeriods(6).map((p) => {
        const due = s.contracts
          .filter((c) => c.status !== "terminated" && c.startDate.slice(0, 7) <= p && c.endDate.slice(0, 7) >= p)
          .reduce((a, c) => a + c.rent, 0);
        const got = s.payments.filter((x) => x.period === p).reduce((a, x) => a + x.amount, 0);
        return { period: p, rate: due ? Math.min(100, (got / due) * 100) : 0 };
      }),
    [s.contracts, s.payments]
  );

  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);

  const remaining = Math.max(0, k.expectedThisMonth - k.collectedThisMonth);
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 5 ? "مساء الخير" : hour < 12 ? "صباح الخير" : hour < 17 ? "طاب يومك" : "مساء الخير";

  const needsAttention = k.arrearsCount > 0 || k.flaggedUnits > 0;

  return (
    <div className="space-y-3">
      {/* ============================== الترحيب ============================== */}
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <h1 className="truncate text-[19px] leading-tight">
          {greet}، <span className="font-bold">{user?.displayName}</span>
        </h1>
        <p className="shrink-0 text-[11.5px] text-[var(--muted)]">{GREG_FMT.format(now)}</p>
      </div>

      {/* ==================== الإشغال وتحصيل الشهر ==================== */}
      <section className="anim-up overflow-hidden rounded-xl border border-[var(--line)]">
        <div className="flex items-center gap-4 bg-[var(--primary)] p-4 text-white">
          <Gauge value={k.occupancyRate} size={84} label="إشغال" />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <div>
              <p className="num text-[22px] font-bold leading-none">
                {num(k.occupied)}<span className="text-[13px] text-white/45"> / {num(k.totalUnits)}</span>
              </p>
              <p className="mt-1 text-[11.5px] text-white/60">وحدة مؤجرة</p>
            </div>

            <Link href="/apartments" className="transition hover:opacity-80">
              <p className="num text-[22px] font-bold leading-none text-[var(--gold)]">{num(k.vacant)}</p>
              <p className="mt-1 flex items-center gap-1 text-[11.5px] text-white/60">
                شاغرة {k.vacant > 0 && <Icon name="chevronLeft" size={11} />}
              </p>
            </Link>

            <div className="col-span-2 border-t border-white/10 pt-2.5 sm:col-span-1 sm:border-0 sm:pt-0">
              <p className="num text-[22px] font-bold leading-none">
                {amount(k.monthlyRentRoll)}<span className="text-[11px] text-white/45"> د.ك</span>
              </p>
              <p className="mt-1 text-[11.5px] text-white/60">إيجار الشهر المتعاقد</p>
            </div>
          </div>
        </div>

        {allow("finance.view") && (
          <Link href="/finances" className="block bg-[var(--surface)] transition hover:bg-[var(--surface-2)]">
            <div className="flex items-baseline justify-between px-4 pt-3">
              <p className="text-[13px] font-bold">تحصيل {monthAr(thisPeriod())}</p>
              <span className="t-xs font-semibold text-[var(--primary)]">{pct(k.collectionRate)}</span>
            </div>
            <div className="px-4 pt-2">
              <Progress value={k.collectionRate} tone={remaining ? "gold" : "green"} height={5} />
            </div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-[var(--line)] border-t border-[var(--line)]">
              {[
                ["المستحق", k.expectedThisMonth, "var(--ink)"],
                ["المحصَّل", k.collectedThisMonth, "var(--ok)"],
                ["المتبقي", remaining, remaining ? "var(--danger)" : "var(--muted)"],
              ].map(([l, v, c]) => (
                <div key={l as string} className="px-2 py-2.5 text-center">
                  <p className="num text-[15px] font-bold leading-none" style={{ color: c as string }}>
                    {amount(v as number)}<span className="text-[9.5px] font-semibold opacity-55"> د.ك</span>
                  </p>
                  <p className="t-xs mt-1 text-[var(--muted)]">{l as string}</p>
                </div>
              ))}
            </div>
          </Link>
        )}
      </section>

      {/* ============================ إشغال الأدوار ============================ */}
      {floors.length > 0 && (
        <section className="card p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold">إشغال الأدوار</h2>
            <Link href="/apartments" className="t-xs font-bold text-[var(--primary)]">الشقق ‹</Link>
          </div>
          <ul className="space-y-2">
            {floors.map((f) => {
              const rate = (f.occupied / f.units.length) * 100;
              return (
                <li key={f.floorId} className="flex items-center gap-2.5">
                  <span className="w-[48px] shrink-0 text-[12px] font-bold text-[var(--ink-2)]">{f.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <span
                      className="block h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${rate}%`, background: rate === 100 ? "var(--ok)" : "var(--primary)" }}
                    />
                  </span>
                  <span className="num w-[38px] shrink-0 text-left text-[11.5px] font-bold text-[var(--muted)]">
                    {num(f.occupied)}/{num(f.units.length)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ========================== نسبة التحصيل ========================== */}
      {allow("finance.view") && (
        <section className="card p-4">
          <h2 className="mb-3 text-[14px] font-extrabold">نسبة التحصيل — آخر ٦ أشهر</h2>
          <div className="flex items-end justify-between gap-2">
            {trend.map((t) => (
              <div key={t.period} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="num text-[10.5px] font-bold text-[var(--ink-2)]">{Math.round(t.rate)}%</span>
                <span className="flex h-20 w-full max-w-[24px] items-end overflow-hidden rounded-md bg-[var(--surface-3)]">
                  <span
                    className="w-full rounded-md transition-[height] duration-700"
                    style={{
                      height: `${Math.max(3, t.rate)}%`,
                      background: t.rate >= 95 ? "var(--ok)" : t.rate >= 60 ? "var(--primary)" : "var(--gold)",
                    }}
                  />
                </span>
                <span className="truncate text-[10px] font-semibold text-[var(--muted)]">
                  {monthAr(t.period).split(" ")[0].slice(0, 4)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================== يحتاج انتباهك =========================== */}
      {needsAttention && (
        <section className="card overflow-hidden">
          <h2 className="px-4 pb-1 pt-3.5 text-[14px] font-extrabold">يحتاج انتباهك</h2>
          <div className="divide-y divide-[var(--line)]">
            {allow("finance.view") && k.arrearsCount > 0 && (
              <AlertRow
                href="/finances" icon="alert" tone="rose"
                title={`${num(k.arrearsCount)} مستأجر لم يسدّد`}
                right={<Money v={k.arrearsTotal} size="sm" tone="#b3303b" />}
              />
            )}
            {allow("flags.view") && k.flaggedUnits > 0 && (
              <AlertRow
                href="/flags" icon="alert" tone="navy"
                title={`${num(k.flaggedUnits)} وحدة عليها ملاحظة`}
                right={<Icon name="chevronLeft" size={15} className="text-[var(--muted)]" />}
              />
            )}
          </div>

          {allow("finance.view") && ar.length > 0 && (
            <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {ar.map((a) => (
                <li key={a.contract.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="num grid h-8 w-9 shrink-0 place-items-center rounded-md bg-[var(--danger-050)] text-[11px] font-bold text-[#b3303b]">
                    {a.unit?.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{a.tenant?.name ?? "—"}</span>
                    <span className="t-xs block text-[var(--muted)]">{monthsLabel(a.missing.length)}</span>
                  </span>
                  <Money v={a.amount} size="sm" className="shrink-0" tone="#b3303b" />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ====================== عقود تقارب على الانتهاء ====================== */}
      {allow("contracts.view") && expiring.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
            <h2 className="text-[14px] font-extrabold">عقود تقارب على الانتهاء</h2>
            <Link href="/finances?tab=contracts" className="t-xs font-bold text-[var(--primary)]">الكل ‹</Link>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {expiring.slice(0, 3).map(({ c, left }) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="num grid h-8 w-9 shrink-0 place-items-center rounded-md bg-[var(--gold-050)] text-[11px] font-bold text-[var(--gold-600)]">
                  {unitById.get(c.unitId)?.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{tenantById.get(c.tenantId)?.name ?? "—"}</span>
                  <span className="t-xs block text-[var(--muted)]">ينتهي {dateShort(c.endDate)}</span>
                </span>
                <span className="num shrink-0 text-[12px] font-bold text-[var(--gold-600)]">
                  {num(Math.ceil(left / 86400000))} يومًا
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* لا شيء يحتاج انتباهك ولا عقود تنتهي — رسالة قصيرة بدل فراغ */}
      {!needsAttention && expiring.length === 0 && (
        <p className="card flex items-center justify-center gap-2 p-4 text-[13px] font-semibold text-[var(--muted)]">
          <Icon name="checkCircle" size={16} className="text-[var(--ok)]" />
          لا شيء يحتاج انتباهك اليوم
        </p>
      )}

    </div>
  );
}

function AlertRow({
  href, icon, title, right, tone,
}: { href: string; icon: IconName; title: string; right: React.ReactNode; tone: "rose" | "navy" }) {
  const c = {
    rose: { bg: "var(--danger-050)", fg: "#b3303b" },
    navy: { bg: "var(--primary-050)", fg: "var(--primary)" },
  }[tone];
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-2)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: c.bg, color: c.fg }}>
        <Icon name={icon} size={17} />
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-bold">{title}</p>
      {right}
    </Link>
  );
}
