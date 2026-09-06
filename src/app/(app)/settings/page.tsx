"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Field, KeyVal, PageHeader, Panel, Select, TextInput, useConfirm } from "@/components/ui";
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
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof typeof org>(k: K, v: (typeof org)[K]) => {
    setOrg((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const saveSettings = () => {
    update((d) => { d.settings = { ...d.settings, ...org }; },
      { action: "تعديل الإعدادات", detail: org.orgName, actor: user?.username });
    setDirty(false);
    toast("تم حفظ الإعدادات");
  };

  const doImport = async (f: File) => {
    if (!(await confirm("استيراد نسخة", "سيتم استبدال كل البيانات الحالية بمحتوى الملف."))) return;
    try { await importBackup(f); toast("تم استيراد النسخة"); }
    catch { toast("ملف غير صالح", "error"); }
  };

  const doReset = async () => {
    if (!(await confirm("إعادة ضبط النظام", "سيتم حذف كل البيانات والمستندات وإعادة بناء السجل من بيانات المكتب المستوردة."))) return;
    await resetAll();
    toast("تمت إعادة الضبط");
  };

  const stats: [string, string][] = [
    ["عقارات", num(data.buildings.length)],
    ["وحدات", num(data.units.length)],
    ["مستأجرون", num(data.tenants.length)],
    ["عقود", num(data.contracts.length)],
    ["وصولات", num(data.payments.length)],
    ["مصروفات", num(data.expenses.length)],
    ["مستندات", num(data.docs.length)],
    ["مراسلات", num(data.memos.length)],
  ];

  return (
    <div className="space-y-3">
      {dialog}
      <PageHeader title="الإعدادات" />

      {/* الحساب */}
      <Panel title="حسابي">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-white">
            <Icon name="user" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{user?.displayName}</p>
            <p className="t-xs text-[var(--muted)]">
              @{user?.username} · {user && roleLabel[user.role]}
              {user?.lastLoginAt && <> · آخر دخول {dateShort(user.lastLoginAt)}</>}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm shrink-0" onClick={() => setPwOpen(true)}>
            <Icon name="key" size={13} /> كلمة المرور
          </button>
        </div>
        <button
          className="btn btn-danger btn-sm mt-3 w-full sm:w-auto"
          onClick={() => { logout(); router.push("/login"); }}
        >
          <Icon name="logout" size={14} /> تسجيل الخروج
        </button>
      </Panel>

      {/* بيانات المكتب */}
      {allow("settings.manage") && (
        <Panel
          title="بيانات المكتب"
          action={dirty ? <button className="btn btn-primary btn-sm" onClick={saveSettings}>حفظ</button> : undefined}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم الجهة">
              <TextInput value={org.orgName} onChange={(e) => set("orgName", e.target.value)} />
            </Field>
            <Field label="اسم المالك كما يُكتب في العقود">
              <TextInput value={org.ownerFullName} onChange={(e) => set("ownerFullName", e.target.value)} />
            </Field>
          </div>
        </Panel>
      )}

      {/* قواعد العقود والتحصيل */}
      {allow("settings.manage") && (
        <Panel
          title="قواعد العقود والتحصيل"
          action={dirty ? <button className="btn btn-primary btn-sm" onClick={saveSettings}>حفظ</button> : undefined}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="يوم استحقاق الإيجار" hint="حسب العقد: قبل يوم 5">
              <TextInput type="number" min={1} max={28} value={org.dueDay} onChange={(e) => set("dueDay", +e.target.value)} />
            </Field>
            <Field label="تنبيه قرب انتهاء العقد" hint="بالأيام">
              <TextInput type="number" min={7} max={180} value={org.contractAlertDays} onChange={(e) => set("contractAlertDays", +e.target.value)} />
            </Field>
            <Field label="بداية احتساب المتأخرات" hint="لا تُحتسب مطالبات قبل هذا الشهر">
              <TextInput type="month" value={org.trackingStartPeriod} onChange={(e) => set("trackingStartPeriod", e.target.value)} />
            </Field>
            <Field label="الغرامة الإدارية (د.ك)" hint="البند الرابع عشر من العقد">
              <TextInput type="number" min={0} value={org.lateFee} onChange={(e) => set("lateFee", +e.target.value)} />
            </Field>
            <Field label="أجرة المشرف الفني (د.ك)" hint="البند الثامن عشر من العقد">
              <TextInput type="number" min={0} value={org.supervisorFee} onChange={(e) => set("supervisorFee", +e.target.value)} />
            </Field>
            <Field label="مدة الجلسة (دقيقة)" hint="خروج تلقائي بعدها">
              <TextInput type="number" min={30} value={org.sessionMinutes} onChange={(e) => set("sessionMinutes", +e.target.value)} />
            </Field>
          </div>
        </Panel>
      )}

      {/* البيانات */}
      <Panel title="البيانات والنسخ الاحتياطي" flush>
        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-[var(--line)] border-b border-[var(--line)]">
          {stats.map(([l, v]) => (
            <div key={l} className="px-2 py-2.5 text-center">
              <p className="num t-title leading-none">{v}</p>
              <p className="t-xs mt-1 text-[var(--muted)]">{l}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 p-3.5">
          {allow("data.export") && (
            <button className="btn btn-ghost btn-sm" onClick={exportBackup}>
              <Icon name="download" size={13} /> تصدير نسخة
            </button>
          )}
          {allow("settings.manage") && (
            <>
              <input
                ref={fileRef} type="file" accept="application/json" hidden
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) doImport(f); }}
              />
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={13} /> استيراد نسخة
              </button>
              <button className="btn btn-danger btn-sm mr-auto" onClick={doReset}>
                <Icon name="refresh" size={13} /> إعادة ضبط
              </button>
            </>
          )}
        </div>
        <p className="t-xs border-t border-[var(--line)] px-3.5 py-2.5 leading-relaxed text-[var(--muted)]">
          البيانات محفوظة داخل هذا المتصفح والمستندات في IndexedDB. صدّر نسخة احتياطية بانتظام،
          أو اربط النظام بـ Supabase للمزامنة بين الأجهزة.
        </p>
      </Panel>

      {/* الأمان */}
      <Panel title="الأمان">
        <KeyVal k="تشفير كلمات المرور" v="PBKDF2-SHA256 · 150,000 دورة" />
        <KeyVal k="الإيقاف بعد المحاولات الفاشلة" v="خمس محاولات ← إيقاف 90 ثانية" />
        <KeyVal k="الخروج التلقائي عند الخمول" v="12 ساعة" />
        <KeyVal k="مدة الجلسة القصوى" v={`${num(data.settings.sessionMinutes)} دقيقة`} />
      </Panel>

      <p className="t-xs pb-2 text-center text-[var(--faint)]">
        {data.settings.orgName} · الإصدار 1.0
      </p>

      {pwOpen && user && (
        <PasswordForm open onClose={() => setPwOpen(false)} target={user} isSelf changePassword={changePassword} />
      )}
    </div>
  );
}
