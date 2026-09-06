"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { arrears, floorStats, kpis, scope } from "@/lib/selectors";
import { amount, dateShort, monthAr, monthsLabel, num, pct, thisPeriod } from "@/lib/format";
import { Empty, Money, Panel } from "@/components/ui";
import { Icon } from "@/components/Icons";
import UnitSheet from "@/components/UnitSheet";
import { PaymentForm } from "@/components/forms";

const GREG = new Intl.DateTimeFormat("ar-KW-u-nu-latn", { weekday: "long", day: "numeric", month: "long" });

type Task = {
  id: string;
  kind: "overdue" | "expiring" | "flag";
  unitNo: string;
  title: string;
  detail: string;
  value: React.ReactNode;
  unitId?: string;
  contractId?: string;
  period?: string;
};

export default function DashboardPage() {
  const { data, activeBuilding } = useStore();
  const { user, allow } = useAuth();
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<{ contractId: string; period: string } | null>(null);

  const k = useMemo(() => kpis(data, activeBuilding), [data, activeBuilding]);
  const s = useMemo(() => scope(data, activeBuilding), [data, activeBuilding]);
  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;
  const floors = useMemo(() => floorStats(data, buildingId), [data, buildingId]);

  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);

  /** قائمة عمل واحدة مرتّبة بالأولوية — بديل تكرار «متأخرات» و«عقود» و«ملاحظات». */
  const tasks = useMemo<Task[]>(() => {
    const out: Task[] = [];

    if (allow("finance.view")) {
      for (const a of arrears(data, s)) {
        out.push({
          id: `a-${a.contract.id}`,
          kind: "overdue",
          unitNo: a.unit?.number ?? "—",
          title: a.tenant?.name ?? "—",
          detail: `متأخر ${monthsLabel(a.missing.length)}`,
          value: <Money v={a.amount} size="sm" tone="var(--danger)" />,
          unitId: a.unit?.id,
          contractId: a.contract.id,
          period: a.missing[0],
        });
      }
    }

    if (allow("contracts.view")) {
      const now = Date.now();
      const lim = data.settings.contractAlertDays * 86400000;
      s.contracts
        .filter((c) => c.status === "active")
        .map((c) => ({ c, left: new Date(c.endDate).getTime() - now }))
        .filter((x) => x.left >= 0 && x.left <= lim)
        .sort((a, b) => a.left - b.left)
        .forEach(({ c, left }) => {
          out.push({
            id: `c-${c.id}`,
            kind: "expiring",
            unitNo: unitById.get(c.unitId)?.number ?? "—",
            title: tenantById.get(c.tenantId)?.name ?? "—",
            detail: `العقد ينتهي ${dateShort(c.endDate)}`,
            value: (
              <span className="num text-[12.5px] font-bold text-[var(--warn)]">
                {num(Math.ceil(left / 86400000))} يومًا
              </span>
            ),
            unitId: c.unitId,
          });
        });
    }

    if (allow("flags.view")) {
      s.units.filter((u) => u.flagged).forEach((u) => {
        out.push({
          id: `f-${u.id}`,
          kind: "flag",
          unitNo: u.number,
          title: u.flagNote ?? "ملاحظة",
          detail: `مُعلّمة منذ ${dateShort(u.flaggedAt)}`,
          value: <Icon name="chevronLeft" size={15} className="text-[var(--faint)]" />,
          unitId: u.id,
        });
      });
    }

    return out;
  }, [data, s, allow, unitById, tenantById]);

  const [tab, setTab] = useState<"all" | Task["kind"]>("all");
  const counts = {
    all: tasks.length,
    overdue: tasks.filter((t) => t.kind === "overdue").length,
    expiring: tasks.filter((t) => t.kind === "expiring").length,
    flag: tasks.filter((t) => t.kind === "flag").length,
  };
  const shown = (tab === "all" ? tasks : tasks.filter((t) => t.kind === tab)).slice(0, 12);

  const remaining = Math.max(0, k.expectedThisMonth - k.collectedThisMonth);
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? "صباح الخير" : "مساء الخير";

  const KIND = {
    overdue: { c: "var(--danger)", bg: "var(--danger-050)", icon: "wallet" as const },
    expiring: { c: "var(--warn)", bg: "var(--warn-050)", icon: "calendar" as const },
    flag: { c: "var(--steel)", bg: "var(--steel-050)", icon: "alert" as const },
  };

  return (
    <div className="space-y-4">
      {/* ============================ الترحيب ============================ */}
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="t-display truncate">
          {greet}، <span className="font-normal text-[var(--muted)]">{user?.displayName}</span>
        </h1>
        <span className="t-xs shrink-0 text-[var(--muted)]">{GREG.format(now)}</span>
      </div>

      {/* ===================== الشريط الرئيسي: الإشغال + المال ===================== */}
      <section className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">
        <div className="grid divide-y divide-[var(--line)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:divide-x sm:divide-x-reverse sm:divide-y-0">
          {/* الإشغال */}
          <Link href="/apartments" className="flex items-center gap-4 p-4 transition hover:bg-[var(--surface-2)]">
            <OccupancyRing value={k.occupancyRate} />
            <div className="min-w-0">
              <p className="t-xs text-[var(--muted)]">الإشغال</p>
              <p className="num mt-0.5 text-[22px] font-bold leading-none">
                {num(k.occupied)}<span className="text-[13px] font-medium text-[var(--faint)]"> / {num(k.totalUnits)}</span>
              </p>
              <p className="t-xs mt-1.5 text-[var(--muted)]">
                <span className="font-bold text-[var(--warn)]">{num(k.vacant)}</span> شاغرة
                {k.flaggedUnits > 0 && <> · <span className="font-bold text-[var(--danger)]">{num(k.flaggedUnits)}</span> ملاحظة</>}
              </p>
            </div>
          </Link>

          {/* المال */}
          {allow("finance.view") ? (
            <Link href="/finances" className="block p-4 transition hover:bg-[var(--surface-2)]">
              <div className="flex items-baseline justify-between">
                <p className="t-xs text-[var(--muted)]">إيجار {monthAr(thisPeriod())}</p>
                <span className="num t-xs font-bold text-[var(--muted)]">{pct(k.collectionRate)}</span>
              </div>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <span className="bg-[var(--ok)] transition-[width] duration-700" style={{ width: `${k.collectionRate}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ["المستحق", k.expectedThisMonth, "var(--ink)"],
                  ["المحصَّل", k.collectedThisMonth, "var(--ok)"],
                  ["المتبقي", remaining, remaining ? "var(--gold-600)" : "var(--muted)"],
                ].map(([l, v, c]) => (
                  <div key={l as string}>
                    <p className="num t-title leading-none" style={{ color: c as string }}>
                      {amount(v as number)}
                    </p>
                    <p className="t-xs mt-1 text-[var(--muted)]">{l as string} <span className="opacity-60">د.ك</span></p>
                  </div>
                ))}
              </div>
            </Link>
          ) : (
            <div className="p-4">
              <p className="t-xs text-[var(--muted)]">الأدوار</p>
              <p className="num mt-1 text-[22px] font-bold leading-none">{num(floors.length)}</p>
            </div>
          )}
        </div>
      </section>

      {/* ============================ ما يحتاج إجراء ============================ */}
      <Panel
        flush
        title="يحتاج إجراء"
        action={
          tasks.length > 0 ? (
            <div className="no-scrollbar -my-1 flex gap-1 overflow-x-auto">
              {([
                ["all", "الكل", counts.all],
                ...(counts.overdue ? [["overdue", "متأخرات", counts.overdue]] : []),
                ...(counts.expiring ? [["expiring", "عقود", counts.expiring]] : []),
                ...(counts.flag ? [["flag", "ملاحظات", counts.flag]] : []),
              ] as [typeof tab, string, number][]).map(([v, l, n]) => (
                <button key={v} onClick={() => setTab(v)} data-on={tab === v} className="chip shrink-0 !py-0.5 !text-[11.5px]">
                  {l}<span className="chip-n num">{n}</span>
                </button>
              ))}
            </div>
          ) : undefined
        }
      >
        {shown.length ? (
          <>
            {shown.map((t) => {
              const st = KIND[t.kind];
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.kind === "overdue" && t.contractId && allow("receipts.create")) {
                      setPayFor({ contractId: t.contractId, period: t.period! });
                    } else if (t.unitId) setOpenUnit(t.unitId);
                  }}
                  className="row row-link"
                >
                  <span
                    className="num grid h-8 w-9 shrink-0 place-items-center rounded-md text-[11.5px] font-bold"
                    style={{ background: st.bg, color: st.c }}
                  >
                    {t.unitNo}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{t.title}</span>
                    <span className="t-xs block truncate text-[var(--muted)]">{t.detail}</span>
                  </span>
                  {t.value}
                </button>
              );
            })}
            {tasks.length > shown.length && (
              <p className="t-xs border-t border-[var(--line)] py-2 text-center text-[var(--muted)]">
                و{num(tasks.length - shown.length)} أخرى — افتح القسم المعني للاطلاع عليها
              </p>
            )}
          </>
        ) : (
          <Empty icon="checkCircle" title="لا يوجد ما يحتاج إجراءً" body="لا متأخرات، ولا عقود تقارب على الانتهاء، ولا ملاحظات مفتوحة." />
        )}
      </Panel>

      {/* ============================== الأدوار ============================== */}
      {floors.length > 0 && (
        <Panel
          title="إشغال الأدوار"
          action={<Link href="/apartments" className="t-xs font-semibold text-[var(--primary)]">عرض الشقق ‹</Link>}
        >
          <ul className="space-y-1.5">
            {floors.filter((f) => f.units.length).map((f) => {
              const rate = (f.occupied / f.units.length) * 100;
              return (
                <li key={f.floorId} className="flex items-center gap-2.5">
                  <span className="w-[46px] shrink-0 text-[12.5px] font-semibold text-[var(--ink-2)]">{f.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <span
                      className="block h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${rate}%`, background: rate === 100 ? "var(--ok)" : "var(--primary)" }}
                    />
                  </span>
                  <span className="num w-[40px] shrink-0 text-left text-[11.5px] font-semibold text-[var(--muted)]">
                    {num(f.occupied)}/{num(f.units.length)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <UnitSheet unitId={openUnit} onClose={() => setOpenUnit(null)} />
      {payFor && (
        <PaymentForm open onClose={() => setPayFor(null)} presetContractId={payFor.contractId} presetPeriod={payFor.period} />
      )}
    </div>
  );
}

/** حلقة إشغال صغيرة — معلومة لا زينة. */
function OccupancyRing({ value }: { value: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke="var(--gold)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(Math.max(0, Math.min(100, value)) / 100) * c} ${c}`}
          style={{ transition: "stroke-dasharray 1s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <span className="num absolute inset-0 grid place-content-center t-title">
        {Math.round(value)}<span className="text-[10px] font-semibold text-[var(--muted)]">%</span>
      </span>
    </div>
  );
}
