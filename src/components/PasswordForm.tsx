"use client";

import { useMemo, useState } from "react";
import { useToast } from "./Toast";
import { Field, Sheet, TextInput } from "./ui";
import { Icon } from "./Icons";
import { passwordStrength } from "@/lib/crypto";
import type { User } from "@/lib/types";

export default function PasswordForm({
  open, onClose, target, isSelf, changePassword,
}: {
  open: boolean;
  onClose: () => void;
  target: User;
  isSelf: boolean;
  changePassword: (id: string, current: string | null, next: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = useMemo(() => passwordStrength(next), [next]);

  const save = async () => {
    if (next !== confirmPw) return toast("كلمتا المرور غير متطابقتين", "error");
    if (strength.problems.length) return toast(`كلمة المرور: ${strength.problems[0]}`, "error");
    setBusy(true);
    const res = await changePassword(target.id, isSelf ? current : null, next);
    setBusy(false);
    if (!res.ok) return toast(res.message, "error");
    toast("تم تغيير كلمة المرور");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`كلمة المرور — ${target.displayName}`}
      footer={
        <button className="btn btn-primary w-full" onClick={save} disabled={busy}>
          <Icon name="key" size={16} /> {busy ? "جاري الحفظ…" : "حفظ كلمة المرور"}
        </button>
      }
    >
      <div className="space-y-3">
        {isSelf && (
          <Field label="كلمة المرور الحالية" required>
            <TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} dir="ltr" autoComplete="current-password" />
          </Field>
        )}
        <Field label="كلمة المرور الجديدة" required hint="٨ أحرف على الأقل، حرف ورقم">
          <TextInput type="password" value={next} onChange={(e) => setNext(e.target.value)} dir="ltr" autoComplete="new-password" />
        </Field>
        {next && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(strength.score / 4) * 100}%`,
                  background: strength.score >= 3 ? "var(--ok)" : strength.score >= 2 ? "var(--warn)" : "var(--danger)",
                }}
              />
            </div>
            <span className="text-[11px] font-bold text-[var(--muted)]">{strength.label}</span>
          </div>
        )}
        <Field label="تأكيد كلمة المرور" required>
          <TextInput type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} dir="ltr" autoComplete="new-password" />
        </Field>
      </div>
    </Sheet>
  );
}
