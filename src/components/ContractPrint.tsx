"use client";

import { useState } from "react";
import { Field, Sheet, TextInput } from "./ui";
import { Icon } from "./Icons";
import { ContractDoc, PrintOverlay } from "./print";
import { todayISO } from "@/lib/format";
import type { Contract } from "@/lib/types";

/** سنة كاملة من تاريخ البداية: ١/١٠/٢٠٢٦ ← ٣٠/٩/٢٠٢٧. */
const yearAfter = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const end = new Date(y + 1, m - 1, d - 1);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
};

/**
 * طباعة العقد: تُسأل أولًا عن تاريخ بدايته ونهايته وتاريخ تحريره،
 * ثم يُعرض العقد مطبوعًا بهذه التواريخ.
 */
export default function ContractPrint({
  contract, fileTitle, onClose, flush, signedAt,
}: { contract: Contract; fileTitle: string; onClose: () => void; flush?: boolean; signedAt?: string }) {
  const [start, setStart] = useState(contract.startDate);
  const [end, setEnd] = useState(() => yearAfter(contract.startDate));
  const [signed, setSigned] = useState(signedAt || contract.signedAt || todayISO());
  const [ready, setReady] = useState(false);

  if (ready) {
    return (
      <PrintOverlay open onClose={onClose} fileTitle={fileTitle} flush={flush}>
        <ContractDoc contract={contract} startDate={start} endDate={end} signedAt={signed} />
      </PrintOverlay>
    );
  }

  const bad = !!start && !!end && end < start;

  return (
    <Sheet
      open onClose={onClose} title="طباعة العقد"
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" disabled={bad} onClick={() => setReady(true)}>
            <Icon name="print" size={15} /> عرض وطباعة
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="تاريخ بداية العقد" required>
          <TextInput
            type="date" value={start}
            onChange={(e) => {
              // النهاية تتبع البداية ما دامت سنة كاملة منها
              if (!end || end === yearAfter(start)) setEnd(yearAfter(e.target.value));
              setStart(e.target.value);
            }}
          />
        </Field>
        <Field label="تاريخ نهاية العقد" required>
          <TextInput type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="تاريخ تحرير العقد" className="sm:col-span-2">
          <TextInput type="date" value={signed} onChange={(e) => setSigned(e.target.value)} />
        </Field>
      </div>
      <p className={`t-xs mt-3 rounded-lg p-2.5 leading-relaxed ${bad ? "bg-red-50 text-red-700" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>
        {bad ? "تاريخ النهاية قبل تاريخ البداية." : "التاريخان يُطبعان في بند مدة العقد. اترك أيًّا منهما فارغًا ليُكتب باليد."}
      </p>
    </Sheet>
  );
}
