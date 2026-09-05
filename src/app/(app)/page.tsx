"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, kpis, monthlySeries, scope } from "@/lib/selectors";
import { KWD, dateShort, monthAr, num, pct, thisPeriod } from "@/lib/format";
import { Progress, SectionTitle } from "@/components/ui";
import { BarChart } from "@/components/Charts";
import { Icon, type IconName } from "@/components/Icons";

export default function DashboardPage() {
  const { data, activeBuilding } = useStore();
  const { user, allow } = useAuth();

  const k = useMemo(() => kpis(data, activeBuilding), [data, activeBuilding]);
  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const series = useMemo(() => monthlySeries(data, activeBuilding, 6), [data, activeBuilding]);
  const ar = useMemo(() => arrears(data, s).slice(0, 4), [data, s]);

  const expiring = useMemo(() => {
    const now = Date.now();
    const lim = data.settings.contractAlertDays * 86400000;
    return s.contracts
      .filter((c) => c.status === "active")
      .map((c) => ({ c, left: new Date(c.endDate).getTime() - now }))
      .filter((x) => x.left >= 0 && x.left <= lim)
      .sort((a, b) => a.left - b.left)
      .slice(0, 4);
  }, [s.contracts, data.settings.contractAlertDays]);

  const buildingName = activeBuilding === "all" ? "كل العمارات" : data.buildings.find((b) => b.id === activeBuilding)?.name;
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);

  const remaining = Math.max(0, k.expectedThisMonth - k.collectedThisMonth);

  return (
    <div className="space-y-4">
      {/* ترحيب + الإشغال */}
      <div className="anim-up overflow-hidden rounded-[22px] bg-[var(--primary)] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] text-white/70">أهلًا</p>
            <h1 className="truncate text-xl text-white">{user?.displayName}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-white/80">
              <Icon name="building" size={14} /> {buildingName}
            </p>
          </div>
          <div className="shrink-0 text-left">
            <p className="display text-4xl leading-none text-[var(--gold)]">{pct(k.occupancyRate)}</p>
            <p className="text-[11px] text-white/70">نسبة الإشغال</p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-700" style={{ width: `${k.occupancyRate}%` }} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["مؤجرة", num(k.occupied)],
            ["فاضية", num(k.vacant)],
            ["الإجمالي", num(k.totalUnits)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/10 py-2">
              <p className="display text-[18px] leading-none text-white">{v}</p>
              <p className="mt-1 text-[11px] text-white/70">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* تحصيل الشهر — الرقم الوحيد المهم */}
      {allow("finance.view") && (
        <Link href="/finances" className="card card-lg block p-4 transition hover:shadow-[var(--sh-2)]">
          <SectionTitle extra={<span className="text-[12px] font-bold text-[var(--primary)]">التفاصيل ‹</span>}>
            تحصيل {monthAr(thisPeriod())}
          </SectionTitle>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="display text-[26px] leading-none">{KWD(k.collectedThisMonth, false)}</p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">من أصل {KWD(k.expectedThisMonth)}</p>
            </div>
            <p className="display text-[20px]" style={{ color: k.collectionRate >= 80 ? "var(--ok)" : "var(--gold-600)" }}>
              {pct(k.collectionRate)}
            </p>
          </div>
          <div className="mt-3">
            <Progress value={k.collectionRate} tone={k.collectionRate >= 80 ? "green" : "gold"} height={10} />
          </div>
          {remaining > 0 && (
            <p className="mt-2 text-[12.5px] font-bold text-[var(--gold-600)]">
              باقي {KWD(remaining)} لم تُحصَّل بعد
            </p>
          )}
        </Link>
      )}

      {/* اختصارات */}
      <div className="grid grid-cols-4 gap-2">
        {([
          allow("receipts.create") && ["/finances", "receipt", "تسجيل دفعة"],
          ["/apartments", "grid", "الشقق"],
          allow("tickets.create") && ["/maintenance", "wrench", "بلاغ"],
          allow("reports.view") && ["/reports", "chart", "كشف"],
          ["/tenants", "users", "المستأجرون"],
        ].filter(Boolean) as [string, IconName, string][])
          .slice(0, 4)
          .map(([href, icon, label]) => (
            <Link
              key={href}
              href={href}
              className="card flex flex-col items-center gap-1.5 p-3 transition active:scale-[.96]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary)]">
                <Icon name={icon} size={18} />
              </span>
              <span className="text-[11px] font-bold text-[var(--ink-2)]">{label}</span>
            </Link>
          ))}
      </div>

      {/* ما يحتاج انتباهك */}
      {(ar.length > 0 || expiring.length > 0 || k.openTickets > 0) && (
        <div className="card card-lg p-4">
          <SectionTitle>يحتاج انتباهك</SectionTitle>
          <div className="space-y-1.5">
            {allow("finance.view") && k.arrearsCount > 0 && (
              <AlertRow
                href="/finances?tab=arrears"
                icon="alert"
                tone="rose"
                title={`${num(k.arrearsCount)} مستأجر عليهم متأخرات`}
                sub={KWD(k.arrearsTotal)}
              />
            )}
            {allow("contracts.view") && k.expiringSoon > 0 && (
              <AlertRow
                href="/contracts?filter=expiring"
                icon="calendar"
                tone="gold"
                title={`${num(k.expiringSoon)} عقد ينتهي قريبًا`}
                sub={`خلال ${data.settings.contractAlertDays} يوم`}
              />
            )}
            {k.openTickets > 0 && (
              <AlertRow
                href="/maintenance"
                icon="wrench"
                tone="navy"
                title={`${num(k.openTickets)} بلاغ صيانة مفتوح`}
                sub="بانتظار المتابعة"
              />
            )}
          </div>
        </div>
      )}

      {/* أعلى المتأخرات */}
      {allow("finance.view") && ar.length > 0 && (
        <div className="card card-lg p-4">
          <SectionTitle extra={<Link href="/finances?tab=arrears" className="text-[12px] font-bold text-[var(--primary)]">الكل ‹</Link>}>
            أعلى المتأخرات
          </SectionTitle>
          <ul className="divide-y divide-[var(--line)]">
            {ar.map((a) => (
              <li key={a.contract.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--danger-050)] text-[11px] font-extrabold text-[#b3303b]">
                  {a.unit?.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{a.tenant?.name ?? "—"}</p>
                  <p className="text-[11.5px] text-[var(--muted)]">{a.missing.length} شهر غير مسدد</p>
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
          <SectionTitle extra={<Link href="/contracts" className="text-[12px] font-bold text-[var(--primary)]">الكل ‹</Link>}>
            عقود تنتهي قريبًا
          </SectionTitle>
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

      {/* رسم واحد فقط */}
      {allow("finance.view") && (
        <div className="card card-lg p-4">
          <SectionTitle>الدخل والمصاريف — ٦ أشهر</SectionTitle>
          <BarChart
            points={series.map((m) => ({ label: monthAr(m.period).split(" ")[0].slice(0, 4), a: m.income, b: m.expense }))}
            aLabel="المحصّل"
            bLabel="المصاريف"
          />
        </div>
      )}
    </div>
  );
}

function AlertRow({
  href, icon, title, sub, tone,
}: { href: string; icon: IconName; title: string; sub: string; tone: "rose" | "gold" | "navy" }) {
  const c = {
    rose: { bg: "var(--danger-050)", fg: "#b3303b" },
    gold: { bg: "var(--gold-050)", fg: "var(--gold-600)" },
    navy: { bg: "var(--primary-050)", fg: "var(--primary)" },
  }[tone];
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-[var(--surface-2)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: c.bg, color: c.fg }}>
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold">{title}</p>
        <p className="truncate text-[11.5px] text-[var(--muted)]">{sub}</p>
      </div>
      <Icon name="chevronLeft" size={16} className="text-[var(--muted)]" />
    </Link>
  );
}
