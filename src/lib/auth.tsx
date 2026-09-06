"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import { hashPassword, randomSalt, uid, verifyPassword } from "./crypto";
import type { Role, User } from "./types";
import { can, type Perm } from "./permissions";
import { CLOUD, cloudError, emailOf, normalizeUsername, sb } from "./cloud";

const SESSION_KEY = "aqar:session";
const LOCK_KEY = "aqar:lockouts";
const IDLE_KEY = "aqar:last-activity";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 90;
const IDLE_MINUTES = 720;   // 12 ساعة — لا نطرد المستخدم أثناء العمل

interface Session { userId: string; iat: number; exp: number; fp: string }
interface Lock { fails: number; until: number }

export type AuthResult = { ok: true } | { ok: false; message: string; waitSeconds?: number };

export interface NewUser {
  username: string;
  displayName: string;
  role: Role;
  phone?: string;
  password: string;
}

interface AuthCtx {
  user: User | null;
  role: Role | undefined;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: (reason?: string) => void;
  allow: (perm: Perm) => boolean;
  changePassword: (userId: string, current: string | null, next: string) => Promise<AuthResult>;
  lockInfo: (username: string) => { locked: boolean; waitSeconds: number; remaining: number };
  notice: string | null;
  clearNotice: () => void;
  /** إدارة الحسابات — تختلف آليتها بين المحلي والسحابي وتتوحّد هنا. */
  createUser: (u: NewUser) => Promise<AuthResult>;
  saveUser: (id: string, patch: Partial<Pick<User, "displayName" | "role" | "phone" | "username" | "active">>) => Promise<AuthResult>;
  removeUser: (id: string) => Promise<AuthResult>;
  /** هل يمكن تغيير اسم المستخدم بعد الإنشاء؟ (لا في الوضع السحابي) */
  canRenameUsers: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const readLocks = (): Record<string, Lock> => {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) || "{}"); } catch { return {}; }
};
const writeLocks = (l: Record<string, Lock>) => {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(l)); } catch {}
};

/** إيقاف مؤقت بعد محاولات فاشلة — على الجهاز، فوق حماية الخادم نفسه. */
function useLockout() {
  const lockInfo = useCallback((username: string) => {
    const l = readLocks()[normalizeUsername(username)];
    if (!l) return { locked: false, waitSeconds: 0, remaining: MAX_ATTEMPTS };
    const wait = Math.max(0, Math.ceil((l.until - Date.now()) / 1000));
    return { locked: wait > 0, waitSeconds: wait, remaining: Math.max(0, MAX_ATTEMPTS - l.fails) };
  }, []);

  const guard = useCallback((username: string): AuthResult | null => {
    const l = readLocks()[normalizeUsername(username)];
    if (l && l.until > Date.now()) {
      const wait = Math.ceil((l.until - Date.now()) / 1000);
      return { ok: false, message: `تم إيقاف المحاولات مؤقتًا. حاول بعد ${wait} ثانية.`, waitSeconds: wait };
    }
    return null;
  }, []);

  const fail = useCallback((username: string, message: string): AuthResult => {
    const uname = normalizeUsername(username);
    const locks = readLocks();
    const fails = (locks[uname]?.fails ?? 0) + 1;
    locks[uname] = { fails: fails >= MAX_ATTEMPTS ? 0 : fails, until: fails >= MAX_ATTEMPTS ? Date.now() + LOCK_SECONDS * 1000 : 0 };
    writeLocks(locks);
    const left = MAX_ATTEMPTS - fails;
    return {
      ok: false,
      message: left > 0 ? `${message} المحاولات المتبقية: ${left}` : `تم إيقاف المحاولات ${LOCK_SECONDS} ثانية بعد ${MAX_ATTEMPTS} محاولات فاشلة.`,
    };
  }, []);

  const clear = useCallback((username: string) => {
    const locks = readLocks();
    delete locks[normalizeUsername(username)];
    writeLocks(locks);
  }, []);

  return { lockInfo, guard, fail, clear };
}

