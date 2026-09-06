"use client";

import { CLOUD, sb } from "./cloud";
import * as idb from "./idb";

/**
 * ملفات المستندات (صور البطاقة المدنية، العقود…).
 *
 * في الوضع السحابي تُحفظ في مخزن Supabase الخاص فيراها كل المستخدمين،
 * وفي الوضع المحلي تبقى في IndexedDB على الجهاز.
 */
const BUCKET = "documents";
const pathOf = (id: string) => `docs/${id}`;
const SIGNED_SECONDS = 60 * 10;

export async function putBlob(id: string, file: Blob): Promise<void> {
  if (!CLOUD) { await idb.putBlob(id, file); return; }
  const { error } = await sb().storage.from(BUCKET).upload(pathOf(id), file, {
    upsert: true,
    contentType: (file as File).type || "application/octet-stream",
  });
  if (error) throw error;
}

/** رابط مؤقّت لعرض الملف — للصور وملفات PDF داخل الصفحة. */
export async function blobUrl(id: string): Promise<string | null> {
  if (!CLOUD) return idb.blobUrl(id);
  const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(pathOf(id), SIGNED_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function openBlob(id: string, fileName: string): Promise<void> {
  if (!CLOUD) { await idb.openBlob(id, fileName); return; }
  const { data, error } = await sb().storage.from(BUCKET)
    .createSignedUrl(pathOf(id), SIGNED_SECONDS, { download: fileName });
  if (error || !data?.signedUrl) throw new Error("تعذّر فتح الملف");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function delBlob(id: string): Promise<void> {
  if (!CLOUD) { await idb.delBlob(id); return; }
  const { error } = await sb().storage.from(BUCKET).remove([pathOf(id)]);
  if (error) throw error;
}
