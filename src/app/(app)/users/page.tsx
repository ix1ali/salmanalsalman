"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { dateShort, roleDesc, roleLabel } from "@/lib/format";
import { Chip, Empty, Field, KeyVal, PageHeader, Select, Sheet, TextInput, useConfirm } from "@/components/ui";
import PasswordForm from "@/components/PasswordForm";
import { Icon, type IconName } from "@/components/Icons";
import { passwordStrength } from "@/lib/crypto";
import { PERMS } from "@/lib/permissions";
import type { Role, User } from "@/lib/types";

const roleTone = { admin: "teal", manager: "violet", viewer: "sky", guard: "gold" } as const;

const roleIcon = (r: Role): IconName =>
  r === "admin" ? "shield" : r === "manager" ? "building" : r === "viewer" ? "eye" : "key";

export default function UsersPage() {
  const { data } = useStore();
  const { user, allow, changePassword, saveUser, removeUser } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [pwFor, setPwFor] = useState<User | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  if (!allow("users.manage")) {
    return <Empty icon="lock" title="غير مصرح" body="هذه الصفحة للمدير فقط." />;
  }

  const toggleActive = async (u: User) => {
    if (u.id === user?.id) return toast("لا يمكنك إيقاف حسابك الشخصي", "error");
    if (!(await confirm(u.active ? "إيقاف الحساب" : "تفعيل الحساب", `${u.displayName} (${u.username})`, u.active))) return;
    const res = await saveUser(u.id, { active: !u.active });
    toast(res.ok ? "تم الحفظ" : res.message, res.ok ? "success" : "error");
  };

  const remove = async (u: User) => {
    if (u.id === user?.id) return toast("لا يمكنك حذف حسابك الشخصي", "error");
    if (data.users.filter((x) => x.role === "admin" && x.active).length <= 1 && u.role === "admin")
      return toast("يجب بقاء مدير واحد على الأقل", "error");
    if (!(await confirm("حذف المستخدم", `سيتم حذف حساب ${u.displayName} نهائيًا.`))) return;
    const res = await removeUser(u.id);
    toast(res.ok ? "تم حذف الحساب" : res.message, res.ok ? "success" : "error");
  };

  return (
    <div className="space-y-4">
      {dialog}
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle={`${data.users.length} حساب`}
        icon="shield"
        actions={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAudit(true)}><Icon name="clock" size={15} /> السجل</button>
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> مستخدم</button>
          </>
        }
      />

      <div className="space-y-2">
        {data.users.map((u) => (
          <div key={u.id} className="card p-3">
            <div className="flex items-center gap-3">
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white ${
                  u.active ? "bg-[var(--primary)]" : "bg-[#a5b6c4]"
                }`}
              >
                <Icon name={roleIcon(u.role)} size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">
                  {u.displayName}
                  {u.id === user?.id && <span className="mr-1.5 text-[11px] font-bold text-[var(--primary-700)]">(أنت)</span>}
                </p>
                <p className="truncate text-[11.5px] text-[var(--muted)]" dir="ltr">@{u.username}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Chip tone={roleTone[u.role]}>{roleLabel[u.role]}</Chip>
                {!u.active && <Chip tone="rose">موقوف</Chip>}
              </div>
            </div>

            <p className="mt-2 text-[11.5px] text-[var(--muted)]">
              {roleDesc[u.role]} · {u.lastLoginAt ? `آخر دخول ${dateShort(u.lastLoginAt)}` : "لم يسجّل دخول بعد"}
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}><Icon name="edit" size={13} /> تعديل</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPwFor(u)}><Icon name="key" size={13} /> كلمة المرور</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                <Icon name={u.active ? "lock" : "check"} size={13} /> {u.active ? "إيقاف" : "تفعيل"}
              </button>
              <button className="btn btn-danger btn-sm mr-auto" onClick={() => remove(u)}><Icon name="trash" size={13} /> حذف</button>
            </div>
          </div>
        ))}
      </div>

      {/* مصفوفة الصلاحيات */}
      <div className="card p-3.5">
        <h2 className="mb-3 text-[15px]">ماذا يستطيع كل دور؟</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["admin", "manager", "viewer", "guard"] as Role[]).map((r) => (
            <div key={r} className="rounded-lg border border-[var(--line)] p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--primary-050)] text-[var(--primary-700)]">
                  <Icon name={roleIcon(r)} size={16} />
                </span>
                <div>
                  <p className="text-[13px] font-bold">{roleLabel[r]}</p>
                  <p className="text-[10.5px] text-[var(--muted)]">{PERMS[r].length} صلاحية</p>
                </div>
              </div>
              <ul className="space-y-1 text-[11.5px] text-[var(--ink-2)]">
                {DESCR[r].map((line) => (
                  <li key={line} className="flex items-start gap-1.5">
                    <Icon name="check" size={12} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {adding && <UserForm open onClose={() => setAdding(false)} />}
      {editing && <UserForm open onClose={() => setEditing(null)} target={editing} />}
      {pwFor && (
        <PasswordForm
          open
          onClose={() => setPwFor(null)}
          target={pwFor}
          isSelf={pwFor.id === user?.id}
          changePassword={changePassword}
        />
      )}

      <Sheet open={showAudit} onClose={() => setShowAudit(false)} wide title="سجل العمليات">
        {data.audit.length ? (
          <ul className="space-y-1.5">
            {data.audit.slice(0, 120).map((a) => (
              <li key={a.id} className="card flex items-start gap-2.5 p-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--bg-soft)] text-[var(--muted)]">
                  <Icon name="clock" size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold">{a.action}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">{a.detail}</p>
                </div>
                <div className="shrink-0 text-left">
                  <p className="text-[10.5px] font-bold text-[var(--ink-2)]">{a.actor}</p>
                  <p className="text-[10px] text-[var(--muted)]">{new Date(a.at).toLocaleString("ar-KW", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="clock" title="السجل فاضي" />
        )}
      </Sheet>
    </div>
  );
}

const DESCR: Record<Role, string[]> = {
  admin: ["كل الصفحات والتعديل", "إدارة العمارات والوحدات", "العقود والمالية والوصولات", "رفع وحذف المستندات", "إدارة المستخدمين"],
  manager: ["كل شيء داخل عقاراته فقط", "الشقق والمستأجرون والعقود", "المالية والوصولات والمصروفات", "لا يرى العقارات الأخرى", "لا يدير المستخدمين ولا الإعدادات"],
  viewer: ["اطلاع على كل البيانات", "الكشوفات والتقارير", "تصدير البيانات", "بدون أي تعديل أو حذف"],
  guard: ["الشقق وبيانات المستأجرين", "فتح ومتابعة بلاغات الصيانة", "بدون بيانات مالية", "بدون تعديل على العقود"],
};

/* ============================== نموذج المستخدم ============================== */

function UserForm({ open, onClose, target }: { open: boolean; onClose: () => void; target?: User }) {
  const { data } = useStore();
  const { createUser, saveUser, canRenameUsers } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    username: target?.username ?? "",
    displayName: target?.displayName ?? "",
    role: (target?.role ?? "viewer") as Role,
    phone: target?.phone ?? "",
    password: "",
  });
  const [buildingIds, setBuildingIds] = useState<string[]>(
    Array.isArray(target?.buildingIds) ? target.buildingIds : []
  );
  const toggleBuilding = (id: string) =>
    setBuildingIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const strength = useMemo(() => passwordStrength(f.password), [f.password]);

  const save = async () => {
    const uname = f.username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,20}$/.test(uname))
      return toast("اسم المستخدم: أحرف إنجليزية وأرقام، من ٣ إلى ٢٠ خانة", "error");
    if (!f.displayName.trim()) return toast("أدخل الاسم الظاهر", "error");
    if (data.users.some((u) => u.username.toLowerCase() === uname && u.id !== target?.id))
      return toast("اسم المستخدم محجوز", "error");
    if (!target && strength.problems.length) return toast(`كلمة المرور: ${strength.problems[0]}`, "error");
    if (f.role === "manager" && buildingIds.length === 0)
      return toast("اختر العقار الذي يشرف عليه", "error");

    const scopeIds: string[] | "all" = f.role === "manager" ? buildingIds : "all";

    setBusy(true);
    const res = target
      ? await saveUser(target.id, {
          displayName: f.displayName.trim(), role: f.role, phone: f.phone, buildingIds: scopeIds,
          ...(canRenameUsers ? { username: uname } : {}),
        })
      : await createUser({
          username: uname, displayName: f.displayName.trim(), role: f.role,
          phone: f.phone, password: f.password, buildingIds: scopeIds,
        });
    setBusy(false);
    if (!res.ok) return toast(res.message, "error");
    toast("تم الحفظ");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={target ? `تعديل ${target.displayName}` : "مستخدم جديد"}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save} disabled={busy}>
            <Icon name="check" size={16} /> {busy ? "جاري الحفظ…" : "حفظ"}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الاسم الظاهر" required className="sm:col-span-2">
          <TextInput value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
        </Field>
        <Field
          label="اسم المستخدم"
          required
          hint={target && !canRenameUsers ? "لا يمكن تغييره بعد الإنشاء" : "إنجليزي، بدون مسافات — لا فرق بين الحروف الكبيرة والصغيرة"}
        >
          <TextInput
            value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value })}
            dir="ltr"
            autoCapitalize="none"
            disabled={!!target && !canRenameUsers}
          />
        </Field>
        <Field label="رقم الهاتف">
          <TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} dir="ltr" inputMode="tel" />
        </Field>
        <Field label="الدور" required className="sm:col-span-2">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="admin">مدير — صلاحية كاملة</option>
            <option value="manager">مشرف عقار — صلاحية كاملة على عقاراته</option>
            <option value="viewer">مشاهد — اطلاع فقط</option>
            <option value="guard">حارس — الشقق والبلاغات</option>
          </Select>
        </Field>
        {f.role === "manager" && (
          <Field label="العقارات التي يشرف عليها" required className="sm:col-span-2" hint="لن يرى غيرها إطلاقًا">
            <div className="space-y-1.5">
              {data.buildings.map((b) => {
                const on = buildingIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBuilding(b.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-right transition"
                    style={{
                      borderColor: on ? "var(--primary)" : "var(--line)",
                      background: on ? "var(--primary-050)" : "var(--surface)",
                    }}
                  >
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2"
                      style={{
                        borderColor: on ? "var(--primary)" : "var(--line-strong)",
                        background: on ? "var(--primary)" : "#fff",
                        color: "#fff",
                      }}
                    >
                      {on && <Icon name="check" size={12} strokeWidth={3} />}
                    </span>
                    <span className="flex-1 text-[13px] font-semibold">{b.name}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {!target && (
          <Field label="كلمة المرور" required className="sm:col-span-2" hint="٨ أحرف على الأقل، تحتوي حرفًا ورقمًا">
            <TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} dir="ltr" />
            {f.password && (
              <div className="mt-1.5 flex items-center gap-2">
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
          </Field>
        )}
      </div>
      {target && (
        <div className="mt-3 card p-3">
          <KeyVal k="تاريخ الإنشاء" v={dateShort(target.createdAt)} icon="calendar" />
          <KeyVal k="آخر دخول" v={target.lastLoginAt ? dateShort(target.lastLoginAt) : "—"} icon="clock" />
        </div>
      )}
    </Sheet>
  );
}
