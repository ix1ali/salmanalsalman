"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Field, KeyVal, PageHeader, SectionTitle, Select, TextInput, useConfirm } from "@/components/ui";
import { Icon } from "@/components/Icons";
import PasswordForm from "@/components/PasswordForm";
import { dateShort, num, roleLabel } from "@/lib/format";

export default function SettingsPage() {
  const { data, update, resetAll, exportBackup, importBackup } = useStore();
  const { user, allow, changePassword, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [org, setOrg] = useState(data.settings);

  const saveSettings = () => {
    update((d) => { d.settings = { ...d.settings, ...org }; }, { action: "تعديل الإعدادات", detail: org.orgName, actor: user?.username });
    toast("تم حفظ الإعدادات");
  };

  const doImport = async (f: File) => {
    if (!(await confirm("استيراد نسخة", "سيتم استبدال كل البيانات الحالية بمحتوى الملف."))) return;
    try {
      await importBackup(f);
      toast("تم استيراد النسخة");
    } catch {
      toast("ملف غير صالح", "error");
    }
  };

  const doReset = async () => {
    if (!(await confirm("إعادة ضبط النظام", "سيتم حذف كل البيانات والمستندات والعودة للبيانات التجريبية."))) return;
    await resetAll();
    toast("تمت إعادة الضبط");
  };

  return (
    <div className="space-y-4">
      {dialog}
      <PageHeader title="الإعدادات" subtitle="الحساب، النظام، النسخ الاحتياطي" icon="cog" />

      {/* الحساب */}
      <div className="card card-lg p-4">
        <SectionTitle>حسابي</SectionTitle>
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#1b4f8a] to-[#0b2545] text-lg font-extrabold text-white">
            {user?.displayName.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{user?.displayName}</p>
            <p className="text-[12px] text-[var(--muted)]" dir="ltr">@{user?.username}</p>
          </div>
          <span className="chip" style={{ background: "var(--primary-050)", color: "var(--primary-700)" }}>
            {user && roleLabel[user.role]}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setPwOpen(true)}>
            <Icon name="key" size={14} /> تغيير كلمة المرور
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => { logout(); router.push("/login"); }}>
            <Icon name="logout" size={14} /> تسجيل الخروج
          </button>
        </div>
      </div>

      {/* إعدادات النظام */}
      {allow("settings.manage") && (
        <div className="card card-lg p-4">
          <SectionTitle>إعدادات النظام</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم الجهة / المكتب" className="sm:col-span-2">
              <TextInput value={org.orgName} onChange={(e) => setOrg({ ...org, orgName: e.target.value })} />
            </Field>
            <Field label="العملة">
              <Select value={org.currency} onChange={(e) => setOrg({ ...org, currency: e.target.value })}>
                <option value="KWD">دينار كويتي (د.ك)</option>
              </Select>
            </Field>
            <Field label="مدة الجلسة (دقيقة)" hint="تسجيل خروج تلقائي بعدها">
              <TextInput type="number" min={30} max={1440} value={org.sessionMinutes} onChange={(e) => setOrg({ ...org, sessionMinutes: +e.target.value })} />
            </Field>
            <Field label="تنبيه قبل الاستحقاق (أيام)">
              <TextInput type="number" min={0} max={15} value={org.reminderDaysBeforeDue} onChange={(e) => setOrg({ ...org, reminderDaysBeforeDue: +e.target.value })} />
            </Field>
            <Field label="تنبيه قرب انتهاء العقد (أيام)">
              <TextInput type="number" min={7} max={180} value={org.contractAlertDays} onChange={(e) => setOrg({ ...org, contractAlertDays: +e.target.value })} />
            </Field>
          </div>
          <button className="btn btn-primary mt-3 w-full sm:w-auto" onClick={saveSettings}>
            <Icon name="check" size={16} /> حفظ الإعدادات
          </button>
        </div>
      )}

      {/* البيانات */}
      <div className="card card-lg p-4">
        <SectionTitle>البيانات والنسخ الاحتياطي</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["عمارات", num(data.buildings.length)],
            ["وحدات", num(data.units.length)],
            ["مستأجرون", num(data.tenants.length)],
            ["عقود", num(data.contracts.length)],
            ["وصولات", num(data.payments.length)],
            ["مصاريف", num(data.expenses.length)],
            ["مستندات", num(data.docs.length)],
            ["تنبيهات", num(data.units.filter((u) => u.flagged).length)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-[var(--surface-2)] p-2.5 text-center">
              <p className="display text-[16px] tabular-nums">{v}</p>
              <p className="text-[10.5px] text-[var(--muted)]">{l}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {allow("data.export") && (
            <button className="btn btn-ghost btn-sm" onClick={exportBackup}>
              <Icon name="download" size={14} /> تصدير نسخة احتياطية
            </button>
          )}
          {allow("settings.manage") && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) doImport(f);
                }}
              />
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} /> استيراد نسخة
              </button>
              <button className="btn btn-danger btn-sm" onClick={doReset}>
                <Icon name="refresh" size={14} /> إعادة ضبط البيانات
              </button>
            </>
          )}
        </div>
        <p className="mt-2 text-[11.5px] text-[var(--muted)]">
          البيانات محفوظة حاليًا داخل هذا المتصفح (localStorage) والمستندات في IndexedDB. صدّر نسخة احتياطية بانتظام،
          أو اربط النظام بـ Supabase للمزامنة بين الأجهزة.
        </p>
      </div>

      {/* الربط بـ Supabase */}
      {allow("settings.manage") && (
        <div className="card card-lg p-4">
          <SectionTitle>الربط بقاعدة بيانات Supabase</SectionTitle>
          <div className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] p-3">
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              النظام جاهز للربط. كل عمليات القراءة والكتابة تمر عبر طبقة واحدة، فيتم التبديل بتعبئة المفاتيح
              وتشغيل ملف الجداول الجاهز في المشروع:
            </p>
            <ul className="mt-2 space-y-1 text-[12px] text-[var(--muted)]">
              <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-[var(--primary)]" /> <code dir="ltr" className="font-mono">supabase/schema.sql</code> — الجداول وسياسات الصلاحيات</li>
              <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-[var(--primary)]" /> <code dir="ltr" className="font-mono">.env.local</code> — مفاتيح المشروع</li>
              <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-[var(--primary)]" /> <code dir="ltr" className="font-mono">src/lib/store.tsx</code> — نقطة التبديل الوحيدة</li>
            </ul>
          </div>
        </div>
      )}

      {/* الأمان */}
      <div className="card card-lg p-4">
        <SectionTitle>الأمان</SectionTitle>
        <KeyVal k="تشفير كلمات المرور" v="PBKDF2-SHA256 · 150,000 دورة" icon="lock" />
        <KeyVal k="إيقاف بعد المحاولات الفاشلة" v="٥ محاولات ← إيقاف ٩٠ ثانية" icon="shield" />
        <KeyVal k="خروج تلقائي عند الخمول" v="٢٠ دقيقة" icon="clock" />
        <KeyVal k="مدة الجلسة القصوى" v={`${num(data.settings.sessionMinutes)} دقيقة`} icon="key" />
        <KeyVal k="آخر دخول لحسابك" v={user?.lastLoginAt ? dateShort(user.lastLoginAt) : "—"} icon="user" />
      </div>

      <p className="pb-4 text-center text-[11px] text-[var(--muted)]">
        نظام إدارة العمارات · إصدار 1.0
      </p>

      {pwOpen && user && (
        <PasswordForm open onClose={() => setPwOpen(false)} target={user} isSelf changePassword={changePassword} />
      )}
    </div>
  );
}
