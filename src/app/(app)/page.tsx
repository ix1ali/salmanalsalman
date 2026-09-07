"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, kpis, lastPeriods, scope } from "@/lib/selectors";
import { amount, dateShort, monthAr, monthsLabel, num, thisPeriod } from "@/lib/format";
import { Money } from "@/components/ui";
import { Gauge } from "@/components/Charts";
import { Icon, type IconName } from "@/components/Icons";
import { useBuildingPhoto } from "@/components/BuildingPhoto";

const DATE_FMT = new Intl.DateTimeFormat("ar-KW-u-nu-latn", {
  weekday: "long", day: "numeric", month: "long",
});

export default function DashboardPage() {
  const { data, activeBuilding } = useStore();
  const { user, allow } = useAuth();

  const k = useMemo(() => kpis(data, activeBuilding), [data, activeBuilding]);
  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const ar = useMemo(() => arrears(data, s).slice(0, 3), [data, s]);

  const building = useMemo(
    () => (activeBuilding === "all" ? data.buildings[0] : data.buildings.find((b) => b.id === activeBuilding)),
    [data.buildings, activeBuilding]
  );
  // الصورة تخصّ العقار المفتوح وحده
  const photo = useBuildingPhoto(building?.photo);

  const expiring = useMemo(() => {
    const now = Date.now();
    const lim = data.settings.contractAlertDays * 86400000;
    return s.contracts
      .filter((c) => c.status === "active")
      .map((c) => ({ c, left: new Date(c.endDate).getTime() - now }))
      .filter((x) => x.left >= 0 && x.left <= lim)
      .sort((a, b) => a.left - b.left);
  }, [s.contracts, data.settings.contractAlertDays]);

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

  const remaining = Math.max(0, k.expectedThisMonth - k.collectedThisMonth);
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 5 ? "مساء الخير" : hour < 12 ? "صباح الخير" : hour < 17 ? "طاب يومك" : "مساء الخير";
  const monthName = monthAr(thisPeriod()).split(" ")[0];

  const attention = k.arrearsCount > 0 || k.flaggedUnits > 0 || expiring.length > 0;

  return (
    <div className="space-y-3">
      {/* ============================== الترحيب ============================== */}
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <h1 className="truncate text-[19px] leading-tight">
          {greet}، <span className="font-bold">{user?.displayName}</span>
        </h1>
        <p className="shrink-0 text-[11.5px] text-[var(--muted)]">{DATE_FMT.format(now)}</p>
      </div>

      {/* ========================= العقار وصورة واجهته ========================= */}
      <section className="anim-up relative h-[150px] overflow-hidden rounded-2xl">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "50% 38%" }} />
        ) : (
          <div className="absolute inset-0 bg-[var(--primary)]" />
        )}
        {/* حجاب مزدوج: من اليمين حيث يبدأ النص، ومن الأسفل حيث الأرقام */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to left, rgba(7,45,43,.94) 0%, rgba(7,45,43,.74) 42%, rgba(7,45,43,.20) 100%)," +
              "linear-gradient(to top, rgba(7,45,43,.80) 0%, rgba(7,45,43,0) 62%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-4 text-white">
          <div>
            <p className="flex items-center gap-1.5 text-[11.5px] text-white/60">
              <Icon name="building" size={13} /> عقار
            </p>
            <h2 className="mt-0.5 text-[20px] font-bold leading-tight text-white">{building?.name ?? "—"}</h2>
          </div>
          <div className="flex items-end gap-5">
            <div>
              <p className="num text-[24px] font-bold leading-none">
                {num(k.occupied)}<span className="text-[13px] text-white/45"> / {num(k.totalUnits)}</span>
              </p>
              <p className="mt-1 text-[11.5px] text-white/60">مؤجرة</p>
            </div>
            <Link href="/apartments" className="transition hover:opacity-80">
              <p className="num text-[24px] font-bold leading-none text-[var(--gold)]">{num(k.vacant)}</p>
              <p className="mt-1 flex items-center gap-1 text-[11.5px] text-white/60">
                شاغرة <Icon name="chevronLeft" size={11} />
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* ========================== تحصيل هذا الشهر ========================== */}
      {allow("finance.view") && (
        <section className="card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="t-xs text-[var(--muted)]">الإيجارات المحصَّلة</p>
              <p className="num mt-1 text-[28px] font-bold leading-none text-[var(--ok)]">
                {amount(k.collectedThisMonth)}
                <span className="text-[13px] font-semibold opacity-60"> د.ك</span>
              </p>

              <div className="my-3 h-px bg-[var(--line)]" />

              <p className="t-xs text-[var(--muted)]">المستحق هذا الشهر</p>
              <p className="num mt-1 text-[19px] font-bold leading-none">
                {amount(k.expectedThisMonth)}
                <span className="text-[11px] font-semibold opacity-55"> د.ك</span>
              </p>
            </div>

            <div className="shrink-0 text-center text-[var(--ink)]">
              <Gauge
                value={k.collectionRate}
                size={104}
                stroke={11}
                track="var(--surface-3)"
                color={k.collectionRate >= 95 ? "var(--ok)" : "var(--gold)"}
              />
              <p className="t-xs mt-1 text-[var(--muted)]">{monthName}</p>
            </div>
          </div>

          <Link
            href="/finances"
            className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 transition"
            style={{ background: remaining ? "var(--danger-050)" : "var(--ok-050)" }}
          >
            <Icon
              name={remaining ? "alert" : "checkCircle"}
              size={16}
              style={{ color: remaining ? "var(--danger)" : "var(--ok)" }}
            />
            <span className="flex-1 text-[13px] font-bold" style={{ color: remaining ? "var(--danger)" : "var(--ok)" }}>
              {remaining ? "المتبقي للتحصيل" : "اكتمل تحصيل الشهر"}
            </span>
            {remaining > 0 && <Money v={remaining} size="sm" tone="var(--danger)" />}
            <Icon name="chevronLeft" size={15} style={{ color: remaining ? "var(--danger)" : "var(--ok)" }} />
          </Link>
        </section>
      )}

      {/* =========================== يحتاج انتباهك =========================== */}
      {attention ? (
        <section className="card overflow-hidden">
          <h2 className="px-4 pb-1 pt-3.5 text-[14px] font-extrabold">يحتاج انتباهك</h2>
          <div className="divide-y divide-[var(--line)]">
            {allow("finance.view") && k.arrearsCount > 0 && (
              <Row href="/finances" icon="alert" tone="rose"
                title={`${num(k.arrearsCount)} مستأجر لم يسدّد`}
                right={<Money v={k.arrearsTotal} size="sm" tone="#b3303b" />} />
            )}
            {allow("contracts.view") && expiring.length > 0 && (
              <Row href="/finances?tab=contracts" icon="calendar" tone="gold"
                title={`${num(expiring.length)} عقد يقارب على الانتهاء`}
                right={<span className="t-xs font-bold text-[var(--gold-600)]">{dateShort(expiring[0].c.endDate)}</span>} />
            )}
            {allow("flags.view") && k.flaggedUnits > 0 && (
              <Row href="/flags" icon="alert" tone="navy"
                title={`${num(k.flaggedUnits)} وحدة عليها ملاحظة`} right={null} />
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
      ) : (
        <p className="card flex items-center justify-center gap-2 p-4 text-[13px] font-semibold text-[var(--muted)]">
          <Icon name="checkCircle" size={16} className="text-[var(--ok)]" />
          لا شيء يحتاج انتباهك اليوم
        </p>
      )}

      {/* ====================== نسبة التحصيل — ستة أشهر ====================== */}
      {allow("finance.view") && (
        <section className="card p-4">
          <h2 className="mb-3 text-[14px] font-extrabold">نسبة التحصيل — آخر ٦ أشهر</h2>
          <div className="flex items-end justify-between gap-2">
            {trend.map((t, i) => {
              const isNow = i === trend.length - 1;
              return (
                <div key={t.period} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span
                    className="num text-[10.5px] font-bold"
                    style={{ color: isNow ? "var(--ink)" : "var(--muted)" }}
                  >
                    {Math.round(t.rate)}%
                  </span>
                  <span className="flex h-20 w-full max-w-[26px] items-end overflow-hidden rounded-lg bg-[var(--surface-3)]">
                    <span
                      className="w-full rounded-lg transition-[height] duration-700"
                      style={{
                        height: `${Math.max(4, t.rate)}%`,
                        background: t.rate >= 95 ? "var(--ok)" : t.rate >= 60 ? "var(--primary)" : "var(--gold)",
                      }}
                    />
                  </span>
                  <span className="truncate text-[10px] font-semibold text-[var(--muted)]">
                    {monthAr(t.period).split(" ")[0].slice(0, 4)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({
  href, icon, title, right, tone,
}: { href: string; icon: IconName; title: string; right: React.ReactNode; tone: "rose" | "gold" | "navy" }) {
  const c = {
    rose: { bg: "var(--danger-050)", fg: "#b3303b" },
    gold: { bg: "var(--gold-050)", fg: "var(--gold-600)" },
    navy: { bg: "var(--primary-050)", fg: "var(--primary)" },
  }[tone];
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-2)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: c.bg, color: c.fg }}>
        <Icon name={icon} size={17} />
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-bold">{title}</p>
      {right}
      <Icon name="chevronLeft" size={15} className="shrink-0 text-[var(--muted)]" />
    </Link>
  );
}
