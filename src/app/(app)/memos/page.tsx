"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Empty, Field, PageHeader, SearchBox, Sheet, TextArea, TextInput, useConfirm } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { uid } from "@/lib/crypto";

const D = new Intl.DateTimeFormat("ar-KW-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });
const T = new Intl.DateTimeFormat("ar-KW-u-nu-latn", { hour: "numeric", minute: "2-digit" });
const stamp = (iso: string) => `${D.format(new Date(iso))} - ${T.format(new Date(iso))}`;

/** لوحة ملاحظات المكتب: عنوان ونص، والأحدث أولًا. لا محادثات ولا ردود. */
export default function MemosPage() {
  const { data, update } = useStore();
  const { user, allow } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return [...data.memos]
      .filter((m) => !n || m.title.toLowerCase().includes(n) || m.body.toLowerCase().includes(n) || m.authorName.includes(n))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.memos, q]);

  const save = () => {
    if (!title.trim()) return toast("اكتب عنوان المراسلة", "error");
    if (!body.trim()) return toast("اكتب نص المراسلة", "error");
    update((d) => {
      d.memos.unshift({
        id: uid("m-"),
        title: title.trim(),
        body: body.trim(),
        authorId: user?.id ?? "",
        authorName: user?.displayName ?? "—",
        createdAt: new Date().toISOString(),
      });
    }, { action: "مراسلة جديدة", detail: title.trim(), actor: user?.username });
    toast("تم نشر المراسلة");
    setTitle(""); setBody(""); setAdding(false);
  };

  const remove = async (id: string, t: string) => {
    if (!(await confirm("حذف المراسلة", `سيتم حذف «${t}».`))) return;
    update((d) => { d.memos = d.memos.filter((m) => m.id !== id); },
      { action: "حذف مراسلة", detail: t, actor: user?.username });
  };

  return (
    <div className="space-y-3">
      {dialog}
      <PageHeader
        title="المراسلات"
        subtitle="ملاحظات وإعلانات داخلية بين مستخدمي النظام"
        actions={
          allow("memos.create") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              <Icon name="plus" size={14} /> مراسلة
            </button>
          ) : undefined
        }
      />

      {data.memos.length > 3 && <SearchBox value={q} onChange={setQ} placeholder="ابحث في المراسلات…" />}

      {list.length ? (
        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.id} className="card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="t-title min-w-0 flex-1">{m.title}</h2>
                {allow("memos.delete") && (
                  <button
                    onClick={() => remove(m.id, m.title)}
                    className="btn btn-icon btn-ghost !border-transparent !bg-transparent !p-1 text-[var(--faint)] hover:text-[var(--danger)]"
                    aria-label="حذف"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
              <p className="t-body mt-1.5 whitespace-pre-wrap leading-relaxed text-[var(--ink-2)]">{m.body}</p>
              <p className="t-xs mt-3 border-t border-[var(--line)] pt-2 text-[var(--muted)]">
                بواسطة <span className="font-semibold text-[var(--ink-2)]">{m.authorName}</span>
                <span className="mx-1.5 text-[var(--faint)]">·</span>
                {stamp(m.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card">
          <Empty
            icon="message"
            title={q ? "لا توجد نتائج مطابقة" : "لا توجد مراسلات"}
            body={q ? undefined : "اكتب ملاحظة أو إعلانًا ليطّلع عليه بقية المستخدمين."}
            action={
              allow("memos.create") && !q ? (
                <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={14} /> مراسلة جديدة
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="مراسلة جديدة"
        footer={
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={save}><Icon name="check" size={15} /> نشر</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>إلغاء</button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="العنوان" required>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: صيانة المصعد" autoFocus />
          </Field>
          <Field label="النص" required>
            <TextArea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="تم التواصل مع شركة المصاعد وسيتم إرسال الفني غدًا."
            />
          </Field>
          <p className="t-xs text-[var(--muted)]">
            تُنشر باسمك ({user?.displayName}) مع تاريخ ووقت النشر، ويطّلع عليها كل من له صلاحية.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
