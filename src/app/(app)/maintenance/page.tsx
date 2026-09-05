"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { dateShort, num, ticketStatusLabel } from "@/lib/format";
import { Empty, Field, PageHeader, SearchBox, Segmented, Select, Sheet, TextArea, TextInput, useConfirm } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { uid } from "@/lib/crypto";
import type { Ticket, TicketStatus } from "@/lib/types";

const STATUSES: TicketStatus[] = ["new", "in_progress", "done"];

const STATUS_STYLE: Record<TicketStatus, { bg: string; fg: string }> = {
  new: { bg: "var(--danger-050)", fg: "#b3303b" },
  in_progress: { bg: "var(--gold-050)", fg: "var(--gold-600)" },
  done: { bg: "var(--ok-050)", fg: "var(--ok)" },
  cancelled: { bg: "var(--steel-050)", fg: "var(--steel)" },
};

export default function MaintenancePage() {
  const { data, update, activeBuilding } = useStore();
  const { user, allow } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<"open" | "done">("open");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);

  const base = useMemo(
    () => data.tickets.filter((t) => activeBuilding === "all" || t.buildingId === activeBuilding),
    [data.tickets, activeBuilding]
  );

  const counts = useMemo(
    () => ({
      open: base.filter((t) => t.status === "new" || t.status === "in_progress").length,
      done: base.filter((t) => t.status === "done").length,
    }),
    [base]
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return base
      .filter((t) => (tab === "open" ? t.status === "new" || t.status === "in_progress" : t.status === "done"))
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || (unitById.get(t.unitId ?? "")?.number ?? "").includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [base, tab, q, unitById]);

  const setStatus = (t: Ticket, status: TicketStatus) => {
    update((d) => {
      const x = d.tickets.find((y) => y.id === t.id);
      if (x) {
        x.status = status;
        x.closedAt = status === "done" ? new Date().toISOString() : undefined;
      }
    }, { action: "تحديث بلاغ", detail: `${t.no} → ${ticketStatusLabel[status]}`, actor: user?.username });
  };

  const remove = async (t: Ticket) => {
    if (!(await confirm("حذف البلاغ", t.title))) return;
    update((d) => { d.tickets = d.tickets.filter((x) => x.id !== t.id); },
      { action: "حذف بلاغ", detail: t.no, actor: user?.username });
    toast("تم الحذف");
  };

  return (
    <div className="space-y-4">
      {dialog}
      <PageHeader
        title="بلاغات الصيانة"
        subtitle={`${num(counts.open)} بلاغ مفتوح`}
        icon="wrench"
        actions={
          allow("tickets.create") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              <Icon name="plus" size={15} /> بلاغ جديد
            </button>
          ) : undefined
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "open", label: "مفتوحة", count: counts.open },
          { value: "done", label: "منجزة", count: counts.done },
        ]}
      />

      {base.length > 4 && <SearchBox value={q} onChange={setQ} placeholder="عنوان البلاغ أو رقم الشقة…" />}

      {list.length ? (
        <ul className="space-y-2">
          {list.map((t) => {
            const st = STATUS_STYLE[t.status];
            return (
              <li key={t.id} className="card p-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: st.bg, color: st.fg }}>
                    <Icon name="wrench" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-extrabold leading-snug">{t.title}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                      شقة {unitById.get(t.unitId ?? "")?.number ?? "—"} · {dateShort(t.createdAt)}
                      {t.priority === "urgent" ? " · طارئ" : ""}
                    </p>
                    {t.description && (
                      <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-2)]">{t.description}</p>
                    )}
                  </div>
                  {allow("tickets.edit") && (
                    <button className="btn btn-icon btn-ghost !p-1.5 shrink-0" onClick={() => remove(t)} aria-label="حذف">
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>

                {allow("tickets.edit") ? (
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {STATUSES.map((sv) => {
                      const on = t.status === sv;
                      const c = STATUS_STYLE[sv];
                      return (
                        <button
                          key={sv}
                          onClick={() => setStatus(t, sv)}
                          className="rounded-lg py-1.5 text-[12px] font-extrabold transition"
                          style={{
                            background: on ? c.fg : "var(--surface-2)",
                            color: on ? "#fff" : "var(--muted)",
                            border: `1px solid ${on ? c.fg : "var(--line)"}`,
                          }}
                        >
                          {ticketStatusLabel[sv]}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="chip mt-2 inline-flex" style={{ background: st.bg, color: st.fg }}>
                    {ticketStatusLabel[t.status]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty
          icon="checkCircle"
          title={tab === "open" ? "ما فيه بلاغات مفتوحة" : "ما فيه بلاغات منجزة"}
          body={tab === "open" ? "كل شيء تمام." : undefined}
          action={
            allow("tickets.create") && tab === "open" ? (
              <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                <Icon name="plus" size={14} /> بلاغ جديد
              </button>
            ) : undefined
          }
        />
      )}

      {adding && <QuickTicket onClose={() => setAdding(false)} />}
    </div>
  );
}

/* ------------------------- بلاغ جديد — ثلاثة حقول ------------------------- */

function QuickTicket({ onClose }: { onClose: () => void }) {
  const { data, update, activeBuilding } = useStore();
  const { user } = useAuth();
  const toast = useToast();

  const units = useMemo(
    () => data.units.filter((u) => activeBuilding === "all" || u.buildingId === activeBuilding),
    [data.units, activeBuilding]
  );

  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [desc, setDesc] = useState("");
  const [urgent, setUrgent] = useState(false);

  const save = () => {
    if (!title.trim()) return toast("اكتب عنوان البلاغ", "error");
    const unit = data.units.find((u) => u.id === unitId);
    const contract = data.contracts.find((c) => c.unitId === unitId && c.status === "active");
    update((d) => {
      const max = d.tickets.reduce((m, t) => Math.max(m, Number(t.no.replace("ص-", "")) || 0), 100);
      d.tickets.unshift({
        id: uid("tk-"),
        no: `ص-${max + 1}`,
        buildingId: unit?.buildingId ?? "",
        unitId,
        tenantId: contract?.tenantId,
        title: title.trim(),
        description: desc.trim() || undefined,
        status: "new",
        priority: urgent ? "urgent" : "normal",
        createdBy: user?.username ?? "—",
        createdAt: new Date().toISOString(),
      });
    }, { action: "بلاغ جديد", detail: title.trim(), actor: user?.username });
    toast("تم تسجيل البلاغ");
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="بلاغ صيانة جديد"
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save}><Icon name="check" size={16} /> تسجيل البلاغ</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="ما هي المشكلة؟" required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تسريب ماء في المطبخ" autoFocus />
        </Field>
        <Field label="الشقة">
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.number}</option>)}
          </Select>
        </Field>
        <Field label="تفاصيل إضافية (اختياري)">
          <TextArea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
        </Field>
        <label className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] p-3 text-[13px] font-bold">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-4 w-4 accent-[var(--danger)]" />
          بلاغ طارئ يحتاج تدخل فوري
        </label>
      </div>
    </Sheet>
  );
}
