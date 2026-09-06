import type {
  AppData, Building, Contract, Expense, Floor, Payment, Tenant, Unit, User,
} from "./types";
import { hashPassword, randomSalt } from "./crypto";
import { localISO } from "./format";
import { TURAB_BUILDING, TURAB_FLOORS, TURAB_RECORDS } from "./turabData";

const BID = "b-turab";
const iso = localISO;

const addYears = (d: Date, n: number) => {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
};

/**
 * يبني بيانات النظام من سجل المكتب الفعلي.
 *
 * لا تُختلق أي بيانات مالية: سجل المكتب لا يحتوي على دفعات، فيبدأ النظام
 * بسجل تحصيل فارغ، وتُحتسب المتأخرات ابتداءً من الشهر المحدّد في
 * settings.trackingStartPeriod فقط.
 */
export async function buildSeed(): Promise<AppData> {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = iso(now);
  const period = today.slice(0, 7);

  /* ------------------------------ المستخدمون ------------------------------ */
  const mkUser = async (
    username: string, displayName: string, role: User["role"], password: string, phone: string
  ): Promise<User> => {
    const salt = randomSalt();
    return {
      id: `u-${username}`, username, displayName, role, salt,
      hash: await hashPassword(password, salt),
      active: true, buildingIds: "all", phone, createdAt: nowIso,
    };
  };

  const users: User[] = [
    await mkUser("admin", "سلمان السلمان", "admin", "Admin@1234", "99000011"),
    await mkUser("viewer", "محاسب المكتب", "viewer", "Viewer@1234", "99000022"),
    await mkUser("guard", "حارس عمارة تراب", "guard", "Guard@1234", "99000033"),
  ];

  /* -------------------------------- العقار -------------------------------- */
  const buildings: Building[] = [{
    id: BID,
    name: TURAB_BUILDING.name,
    code: TURAB_BUILDING.code,
    area: TURAB_BUILDING.area,
    block: TURAB_BUILDING.block,
    street: TURAB_BUILDING.street,
    buildingNo: TURAB_BUILDING.buildingNo,
    parcel: TURAB_BUILDING.parcel,
    ownerName: TURAB_BUILDING.ownerName,
    color: "#123a6b",
    notes: "تسعون شقة سكنية، إضافة إلى المحل في الدور الأرضي والسرداب.",
    createdAt: nowIso,
  }];

  /* --------------------------- الأدوار والوحدات --------------------------- */
  const floors: Floor[] = [];
  const units: Unit[] = [];

  TURAB_FLOORS.forEach((f, i) => {
    const fid = `${BID}-f${f.level}`;
    floors.push({ id: fid, buildingId: BID, level: f.level, name: f.name, order: i });

    for (let n = 1; n <= f.apartments; n++) {
      const number = `${f.prefix}${String(n).padStart(2, "0")}`;
      units.push({
        id: `${BID}-u-${number}`, buildingId: BID, floorId: fid, number,
        kind: "apartment", status: "vacant", baseRent: 0,
        flagged: false, createdAt: nowIso,
      });
    }
  });

  // المحل في الدور الأرضي والسرداب — وحدتان غير سكنيتين
  units.push({
    id: `${BID}-u-shop`, buildingId: BID, floorId: `${BID}-f0`, number: "المحل",
    kind: "shop", status: "vacant", baseRent: 0, flagged: false, createdAt: nowIso,
  });
  units.push({
    id: `${BID}-u-basement`, buildingId: BID, floorId: `${BID}-f-1`, number: "السرداب",
    kind: "storage", status: "vacant", baseRent: 0, flagged: false, createdAt: nowIso,
  });

  const unitByNumber = new Map(units.map((u) => [u.number, u]));

  /* ---------------------- المستأجرون والعقود من السجل ---------------------- */
  const tenants: Tenant[] = [];
  const contracts: Contract[] = [];
  let cSeq = 0;

  for (const r of TURAB_RECORDS) {
    const unit = unitByNumber.get(r.unit);
    if (!unit) continue;

    const tenantId = `t-${r.seq}`;
    tenants.push({
      id: tenantId,
      name: r.name,
      civilId: r.civilId,
      phone: r.phone,
      nationality: r.nationality,
      workplace: r.job,
      active: true,
      createdAt: nowIso,
    });

    unit.status = "occupied";
    unit.baseRent = r.rent;

    // العقد يتجدد سنويًا تلقائيًا وفق البند الأول، فنعرض الدورة السارية حاليًا
    let start = r.start ? new Date(`${r.start}T00:00:00`) : new Date(now);
    let end = r.end ? new Date(`${r.end}T00:00:00`) : addYears(start, 1);
    let review = "";

    if (!r.start) review = "بيانات العقد غير مكتملة في سجل المكتب — يرجى استكمالها";
    else if (end <= start) {
      review = "تاريخ انتهاء العقد المسجّل سابق لتاريخ بدايته — يرجى مراجعته";
      end = addYears(start, 1);
    }

    while (end <= now) {
      start = addYears(start, 1);
      end = addYears(end, 1);
    }

    contracts.push({
      id: `c-${r.seq}`,
      no: `ع-${String(++cSeq).padStart(4, "0")}`,
      buildingId: BID,
      unitId: unit.id,
      tenantId,
      startDate: iso(start),
      endDate: iso(end),
      firstRentedAt: r.start || undefined,
      signedAt: r.signed || undefined,
      durationText: "سنة",
      rent: r.rent,
      deposit: r.rent,
      dueDay: 5,
      payMethod: "cash",
      status: "active",
      createdAt: nowIso,
    });

    if (review) {
      unit.flagged = true;
      unit.flagNote = review;
      unit.flaggedAt = nowIso;
    }
  }

  // الوحدات الشاغرة: يُقترح لها متوسط إيجار دورها حتى يحدّده المالك
  const rented = units.filter((u) => u.status === "occupied" && u.kind === "apartment");
  const avgAll = rented.length ? Math.round(rented.reduce((a, u) => a + u.baseRent, 0) / rented.length) : 150;
  const byFloor = new Map<string, number[]>();
  rented.forEach((u) => byFloor.set(u.floorId, [...(byFloor.get(u.floorId) ?? []), u.baseRent]));
  units.forEach((u) => {
    if (u.baseRent) return;
    const list = byFloor.get(u.floorId) ?? [];
    u.baseRent = list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : avgAll;
  });

  const expenses: Expense[] = [];
  const payments: Payment[] = [];

  return {
    version: 4,
    users, buildings, floors, units, tenants, contracts, payments, expenses,
    docs: [],
    memos: [{
      id: "m-1",
      title: "بدء العمل بالنظام الجديد",
      body: "تم استيراد سجل المستأجرين من برنامج المكتب السابق. يرجى مراجعة الوحدات التي عليها ملاحظة حمراء واستكمال بياناتها، وتسجيل الدفعات أولًا بأول ليظهر التحصيل والمتأخرات بشكل صحيح.",
      authorId: "u-admin",
      authorName: "سلمان السلمان",
      createdAt: nowIso,
    }],
    audit: [{
      id: "a0", at: nowIso, actor: "النظام", action: "استيراد بيانات",
      detail: `تم استيراد ${TURAB_RECORDS.length} مستأجرًا من سجل المكتب`,
    }],
    settings: {
      orgName: "إدارة عقار سلمان السلمان",
      ownerFullName: TURAB_BUILDING.ownerName,
      currency: "KWD",
      sessionMinutes: 43200,
      reminderDaysBeforeDue: 3,
      contractAlertDays: 45,
      trackingStartPeriod: period,
      dueDay: 5,
      lateFee: 200,
      supervisorFee: 5,
    },
  };
}
