"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "./types";
import { buildSeed } from "./seed";
import { uid } from "./crypto";
import { allKeys, delBlob } from "./idb";
import { CLOUD, cloudError, sb } from "./cloud";
import { REALTIME_TABLES, emptyData, fetchAll, fetchTable, pushAll, pushDiff } from "./cloudData";

const KEY = "aqar:data:v1";
const BKEY = "aqar:active-building";

/**
 * المصدر الوحيد للبيانات في النظام كله.
 *
 * وضعان لا يعرف عنهما بقيةُ التطبيق شيئًا:
 *  • السحابة (Supabase): البيانات مشتركة بين كل المستخدمين وتتحدّث لحظيًا،
 *    وكل تعديل يمرّ عبر `update` فيُرسَل فرقُه إلى قاعدة البيانات.
 *  • محلي: تخزين على هذا الجهاز فقط للتجربة قبل الربط.
 */
interface StoreCtx {
  ready: boolean;
  data: AppData;
  update: (mutator: (draft: AppData) => void, audit?: { action: string; detail: string; actor?: string }) => void;
  activeBuilding: string;
  setActiveBuilding: (id: string) => void;
  resetAll: () => Promise<void>;
  exportBackup: () => void;
  importBackup: (file: File) => Promise<void>;
  /** حالة الاتصال بالسحابة — تُعرض في الشريط العلوي. */
  cloud: { on: boolean; signedIn: boolean; syncing: boolean; error: string | null };
  /** يرفع بيانات المكتب إلى قاعدة فارغة أول مرة (للمدير). */
  seedCloud: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [ready, setReady] = useState(false);
  const [activeBuilding, setActive] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<AppData | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  latest.current = data;

  /* ------------------------- اختيار العقار النشط ------------------------- */
  const pickBuilding = useCallback((d: AppData) => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(BKEY) : null;
    const valid = saved && d.buildings.some((b) => b.id === saved) ? saved : d.buildings[0]?.id ?? "";
    setActive(valid);
  }, []);

  /* ================================ السحابة ================================ */

  const load = useCallback(async () => {
    try {
      const d = await fetchAll();
      setData(d);
      pickBuilding(d);
      setError(null);
    } catch (e) {
      setError(cloudError(e));
      setData((p) => p ?? emptyData());
    } finally {
      setReady(true);
    }
  }, [pickBuilding]);

  useEffect(() => {
    if (!CLOUD) return;
    let alive = true;

    sb().auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      setSignedIn(!!session);
      if (session) load();
      else { setData(emptyData()); setReady(true); }
    });

    const { data: sub } = sb().auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      setSignedIn(!!session);
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") { if (session) load(); }
      if (event === "SIGNED_OUT") { setData(emptyData()); setReady(true); }
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [load]);

  // اشتراك لحظي: أي تعديل من أي مستخدم يصل إلى بقية الأجهزة فورًا
  useEffect(() => {
    if (!CLOUD || !signedIn) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const refresh = (table: string) => {
      clearTimeout(timers.get(table));
      timers.set(table, setTimeout(async () => {
        try {
          const part = await fetchTable(table);
          setData((p) => (p ? { ...p, ...part } : p));
        } catch { /* تُلتقط عند إعادة التحميل التالية */ }
      }, 250));
    };

    const ch = sb().channel("aqar-live");
    REALTIME_TABLES.forEach((t) => {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => refresh(t));
    });
    ch.subscribe();

    return () => {
      timers.forEach((t) => clearTimeout(t));
      sb().removeChannel(ch);
    };
  }, [signedIn]);

  /* ================================= محلي ================================= */

  useEffect(() => {
    if (CLOUD) return;
    let cancelled = false;
    (async () => {
      let loaded: AppData | null = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) loaded = JSON.parse(raw) as AppData;
      } catch {
        loaded = null;
      }
      // ترقية المخطط: البيانات الأقدم من الإصدار الحالي تُبنى من جديد
      if (!loaded || !loaded.users?.length || (loaded.version ?? 1) < 5) loaded = await buildSeed();
      if (cancelled) return;
      setData(loaded);
      pickBuilding(loaded);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [pickBuilding]);

  useEffect(() => {
    if (CLOUD || !data || !ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        console.warn("تعذر حفظ البيانات محليًا");
      }
    }, 250);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data, ready]);

  /* ================================ التعديل ================================ */

  const update = useCallback<StoreCtx["update"]>((mutator, audit) => {
    const prev = latest.current;
    if (!prev) return;

    const draft: AppData = structuredClone(prev);
    mutator(draft);
    if (audit) {
      draft.audit = [
        { id: uid("a-"), at: new Date().toISOString(), actor: audit.actor ?? "—", action: audit.action, detail: audit.detail },
        ...draft.audit,
      ].slice(0, 400);
    }

    latest.current = draft;
    setData(draft);

    if (!CLOUD) return;

    pending.current += 1;
    setSyncing(true);
    queue.current = queue.current
      .then(() => pushDiff(prev, draft))
      .then(() => setError(null))
      .catch(async (e) => {
        setError(cloudError(e));
        // الخادم هو المرجع: نعيد قراءة الحالة الصحيحة بدل ترك فرق صامت
        try {
          const fresh = await fetchAll();
          latest.current = fresh;
          setData(fresh);
        } catch { /* تُعالَج في المحاولة التالية */ }
      })
      .finally(() => {
        pending.current -= 1;
        if (pending.current === 0) setSyncing(false);
      });
  }, []);

  const setActiveBuilding = useCallback((id: string) => {
    setActive(id);
    try { localStorage.setItem(BKEY, id); } catch {}
  }, []);

  const reload = useCallback(async () => { if (CLOUD) await load(); }, [load]);

  const seedCloud = useCallback(async () => {
    const seed = await buildSeed();
    const current = latest.current ?? emptyData();
    await pushAll({ ...seed, users: current.users, settings: seed.settings });
    await load();
  }, [load]);

  const resetAll = useCallback(async () => {
    if (CLOUD) throw new Error("في الوضع السحابي تُحذف البيانات من لوحة Supabase.");
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
    const safe = { ...data, users: data.users.map((u) => ({ ...u, salt: "", hash: "" })) };
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
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
    if (CLOUD) {
      const current = latest.current ?? emptyData();
      await pushDiff(current, { ...parsed, users: current.users });
      await load();
      return;
    }
    setData(parsed);
    localStorage.setItem(KEY, JSON.stringify(parsed));
  }, [load]);

  const cloud = useMemo(
    () => ({ on: CLOUD, signedIn, syncing, error }),
    [signedIn, syncing, error]
  );

  const value = useMemo<StoreCtx | null>(
    () => (data
      ? { ready, data, update, activeBuilding, setActiveBuilding, resetAll, exportBackup, importBackup, cloud, seedCloud, reload }
      : null),
    [data, ready, update, activeBuilding, setActiveBuilding, resetAll, exportBackup, importBackup, cloud, seedCloud, reload]
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
