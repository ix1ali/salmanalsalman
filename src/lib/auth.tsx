"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import { hashPassword, randomSalt, verifyPassword } from "./crypto";
import type { Role, User } from "./types";
import { can, type Perm } from "./permissions";

const SESSION_KEY = "aqar:session";
const LOCK_KEY = "aqar:lockouts";
const IDLE_KEY = "aqar:last-activity";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 90;
const IDLE_MINUTES = 20;

interface Session { userId: string; iat: number; exp: number; fp: string }
interface Lock { fails: number; until: number }

type LoginResult = { ok: true } | { ok: false; message: string; waitSeconds?: number };

interface AuthCtx {
  user: User | null;
  role: Role | undefined;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: (reason?: string) => void;
  allow: (perm: Perm) => boolean;
  changePassword: (userId: string, current: string | null, next: string) => Promise<LoginResult>;
  lockInfo: (username: string) => { locked: boolean; waitSeconds: number; remaining: number };
  notice: string | null;
  clearNotice: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const readLocks = (): Record<string, Lock> => {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) || "{}"); } catch { return {}; }
};
const writeLocks = (l: Record<string, Lock>) => {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(l)); } catch {}
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, update } = useStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const endSession = useCallback((reason?: string) => {
    localStorage.removeItem(SESSION_KEY);
    setUserId(null);
    if (reason) setNotice(reason);
  }, []);

  // Restore session on load, honouring both absolute expiry and idle timeout.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s: Session = JSON.parse(raw);
        const idle = Number(localStorage.getItem(IDLE_KEY) || 0);
        const idleExpired = idle && Date.now() - idle > IDLE_MINUTES * 60_000;
        const u = data.users.find((x) => x.id === s.userId);
        if (!u || !u.active) endSession();
        else if (Date.now() > s.exp) endSession("انتهت الجلسة، سجّل الدخول مرة أخرى.");
        else if (idleExpired) endSession("تم تسجيل خروجك تلقائيًا لعدم النشاط.");
        else if (s.fp !== u.hash.slice(0, 12)) endSession("تم تغيير كلمة المرور، سجّل الدخول مرة أخرى.");
        else setUserId(s.userId);
      }
    } catch {
      endSession();
    }
    setLoading(false);
    // Intentionally runs once: session restore is a boot-time concern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle tracking + periodic expiry check.
  useEffect(() => {
    if (!userId) return;
    const touch = () => { try { localStorage.setItem(IDLE_KEY, String(Date.now())); } catch {} };
    touch();
    const evts = ["pointerdown", "keydown", "scroll", "visibilitychange"] as const;
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const iv = setInterval(() => {
      const idle = Number(localStorage.getItem(IDLE_KEY) || 0);
      if (idle && Date.now() - idle > IDLE_MINUTES * 60_000) endSession("تم تسجيل خروجك تلقائيًا لعدم النشاط.");
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s: Session = JSON.parse(raw);
        if (Date.now() > s.exp) endSession("انتهت الجلسة، سجّل الدخول مرة أخرى.");
      }
    }, 30_000);
    return () => {
      evts.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(iv);
    };
  }, [userId, endSession]);

  const lockInfo = useCallback((username: string) => {
    const locks = readLocks();
    const l = locks[username.toLowerCase()];
    if (!l) return { locked: false, waitSeconds: 0, remaining: MAX_ATTEMPTS };
    const wait = Math.max(0, Math.ceil((l.until - Date.now()) / 1000));
    return { locked: wait > 0, waitSeconds: wait, remaining: Math.max(0, MAX_ATTEMPTS - l.fails) };
  }, []);

  const login = useCallback<AuthCtx["login"]>(async (username, password) => {
    const uname = username.trim().toLowerCase();
    if (!uname || !password) return { ok: false, message: "أدخل اسم المستخدم وكلمة المرور." };

    const locks = readLocks();
    const l = locks[uname];
    if (l && l.until > Date.now()) {
      const wait = Math.ceil((l.until - Date.now()) / 1000);
      return { ok: false, message: `تم إيقاف المحاولات مؤقتًا. حاول بعد ${wait} ثانية.`, waitSeconds: wait };
    }

    const u = data.users.find((x) => x.username.toLowerCase() === uname);
    // Always run a hash so a wrong username costs the same time as a wrong password.
    const okPass = u
      ? await verifyPassword(password, u.salt, u.hash)
      : (await hashPassword(password, "decoy-salt"), false);

    if (!u || !okPass) {
      const fails = (l?.fails ?? 0) + 1;
      locks[uname] = { fails, until: fails >= MAX_ATTEMPTS ? Date.now() + LOCK_SECONDS * 1000 : 0 };
      if (fails >= MAX_ATTEMPTS) locks[uname].fails = 0;
      writeLocks(locks);
      const left = MAX_ATTEMPTS - fails;
      return {
        ok: false,
        message: left > 0
          ? `اسم المستخدم أو كلمة المرور غير صحيحة. المحاولات المتبقية: ${left}`
          : `تم إيقاف المحاولات ${LOCK_SECONDS} ثانية بعد ${MAX_ATTEMPTS} محاولات فاشلة.`,
      };
    }

    if (!u.active) return { ok: false, message: "هذا الحساب موقوف. راجع المدير." };

    delete locks[uname];
    writeLocks(locks);

    const session: Session = {
      userId: u.id,
      iat: Date.now(),
      exp: Date.now() + data.settings.sessionMinutes * 60_000,
      fp: u.hash.slice(0, 12),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(IDLE_KEY, String(Date.now()));
    setUserId(u.id);
    setNotice(null);
    update(
      (d) => {
        const target = d.users.find((x) => x.id === u.id);
        if (target) target.lastLoginAt = new Date().toISOString();
      },
      { action: "تسجيل دخول", detail: `${u.displayName} (${u.username})`, actor: u.username }
    );
    return { ok: true };
  }, [data.users, data.settings.sessionMinutes, update]);

  const changePassword = useCallback<AuthCtx["changePassword"]>(async (targetId, current, next) => {
    const target = data.users.find((x) => x.id === targetId);
    if (!target) return { ok: false, message: "المستخدم غير موجود." };
    if (current !== null && !(await verifyPassword(current, target.salt, target.hash)))
      return { ok: false, message: "كلمة المرور الحالية غير صحيحة." };
    if (next.length < 8) return { ok: false, message: "كلمة المرور يجب ألا تقل عن ٨ أحرف." };
    const salt = randomSalt();
    const hash = await hashPassword(next, salt);
    update(
      (d) => {
        const t = d.users.find((x) => x.id === targetId);
        if (t) { t.salt = salt; t.hash = hash; t.mustChangePassword = false; }
      },
      { action: "تغيير كلمة مرور", detail: target.username }
    );
    if (targetId === userId) {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s: Session = JSON.parse(raw);
        s.fp = hash.slice(0, 12);
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      }
    }
    return { ok: true };
  }, [data.users, update, userId]);

  const user = useMemo(() => data.users.find((u) => u.id === userId) ?? null, [data.users, userId]);

  const logout = useCallback((reason?: string) => {
    if (user) update(() => {}, { action: "تسجيل خروج", detail: user.displayName, actor: user.username });
    endSession(reason);
  }, [user, update, endSession]);

  const allow = useCallback((perm: Perm) => can(user?.role, perm), [user?.role]);

  const value = useMemo<AuthCtx>(
    () => ({ user, role: user?.role, loading, login, logout, allow, changePassword, lockInfo, notice, clearNotice: () => setNotice(null) }),
    [user, loading, login, logout, allow, changePassword, lockInfo, notice]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
