import type {
  AppData, Building, Contract, Expense, Floor, Payment, Tenant, Ticket, Unit, User,
  ExpenseCategory, PayMethod, UnitStatus,
} from "./types";
import { hashPassword, randomSalt } from "./crypto";
import { floorName, localISO } from "./format";

/** Deterministic PRNG so the demo data looks the same every time it is generated. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["عبدالله","محمد","أحمد","فهد","يوسف","خالد","بدر","ناصر","سعود","طلال","مشاري","جاسم","حمد","صالح","راشد","عادل","وليد","ماجد","سالم","علي","إبراهيم","عمر","زياد","ياسر","تركي","فيصل","سلطان","نواف","بشار","أنس","كريم","مروان","هيثم","رامي","سامي","نبيل"];
const LAST = ["العنزي","المطيري","العجمي","الرشيدي","الظفيري","الحربي","السالم","الشمري","العتيبي","الدوسري","الفضلي","البلوشي","الخالدي","المهنا","الكندري","العوضي","الرومي","بورسلي","الشطي","حيدر","خضر","السيد","الحمدان","القلاف","الجاسم","المنصور","الفارس"];
const NAT = ["كويتي","مصري","سوري","لبناني","أردني","هندي","باكستاني","فلبيني","سعودي","عراقي","سوداني","تونسي"];
const WORK = ["وزارة الداخلية","شركة نفط الكويت","بنك الكويت الوطني","وزارة الصحة","شركة زين","مؤسسة البترول","القطاع الخاص","وزارة التربية","شركة مقاولات","محل تجاري","الجيش الكويتي","شركة تأمين"];

const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];
const between = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));

const iso = localISO;
const shift = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

interface FloorSpec { level: number; apartments: number; shops?: number; storage?: number; name?: string; prefix?: string }

function makeBuilding(
  r: () => number,
  b: Omit<Building, "createdAt">,
  specs: FloorSpec[],
  occupancy: number,
  rentRange: [number, number],
  out: { floors: Floor[]; units: Unit[] }
): Building {
  const now = new Date().toISOString();
  specs.forEach((spec, i) => {
    const fid = `${b.id}-f${spec.level}`;
    out.floors.push({ id: fid, buildingId: b.id, level: spec.level, name: spec.name ?? floorName(spec.level), order: i });

    const mk = (kind: Unit["kind"], number: string, idx: number) => {
      const roll = r();
      let status: UnitStatus = "occupied";
      if (roll > occupancy) status = roll > occupancy + (1 - occupancy) * 0.78 ? "maintenance" : "vacant";
      const rooms = kind === "apartment" ? between(r, 1, 3) : 1;
      const area = kind === "shop" ? between(r, 28, 70)
        : kind === "storage" ? between(r, 12, 25)
        : 55 + rooms * between(r, 12, 20);
      const rent = kind === "shop" ? between(r, 350, 700)
        : kind === "storage" ? between(r, 40, 80)
        : between(r, rentRange[0], rentRange[1]) + rooms * 25;
      out.units.push({
        id: `${b.id}-u-${number}`,
        buildingId: b.id,
        floorId: fid,
        number,
        kind,
        status,
        area,
        rooms,
        bathrooms: kind === "apartment" ? (rooms >= 3 ? 2 : 1) : 1,
        balconies: kind === "apartment" ? (rooms >= 2 ? 1 : 0) : 0,
        baseRent: Math.round(rent / 5) * 5,
        meterNo: `${between(r, 10000, 99999)}`,
        createdAt: now,
        notes: idx === 0 && kind === "apartment" ? "قريبة من المصعد" : undefined,
      });
    };

    const pad = (n: number) => String(n).padStart(2, "0");
    for (let i = 0; i < spec.apartments; i++) {
      const number = spec.prefix
        ? `${spec.prefix}${pad(i + 1)}`
        : spec.level < 0 ? `ب${pad(i + 1)}`
        : spec.level === 0 ? `أ${pad(i + 1)}`
        : `${spec.level}${pad(i + 1)}`;
      mk("apartment", number, i);
    }
    for (let i = 0; i < (spec.shops ?? 0); i++) mk("shop", `محل ${i + 1}`, i);
    for (let i = 0; i < (spec.storage ?? 0); i++) mk("storage", `مخزن ${i + 1}`, i);
  });
  return { ...b, createdAt: now };
}

export async function buildSeed(): Promise<AppData> {
  const r = rng(20260905);
  const now = new Date();
  const nowIso = now.toISOString();

  const mkUser = async (
    username: string, displayName: string, role: User["role"], password: string, phone: string
  ): Promise<User> => {
    const salt = randomSalt();
    return {
      id: `u-${username}`, username, displayName, role, salt,
      hash: await hashPassword(password, salt),
      active: true, buildingIds: "all", phone,
      createdAt: nowIso,
    };
  };

  const users: User[] = [
    await mkUser("admin", "سلمان السلمان", "admin", "Admin@1234", "99000011"),
    await mkUser("viewer", "محاسب العمارة", "viewer", "Viewer@1234", "99000022"),
    await mkUser("guard", "حارس عمارة تراب", "guard", "Guard@1234", "99000033"),
  ];

  const floors: Floor[] = [];
  const units: Unit[] = [];
  const buildings: Building[] = [];

  // عمارة تراب: سرداب + أرضي (محلات) + سبعة أدوار = ٩٠ شقة
  buildings.push(
    makeBuilding(
      r,
      {
        id: "b-turab", name: "عمارة تراب", code: "TRB",
        area: "حولي", block: "قطعة 4", street: "شارع بيروت", buildingNo: "قسيمة 128",
        ownerName: "سلمان السلمان", paciNo: "48213756",
        landArea: 750, builtArea: 4200, color: "#123a6b",
        notes: "٩٠ شقة + ٤ محلات، مصعدان، حارس مقيم.",
      },
      // ٩٠ شقة: الأرضي ٨ + الأدوار ١–٦ (١٢ لكل دور) + السطح ١٠
      [
        { level: -1, apartments: 0, storage: 6, name: "السرداب" },
        { level: 0, apartments: 8, shops: 4, name: "الأرضي" },
        { level: 1, apartments: 12 }, { level: 2, apartments: 12 },
        { level: 3, apartments: 12 }, { level: 4, apartments: 12 },
        { level: 5, apartments: 12 }, { level: 6, apartments: 12 },
        { level: 7, apartments: 10, name: "السطح", prefix: "س" },
      ],
      0.82,
      [170, 240],
      { floors, units }
    )
  );

  // مبنى ثانٍ لتجربة إدارة أكثر من عمارة
  buildings.push(
    makeBuilding(
      r,
      {
        id: "b-firdous", name: "عمارة الفردوس", code: "FRD",
        area: "الفروانية", block: "قطعة 1", street: "شارع 12", buildingNo: "قسيمة 55",
        ownerName: "سلمان السلمان", paciNo: "31998420",
        landArea: 400, builtArea: 1600, color: "#c9992e",
        notes: "عمارة صغيرة، أربعة أدوار.",
      },
      [
        { level: 0, apartments: 2, shops: 2 },
        { level: 1, apartments: 6 }, { level: 2, apartments: 6 },
        { level: 3, apartments: 6 }, { level: 4, apartments: 6 },
      ],
      0.75,
      [150, 210],
      { floors, units }
    )
  );

  const tenants: Tenant[] = [];
  const contracts: Contract[] = [];
  const payments: Payment[] = [];
  let cSeq = 1000;
  let rSeq = 5000;

  const occupied = units.filter((u) => u.status === "occupied");
  occupied.forEach((u, i) => {
    const name = `${pick(r, FIRST)} ${pick(r, LAST)}`;
    const t: Tenant = {
      id: `t-${u.id}`,
      name,
      civilId: `${between(r, 2, 3)}${between(r, 60, 99)}${String(between(r, 1, 12)).padStart(2, "0")}${String(between(r, 1, 28)).padStart(2, "0")}${between(r, 10000, 99999)}`,
      phone: `${pick(r, ["6", "9", "5"])}${between(r, 1000000, 9999999)}`.slice(0, 8),
      nationality: pick(r, NAT),
      workplace: pick(r, WORK),
      active: true,
      createdAt: nowIso,
    };
    tenants.push(t);

    const monthsAgo = between(r, 1, 26);
    const start = shift(now, -monthsAgo * 30);
    // العقد سنوي ويتجدد، فنأخذ الدورة السارية حاليًا
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    while (end <= now) {
      start.setFullYear(start.getFullYear() + 1);
      end.setFullYear(end.getFullYear() + 1);
    }
    // بعض العقود تنتهي قريبًا حتى تظهر التنبيهات
    if (i % 17 === 0) end.setTime(shift(now, between(r, 5, 40)).getTime());

    const c: Contract = {
      id: `c-${u.id}`,
      no: `ع-${++cSeq}`,
      buildingId: u.buildingId,
      unitId: u.id,
      tenantId: t.id,
      startDate: iso(start),
      endDate: iso(end),
      rent: u.baseRent,
      deposit: u.baseRent,
      dueDay: 1,
      payMethod: pick(r, ["cash", "knet", "transfer", "cheque"] as PayMethod[]),
      status: end.getTime() < now.getTime() ? "expired" : "active",
      terms: "يلتزم المستأجر بسداد الإيجار في اليوم الأول من كل شهر ميلادي، والكهرباء والماء على المستأجر.",
      createdAt: nowIso,
    };
    contracts.push(c);

    // مدفوعات آخر ١٢ شهرًا (من بداية العقد) مع ترك بعض المتأخرات
    for (let m = 11; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      if (d < new Date(start.getFullYear(), start.getMonth(), 1)) continue;
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const skip = m === 0 ? r() < 0.26 : m === 1 ? r() < 0.1 : r() < 0.03;
      if (skip) continue;
      const payDay = between(r, 1, m === 0 ? Math.max(1, now.getDate()) : 12);
      payments.push({
        id: `p-${u.id}-${period}`,
        receiptNo: `و-${++rSeq}`,
        buildingId: u.buildingId,
        unitId: u.id,
        tenantId: t.id,
        contractId: c.id,
        period,
        amount: c.rent,
        paidAt: iso(new Date(d.getFullYear(), d.getMonth(), payDay)),
        method: c.payMethod,
        createdBy: "admin",
        createdAt: nowIso,
      });
    }
  });

  const expenses: Expense[] = [];
  const cats: [ExpenseCategory, number, number][] = [
    ["electricity", 180, 420], ["water", 60, 150], ["guard", 250, 250],
    ["cleaning", 80, 160], ["elevator", 90, 140], ["maintenance", 30, 320],
  ];
  const expenseTitle: Record<string, string> = {
    electricity: "فاتورة كهرباء", water: "فاتورة ماء", guard: "راتب الحارس",
    cleaning: "عقد تنظيف", elevator: "صيانة مصعد", maintenance: "أعمال صيانة متفرقة",
  };
  buildings.forEach((b) => {
    const scale = b.id === "b-turab" ? 1 : 0.45;
    for (let m = 11; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, between(r, 3, 25));
      cats.forEach(([cat, lo, hi]) => {
        if (cat === "maintenance" && r() < 0.35) return;
        expenses.push({
          id: `e-${b.id}-${cat}-${m}`,
          buildingId: b.id,
          category: cat,
          title: expenseTitle[cat] ?? "مصروف",
          amount: Math.round(between(r, lo, hi) * scale),
          date: iso(d),
          vendor: cat === "electricity" || cat === "water" ? "وزارة الكهرباء والماء"
            : cat === "elevator" ? "شركة المصاعد المتحدة" : undefined,
          method: "transfer",
          createdAt: nowIso,
        });
      });
    }
  });

  const ticketSeeds: [string, string, Ticket["status"], Ticket["priority"]][] = [
    ["تسريب ماء في الحمام", "تسريب من ماسورة الحمام الرئيسي", "new", "high"],
    ["المصعد يتوقف بين الأدوار", "المصعد الأيمن يقف بين الدور ٣ و٤", "in_progress", "urgent"],
    ["مكيف الصالة لا يبرّد", "يحتاج تعبئة فريون", "new", "normal"],
    ["إنارة الدرج مطفية", "لمبات الدور الخامس", "done", "low"],
    ["باب المدخل لا يقفل", "قفل المدخل الرئيسي تالف", "in_progress", "high"],
    ["انسداد في المجاري", "الدور الأول جهة الشمال", "new", "urgent"],
    ["طلاء الممر", "الممر بحاجة دهان", "done", "low"],
    ["عطل في سخان الماء", "السخان لا يعمل نهائيًا", "new", "normal"],
  ];
  const tickets: Ticket[] = ticketSeeds.map(([title, description, status, priority], i) => {
    const u = occupied[between(r, 0, occupied.length - 1)];
    return {
      id: `tk-${i}`,
      no: `ص-${100 + i}`,
      buildingId: u.buildingId,
      unitId: u.id,
      tenantId: `t-${u.id}`,
      title, description, status, priority,
      cost: status === "done" ? between(r, 10, 120) : undefined,
      assignee: status !== "new" ? pick(r, ["فني الصيانة", "شركة المصاعد", "الحارس"]) : undefined,
      createdBy: "guard",
      createdAt: iso(shift(now, -between(r, 1, 40))),
      closedAt: status === "done" ? iso(shift(now, -between(r, 1, 10))) : undefined,
    };
  });

  return {
    version: 1,
    users, buildings, floors, units, tenants, contracts, payments, expenses, tickets,
    docs: [],
    audit: [{ id: "a0", at: nowIso, actor: "system", action: "تهيئة", detail: "تم إنشاء بيانات النظام الأولية" }],
    settings: {
      orgName: "إدارة أملاك سلمان السلمان",
      currency: "KWD",
      sessionMinutes: 480,
      reminderDaysBeforeDue: 3,
      contractAlertDays: 45,
    },
  };
}
