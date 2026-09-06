"use client";

import React, { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "./Toast";
import { Icon } from "./Icons";
import { Chip, Empty, Field, Select, TextInput, useConfirm } from "./ui";
import { blobUrl, delBlob, openBlob, putBlob } from "@/lib/files";
import { uid } from "@/lib/crypto";
import { bytes, dateShort, docLabel } from "@/lib/format";
import type { DocKind, OwnerType } from "@/lib/types";

const MAX_MB = 8;

const kindIcon = (k: DocKind) =>
  k === "civil_id" || k === "passport" ? "idCard" : k === "receipt" ? "receipt" : k === "photo" ? "eye" : "file";

export default function DocsPanel({
  ownerType, ownerId, buildingId, defaultKind = "other", title = "المستندات", compact,
}: {
  ownerType: OwnerType; ownerId: string; buildingId?: string;
  defaultKind?: DocKind; title?: string; compact?: boolean;
}) {
  const { data, update } = useStore();
  const { user, allow } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocKind>(defaultKind);
  const [docTitle, setDocTitle] = useState("");
  const [expires, setExpires] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const docs = useMemo(
    () => data.docs.filter((d) => d.ownerType === ownerType && d.ownerId === ownerId)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [data.docs, ownerType, ownerId]
  );

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) {
        if (f.size > MAX_MB * 1024 * 1024) {
          toast(`${f.name}: الحجم أكبر من ${MAX_MB} ميجا`, "error");
          continue;
        }
        const id = uid("d-");
        await putBlob(id, f);
        update(
          (d) => {
            d.docs.unshift({
              id, ownerType, ownerId, buildingId,
              kind, title: docTitle.trim() || f.name.replace(/\.[^.]+$/, ""),
              fileName: f.name, mime: f.type || "application/octet-stream", size: f.size,
              expiresAt: expires || undefined,
              uploadedBy: user?.username ?? "—",
              uploadedAt: new Date().toISOString(),
            });
          },
          { action: "رفع مستند", detail: `${docLabel[kind]} — ${f.name}`, actor: user?.username }
        );
      }
      setDocTitle("");
      setExpires("");
      toast("تم رفع المستند");
    } catch {
      toast("تعذّر رفع الملف", "error");
    } finally {
      setBusy(false);
    }
  };

  const view = async (id: string, mime: string, name: string) => {
    const url = await blobUrl(id);
    if (!url) return toast("الملف غير موجود", "error");
    if (mime.startsWith("image/") || mime === "application/pdf") setPreview({ url, name, mime });
    else openBlob(id, name);
  };

  const remove = async (id: string, name: string) => {
    if (!(await confirm("حذف المستند", `سيتم حذف «${name}» نهائيًا. متأكد؟`))) return;
    try { await delBlob(id); } catch {}
    update((d) => { d.docs = d.docs.filter((x) => x.id !== id); }, { action: "حذف مستند", detail: name, actor: user?.username });
    toast("تم الحذف");
  };

  return (
    <div>
      {dialog}
      {!compact && (
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 t-section">
            <Icon name="folder" size={16} className="text-[var(--muted)]" /> {title}
            <span className="rounded-full bg-[var(--bg-soft)] px-1.5 text-[11px] text-[var(--muted)]">{docs.length}</span>
          </h3>
        </div>
      )}

      {allow("docs.upload") && (
        <div className="mb-3 rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="نوع المستند">
              <Select value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
                {(Object.keys(docLabel) as DocKind[]).map((k) => (
                  <option key={k} value={k}>{docLabel[k]}</option>
                ))}
              </Select>
            </Field>
            <Field label="الاسم (اختياري)">
              <TextInput value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="مثال: بطاقة مدنية — وجه" />
            </Field>
            <Field label="تاريخ الانتهاء (اختياري)">
              <TextInput type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </Field>
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept="image/*,application/pdf"
            onChange={onPick}
          />
          <button className="btn btn-soft mt-2.5 w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="upload" size={16} />
            {busy ? "جاري الرفع…" : "اختر ملف أو صورة"}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-[var(--muted)]">
            صور أو PDF · حتى {MAX_MB} ميجا · محفوظة داخل الجهاز
          </p>
        </div>
      )}

      {docs.length ? (
        <ul className="space-y-2">
          {docs.map((d) => {
            const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
            return (
              <li key={d.id} className="card flex items-center gap-2.5 p-2.5">
                <button
                  onClick={() => view(d.id, d.mime, d.fileName)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary-700)]"
                  aria-label="عرض"
                >
                  <Icon name={kindIcon(d.kind)} size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{d.title}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--muted)]">
                    <span>{docLabel[d.kind]}</span>
                    <span>· {bytes(d.size)}</span>
                    <span>· {dateShort(d.uploadedAt)}</span>
                  </p>
                  {d.expiresAt && (
                    <span className="mt-1 inline-block">
                      <Chip tone={expired ? "rose" : "amber"} icon="calendar">
                        {expired ? "منتهي" : "ينتهي"} {dateShort(d.expiresAt)}
                      </Chip>
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn btn-icon btn-ghost !p-1.5" onClick={() => view(d.id, d.mime, d.fileName)} aria-label="عرض">
                    <Icon name="eye" size={15} />
                  </button>
                  <button className="btn btn-icon btn-ghost !p-1.5" onClick={() => openBlob(d.id, d.fileName)} aria-label="تنزيل">
                    <Icon name="download" size={15} />
                  </button>
                  {allow("docs.delete") && (
                    <button className="btn btn-icon btn-danger !p-1.5" onClick={() => remove(d.id, d.title)} aria-label="حذف">
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty icon="folder" title="لا توجد مستندات" body={allow("docs.upload") ? "ارفع البطاقة المدنية أو العقد أو أي وثيقة." : undefined} />
      )}

      {preview && (
        <div className="fixed inset-0 z-[190] grid place-items-center bg-[#0b1b2b]/80 p-4" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
          <div className="anim-pop relative max-h-[88dvh] w-full max-w-2xl overflow-hidden rounded-lg bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
              <p className="truncate text-[13px] font-bold">{preview.name}</p>
              <button className="btn btn-icon btn-ghost !p-1.5" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
                <Icon name="x" size={16} />
              </button>
            </div>
            {preview.mime.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={preview.name} className="max-h-[76dvh] w-full object-contain" />
            ) : (
              <iframe src={preview.url} title={preview.name} className="h-[76dvh] w-full" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
