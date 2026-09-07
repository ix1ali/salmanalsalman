import type { Unit } from "./types";

/** أربع حالات فقط في كل النظام — كلٌّ بلونها، واضحة من أول نظرة. */
export const UNIT_COLOR = {
  occupied: "#1e8a5f",     // أخضر: مؤجرة
  vacant: "#c9992e",       // ذهبي: شاغرة
  maintenance: "#6d5bd0",  // بنفسجي: تحت الصيانة
  flagged: "#d64550",      // أحمر: عليها ملاحظة
} as const;

export type UnitState = keyof typeof UNIT_COLOR;

/** الصيانة تسبق كل شيء: الشقة معطّلة فعليًا مهما كانت حالتها الأخرى. */
export const unitState = (u: Unit): UnitState =>
  u.maintenance ? "maintenance"
    : u.flagged ? "flagged"
    : u.status === "occupied" ? "occupied"
    : "vacant";

export const unitColor = (u: Unit) => UNIT_COLOR[unitState(u)];

export const UNIT_LABEL: Record<UnitState, string> = {
  occupied: "مؤجرة",
  vacant: "شاغرة",
  maintenance: "تحت الصيانة",
  flagged: "عليها ملاحظة",
};
