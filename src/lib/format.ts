import type { ExpenseCategory, PayMethod, Role, UnitKind, UnitStatus, DocKind, ContractStatus } from "./types";

// أرقام لاتينية مع نصوص عربية — الأسهل قراءةً في الاستخدام التجاري بالكويت
const AR = "ar-KW-u-nu-latn";

export const KWD = (n: number, withSymbol = true) => {
  const v = (Number.isFinite(n) ? n : 0).toLocaleString(AR, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return withSymbol ? `${v} د.ك` : v;
};

export const num = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString(AR);

export const pct = (n: number) => `${Math.round(n)}%`;

export const dateAr = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(AR, { year: "numeric", month: "short", day: "numeric" });
};

export const dateShort = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};

export const monthAr = (period: string) => {
  const [y, m] = period.split("-");
  const names = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${names[Number(m) - 1] ?? m} ${y}`;
};

/** YYYY-MM-DD بتوقيت الجهاز — toISOString يزيح اليوم في الكويت (UTC+3). */
export const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayISO = () => localISO(new Date());
export const thisPeriod = () => localISO(new Date()).slice(0, 7);

export const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return localISO(d);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export const bytes = (n: number) => {
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} كيلو`;
  return `${(n / 1048576).toFixed(1)} ميجا`;
};

// ===== Labels =====

export const roleLabel: Record<Role, string> = {
  admin: "مدير", viewer: "مشاهد", guard: "حارس",
};

export const roleDesc: Record<Role, string> = {
  admin: "يشوف ويعدل كل شيء",
  viewer: "يشوف بس، ما يعدل",
  guard: "الشقق والتنبيهات فقط",
};

export const statusLabel: Record<UnitStatus, string> = {
  occupied: "مؤجرة", vacant: "فاضية",
};

export const kindLabel: Record<UnitKind, string> = {
  apartment: "شقة", shop: "محل", storage: "مخزن", office: "مكتب", parking: "موقف",
};

export const methodLabel: Record<PayMethod, string> = {
  cash: "كاش", knet: "كي نت", transfer: "تحويل", cheque: "شيك", link: "رابط دفع",
};

export const expenseLabel: Record<ExpenseCategory, string> = {
  electricity: "كهرباء", water: "ماء", guard: "حارس", cleaning: "تنظيف",
  elevator: "مصعد", maintenance: "صيانة", government: "رسوم حكومية",
  internet: "إنترنت", insurance: "تأمين", other: "أخرى",
};

export const docLabel: Record<DocKind, string> = {
  civil_id: "بطاقة مدنية", passport: "جواز سفر", contract: "عقد", receipt: "وصل",
  statement: "كشف حساب", cheque: "شيك", license: "ترخيص", deed: "وثيقة ملكية",
  photo: "صورة", other: "أخرى",
};

export const contractStatusLabel: Record<ContractStatus, string> = {
  active: "ساري", expired: "منتهي", terminated: "مفسوخ", upcoming: "قادم",
};

const ORDINAL = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس",
  "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];

export const floorName = (level: number) => {
  if (level < 0) return level === -1 ? "السرداب" : `السرداب ${-level}`;
  if (level === 0) return "الأرضي";
  return ORDINAL[level] ?? `الدور ${level}`;
};
