import type { AppData, Contract } from "./types";
import { uid } from "./crypto";
import { todayISO } from "./format";

/** الرقم التسلسلي التالي للوصل. */
export const nextReceiptNo = (d: AppData) => {
  const max = d.payments.reduce((m, p) => {
    const n = Number(String(p.receiptNo).replace("و-", "").trim());
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `و-${max + 1}`;
};

/**
 * تأكيد سداد شهر بضغطة واحدة — بقيمة العقد وتاريخ اليوم.
 * منفصل تمامًا عن طباعة الوصل: التأكيد شيء والطباعة شيء آخر.
 */
export function markPaid(d: AppData, contract: Contract, period: string, actor: string) {
  if (d.payments.some((p) => p.contractId === contract.id && p.period === period)) return;
  d.payments.unshift({
    id: uid("p-"),
    receiptNo: nextReceiptNo(d),
    buildingId: contract.buildingId,
    unitId: contract.unitId,
    tenantId: contract.tenantId,
    contractId: contract.id,
    period,
    amount: contract.rent,
    paidAt: todayISO(),
    method: contract.payMethod ?? "cash",
    createdBy: actor,
    createdAt: new Date().toISOString(),
  });
}

/** التراجع عن التأكيد. */
export function unmarkPaid(d: AppData, contractId: string, period: string) {
  d.payments = d.payments.filter((p) => !(p.contractId === contractId && p.period === period));
}
