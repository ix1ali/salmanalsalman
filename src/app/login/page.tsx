"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Icon, Logo } from "@/components/Icons";

export default function LoginPage() {
  const { login, user, loading, notice, clearNotice, lockInfo } = useAuth();
  const { data } = useStore();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState(false);
  const [wait, setWait] = useState(0);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  // عدّاد تنازلي أثناء الإيقاف المؤقت بعد المحاولات الفاشلة
  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, [wait]);

  const submit = async (e?: React.FormEvent, creds?: { u: string; p: string }) => {
    e?.preventDefault();
    if (busy || wait > 0) return;
    setBusy(true);
    setError(null);
    clearNotice();
    const res = await login(creds?.u ?? username, creds?.p ?? password);
    setBusy(false);
    if (res.ok) {
      router.replace("/");
      return;
    }
    setError(res.message);
    const info = lockInfo(creds?.u ?? username);
    if (info.locked) setWait(info.waitSeconds);
    setPassword("");
    pwRef.current?.focus();
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-[var(--bg)] px-4 py-8">
      {/* خلفية زخرفية */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(20,194,173,.22),transparent_65%)]" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(124,92,255,.16),transparent_65%)]" />
        <svg className="absolute inset-x-0 bottom-0 h-40 w-full opacity-[.06]" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <g fill="#0b1b2b">
            {[0, 120, 260, 400, 540, 690, 840, 980, 1100].map((x, i) => (
              <rect key={x} x={x} y={200 - (70 + (i % 4) * 32)} width={i % 2 ? 92 : 110} height={70 + (i % 4) * 32} rx="6" />
            ))}
          </g>
        </svg>
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={62} />
          <h1 className="mt-3 text-2xl">{data.settings.orgName}</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">نظام إدارة العمارات والإيجارات</p>
        </div>

        <div className="card anim-up p-5">
          <h2 className="text-lg">تسجيل الدخول</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">أدخل اسم المستخدم وكلمة المرور الخاصة بك</p>

          {notice && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--warn-050)] p-2.5 text-[12.5px] font-bold text-[var(--gold-600)]">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={submit} className="mt-4 space-y-3.5">
            <div>
              <label className="label" htmlFor="username">اسم المستخدم</label>
              <div className="relative">
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                  <Icon name="user" size={17} />
                </span>
                <input
                  id="username"
                  className="input pr-9"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  dir="ltr"
                  placeholder="اسم المستخدم"
                  disabled={busy || wait > 0}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">كلمة المرور</label>
              <div className="relative">
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                  <Icon name="lock" size={17} />
                </span>
                <input
                  id="password"
                  ref={pwRef}
                  type={show ? "text" : "password"}
                  className="input px-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
                  autoComplete="current-password"
                  dir="ltr"
                  placeholder="••••••••"
                  disabled={busy || wait > 0}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]"
                  aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  <Icon name={show ? "eyeOff" : "eye"} size={17} />
                </button>
              </div>
              {caps && <p className="mt-1 text-[11.5px] font-bold text-[var(--gold-600)]">تنبيه: مفتاح Caps Lock مفعّل</p>}
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl bg-[var(--danger-050)] p-2.5 text-[12.5px] font-bold text-[#b3303b]">
                <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full !py-3" disabled={busy || wait > 0}>
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  جاري التحقق…
                </>
              ) : wait > 0 ? (
                `المحاولة متاحة بعد ${wait} ثانية`
              ) : (
                <>
                  <Icon name="logout" size={17} className="rotate-180" />
                  دخول
                </>
              )}
            </button>
          </form>

        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-[var(--muted)]">
          <Icon name="shield" size={13} />
          اتصال مشفّر · كلمات المرور محفوظة مجزّأة ولا تُخزَّن كنص صريح
        </p>
      </div>
    </div>
  );
}
