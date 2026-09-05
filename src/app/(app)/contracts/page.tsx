"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { KWD, contractStatusLabel, dateShort, daysBetween, methodLabel, num, todayISO } from "@/lib/format";
import { Chip, Empty, KeyVal, PageHeader, SearchBox, Segmented, Sheet, useConfirm, type Tone } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { ContractForm } from "@/components/forms";
import DocsPanel from "@/components/DocsPanel";
import { ContractDoc, PrintOverlay } from "@/components/print";
import type { Contract, ContractStatus } from "@/lib/types";

const tone: Record<ContractStatus, Tone> = { active: "green", upcoming: "sky", expired: "slate", terminated: "rose" };
type Filter = "active" | "expiring" | "expired" | "all";

export default function ContractsPage() {
  const { data, activeBuilding } = useStore();
  const { allow } = useAuth();
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("filter") === "expiring") setFilter("expiring");
    const id = p.get("id");
    if (id) setOpenId(id);
  }, []);

  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);

  const base = useMemo(
    () => data.contracts.filter((c) => activeBuilding === "all" || c.buildingId === activeBuilding),
    [data.contracts, activeBuilding]
  );

  const counts = useMemo(() => {
    const alertDays = data.settings.contractAlertDays;
    return {
      active: base.filter((c) => c.status === "active").length,
      expiring: base.filter((c) => c.status === "active" && daysBetween(todayISO(), c.endDate) >= 0 && daysBetween(todayISO(), c.endDate) <= alertDays).length,
      expired: base.filter((c) => c.status === "expired" || c.status === "terminated").length,
      all: base.length,
    };
  }, [base, data.settings.contractAlertDays]);

  const list = useMemo(() => {
    const alertDays = data.settings.contractAlertDays;
    const needle = q.trim().toLowerCase();
    let out = base;
    if (filter === "active") out = out.filter((c) => c.status === "active" || c.status === "upcoming");
    if (filter === "expiring")
      out = out.filter((c) => c.status === "active" && daysBetween(todayISO(), c.endDate) >= 0 && daysBetween(todayISO(), c.endDate) <= alertDays);
    if (filter === "expired") out = out.filter((c) => c.status === "expired" || c.status === "terminated");
    if (needle)
      out = out.filter(
        (c) =>
          c.no.includes(needle) ||
          (unitById.get(c.unitId)?.number ?? "").toLowerCase().includes(needle) ||
          (tenantById.get(c.tenantId)?.name ?? "").toLowerCase().includes(needle)
      );
    return [...out].sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [base, filter, q, unitById, tenantById, data.settings.contractAlertDays]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="العقود"
        subtitle={`${num(list.length)} عقد`}
        icon="file"
        actions={
          allow("contracts.edit") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> عقد</button>
          ) : undefined
        }
      />

      <SearchBox value={q} onChange={setQ} placeholder="رقم العقد، الشقة، المستأجر…" />

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: "active", label: "سارية", count: counts.active },
          { value: "expiring", label: "تنتهي قريبًا", count: counts.expiring },
          { value: "expired", label: "منتهية", count: counts.expired },
          { value: "all", label: "الكل", count: counts.all },
        ]}
      />

      {list.length ? (
        <div className="space-y-1.5">
          {list.map((c) => {
            const left = daysBetween(todayISO(), c.endDate);
            const u = unitById.get(c.unitId);
            const t = tenantById.get(c.tenantId);
            return (
              <button
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="card flex w-full items-center gap-3 p-2.5 text-right transition hover:shadow-[var(--sh-2)] active:scale-[.99]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary-700)]">
                  <Icon name="file" size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-extrabold">{t?.name ?? "—"} · شقة {u?.number ?? "—"}</p>
                  <p className="truncate text-[11.5px] text-[var(--muted)]">
                    {c.no} · {dateShort(c.startDate)} — {dateShort(c.endDate)}
                  </p>
                </div>
                <div className="shrink-0 text-left">
                  <p className="text-[12.5px] font-extrabold tabular-nums">{KWD(c.rent, false)}</p>
                  {c.status === "active" && left >= 0 && left <= data.settings.contractAlertDays ? (
                    <Chip tone={left <= 14 ? "rose" : "amber"}>{left} يوم</Chip>
                  ) : (
                    <Chip tone={tone[c.status]}>{contractStatusLabel[c.status]}</Chip>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty icon="file" title="ما فيه عقود" body="أنشئ عقدًا جديدًا لربط مستأجر بوحدة." />
      )}

      {adding && <ContractForm open onClose={() => setAdding(false)} presetBuildingId={activeBuilding === "all" ? undefined : activeBuilding} />}
      <ContractSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

/* ============================== تفاصيل العقد ============================== */

function ContractSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, update } = useStore();
  const { user, allow } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [printing, setPrinting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);

  const c = useMemo(() => data.contracts.find((x) => x.id === id) ?? null, [data.contracts, id]);
  if (!c) return null;

  const unit = data.units.find((u) => u.id === c.unitId);
  const tenant = data.tenants.find((t) => t.id === c.tenantId);
  const building = data.buildings.find((b) => b.id === c.buildingId);
  const left = daysBetween(todayISO(), c.endDate);

  const renew = async (months: number) => {
    if (!(await confirm("تجديد العقد", `سيتم تمديد العقد ${months} شهرًا من تاريخ انتهائه الحالي.`, false))) return;
    const end = new Date(c.endDate);
    end.setMonth(end.getMonth() + months);
    update((d) => {
      const t = d.contracts.find((x) => x.id === c.id);
      if (t) { t.endDate = end.toISOString().slice(0, 10); t.status = "active"; }
      const u = d.units.find((x) => x.id === c.unitId);
      if (u && u.status !== "occupied") u.status = "occupied";
    }, { action: "تجديد عقد", detail: `${c.no} → ${end.toISOString().slice(0, 10)}`, actor: user?.username });
    setRenewing(false);
  };

  const terminate = async () => {
    if (!(await confirm("فسخ العقد", "سيتم إنهاء العقد وتصبح الوحدة فاضية."))) return;
    update((d) => {
      const t = d.contracts.find((x) => x.id === c.id);
      if (t) t.status = "terminated";
      const u = d.units.find((x) => x.id === c.unitId);
      if (u) u.status = "vacant";
    }, { action: "فسخ عقد", detail: c.no, actor: user?.username });
    onClose();
  };

  return (
    <>
      {dialog}
      <Sheet open={!!id} onClose={onClose} wide title={`عقد ${c.no}`}>
        <div className="mb-4 rounded-2xl bg-gradient-to-l from-[var(--primary-050)] to-transparent p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-extrabold">{tenant?.name ?? "—"}</h3>
              <p className="text-[12px] text-[var(--muted)]">{building?.name} · شقة {unit?.number}</p>
            </div>
            <Chip tone={tone[c.status]}>{contractStatusLabel[c.status]}</Chip>
          </div>
          {c.status === "active" && (
            <p className="mt-2 text-[12px] font-bold" style={{ color: left <= 30 ? "#b3303b" : "var(--muted)" }}>
              {left >= 0 ? `متبقٍ ${left} يوم على انتهاء العقد` : `منتهٍ منذ ${Math.abs(left)} يوم`}
            </p>
          )}
        </div>

        <div className="card mb-4 p-3">
          <KeyVal k="رقم العقد" v={c.no} icon="file" />
          <KeyVal k="تاريخ البداية" v={dateShort(c.startDate)} icon="calendar" />
          <KeyVal k="تاريخ النهاية" v={dateShort(c.endDate)} icon="calendar" />
          <KeyVal k="الإيجار الشهري" v={KWD(c.rent)} icon="wallet" />
          <KeyVal k="التأمين" v={KWD(c.deposit)} icon="lock" />
          <KeyVal k="يوم الاستحقاق" v={`${c.dueDay} من كل شهر`} icon="clock" />
          <KeyVal k="طريقة الدفع" v={methodLabel[c.payMethod]} icon="card" />
        </div>

        {c.terms && (
          <div className="card mb-4 p-3">
            <p className="mb-1 text-[13px] font-extrabold">الشروط</p>
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">{c.terms}</p>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => setPrinting(true)}><Icon name="print" size={14} /> طباعة العقد</button>
          {allow("contracts.edit") && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Icon name="edit" size={14} /> تعديل</button>
              <button className="btn btn-soft btn-sm" onClick={() => setRenewing(true)}><Icon name="refresh" size={14} /> تجديد</button>
              {c.status === "active" && (
                <button className="btn btn-danger btn-sm mr-auto" onClick={terminate}><Icon name="x" size={14} /> فسخ</button>
              )}
            </>
          )}
        </div>

        {allow("docs.view") && (
          <DocsPanel ownerType="contract" ownerId={c.id} buildingId={c.buildingId} defaultKind="contract" title="مرفقات العقد" />
        )}
      </Sheet>

      {renewing && (
        <Sheet open onClose={() => setRenewing(false)} title="تجديد العقد">
          <p className="mb-3 text-[13px] text-[var(--muted)]">اختر مدة التمديد من تاريخ الانتهاء الحالي ({dateShort(c.endDate)}).</p>
          <div className="grid grid-cols-3 gap-2">
            {[6, 12, 24].map((m) => (
              <button key={m} className="btn btn-ghost !py-4 !text-base" onClick={() => renew(m)}>{m} شهر</button>
            ))}
          </div>
        </Sheet>
      )}

      {editing && <ContractForm open onClose={() => setEditing(false)} contract={c} />}
      <PrintOverlay open={printing} onClose={() => setPrinting(false)} fileTitle={`عقد إيجار ${c.no} — ${tenant?.name ?? ""}`}>
        <ContractDoc contract={c} />
      </PrintOverlay>
    </>
  );
}