/** خمول المستخدم: خروج تلقائي بعد طول انقطاع. */
function useIdleLogout(active: boolean, onExpire: (reason: string) => void) {
  useEffect(() => {
    if (!active) return;
    const touch = () => { try { localStorage.setItem(IDLE_KEY, String(Date.now())); } catch {} };
    touch();
    const evts = ["pointerdown", "keydown", "scroll", "visibilitychange"] as const;
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const iv = setInterval(() => {
      const idle = Number(localStorage.getItem(IDLE_KEY) || 0);
      if (idle && Date.now() - idle > IDLE_MINUTES * 60_000) onExpire("تم تسجيل خروجك تلقائيًا لعدم النشاط.");
    }, 30_000);
    return () => {
      evts.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(iv);
    };
  }, [active, onExpire]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return CLOUD ? <CloudAuth>{children}</CloudAuth> : <LocalAuth>{children}</LocalAuth>;
}

/* ========================================================================== */
/*                          الوضع السحابي — Supabase                          */
/* ========================================================================== */

function CloudAuth({ children }: { children: React.ReactNode }) {
  const { data, update } = useStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { lockInfo, guard, fail, clear } = useLockout();

  const loadProfile = useCallback(async (id: string) => {
    const { data: row, error } = await sb()
      .from("profiles").select("*").eq("id", id).maybeSingle();
    if (error || !row) return null;
    return {
      id: String(row.id),
      username: String(row.username),
      displayName: String(row.display_name),
      role: (row.role ?? "viewer") as Role,
      salt: "", hash: "",
      active: row.active !== false,
      buildingIds: Array.isArray(row.building_ids) ? (row.building_ids as string[]) : ("all" as const),
      phone: row.phone ?? undefined,
      createdAt: String(row.created_at ?? ""),
      lastLoginAt: row.last_login_at ?? undefined,
    } satisfies User;
  }, []);

  const signOut = useCallback(async (reason?: string) => {
    try { await sb().auth.signOut(); } catch {}
    setUserId(null);
    setProfile(null);
    if (reason) setNotice(reason);
  }, []);

  // متابعة الجلسة: Supabase يتكفّل بالتجديد والانتهاء
  useEffect(() => {
    let alive = true;
    const apply = async (id: string | null) => {
      if (!alive) return;
      setUserId(id);
      if (!id) { setProfile(null); setBooted(true); return; }
      const p = await loadProfile(id);
      if (!alive) return;
      if (!p) { await signOut("لا يوجد ملف صلاحيات لهذا الحساب. راجع المدير."); setBooted(true); return; }
      if (!p.active) { await signOut("هذا الحساب موقوف. راجع المدير."); setBooted(true); return; }
      setProfile(p);
      setBooted(true);
    };

    sb().auth.getSession().then(({ data: { session } }) => apply(session?.user.id ?? null));
    const { data: sub } = sb().auth.onAuthStateChange((_e, session) => {
      apply(session?.user.id ?? null);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile, signOut]);

  // يبقى ملف المستخدم محدّثًا إذا غيّر مديرٌ آخر دوره أو أوقف حسابه
  useEffect(() => {
    if (!userId) return;
    const fresh = data.users.find((u) => u.id === userId);
    if (!fresh) return;
    if (!fresh.active) { signOut("تم إيقاف حسابك."); return; }
    setProfile((p) => (p && JSON.stringify({ ...p, lastLoginAt: "" }) === JSON.stringify({ ...fresh, lastLoginAt: "" }) ? p : fresh));
  }, [data.users, userId, signOut]);

  const onExpire = useCallback((reason: string) => { signOut(reason); }, [signOut]);
  useIdleLogout(!!userId, onExpire);

  const login = useCallback<AuthCtx["login"]>(async (username, password) => {
    const uname = normalizeUsername(username);
    if (!uname || !password) return { ok: false, message: "أدخل اسم المستخدم وكلمة المرور." };
    const blocked = guard(uname);
    if (blocked) return blocked;

    const { data: res, error } = await sb().auth.signInWithPassword({ email: emailOf(uname), password });
    if (error || !res.user) return fail(uname, cloudError(error));

    const p = await loadProfile(res.user.id);
    if (!p) { await signOut(); return { ok: false, message: "لا يوجد ملف صلاحيات لهذا الحساب. راجع المدير." }; }
    if (!p.active) { await signOut(); return { ok: false, message: "هذا الحساب موقوف. راجع المدير." }; }

    clear(uname);
    setNotice(null);
    setUserId(res.user.id);
    setProfile(p);
    try { localStorage.setItem(IDLE_KEY, String(Date.now())); } catch {}
    try {
      await sb().rpc("touch_login");
      await sb().from("audit_log").insert({
        id: uid("a-"), at: new Date().toISOString(), actor: p.username,
        action: "تسجيل دخول", detail: p.displayName,
      });
    } catch { /* الدخول نجح؛ تسجيل الأثر ثانوي */ }
    return { ok: true };
  }, [guard, fail, clear, loadProfile, signOut]);

  const logout = useCallback((reason?: string) => {
    const who = profile;
    (async () => {
      if (who) {
        try {
          await sb().from("audit_log").insert({
            id: uid("a-"), at: new Date().toISOString(), actor: who.username,
            action: "تسجيل خروج", detail: who.displayName,
          });
        } catch {}
      }
      await signOut(reason);
    })();
  }, [profile, signOut]);

  const changePassword = useCallback<AuthCtx["changePassword"]>(async (targetId, current, next) => {
    if (next.length < 8) return { ok: false, message: "كلمة المرور يجب ألا تقل عن ٨ أحرف." };

    if (targetId === userId) {
      if (current !== null) {
        const { error } = await sb().auth.signInWithPassword({ email: emailOf(profile?.username ?? ""), password: current });
        if (error) return { ok: false, message: "كلمة المرور الحالية غير صحيحة." };
      }
      const { error } = await sb().auth.updateUser({ password: next });
      if (error) return { ok: false, message: cloudError(error) };
      return { ok: true };
    }

    const { error } = await sb().rpc("admin_set_password", { p_user: targetId, p_password: next });
    if (error) return { ok: false, message: cloudError(error) };
    return { ok: true };
  }, [userId, profile?.username]);

  const createUser = useCallback<AuthCtx["createUser"]>(async (u) => {
    const uname = normalizeUsername(u.username);
    const { error } = await sb().rpc("admin_create_user", {
      p_username: uname, p_password: u.password, p_display: u.displayName.trim(),
      p_role: u.role, p_phone: u.phone || null,
    });
    if (error) return { ok: false, message: cloudError(error) };
    return { ok: true };
  }, []);

  const saveUser = useCallback<AuthCtx["saveUser"]>(async (id, patch) => {
    update((d) => {
      const t = d.users.find((x) => x.id === id);
      if (!t) return;
      if (patch.displayName !== undefined) t.displayName = patch.displayName;
      if (patch.role !== undefined) t.role = patch.role;
      if (patch.phone !== undefined) t.phone = patch.phone;
      if (patch.active !== undefined) t.active = patch.active;
    }, { action: "تعديل مستخدم", detail: id, actor: profile?.username });
    return { ok: true };
  }, [update, profile?.username]);

  const removeUser = useCallback<AuthCtx["removeUser"]>(async (id) => {
    const { error } = await sb().rpc("admin_delete_user", { p_user: id });
    if (error) return { ok: false, message: cloudError(error) };
    return { ok: true };
  }, []);

  const allow = useCallback((perm: Perm) => can(profile?.role, perm), [profile?.role]);

  const value = useMemo<AuthCtx>(() => ({
    user: profile,
    role: profile?.role,
    loading: !booted,
    login, logout, allow, changePassword, lockInfo,
    notice, clearNotice: () => setNotice(null),
    createUser, saveUser, removeUser,
    canRenameUsers: false,
  }), [profile, booted, login, logout, allow, changePassword, lockInfo, notice, createUser, saveUser, removeUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ========================================================================== */
/*                    الوضع المحلي — تخزين على الجهاز فقط                     */
/* ========================================================================== */

function LocalAuth({ children }: { children: React.ReactNode }) {
  const { data, update } = useStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const { lockInfo, guard, fail, clear } = useLockout();

  const endSession = useCallback((reason?: string) => {
    localStorage.removeItem(SESSION_KEY);
    setUserId(null);
    if (reason) setNotice(reason);
  }, []);

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
    // مرة واحدة عند الإقلاع
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onExpire = useCallback((reason: string) => endSession(reason), [endSession]);
  useIdleLogout(!!userId, onExpire);

  useEffect(() => {
    if (!userId) return;
    const iv = setInterval(() => {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s: Session = JSON.parse(raw);
        if (Date.now() > s.exp) endSession("انتهت الجلسة، سجّل الدخول مرة أخرى.");
      }
    }, 30_000);
    return () => clearInterval(iv);
  }, [userId, endSession]);

  const login = useCallback<AuthCtx["login"]>(async (username, password) => {
    const uname = normalizeUsername(username);
    if (!uname || !password) return { ok: false, message: "أدخل اسم المستخدم وكلمة المرور." };
    const blocked = guard(uname);
    if (blocked) return blocked;

    const u = data.users.find((x) => normalizeUsername(x.username) === uname);
    // نُجري التجزئة دائمًا حتى لا يكشف الوقتُ وجودَ اسم المستخدم من عدمه
    const okPass = u
      ? await verifyPassword(password, u.salt, u.hash)
      : (await hashPassword(password, "decoy-salt"), false);

    if (!u || !okPass) return fail(uname, "اسم المستخدم أو كلمة المرور غير صحيحة.");
    if (!u.active) return { ok: false, message: "هذا الحساب موقوف. راجع المدير." };

    clear(uname);
    const session: Session = {
      userId: u.id, iat: Date.now(),
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
  }, [data.users, data.settings.sessionMinutes, update, guard, fail, clear]);

  const user = useMemo(() => data.users.find((u) => u.id === userId) ?? null, [data.users, userId]);

  const logout = useCallback((reason?: string) => {
    if (user) update(() => {}, { action: "تسجيل خروج", detail: user.displayName, actor: user.username });
    endSession(reason);
  }, [user, update, endSession]);

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
      { action: "تغيير كلمة مرور", detail: target.username, actor: user?.username }
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
  }, [data.users, update, userId, user?.username]);

  const createUser = useCallback<AuthCtx["createUser"]>(async (u) => {
    const uname = normalizeUsername(u.username);
    if (data.users.some((x) => normalizeUsername(x.username) === uname))
      return { ok: false, message: "اسم المستخدم محجوز." };
    const salt = randomSalt();
    const hash = await hashPassword(u.password, salt);
    update((d) => {
      d.users.push({
        id: uid("u-"), username: uname, displayName: u.displayName.trim(), role: u.role,
        salt, hash, active: true, buildingIds: "all", phone: u.phone,
        createdAt: new Date().toISOString(), mustChangePassword: true,
      });
    }, { action: "إضافة مستخدم", detail: uname, actor: user?.username });
    return { ok: true };
  }, [data.users, update, user?.username]);

  const saveUser = useCallback<AuthCtx["saveUser"]>(async (id, patch) => {
    if (patch.username) {
      const uname = normalizeUsername(patch.username);
      if (data.users.some((x) => normalizeUsername(x.username) === uname && x.id !== id))
        return { ok: false, message: "اسم المستخدم محجوز." };
    }
    update((d) => {
      const t = d.users.find((x) => x.id === id);
      if (!t) return;
      if (patch.username !== undefined) t.username = normalizeUsername(patch.username);
      if (patch.displayName !== undefined) t.displayName = patch.displayName;
      if (patch.role !== undefined) t.role = patch.role;
      if (patch.phone !== undefined) t.phone = patch.phone;
      if (patch.active !== undefined) t.active = patch.active;
    }, { action: "تعديل مستخدم", detail: id, actor: user?.username });
    return { ok: true };
  }, [data.users, update, user?.username]);

  const removeUser = useCallback<AuthCtx["removeUser"]>(async (id) => {
    update((d) => { d.users = d.users.filter((x) => x.id !== id); },
      { action: "حذف مستخدم", detail: id, actor: user?.username });
    return { ok: true };
  }, [update, user?.username]);

  const allow = useCallback((perm: Perm) => can(user?.role, perm), [user?.role]);

  const value = useMemo<AuthCtx>(() => ({
    user, role: user?.role, loading, login, logout, allow, changePassword, lockInfo,
    notice, clearNotice: () => setNotice(null),
    createUser, saveUser, removeUser, canRenameUsers: true,
  }), [user, loading, login, logout, allow, changePassword, lockInfo, notice, createUser, saveUser, removeUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
