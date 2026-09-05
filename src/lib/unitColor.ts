import type { Unit } from "./types";

/** ثلاثة ألوان فقط في كل النظام — واضحة من أول نظرة. */
export const UNIT_COLOR = {
  occupied: "#1e8a5f",  // أخضر: مؤجرة
  vacant: "#c9992e",    // ذهبي: شاغرة
  flagged: "#d64550",   // أحمر: عليها ملاحظة
} as const;

export const unitColor = (u: Unit) =>
  u.flagged ? UNIT_COLOR.flagged : u.status === "occupied" ? UNIT_COLOR.occupied : UNIT_COLOR.vacant;
