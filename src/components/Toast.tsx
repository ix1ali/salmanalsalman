"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { Icon } from "./Icons";

type Kind = "success" | "error" | "info" | "warn";
interface Toast { id: number; kind: Kind; text: string }

const Ctx = createContext<{ push: (text: string, kind?: Kind) => void } | null>(null);

const STYLE: Record<Kind, { bg: string; fg: string; icon: string }> = {
  success: { bg: "var(--ok-050)", fg: "var(--ok)", icon: "checkCircle" },
  error: { bg: "var(--danger-050)", fg: "#b3303b", icon: "alert" },
  warn: { bg: "var(--warn-050)", fg: "var(--gold-600)", icon: "alert" },
  info: { bg: "var(--sky-050)", fg: "var(--primary)", icon: "info" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((text: string, kind: Kind = "success") => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, kind, text }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[200] flex flex-col items-center gap-2 px-4 no-print">
        {items.map((t) => {
          const s = STYLE[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className="anim-pop pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-bold shadow-[var(--sh-3)]"
              style={{ background: s.bg, color: s.fg, border: `1px solid ${s.fg}22` }}
            >
              <Icon name={s.icon} size={18} />
              <span className="flex-1">{t.text}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used inside ToastProvider");
  return c.push;
}
