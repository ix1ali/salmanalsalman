"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "./types";
import { buildSeed } from "./seed";
import { uid } from "./crypto";
import { allKeys, delBlob } from "./idb";

const KEY = "aqar:data:v1";
const BKEY = "aqar:active-building";

/**
 * Single source of truth for the whole app.
 *
 * Today it persists to localStorage (+ IndexedDB for file blobs) so everything
 * works with zero backend. Every mutation goes through `update()`, which is the
 * one seam to replace when moving to Supabase — see src/lib/supabase/README.md.
 */
interface StoreCtx {
  ready: boolean;
  data: AppData;
  update: (mutator: (draft: AppData) => void, audit?: { action: string; detail: string; actor?: string }) => void;
  activeBuilding: string; // "all" or a building id
  setActiveBuilding: (id: string) => void;
  resetAll: () => Promise<void>;
  exportBackup: () => void;
  importBackup: (file: File) => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [ready, setReady] = useState(false);
  const [activeBuilding, setActive] = useState("all");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded: AppData | null = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) loaded = JSON.parse(raw) as AppData;
      } catch {
        loaded = null;
      }
      if (!loaded || !loaded.users?.length) loaded = await buildSeed();
      if (cancelled) return;
      setData(loaded);
      setActive(localStorage.getItem(BKEY) || "all");
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced persistence — writing 90+ units on every keystroke would be wasteful.
  useEffect(() => {
    if (!data || !ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        // Quota exceeded: structured data is small, blobs live in IndexedDB.
        console.warn("تعذر حفظ البيانات محليًا");
      }
    }, 250);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data, ready]);

  const update = useCallback<StoreCtx["update"]>((mutator, audit) => {
    setData((prev) => {
      if (!prev) return prev;
      const draft: AppData = structuredClone(prev);
      mutator(draft);
      if (audit) {
        draft.audit = [
          { id: uid("a-"), at: new Date().toISOString(), actor: audit.actor ?? "—", action: audit.action, detail: audit.detail },
          ...draft.audit,
        ].slice(0, 400);
      }
      return draft;
    });
  }, []);

  const setActiveBuilding = useCallback((id: string) => {
    setActive(id);
    try { localStorage.setItem(BKEY, id); } catch {}
  }, []);

  const resetAll = useCallback(async () => {
    const fresh = await buildSeed();
    try {
      const keys = await allKeys();
      await Promise.all(keys.map((k) => delBlob(String(k))));
    } catch {}
    setData(fresh);
    localStorage.setItem(KEY, JSON.stringify(fresh));
  }, []);

  const exportBackup = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [data]);

  const importBackup = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as AppData;
    if (!parsed.users || !parsed.buildings) throw new Error("الملف غير صالح");
    setData(parsed);
    localStorage.setItem(KEY, JSON.stringify(parsed));
  }, []);

  const value = useMemo<StoreCtx | null>(
    () => (data ? { ready, data, update, activeBuilding, setActiveBuilding, resetAll, exportBackup, importBackup } : null),
    [data, ready, update, activeBuilding, setActiveBuilding, resetAll, exportBackup, importBackup]
  );

  if (!value) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--line)] border-t-[var(--primary)]" />
          <p className="text-sm text-[var(--muted)]">جاري تجهيز النظام…</p>
        </div>
      </div>
    );
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used inside StoreProvider");
  return c;
}
