// ===== Core domain types =====

export type Role = "admin" | "viewer" | "guard";

export type UnitStatus = "occupied" | "vacant";
export type UnitKind = "apartment" | "shop" | "storage" | "office" | "parking";

export type PayMethod = "cash" | "knet" | "transfer" | "cheque" | "link";

export type ExpenseCategory =
  | "electricity" | "water" | "salaries" | "bank" | "cleaning" | "elevator"
  | "maintenance" | "government" | "internet" | "insurance" | "guard" | "other";

export type DocKind =
  | "civil_id" | "passport" | "contract" | "receipt" | "statement"
  | "cheque" | "license" | "deed" | "photo" | "other";

export type OwnerType = "tenant" | "unit" | "building" | "contract" | "payment" | "expense" | "maintenance";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  salt: string;
  hash: string;
  active: boolean;
  buildingIds: string[] | "all";
  phone?: string;
  createdAt: string;
  lastLoginAt?: string;
  mustChangePassword?: boolean;
}

export interface Building {
  id: string;
  name: string;
  code: string;
  area: string;          // المنطقة
  block: string;         // قطعة
  street: string;        // شارع
  buildingNo: string;    // رقم العمارة
  parcel?: string;       // رقم القسيمة
  ownerName: string;
  paciNo?: string;
  landArea?: number;
  builtArea?: number;
  notes?: string;
  color: string;
  createdAt: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  /** -1 = basement, 0 = ground, 1..n = upper floors */
  level: number;
  name: string;
  order: number;
}

export interface Unit {
  id: string;
  buildingId: string;
  floorId: string;
  number: string;
  kind: UnitKind;
  status: UnitStatus;
  area?: number;         // م²
  rooms?: number;
  bathrooms?: number;
  balconies?: number;
  baseRent: number;      // د.ك
  meterNo?: string;      // رقم عداد الكهرباء
  notes?: string;
  /** تعليم الشقة بتنبيه يظهر بالأحمر في المخطط */
  flagged?: boolean;
  flagNote?: string;
  flaggedAt?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  civilId: string;
  phone: string;
  phone2?: string;
  nationality?: string;
  email?: string;
  workplace?: string;
  emergencyContact?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export type ContractStatus = "active" | "expired" | "terminated" | "upcoming";

export interface Contract {
  id: string;
  no: string;
  buildingId: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  /** تاريخ أول عقد للمستأجر — يبقى ثابتًا مع كل تجديد */
  firstRentedAt?: string;
  /** تاريخ تحرير العقد */
  signedAt?: string;
  /** مدة العقد كما تُكتب في النموذج (سنة، ستة أشهر…) */
  durationText?: string;
  /** عدد الساكنين المسموح به في العين */
  occupants?: number;
  rent: number;
  deposit: number;
  /** يوم الاستحقاق من كل شهر */
  dueDay: number;
  payMethod: PayMethod;
  status: ContractStatus;
  terms?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  receiptNo: string;
  buildingId: string;
  unitId: string;
  tenantId: string;
  contractId?: string;
  /** الشهر المستحق YYYY-MM */
  period: string;
  amount: number;
  paidAt: string;
  method: PayMethod;
  /** رقم الشيك أو مرجع العملية */
  reference?: string;
  /** اسم البنك المسحوب عليه الشيك */
  bank?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  buildingId: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  date: string;
  vendor?: string;
  method: PayMethod;
  notes?: string;
  createdAt: string;
}

export interface DocMeta {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  buildingId?: string;
  kind: DocKind;
  title: string;
  fileName: string;
  mime: string;
  size: number;
  expiresAt?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface AppData {
  version: number;
  users: User[];
  buildings: Building[];
  floors: Floor[];
  units: Unit[];
  tenants: Tenant[];
  contracts: Contract[];
  payments: Payment[];
  expenses: Expense[];
  docs: DocMeta[];
  audit: AuditEntry[];
  settings: {
    orgName: string;
    /** الاسم الكامل للمالك كما يظهر في العقود */
    ownerFullName: string;
    currency: string;
    sessionMinutes: number;
    reminderDaysBeforeDue: number;
    contractAlertDays: number;
    /** أول شهر تُحتسب منه المتأخرات (YYYY-MM) — ما قبله لا يُحاسب عليه */
    trackingStartPeriod: string;
    /** يوم استحقاق الإيجار من كل شهر */
    dueDay: number;
    /** الغرامة الإدارية عند التأخر عن السداد */
    lateFee: number;
    /** أجرة المشرف الفني الشهرية */
    supervisorFee: number;
  };
}
