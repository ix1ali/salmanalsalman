import type { ExpenseCategory, PayMethod, Role, UnitKind, UnitStatus, DocKind, ContractStatus } from "./types";

// أرقام لاتينية مع نصوص عربية — الأسهل قراءةً في الاستخدام التجاري بالكويت
const AR = "ar-KW-u-nu-latn";

/** الرقم فقط بثلاث خانات عشرية — يُستخدم مع مكوّن Money الذي يضيف «د.ك». */
export const amount = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString(AR, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** مبلغ مالي كنص كامل — دائمًا مصحوب بـ «د.ك» لتمييزه عن الأرقام العادية. */
export const KWD = (n: number) => `${amount(n)} د.ك`;

/** تفريق المبلغ إلى دنانير وفلوس كما في نموذج الوصل الورقي. */
export const dinarsFils = (n: number) => {
  const v = Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 1000));
  return { dinars: Math.floor(v / 1000), fils: v % 1000 };
};

export const num = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString(AR);

/** «شهر واحد / شهران / 5 أشهر» بدل «1 شهر». */
export const monthsLabel = (n: number) =>
  n === 1 ? "شهر واحد" : n === 2 ? "شهران" : n <= 10 ? `${num(n)} أشهر` : `${num(n)} شهرًا`;

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

export const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export const monthAr = (period: string) => {
  const [y, m] = period.split("-");
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${y}`;
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
  admin: "صلاحية كاملة على النظام",
  viewer: "اطّلاع فقط دون تعديل",
  guard: "الوحدات والملاحظات فقط",
};

export const statusLabel: Record<UnitStatus, string> = {
  occupied: "مؤجرة", vacant: "شاغرة",
};

export const kindLabel: Record<UnitKind, string> = {
  apartment: "شقة", shop: "محل", storage: "مخزن", office: "مكتب", parking: "موقف",
};

export const methodLabel: Record<PayMethod, string> = {
  cash: "نقدًا", knet: "كي نت", transfer: "تحويل بنكي", cheque: "شيك", link: "رابط دفع",
};

export const expenseLabel: Record<ExpenseCategory, string> = {
  electricity: "الكهرباء والماء", water: "الماء", salaries: "الرواتب",
  bank: "رسوم بنكية", cleaning: "التنظيف", elevator: "المصعد",
  maintenance: "الصيانة", government: "رسوم حكومية", internet: "الإنترنت",
  insurance: "التأمين", guard: "الحارس", other: "أخرى",
};

/** ترتيب عرض بنود المصروفات في القوائم والتقارير. */
export const EXPENSE_ORDER: ExpenseCategory[] = [
  "electricity", "salaries", "bank", "cleaning", "elevator",
  "maintenance", "government", "water", "internet", "insurance", "guard", "other",
];

export const docLabel: Record<DocKind, string> = {
  civil_id: "بطاقة مدنية", passport: "جواز سفر", contract: "عقد", receipt: "وصل",
  statement: "كشف حساب", cheque: "شيك", license: "ترخيص", deed: "وثيقة ملكية",
  photo: "صورة", other: "أخرى",
};

export const contractStatusLabel: Record<ContractStatus, string> = {
  active: "ساري", expired: "منتهي", terminated: "مفسوخ", upcoming: "لم يبدأ بعد",
};

/** المبلغ كتابةً بالحروف — يُطبع في الوصل والعقد. */
export function amountInWords(n: number): string {
  const v = Math.floor(Math.max(0, n));
  if (v === 0) return "صفر";
  const ones = ["","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة","عشرة",
    "أحد عشر","اثنا عشر","ثلاثة عشر","أربعة عشر","خمسة عشر","ستة عشر","سبعة عشر","ثمانية عشر","تسعة عشر"];
  const tens = ["","","عشرون","ثلاثون","أربعون","خمسون","ستون","سبعون","ثمانون","تسعون"];
  const hundreds = ["","مئة","مئتان","ثلاثمئة","أربعمئة","خمسمئة","ستمئة","سبعمئة","ثمانمئة","تسعمئة"];

  const under1000 = (x: number): string => {
    const parts: string[] = [];
    const h = Math.floor(x / 100);
    const rest = x % 100;
    if (h) parts.push(hundreds[h]);
    if (rest) {
      if (rest < 20) parts.push(ones[rest]);
      else {
        const o = rest % 10, t = Math.floor(rest / 10);
        parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]);
      }
    }
    return parts.join(" و");
  };

  if (v < 1000) return under1000(v);
  const th = Math.floor(v / 1000), rest = v % 1000;
  const thWord = th === 1 ? "ألف" : th === 2 ? "ألفان" : th < 11 ? `${under1000(th)} آلاف` : `${under1000(th)} ألفًا`;
  return rest ? `${thWord} و${under1000(rest)}` : thWord;
}

const ORDINAL = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس",
  "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];

export const floorName = (level: number) => {
  if (level < 0) return level === -1 ? "السرداب" : `السرداب ${-level}`;
  if (level === 0) return "الأرضي";
  return ORDINAL[level] ?? `الدور ${level}`;
};
