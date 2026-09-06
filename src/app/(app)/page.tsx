"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, floorStats, kpis, lastPeriods, monthlySeries, scope } from "@/lib/selectors";
import { KWD, amount, dateShort, monthAr, monthsLabel, num, pct, thisPeriod } from "@/lib/format";
import { Money, Progress } from "@/components/ui";
import { BarChart, Donut, Gauge } from "@/components/Charts";
import { Icon, type IconName } from "@/components/Icons";

const HIJRI_FMT = new Intl.DateTimeFormat("ar-KW-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric", month: "long", year: "numeric",
});
const GREG_FMT = new Intl.DateTimeFormat("ar-KW-u-nu-latn", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});

export default function DashboardPage() {
  const { data, activeBuilding } = useStore();
  const { user, allow } = useAuth();

  const k = useMemo(() => kpis(data, activeBuilding), [data, activeBuilding]);
  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const ar = useMemo(() => arrears(data, s).slice(0, 4), [data, s]);
  const series = useMemo(() => monthlySeries(data, activeBuilding, 6), [data, activeBuilding]);

  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;
  const floors = useMemo(() => floorStats(data, buildingId), [data, buildingId]);

  const expiring = useMemo(() => {
    const now = Date.now();
    const lim = data.settings.contractAlertDays * 86400000;
    return s.contracts
      .filter((c) => c.status === "active")
      .map((c) => ({ c, left: new Date(c.endDate).getTime() - now }))
      .filter((x) => x.left >= 0 && x.left <= lim)
      .sort((a, b) => a.left - b.left);
  }, [s.contracts, data.settings.contractAlertDays]);

  /* نسبة التحصيل شهرًا بشهر — المستحق يُحسب من العقود السارية في ذلك الشهر */
  const trend = useMemo(
    () =>
      lastPeriods(6).map((p) => {
        const due = s.contracts
          .filter((c) => c.status !== "terminated" && c.startDate.slice(0, 7) <= p && c.endDate.slice(0, 7) >= p)
          .reduce((a, c) => a + c.rent, 0);
        const got = s.payments.filter((x) => x.period === p).reduce((a, x) => a + x.amount, 0);
        return { period: p, due, got, rate: due ? Math.min(100, (got / due) * 100) : 0 };
      }),
    [s.contracts, s.payments]
  );

  const all = useMemo(() => kpis(data, "all"), [data]);

  const buildingName = activeBuilding === "all" ? "كل العقارات" : data.buildings.find((b) => b.id === activeBuilding)?.name;
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);

  const remaining = Math.max(0, k.expectedThisMonth - k.collectedThisMonth);
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 5 ? "مساء الخير" : hour < 12 ? "صباح الخير" : hour < 17 ? "طاب يومك" : "مساء الخير";

  const attention = ar.length > 0 || expiring.length > 0 || k.flaggedUnits > 0;

  return (
    <div className="space-y-3">
      {/* ======================= الترحيب والتاريخ ======================= */}
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="text-[13px] text-[var(--muted)]">{greet}</p>
          <h1 className="truncate text-[20px] leading-tight">{user?.displayName}</h1>
        </div>
        <div className="shrink-0 text-left">
          <p className="text-[11.5px] font-bold text-[var(--ink-2)]">{GREG_FMT.format(now)}</p>
          <p className="text-[11px] text-[var(--muted)]">{HIJRI_FMT.format(now)} هـ</p>
        </div>
      </div>

      {/* ================= الإشغال وتحصيل الشهر في لوح واحد ================= */}
      <section className="anim-up overflow-hidden rounded-xl border border-[var(--line)]">
        <div className="bg-[var(--primary)] p-4 text-white">
          <div className="flex items-center gap-4">
            <Gauge value={k.occupancyRate} size={92} label="إشغال" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[12px] text-white/60">
                <Icon name="building" size={13} /> {buildingName}
              </p>
              <p className="num mt-1 text-[28px] font-bold leading-none">
                {num(k.occupied)}<span className="text-[14px] text-white/50"> / {num(k.totalUnits)}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-white/60">وحدة مؤجرة</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11.5px] font-semibold">
                  <span className="num text-[var(--gold)]">{num(k.vacant)}</span> شاغرة
                </span>
                {k.flaggedUnits > 0 && (
                  <Link href="/flags" className="rounded-md bg-white/10 px-2 py-0.5 text-[11.5px] font-semibold transition hover:bg-white/20">
                    <span className="num text-[#e8a09a]">{num(k.flaggedUnits)}</span> ملاحظة
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {allow("finance.view") && (
          <Link href="/finances" className="block bg-[var(--surface)] transition hover:bg-[var(--surface-2)]">
            <div className="flex items-baseline justify-between px-4 pt-3">
              <p className="text-[13px] font-bold">تحصيل {monthAr(thisPeriod())}</p>
              <span className="t-xs font-semibold text-[var(--primary)]">التفاصيل ‹</span>
            </div>
            <div className="px-4 pt-2">
              <Progress value={k.collectionRate} tone={remaining ? "gold" : "green"} height={6} />
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

      {/* ============================== اختصارات ============================== */}
      <div className="grid grid-cols-4 gap-2">
        {([
          ["/apartments", "grid", "الشقق"],
          allow("finance.view") && ["/finances", "wallet", "المالية"],
          allow("flags.view") && ["/flags", "alert", "التنبيهات"],
          ["/tenants", "users", "المستأجرون"],
        ].filter(Boolean) as [string, IconName, string][]).map(([href, icon, label]) => (
          <Link key={href} href={href} className="card flex flex-col items-center gap-1.5 p-3 transition active:scale-[.96]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary)]">
              <Icon name={icon} size={19} />
            </span>
            <span className="text-[11px] font-bold text-[var(--ink-2)]">{label}</span>
          </Link>
        ))}
      </div>

      {/* ========================== إشغال الأدوار ========================== */}
      {floors.length > 0 && (
        <div className="card card-lg p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">إشغال الأدوار</p>
            <Link href="/apartments" className="text-[12px] font-bold text-[var(--primary)]">الشقق ‹</Link>
          </div>
          <ul className="space-y-2">
            {floors.filter((f) => f.units.length).map((f) => {
              const rate = (f.occupied / f.units.length) * 100;
              return (
                <li key={f.floorId} className="flex items-center gap-2.5">
                  <span className="w-[52px] shrink-0 text-[12px] font-bold text-[var(--ink-2)]">{f.name}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                    <span
                      className="block h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${rate}%`, background: rate === 100 ? "var(--ok)" : "var(--primary)" }}
                    />
                  </span>
                  <span className="w-[42px] shrink-0 text-left text-[11.5px] font-extrabold tabular-nums text-[var(--muted)]">
                    {num(f.occupied)}/{num(f.units.length)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* =============================== الرسوم =============================== */}
      {allow("finance.view") && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="card card-lg p-4">
            <p className="mb-2.5 text-[14px] font-extrabold">نسبة التحصيل — آخر ٦ أشهر</p>
            <div className="flex items-end justify-between gap-1.5">
              {trend.map((t) => (
                <div key={t.period} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="num text-[10.5px] font-bold text-[var(--ink-2)]">{Math.round(t.rate)}%</span>
                  <span className="relative flex h-24 w-full max-w-[26px] items-end overflow-hidden rounded-md bg-[var(--surface-3)]">
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
            <p className="t-xs mt-2.5 border-t border-[var(--line)] pt-2 text-[var(--muted)]">
              تحصيل هذا الشهر {pct(k.collectionRate)} من {KWD(k.expectedThisMonth)}
            </p>
          </div>

          <div className="card card-lg p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[14px] font-extrabold">الدخل والمصروفات</p>
              <Link href="/finances?tab=expenses" className="text-[12px] font-bold text-[var(--primary)]">المصروفات ‹</Link>
            </div>
            <BarChart
              points={series.map((m) => ({ label: monthAr(m.period).split(" ")[0].slice(0, 4), a: m.income, b: m.expense }))}
              aLabel="الدخل" bLabel="المصروفات"
            />
          </div>

          <div className="card card-lg p-4">
            <p className="mb-2.5 text-[14px] font-extrabold">توزيع الوحدات</p>
            <Donut
              slices={[
                { label: "مؤجرة", value: k.occupied - k.flaggedUnits > 0 ? k.occupied - k.flaggedUnits : k.occupied, color: "var(--ok)" },
                { label: "شاغرة", value: k.vacant, color: "var(--gold)" },
                ...(k.flaggedUnits > 0 ? [{ label: "عليها ملاحظة", value: k.flaggedUnits, color: "var(--danger)" }] : []),
              ]}
              center={`${num(k.totalUnits)}`}
              sub="وحدة"
            />
          </div>

          <div className="card card-lg p-4">
            <p className="mb-2.5 text-[14px] font-extrabold">صافي الشهر</p>
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--line)]">
              {[
                ["المحصَّل", k.collectedThisMonth, "var(--ok)"],
                ["المصروفات", k.expensesThisMonth, "var(--gold-600)"],
                ["الصافي", k.netThisMonth, k.netThisMonth >= 0 ? "var(--primary)" : "var(--danger)"],
              ].map(([l, v, c]) => (
                <div key={l as string} className="px-2 text-center">
                  <p className="num text-[15px] font-bold leading-none" style={{ color: c as string }}>
                    {amount(v as number)}<span className="text-[9.5px] font-semibold opacity-55"> د.ك</span>
                  </p>
                  <p className="t-xs mt-1 text-[var(--muted)]">{l as string}</p>
                </div>
              ))}
            </div>
            <p className="t-xs mt-3 border-t border-[var(--line)] pt-2 leading-relaxed text-[var(--muted)]">
              الإيجار الشهري المتعاقد {KWD(k.monthlyRentRoll)} على {num(k.tenantsCount)} مستأجرًا.
            </p>
          </div>
        </div>
      )}

      {/* =========================== يحتاج انتباهك =========================== */}
      {attention && (
        <div className="card card-lg overflow-hidden">
          <p className="px-4 pb-1 pt-3.5 text-[14px] font-extrabold">يحتاج انتباهك</p>
          <div className="divide-y divide-[var(--line)]">
            {allow("finance.view") && k.arrearsCount > 0 && (
              <AlertRow
                href="/finances?tab=sheet" icon="alert" tone="rose"
                title={`${num(k.arrearsCount)} مستأجر لم يسدّد`}
                right={<Money v={k.arrearsTotal} size="sm" tone="#b3303b" />}
              />
            )}
            {allow("contracts.view") && expiring.length > 0 && (
              <AlertRow
                href="/finances?tab=contracts" icon="calendar" tone="gold"
                title={`${num(expiring.length)} عقد يقارب على الانتهاء`}
                right={<span className="text-[12px] font-bold text-[var(--gold-600)]">خلال {data.settings.contractAlertDays} يومًا</span>}
              />
            )}
            {allow("flags.view") && k.flaggedUnits > 0 && (
              <AlertRow
                href="/flags" icon="alert" tone="navy"
                title={`${num(k.flaggedUnits)} وحدة عليها ملاحظة`}
                right={<span className="text-[12px] font-bold text-[var(--primary)]">عرض</span>}
              />
            )}
          </div>

          {allow("finance.view") && ar.length > 0 && (
            <div className="border-t border-[var(--line)]">
              <p className="px-4 pb-1 pt-2.5 text-[11.5px] font-bold text-[var(--muted)]">أعلى المتأخرات</p>
              <ul className="divide-y divide-[var(--line)]">
                {ar.map((a) => (
                  <li key={a.contract.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--danger-050)] text-[11px] font-extrabold text-[#b3303b]">
                      {a.unit?.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{a.tenant?.name ?? "—"}</p>
                      <p className="text-[11.5px] text-[var(--muted)]">{monthsLabel(a.missing.length)}</p>
                    </div>
                    <Money v={a.amount} size="sm" className="shrink-0" tone="#b3303b" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ==================== العقود التي تقارب على الانتهاء ==================== */}
      {allow("contracts.view") && expiring.length > 0 && (
        <div className="card card-lg p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">عقود تقارب على الانتهاء</p>
            <Link href="/finances?tab=contracts" className="text-[12px] font-bold text-[var(--primary)]">الكل ‹</Link>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {expiring.slice(0, 4).map(({ c, left }) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--gold-050)] text-[11px] font-extrabold text-[var(--gold-600)]">
                  {unitById.get(c.unitId)?.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{tenantById.get(c.tenantId)?.name ?? "—"}</p>
                  <p className="text-[11.5px] text-[var(--muted)]">ينتهي {dateShort(c.endDate)}</p>
                </div>
                <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-[var(--gold-600)]">
                  {num(Math.ceil(left / 86400000))} يومًا
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ========================= مجموع كل العقارات ========================= */}
      {data.buildings.length > 1 && (
        <div className="card p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-extrabold text-[var(--muted)]">
            <Icon name="layers" size={14} /> كل العقارات ({num(data.buildings.length)})
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {[
              ["الوحدات", num(all.totalUnits)],
              ["مؤجرة / شاغرة", `${num(all.occupied)} / ${num(all.vacant)}`],
              ["دخل الشهر", KWD(all.collectedThisMonth)],
              ["الصافي", KWD(all.netThisMonth)],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="num text-[13.5px] font-bold text-[var(--ink)]">{v}</p>
                <p className="t-xs text-[var(--muted)]">{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="pb-2 text-center text-[11px] text-[var(--muted)]">
        {data.settings.orgName} · {num(data.units.length)} وحدة · {KWD(k.monthlyRentRoll)} إيجار شهري متعاقد
      </p>
    </div>
  );
}

function AlertRow({
  href, icon, title, right, tone,
}: { href: string; icon: IconName; title: string; right: React.ReactNode; tone: "rose" | "gold" | "navy" }) {
  const c = {
    rose: { bg: "var(--danger-050)", fg: "#b3303b" },
    gold: { bg: "var(--gold-050)", fg: "var(--gold-600)" },
    navy: { bg: "var(--primary-050)", fg: "var(--primary)" },
  }[tone];
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-2)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: c.bg, color: c.fg }}>
        <Icon name={icon} size={18} />
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-bold">{title}</p>
      {right}
      <Icon name="chevronLeft" size={15} className="shrink-0 text-[var(--muted)]" />
    </Link>
  );
}
