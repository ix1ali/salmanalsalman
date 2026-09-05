"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Icon, type IconName } from "./Icons";
import { Money } from "./ui";
import { KWD, dateShort, monthAr, statusLabel } from "@/lib/format";
import { tenantOfUnit } from "@/lib/selectors";
import UnitSheet from "./UnitSheet";

interface Hit {
  id: string;
  kind: "unit" | "tenant" | "receipt";
  icon: IconName;
  title: string;
  sub: string;
  extra?: React.ReactNode;
  unitId?: string;
  color: string;
}

/**
 * بحث واحد يغطي النظام كله: الشقق والمستأجرين والوصولات.
 * يُفتح من الشريط العلوي أو بالضغط على «/».
 */
export default function GlobalSearch() {
  const { data } = useStore();
  const { allow } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [unitId, setUnitId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (!typing && (e.key === "/" || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)))) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
    else setQ("");
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 1) return [];
    const out: Hit[] = [];

    for (const u of data.units) {
      if (out.length > 40) break;
      const t = tenantOfUnit(data, u.id).tenant;
      if (
        u.number.toLowerCase().includes(n) ||
        (t?.name ?? "").toLowerCase().includes(n)
      ) {
        const b = data.buildings.find((x) => x.id === u.buildingId);
        const f = data.floors.find((x) => x.id === u.floorId);
        out.push({
          id: `u-${u.id}`, kind: "unit", icon: "door", unitId: u.id,
          title: `شقة ${u.number}`,
          sub: `${f?.name ?? ""} · ${b?.name ?? ""} · ${t?.name ?? statusLabel[u.status]}`,
          extra: allow("finance.view") ? <Money v={u.baseRent} size="sm" /> : undefined,
          color: u.flagged ? "#d64550" : u.status === "occupied" ? "#1e8a5f" : "#c9992e",
        });
      }
    }

    for (const t of data.tenants) {
      if (out.length > 60) break;
      if (
        t.name.toLowerCase().includes(n) ||
        t.phone.includes(n) ||
        (t.civilId ?? "").includes(n) ||
        (t.nationality ?? "").toLowerCase().includes(n) ||
        (t.workplace ?? "").toLowerCase().includes(n)
      ) {
        const c = data.contracts.find((x) => x.tenantId === t.id && x.status === "active");
        const u = data.units.find((x) => x.id === c?.unitId);
        out.push({
          id: `t-${t.id}`, kind: "tenant", icon: "user", unitId: u?.id,
          title: t.name,
          sub: `${u ? `شقة ${u.number}` : "بدون وحدة"} · ${t.nationality || "—"} · ${t.phone}`,
          color: "var(--primary)",
        });
      }
    }

    if (allow("receipts.view")) {
      for (const p of data.payments) {
        if (out.length > 80) break;
        const t = data.tenants.find((x) => x.id === p.tenantId);
        if (p.receiptNo.includes(n) || (t?.name ?? "").toLowerCase().includes(n)) {
          const u = data.units.find((x) => x.id === p.unitId);
          out.push({
            id: `p-${p.id}`, kind: "receipt", icon: "receipt", unitId: u?.id,
            title: `وصل ${p.receiptNo}`,
            sub: `${t?.name ?? "—"} · ${monthAr(p.period)} · ${dateShort(p.paidAt)}`,
            extra: <Money v={p.amount} size="sm" tone="var(--ok)" />,
            color: "var(--ok)",
          });
        }
      }
    }

    return out.slice(0, 30);
  }, [q, data, allow]);

  const groups: { label: string; items: Hit[] }[] = [
    { label: "الشقق", items: hits.filter((h) => h.kind === "unit") },
    { label: "المستأجرون", items: hits.filter((h) => h.kind === "tenant") },
    { label: "الوصولات", items: hits.filter((h) => h.kind === "receipt") },
  ].filter((g) => g.items.length);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-icon btn-ghost"
        aria-label="بحث في كل النظام"
        title="بحث (اضغط /)"
      >
        <Icon name="search" size={18} />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[190] flex items-start justify-center p-0 no-print sm:p-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[#0b2545]/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="anim-pop relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-[var(--surface)] shadow-[var(--sh-3)] sm:mt-8 sm:max-w-xl sm:rounded-3xl">
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
              <Icon name="search" size={19} className="shrink-0 text-[var(--muted)]" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن شقة، مستأجر، رقم هاتف، أو وصل…"
                className="flex-1 bg-transparent text-[15px] font-bold outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
              />
              <button onClick={() => setOpen(false)} className="btn btn-icon btn-ghost !p-1.5" aria-label="إغلاق">
                <Icon name="x" size={17} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {!q.trim() ? (
                <div className="px-4 py-10 text-center">
                  <Icon name="search" size={30} className="mx-auto text-[var(--line-strong)]" />
                  <p className="mt-2 text-[13px] font-bold text-[var(--ink-2)]">ابحث في كل النظام من مكان واحد</p>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    رقم الشقة · اسم المستأجر · رقم الهاتف · الرقم المدني · الجنسية · رقم الوصل
                  </p>
                </div>
              ) : groups.length ? (
                groups.map((g) => (
                  <div key={g.label} className="mb-2">
                    <p className="px-3 py-1.5 text-[11px] font-extrabold text-[var(--muted)]">{g.label}</p>
                    <ul>
                      {g.items.map((h) => (
                        <li key={h.id}>
                          <button
                            onClick={() => { if (h.unitId) { setUnitId(h.unitId); setOpen(false); } }}
                            disabled={!h.unitId}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition hover:bg-[var(--surface-2)] disabled:opacity-60"
                          >
                            <span
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
                              style={{ background: h.color }}
                            >
                              <Icon name={h.icon} size={17} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-extrabold">{h.title}</span>
                              <span className="block truncate text-[11.5px] text-[var(--muted)]">{h.sub}</span>
                            </span>
                            {h.extra}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="text-[13px] font-bold text-[var(--ink-2)]">لا توجد نتائج مطابقة</p>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">جرّب كلمة أو رقمًا آخر.</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <UnitSheet unitId={unitId} onClose={() => setUnitId(null)} />
    </>
  );
}
