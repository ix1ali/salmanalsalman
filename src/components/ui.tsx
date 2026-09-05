"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "./Icons";

/* ------------------------------- Section ------------------------------- */

export function PageHeader({
  title, subtitle, icon, actions,
}: { title: string; subtitle?: string; icon?: IconName; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2.5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary-050)] text-[var(--primary-700)]">
            <Icon name={icon} size={22} />
          </span>
        )}
        <div>
          <h1 className="text-xl leading-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-[var(--muted)]">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="no-scrollbar flex w-full shrink-0 items-center gap-2 overflow-x-auto no-print sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

export function SectionTitle({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-extrabold text-[var(--ink)]">{children}</h2>
      {extra}
    </div>
  );
}

/* --------------------------------- Chip -------------------------------- */

/**
 * لوحة مقيّدة عمدًا: كحلي (العلامة) + ذهبي (تمييز) + ثلاث حالات.
 * الأسماء القديمة محفوظة كمرادفات حتى تبقى الاستدعاءات متسقة اللون.
 */
export const TONES = {
  teal: { bg: "var(--primary-050)", fg: "var(--primary)" },      // كحلي
  sky: { bg: "var(--primary-050)", fg: "var(--primary-600)" },
  violet: { bg: "var(--steel-050)", fg: "var(--steel)" },
  gold: { bg: "var(--gold-050)", fg: "var(--gold-600)" },
  amber: { bg: "var(--gold-050)", fg: "var(--gold-600)" },
  green: { bg: "var(--ok-050)", fg: "var(--ok)" },
  rose: { bg: "var(--danger-050)", fg: "#b3303b" },
  slate: { bg: "var(--steel-050)", fg: "var(--steel)" },
} as const;
export type Tone = keyof typeof TONES;

export function Chip({ tone = "slate", children, icon }: { tone?: Tone; children: React.ReactNode; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <span className="chip" style={{ background: t.bg, color: t.fg }}>
      {icon && <Icon name={icon} size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

/* -------------------------------- Stats -------------------------------- */

export function StatCard({
  label, value, sub, icon, tone = "teal", trend, onClick,
}: {
  label: string; value: string; sub?: string; icon: IconName; tone?: Tone;
  trend?: { dir: "up" | "down"; text: string }; onClick?: () => void;
}) {
  const t = TONES[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`card card-lg w-full p-3.5 text-right transition ${onClick ? "hover:shadow-[var(--sh-2)] active:scale-[.985]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: t.bg, color: t.fg }}>
          <Icon name={icon} size={18} />
        </span>
        {trend && (
          <span
            className="chip"
            style={{
              background: trend.dir === "up" ? "var(--ok-050)" : "var(--danger-050)",
              color: trend.dir === "up" ? "var(--ok)" : "#b3303b",
            }}
          >
            <Icon name={trend.dir === "up" ? "arrowUp" : "arrowDown"} size={12} strokeWidth={2.6} />
            {trend.text}
          </span>
        )}
      </div>
      <p className="mt-2.5 text-[11.5px] font-bold text-[var(--muted)]">{label}</p>
      <p className="display mt-0.5 text-[19px] leading-tight text-[var(--ink)] tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{sub}</p>}
    </Tag>
  );
}

export function Progress({ value, tone = "teal", height = 8 }: { value: number; tone?: Tone; height?: number }) {
  const t = TONES[tone];
  return (
    <div className="w-full overflow-hidden rounded-full bg-[var(--line)]" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: t.fg, opacity: 0.85 }}
      />
    </div>
  );
}

/* -------------------------------- Fields ------------------------------- */

export function Field({
  label, children, hint, required, className = "",
}: { label: string; children: React.ReactNode; hint?: string; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <label className="label">
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`select ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`textarea ${props.className ?? ""}`} rows={props.rows ?? 3} />;
}

export function SearchBox({
  value, onChange, placeholder = "بحث…",
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
        <Icon name="search" size={17} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pr-9"
        inputMode="search"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-2)]"
          aria-label="مسح"
        >
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------- Segmented ----------------------------- */

export function Segmented<T extends string>({
  options, value, onChange, size = "md",
}: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            data-on={on}
            className={`pill-nav shrink-0 border ${on ? "border-transparent" : "border-[var(--line)] bg-[var(--surface)]"} ${size === "sm" ? "!px-3 !py-1 !text-[12px]" : ""}`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`rounded-full px-1.5 text-[11px] ${on ? "bg-white/70" : "bg-[var(--bg-soft)]"}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- Sheet ------------------------------- */

export function Sheet({
  open, onClose, title, children, footer, wide,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center no-print" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="absolute inset-0 bg-[#0b1b2b]/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`anim-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[26px] bg-[var(--surface)] shadow-[var(--sh-3)] sm:anim-pop sm:rounded-[24px] ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <h3 id={id} className="text-base font-extrabold">{title}</h3>
          <button onClick={onClose} className="btn btn-icon btn-ghost" aria-label="إغلاق">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------- Confirm ------------------------------- */

export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);

  const confirm = (title: string, body: string, danger = true) =>
    new Promise<boolean>((resolve) => setState({ title, body, danger, resolve }));

  const dialog = state ? (
    <div className="fixed inset-0 z-[180] grid place-items-center px-6 no-print">
      <div className="absolute inset-0 bg-[#0b1b2b]/50" onClick={() => { state.resolve(false); setState(null); }} />
      <div className="anim-pop relative w-full max-w-sm rounded-3xl bg-[var(--surface)] p-5 shadow-[var(--sh-3)]">
        <div
          className="mb-3 grid h-12 w-12 place-items-center rounded-2xl"
          style={{ background: state.danger ? "var(--danger-050)" : "var(--warn-050)", color: state.danger ? "#b3303b" : "var(--gold-600)" }}
        >
          <Icon name="alert" size={24} />
        </div>
        <h3 className="text-lg">{state.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{state.body}</p>
        <div className="mt-5 flex gap-2">
          <button
            className={`btn flex-1 ${state.danger ? "btn-danger" : "btn-primary"}`}
            onClick={() => { state.resolve(true); setState(null); }}
          >
            تأكيد
          </button>
          <button className="btn btn-ghost flex-1" onClick={() => { state.resolve(false); setState(null); }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}

/* -------------------------------- Empty -------------------------------- */

export function Empty({ icon = "box", title, body, action }: { icon?: IconName; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-12 text-center">
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--bg-soft)] text-[var(--muted)]">
        <Icon name={icon} size={26} />
      </span>
      <p className="font-extrabold text-[var(--ink)]">{title}</p>
      {body && <p className="mt-1 max-w-xs text-[13px] text-[var(--muted)]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------ Data rows ------------------------------ */

export function KeyVal({ k, v, icon }: { k: string; v: React.ReactNode; icon?: IconName }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2 last:border-0">
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--muted)]">
        {icon && <Icon name={icon} size={14} />}
        {k}
      </span>
      <span className="text-[13.5px] font-bold text-[var(--ink)]">{v}</span>
    </div>
  );
}

/** جدول يتحول إلى بطاقات على الجوال. */
export function ScrollTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead className="bg-[var(--surface-2)]">
            <tr>{head.map((h) => <th key={h} className="th">{h}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ Copy button ---------------------------- */

export function CopyButton({ text, label = "نسخ" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
      }}
    >
      <Icon name={done ? "check" : "file"} size={14} />
      {done ? "تم النسخ" : label}
    </button>
  );
}

/* ------------------------------ Long press ----------------------------- */

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function usePrint() {
  const ref = useRef<HTMLDivElement>(null);
  return { ref, print: () => window.print() };
}
