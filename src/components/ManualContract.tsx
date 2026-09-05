"use client";

import { ContractSheet, type ContractFields } from "./print";

/** يمرّر حقول العقد اليدوي إلى نفس نموذج العقد المعتمد. */
export function ManualContractSheet({ f }: { f: ContractFields }) {
  return <ContractSheet f={f} />;
}
