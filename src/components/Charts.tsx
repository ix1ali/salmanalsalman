"use client";

import React, { useMemo, useState } from "react";
import { KWD } from "@/lib/format";

/* ============================ رسم أعمدة مزدوج ============================ */

export interface BarPoint { label: string; a: number; b: number }

export function BarChart({
  points, aLabel, bLabel, aColor = "var(--primary)", bColor = "var(--gold)", height = 190,
}: { points: BarPoint[]; aLabel: string; bLabel: string; aColor?: string; bColor?: string; height?: number }) {
  // في الواجهة العربية يتدفق الزمن من اليمين إلى اليسار
  const items = useMemo(() => [...points].reverse(), [points]);
  const max = Math.max(1, ...items.flatMap((p) => [p.a, p.b]));
  const [hover, setHover] = useState<number | null>(null);

  const W = 320, H = height, padB = 26, padT = 14;
  const innerH = H - padB - padT;
  const slot = W / items.length;
  const bw = Math.min(15, slot / 3.2);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-3 text-[11.5px] font-bold text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: aColor }} /> {aLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: bColor }} /> {bLabel}
        </span>
        {hover !== null && (
          <span className="mr-auto tabular-nums text-[var(--ink)]">
            {items[hover].label} · {KWD(items[hover].a)} / {KWD(items[hover].b)}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label={`${aLabel} مقابل ${bLabel}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={padT + innerH * f} y2={padT + innerH * f} stroke="var(--line)" strokeWidth="1" />
        ))}
        {items.map((p, i) => {
          const cx = slot * i + slot / 2;
          const ha = (p.a / max) * innerH;
          const hb = (p.b / max) * innerH;
          const on = hover === i;
          return (
            <g key={p.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={cx - slot / 2} y={0} width={slot} height={H} fill={on ? "var(--surface-2)" : "transparent"} rx="6" />
              <rect x={cx + 1} y={padT + innerH - ha} width={bw} height={Math.max(2, ha)} rx="3" fill={aColor} opacity={on ? 1 : 0.92} />
              <rect x={cx - bw - 1} y={padT + innerH - hb} width={bw} height={Math.max(2, hb)} rx="3" fill={bColor} opacity={on ? 1 : 0.82} />
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--muted)">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================ حلقة النسبة ============================ */

/** حلقة إشغال متحركة — الرقم في المنتصف. */
export function Gauge({
  value, size = 132, stroke = 12, track = "rgba(255,255,255,.18)", color = "var(--gold)", label,
}: { value: number; size?: number; stroke?: number; track?: string; color?: string; label?: string }) {
  const r = (100 - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pctv = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(pctv / 100) * c} ${c}`}
          style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="display text-[26px] leading-none tabular-nums">{Math.round(pctv)}<span className="text-[15px]">%</span></p>
        {label && <p className="mt-1 text-[10.5px] opacity-70">{label}</p>}
      </div>
    </div>
  );
}

/* ================================ دونات ================================= */

export interface Slice { label: string; value: number; color: string }

export function Donut({ slices, center, sub, size = 168 }: { slices: Slice[]; center: string; sub?: string; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size * 0.72, height: size * 0.72 }}>
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="16" />
          {slices.map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.label}
                cx="70" cy="70" r={R} fill="none"
                stroke={s.color} strokeWidth="16" strokeLinecap="round"
                strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
                strokeDashoffset={-offset}
                style={{ transition: "stroke-dasharray .6s ease" }}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <p className="display text-[15px] leading-tight tabular-nums">{center}</p>
          {sub && <p className="text-[10.5px] text-[var(--muted)]">{sub}</p>}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-[var(--ink-2)]">{s.label}</span>
            <span className="shrink-0 font-extrabold tabular-nums">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================== خط بياني ================================ */

export function Sparkline({ values, color = "var(--primary)", height = 44 }: { values: number[]; color?: string; height?: number }) {
  const pts = [...values].reverse();
  const max = Math.max(1, ...pts);
  const min = Math.min(0, ...pts);
  const W = 120, H = height;
  const d = pts
    .map((v, i) => {
      const x = (i / Math.max(1, pts.length - 1)) * W;
      const y = H - ((v - min) / (max - min || 1)) * (H - 6) - 3;
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} aria-hidden>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill={color} opacity="0.1" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* =========================== شريط أفقي مقارن =========================== */

export function HBars({ items }: { items: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="font-semibold text-[var(--ink-2)]">{i.label}</span>
            <span className="font-extrabold tabular-nums">{KWD(i.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? "var(--primary)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
