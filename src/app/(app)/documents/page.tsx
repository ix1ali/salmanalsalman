"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { bytes, dateShort, docLabel, num } from "@/lib/format";
import { Chip, Empty, PageHeader, SearchBox, Segmented, Sheet, useConfirm } from "@/components/ui";
import { Icon } from "@/components/Icons";
import DocsPanel from "@/components/DocsPanel";
import { blobUrl, delBlob, openBlob } from "@/lib/idb";
import type { DocKind, OwnerType } from "@/lib/types";

const ownerLabel: Record<OwnerType, string> = {
  tenant: "مستأجر", unit: "وحدة", building: "عمارة", contract: "عقد",
  payment: "وصل", expense: "مصروف", maintenance: "تنبيه",
};

export default function DocumentsPage() {
  const { data, update, activeBuilding } = useStore();
  const { user, allow } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | DocKind>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; mime: string } | null>(null);

  const tenantById = useMemo(() => new Map(data.tenants.map((t) => [t.id, t])), [data.tenants]);
  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);
  const contractById = useMemo(() => new Map(data.contracts.map((c) => [c.id, c])), [data.contracts]);
  const buildingById = useMemo(() => new Map(data.buildings.map((b) => [b.id, b])), [data.buildings]);

  const ownerName = (t: OwnerType, id: string) => {
    if (t === "tenant") return tenantById.get(id)?.name ?? "—";
    if (t === "unit") return `وحدة ${unitById.get(id)?.number ?? "—"}`;
    if (t === "building") return buildingById.get(id)?.name ?? "—";
    if (t === "contract") return `عقد ${contractById.get(id)?.no ?? "—"}`;
    return "—";
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.docs
      .filter((d) => (activeBuilding === "all" ? true : !d.buildingId || d.buildingId === activeBuilding))
      .filter((d) => kind === "all" || d.kind === kind)
      .filter((d) => !needle || d.title.toLowerCase().includes(needle) || ownerName(d.ownerType, d.ownerId).toLowerCase().includes(needle))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.docs, q, kind, activeBuilding, tenantById, unitById, contractById, buildingById]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    data.docs.forEach((d) => m.set(d.kind, (m.get(d.kind) ?? 0) + 1));
    return m;
  }, [data.docs]);

  const totalSize = useMemo(() => data.docs.reduce((a, d) => a + d.size, 0), [data.docs]);

  const expiringSoon = useMemo(() => {
    const now = Date.now();
    return data.docs.filter((d) => d.expiresAt && new Date(d.expiresAt).getTime() - now < 60 * 86400000);
  }, [data.docs]);

  const view = async (id: string, mime: string, name: string) => {
    const url = await blobUrl(id);
    if (!url) return;
    if (mime.startsWith("image/") || mime === "application/pdf") setPreview({ url, name, mime });
    else openBlob(id, name);
  };

  const remove = async (id: string, title: string) => {
    if (!(await confirm("حذف المستند", `سيتم حذف «${title}» نهائيًا.`))) return;
    try { await delBlob(id); } catch {}
    update((d) => { d.docs = d.docs.filter((x) => x.id !== id); },
      { action: "حذف مستند", detail: title, actor: user?.username });
  };

  const buildingId = activeBuilding === "all" ? data.buildings[0]?.id ?? "" : activeBuilding;

  return (
    <div className="space-y-4">
      {dialog}
      <PageHeader
        title="المستندات"
        subtitle={`${num(data.docs.length)} ملف · ${bytes(totalSize)}`}
        icon="folder"
        actions={
          allow("docs.upload") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
              <Icon name="upload" size={15} /> رفع
            </button>
          ) : undefined
        }
      />

      {expiringSoon.length > 0 && (
        <div className="card flex items-center gap-3 border-r-4 border-r-[var(--warn)] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--warn-050)] text-[var(--gold-600)]">
            <Icon name="alert" size={18} />
          </span>
          <div>
            <p className="text-[13px] font-extrabold">{num(expiringSoon.length)} مستند قارب على الانتهاء</p>
            <p className="text-[11.5px] text-[var(--muted)]">راجع البطاقات المدنية والتراخيص</p>
          </div>
        </div>
      )}

      <SearchBox value={q} onChange={setQ} placeholder="اسم المستند أو صاحبه…" />

      <Segmented
        value={kind}
        onChange={setKind}
        size="sm"
        options={[
          { value: "all", label: "الكل", count: data.docs.length },
          ...(Object.keys(docLabel) as DocKind[])
            .filter((k) => counts.get(k))
            .map((k) => ({ value: k, label: docLabel[k], count: counts.get(k) })),
        ]}
      />

      {list.length ? (
        <ul className="space-y-2">
          {list.map((d) => {
            const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
            return (
              <li key={d.id} className="card flex items-center gap-2.5 p-2.5">
                <button
                  onClick={() => view(d.id, d.mime, d.fileName)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary-700)]"
                >
                  <Icon name={d.kind === "civil_id" || d.kind === "passport" ? "idCard" : d.mime.startsWith("image/") ? "eye" : "file"} size={19} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-extrabold">{d.title}</p>
                  <p className="truncate text-[11.5px] text-[var(--muted)]">
                    {docLabel[d.kind]} · {ownerLabel[d.ownerType]}: {ownerName(d.ownerType, d.ownerId)}
                  </p>
                  <p className="text-[10.5px] text-[var(--muted)]">{bytes(d.size)} · {dateShort(d.uploadedAt)}</p>
                  {d.expiresAt && (
                    <span className="mt-1 inline-block">
                      <Chip tone={expired ? "rose" : "amber"} icon="calendar">
                        {expired ? "منتهي" : "ينتهي"} {dateShort(d.expiresAt)}
                      </Chip>
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
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
        <Empty
          icon="folder"
          title="لا توجد مستندات"
          body="ارفع صور البطاقات المدنية، العقود، الفواتير، ووثائق الملكية."
          action={allow("docs.upload") ? <button className="btn btn-primary btn-sm" onClick={() => setUploadOpen(true)}><Icon name="upload" size={14} /> رفع مستند</button> : undefined}
        />
      )}

      <Sheet open={uploadOpen} onClose={() => setUploadOpen(false)} title="رفع مستند للعمارة" wide>
        <p className="mb-3 text-[12.5px] text-[var(--muted)]">
          لرفع مستند مرتبط بمستأجر أو وحدة أو عقد، افتح صفحته واستخدم قسم المستندات هناك.
        </p>
        {buildingId ? (
          <DocsPanel ownerType="building" ownerId={buildingId} buildingId={buildingId} defaultKind="deed" title="مستندات العمارة" />
        ) : (
          <Empty icon="building" title="أضف عمارة أولًا" />
        )}
      </Sheet>

      {preview && (
        <div className="fixed inset-0 z-[190] grid place-items-center bg-[#0b1b2b]/80 p-4" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
          <div className="anim-pop relative max-h-[88dvh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
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
