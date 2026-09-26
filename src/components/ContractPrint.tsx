"use client";

import { useState } from "react";
import { Field, Sheet, TextInput } from "./ui";
import { Icon } from "./Icons";
import { ContractDoc, PrintOverlay } from "./print";
import type { Contract } from "@/lib/types";

/** نهاية العقد الافتراضية: سنة كاملة من تاريخ البداية (اليوم السابق لنفس التاريخ بعد سنة). */
export function yearAfter(start: string) {
  const [y, m, d] = start.split("-").map(Number);
  if (!y || !m || !d) return "";
  const end = new Date(y + 1, m - 1, d - 1);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

/**
 * طباعة العقد: يسأل أولًا عن تاريخ البداية والنهاية ثم يعرض العقد
 * معبّأً بها للطباعة.
 */
export default function ContractPrint({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const [start, setStart] = useState(contract.startDate);
  const [end, setEnd] = useState(() => yearAfter(contract.startDate));
  const [show, setShow] = useState(false);

  if (show) {
    return (
      <PrintOverlay open onClose={onClose} fileTitle={`عقد إيجار ${contract.no}`}>
        <ContractDoc contract={contract} startDate={start} endDate={end} />
      </PrintOverlay>
    );
  }

  return (
    <Sheet
      open onClose={onClose} title="طباعة العقد"
      footer={
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={() => setShow(true)}>
            <Icon name="print" size={15} /> عرض وطباعة
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="يبدأ بتاريخ" required>
          <TextInput
            type="date" value={start}
            onChange={(e) => {
              const v = e.target.value;
              // النهاية تتبع البداية ما لم تُغيَّر يدويًا
              if (end === yearAfter(start)) setEnd(yearAfter(v));
              setStart(v);
            }}
          />
        </Field>
        <Field label="ينتهي بتاريخ" required>
          <TextInput type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <p className="t-xs mt-3 rounded-lg bg-[var(--surface-2)] p-2.5 leading-relaxed text-[var(--muted)]">
        التاريخان يُطبعان في البند الأول من العقد فقط، ولا يغيّران ظهور المستأجر في الكشف.
      </p>
    </Sheet>
  );
}
