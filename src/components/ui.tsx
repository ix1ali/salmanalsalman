"use client";

import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icons";
import { amount, monthAr } from "@/lib/format";

/* ================================ المبالغ ================================ */

/**
 * كل مبلغ مالي يمر من هنا فيظهر دائمًا مصحوبًا بـ «د.ك»،
 * ليُميَّز بلا لبس عن الأرقام المجرّدة (عدد الوحدات، الأشهر…).
 */
export function Money({
  v, className = "", size = "md", tone,
}: { v: number; className?: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; tone?: string }) {
  const s = {
    xs: "text-[11.5px]", sm: "text-[12.5px]", md: "text-[14px]",
    lg: "text-[19px]", xl: "text-[26px]",
  }[size];
  return (
    <span
      className={`inline-flex items-baseline gap-1 whitespace-nowrap ${s} ${className}`}
      style={tone ? { color: tone } : undefined}
    >
      <span className="num font-bold">{amount(v)}</span>
      <span className="text-[0.7em] font-semibold opacity-55">د.ك</span>
    </span>
  );
}

/* ============================== رأس الصفحة ============================== */

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; icon?: IconName; actions?: React.ReactNode }) {
  return (
    <div className="mb-3 flex min-h-[34px] items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="t-display truncate">{title}</h1>
        {subtitle && <p className="t-xs mt-0.5 truncate text-[var(--muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5 no-print">{actions}</div>}
    </div>
  );
}

/* ================================= لوح ================================= */

export function Panel({
  title, action, children, className = "", flush,
}: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="panel-head">
          <h2 className="panel-title">{title}</h2>
          {action}
        </header>
      )}
      <div className={flush ? "" : "p-3.5"}>{children}</div>
    </section>
  );
}

/* ================================ الحالة ================================ */

export const TONES = {
  teal: { bg: "var(--primary-050)", fg: "var(--primary)" },
  sky: { bg: "var(--primary-050)", fg: "var(--primary)" },
  violet: { bg: "var(--steel-050)", fg: "var(--steel)" },
  gold: { bg: "var(--gold-050)", fg: "var(--gold-600)" },
  amber: { bg: "var(--warn-050)", fg: "var(--warn)" },
  green: { bg: "var(--ok-050)", fg: "var(--ok)" },
  rose: { bg: "var(--danger-050)", fg: "var(--danger)" },
  slate: { bg: "var(--steel-050)", fg: "var(--steel)" },
} as const;
export type Tone = keyof typeof TONES;

export function Chip({ tone = "slate", children, icon }: { tone?: Tone; children: React.ReactNode; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <span className="tag" style={{ background: t.bg, color: t.fg }}>
      {icon && <Icon name={icon} size={11} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}

/* ============================== شريط فلاتر ============================== */

export function Filters<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar fade-edge -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} data-on={o.value === value} className="chip shrink-0">
          {o.label}
          {o.count !== undefined && <span className="chip-n num">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** مرادف — نفس شريط الفلاتر. */
export const Segmented = Filters;

/* ============================== منتقي الشهر ============================== */

export function MonthPicker({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const shift = (n: number) => {
    const [y, m] = value.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <div className="inline-flex items-center overflow-hidden rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)]">
      <button onClick={() => shift(1)} className="px-2.5 py-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)]" aria-label="الشهر التالي">
        <Icon name="chevronRight" size={15} />
      </button>
      <span className="min-w-[108px] border-x border-[var(--line)] px-2 py-1.5 text-center text-[13px] font-semibold">
        {monthAr(value)}
      </span>
      <button onClick={() => shift(-1)} className="px-2.5 py-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)]" aria-label="الشهر السابق">
        <Icon name="chevronLeft" size={15} />
      </button>
    </div>
  );
}

/* ================================ الحقول ================================ */

export function Field({
  label, children, hint, required, className = "",
}: { label: string; children: React.ReactNode; hint?: string; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <label className="label">
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </label>
      {children}
      {hint && <p className="t-xs mt-1 text-[var(--muted)]">{hint}</p>}
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
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]">
        <Icon name="search" size={16} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pr-8"
        inputMode="search"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)]"
          aria-label="مسح"
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

/* ================================ النوافذ ================================ */

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

  if (!open || typeof document === "undefined") return null;

  // بوابة إلى body: الشريط العلوي يستخدم backdrop-filter وهو ينشئ حاوية
  // جديدة للعناصر الثابتة، فكانت النوافذ تُقصّ خارج حدود الشاشة.
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center no-print sm:items-center" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="anim-fade absolute inset-0 bg-[#0b1a2c]/45" onClick={onClose} />
      <div
        className={`anim-sheet relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-[var(--sh-3)] sm:anim-pop sm:max-h-[88dvh] sm:rounded-xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
          <h3 id={id} className="t-title truncate">{title}</h3>
          <button onClick={onClose} className="btn btn-icon btn-ghost" aria-label="إغلاق">
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3.5">{children}</div>
        {footer && <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);

  const confirm = (title: string, body: string, danger = true) =>
    new Promise<boolean>((resolve) => setState({ title, body, danger, resolve }));

  const dialog = state && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[180] grid place-items-center px-6 no-print">
      <div className="anim-fade absolute inset-0 bg-[#0b1a2c]/50" onClick={() => { state.resolve(false); setState(null); }} />
      <div className="anim-pop relative w-full max-w-sm rounded-xl bg-[var(--surface)] p-4 shadow-[var(--sh-3)]">
        <h3 className="t-title">{state.title}</h3>
        <p className="t-sm mt-1.5 leading-relaxed text-[var(--muted)]">{state.body}</p>
        <div className="mt-4 flex gap-2">
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
    </div>,
    document.body
  ) : null;

  return { confirm, dialog };
}

/* ================================ فارغ ================================= */

export function Empty({ icon = "box", title, body, action }: { icon?: IconName; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Icon name={icon} size={26} className="text-[var(--line-strong)]" />
      <p className="t-section mt-2.5">{title}</p>
      {body && <p className="t-sm mt-1 max-w-xs text-[var(--muted)]">{body}</p>}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

/* ============================== عناصر بيانات ============================== */

export function KeyVal({ k, v }: { k: string; v: React.ReactNode; icon?: IconName }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-1.5 last:border-0">
      <span className="t-sm shrink-0 text-[var(--muted)]">{k}</span>
      <span className="t-sm text-left font-semibold text-[var(--ink)]">{v}</span>
    </div>
  );
}

export function Progress({ value, tone = "teal", height = 6 }: { value: number; tone?: Tone; height?: number }) {
  const fg = tone === "green" ? "var(--ok)"
    : tone === "gold" || tone === "amber" ? "var(--gold)"
    : tone === "rose" ? "var(--danger)"
    : "var(--primary)";
  return (
    <div className="w-full overflow-hidden rounded-full bg-[var(--surface-3)]" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: fg }}
      />
    </div>
  );
}

export function ScrollTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr>{head.map((h) => <th key={h} className="th">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function CopyButton({ text, label = "نسخ" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
      }}
    >
      <Icon name={done ? "check" : "file"} size={13} />
      {done ? "تم النسخ" : label}
    </button>
  );
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
