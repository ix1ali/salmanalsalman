"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, floorStats, kpis, monthlySeries, scope } from "@/lib/selectors";
import { KWD, amount, dateShort, monthAr, monthsLabel, num, pct, thisPeriod } from "@/lib/format";
import { Money, Progress } from "@/components/ui";
import { BarChart, Gauge } from "@/components/Charts";
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

  const buildingName = activeBuilding === "all" ? "كل العقارات" : data.buildings.find((b) => b.id === activeBuilding)?.name;
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);

  const remaining = Math.max(0, k.expectedThisMonth - k.collectedThisMonth);
  const net = k.collectedThisMonth - k.expensesThisMonth;
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 5 ? "مساء الخير" : hour < 12 ? "صباح الخير" : hour < 17 ? "طاب يومك" : "مساء الخير";

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

      {/* ============================ البطاقة الرئيسية ============================ */}
      <div className="anim-up relative overflow-hidden rounded-[24px] bg-[var(--primary)] p-5 text-white shadow-[var(--sh-2)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(201,153,46,.35), transparent 68%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-10 h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,.10), transparent 65%)" }}
        />

        <div className="relative flex items-center gap-4">
          <Gauge value={k.occupancyRate} size={122} label="إشغال" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[12.5px] text-white/70">
              <Icon name="building" size={14} /> {buildingName}
            </p>
            <p className="display mt-1.5 text-[34px] leading-none">
              {num(k.occupied)}<span className="text-[16px] text-white/60"> / {num(k.totalUnits)}</span>
            </p>
            <p className="mt-1 text-[12px] text-white/70">وحدة مؤجرة</p>

            <div className="mt-3 flex gap-2">
              <span className="rounded-lg bg-white/12 px-2.5 py-1 text-[11.5px] font-bold">
                <span className="text-[var(--gold)]">{num(k.vacant)}</span> شاغرة
              </span>
              {k.flaggedUnits > 0 && (
                <span className="rounded-lg bg-white/12 px-2.5 py-1 text-[11.5px] font-bold">
                  <span className="text-[#ff9aa4]">{num(k.flaggedUnits)}</span> ملاحظة
                </span>
              )}
            </div>
          </div>
        </div>

        {allow("finance.view") && (
          <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3.5 text-center">
            {[
              ["المحصَّل", k.collectedThisMonth, "#7ee0b0"],
              ["المتبقي", remaining, "var(--gold)"],
              ["صافي الشهر", net, net >= 0 ? "#ffffff" : "#ff9aa4"],
            ].map(([l, v, c]) => (
              <div key={l as string}>
                <p className="display text-[16px] leading-none tabular-nums" style={{ color: c as string }}>
                  {amount(v as number)}
                  <span className="text-[10px] opacity-60"> د.ك</span>
                </p>
                <p className="mt-1 text-[10.5px] text-white/60">{l as string}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================ تحصيل الشهر ============================ */}
      {allow("finance.view") && (
        <Link href="/finances" className="card card-lg block p-4 transition hover:shadow-[var(--sh-2)]">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">تحصيل {monthAr(thisPeriod())}</p>
            <span className="text-[12px] font-bold text-[var(--primary)]">التفاصيل ‹</span>
          </div>
          <Progress value={k.collectionRate} tone={remaining ? "gold" : "green"} height={12} />
          <div className="mt-2.5 flex items-center justify-between text-[12.5px]">
            <span className="font-bold" style={{ color: remaining ? "var(--gold-600)" : "var(--ok)" }}>
              {remaining ? <>المتبقي <Money v={remaining} size="sm" tone="var(--gold-600)" /></> : "تم تحصيل كامل الإيجارات"}
            </span>
            <span className="text-[var(--muted)]">{pct(k.collectionRate)}</span>
          </div>
        </Link>
      )}

      {/* ============================== اختصارات ============================== */}
      <div className="grid grid-cols-4 gap-2">
        {([
          ["/apartments", "grid", "الشقق"],
          allow("finance.view") && ["/finances", "wallet", "المالية"],
          allow("reports.view") && ["/print", "print", "الطباعة"],
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

      {/* =========================== يحتاج انتباهك =========================== */}
      {(ar.length > 0 || expiring.length > 0 || k.flaggedUnits > 0) && (
        <div className="card card-lg overflow-hidden">
          <p className="px-4 pb-1 pt-3.5 text-[14px] font-extrabold">يحتاج انتباهك</p>
          <div className="divide-y divide-[var(--line)]">
            {allow("finance.view") && k.arrearsCount > 0 && (
              <AlertRow
                href="/finances?tab=arrears" icon="alert" tone="rose"
                title={`${num(k.arrearsCount)} مستأجر لم يسدّد`}
                right={<Money v={k.arrearsTotal} size="sm" tone="#b3303b" />}
              />
            )}
            {allow("contracts.view") && expiring.length > 0 && (
              <AlertRow
                href="/print" icon="calendar" tone="gold"
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
        </div>
      )}

      {/* ======================== أعلى المتأخرات ======================== */}
      {allow("finance.view") && ar.length > 0 && (
        <div className="card card-lg p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">أعلى المتأخرات</p>
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
                  <p className="text-[11.5px] text-[var(--muted)]">{monthsLabel(a.missing.length)}</p>
                </div>
                <Money v={a.amount} size="sm" className="shrink-0" tone="#b3303b" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ==================== العقود التي تقارب على الانتهاء ==================== */}
      {allow("contracts.view") && expiring.length > 0 && (
        <div className="card card-lg p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">عقود تقارب على الانتهاء</p>
            <Link href="/print" className="text-[12px] font-bold text-[var(--primary)]">طباعة ‹</Link>
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

      {/* ============================== الرسم ============================== */}
      {allow("finance.view") && (
        <div className="card card-lg p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-extrabold">الدخل والمصروفات</p>
            <Link href="/finances?tab=profit" className="text-[12px] font-bold text-[var(--primary)]">الأرباح ‹</Link>
          </div>
          <BarChart
            points={series.map((m) => ({ label: monthAr(m.period).split(" ")[0].slice(0, 4), a: m.income, b: m.expense }))}
            aLabel="الدخل" bLabel="المصروفات"
          />
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
