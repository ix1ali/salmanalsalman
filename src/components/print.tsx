"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { Icon, Logo } from "./Icons";
import {
  KWD, amount, amountInWords, dateAr, dateShort, dinarsFils, expenseLabel,
  methodLabel, monthAr, num, pct,
} from "@/lib/format";
import type { Contract, Payment, Unit } from "@/lib/types";
import { arrears, scope } from "@/lib/selectors";

const INK = "#0b2545";
const NAVY = "#123a6b";
const MUTED = "#7089a3";
const LINE = "#cbd7e5";

const WEEKDAY = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const dayName = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : WEEKDAY[d.getDay()];
};

/* =========================== غلاف قابل للطباعة =========================== */

export function PrintOverlay({
  open, onClose, children, fileTitle,
}: { open: boolean; onClose: () => void; children: React.ReactNode; fileTitle: string }) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("print-mode");
    const prevTitle = document.title;
    document.title = fileTitle;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("print-mode");
      document.title = prevTitle;
      document.body.style.overflow = prev;
    };
  }, [open, fileTitle]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div id="print-portal" className="fixed inset-0 z-[220] overflow-y-auto bg-[#0b2545]/60 p-0 sm:p-6">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 bg-[var(--surface)] px-3 py-2 shadow-[var(--sh-2)] sm:mx-auto sm:max-w-[820px] sm:rounded-t-2xl">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          <Icon name="x" size={15} /> إغلاق
        </button>
        <p className="truncate text-[13px] font-extrabold">{fileTitle}</p>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
          <Icon name="print" size={15} /> طباعة / PDF
        </button>
      </div>
      <div className="print-sheet mx-auto max-w-[820px] bg-white p-6 shadow-[var(--sh-3)] sm:rounded-b-2xl sm:p-10">
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ============================== ترويسة عامة ============================== */

function LetterHead({ title, en, meta }: { title: string; en?: string; meta?: React.ReactNode }) {
  const { data } = useStore();
  return (
    <div className="mb-5 flex items-start justify-between gap-4 border-b-2 pb-3" style={{ borderColor: NAVY }}>
      <div className="flex items-center gap-3">
        <Logo size={48} />
        <div>
          <p className="text-[17px] font-extrabold" style={{ color: INK }}>عقار / سلمان السلمان</p>
          <p className="text-[11.5px]" style={{ color: MUTED }}>Real Estate / Salman AlSalman</p>
          <p className="mt-0.5 text-[11.5px]" style={{ color: MUTED }}>{data.settings.orgName}</p>
        </div>
      </div>
      <div className="text-left">
        <p className="text-[20px] font-extrabold" style={{ color: NAVY }}>{title}</p>
        {en && <p className="text-[11.5px]" style={{ color: MUTED }}>{en}</p>}
        {meta}
      </div>
    </div>
  );
}

const Line = ({ k, v, w = "" }: { k: string; v: React.ReactNode; w?: string }) => (
  <span className={`inline-flex items-baseline gap-1.5 ${w}`}>
    <span className="text-[12.5px] font-semibold" style={{ color: MUTED }}>{k}</span>
    <span className="min-w-[70px] flex-1 border-b border-dotted px-1 text-[13px] font-bold" style={{ borderColor: LINE, color: INK }}>
      {v || " "}
    </span>
  </span>
);

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3 border-b border-dashed py-1.5 text-[12.5px]" style={{ borderColor: "#e4eaf2" }}>
    <span className="font-semibold" style={{ color: MUTED }}>{k}</span>
    <span className="font-bold" style={{ color: INK }}>{v}</span>
  </div>
);

const Signatures = ({ a, b }: { a: string; b: string }) => (
  <div className="mt-10 grid grid-cols-2 gap-8 text-center text-[12.5px]">
    {[a, b].map((label) => (
      <div key={label}>
        <p className="font-bold" style={{ color: INK }}>{label}</p>
        <div className="mx-auto mt-10 w-4/5 border-b" style={{ borderColor: INK }} />
        <p className="mt-1 text-[11px]" style={{ color: MUTED }}>الاسم والتوقيع</p>
      </div>
    ))}
  </div>
);

function useUnitCtx(unitId: string) {
  const { data } = useStore();
  const unit = data.units.find((u) => u.id === unitId);
  const floor = data.floors.find((f) => f.id === unit?.floorId);
  const building = data.buildings.find((b) => b.id === unit?.buildingId);
  return { unit, floor, building };
}

/* ================================ العقد ================================= */

/** حقول العقد القابلة للتعبئة — من عقد مسجّل أو يدويًا. */
export interface ContractFields {
  tenantName: string;
  civilId: string;
  nationality: string;
  job: string;
  phone: string;
  area: string;
  block: string;
  street: string;
  buildingNo: string;
  floor: string;
  unitNo: string;
  duration: string;
  startDate: string;
  endDate: string;
  rent: number;
  deposit: number;
  dueDay: number;
  occupants: number;
  signedAt: string;
}

/**
 * عقد الإيجار بنصّه المعتمد في المكتب — منقول حرفيًا من نموذج rent1.docm.
 * البنود التسعة عشر ثابتة، وما عداها يُعبّأ من الحقول.
 */
export function ContractSheet({ f }: { f: ContractFields }) {
  const { data } = useStore();
  const owner = data.settings.ownerFullName;

  return (
    <>
      <LetterHead title="عقد إيجار" en="Rent Contract" />

      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
        <Line k="في الكويت اليوم :" v={dayName(f.signedAt)} />
        <Line k="الموافق :" v={dateShort(f.signedAt)} />
      </div>

      <p className="mb-3 text-[13px] font-bold" style={{ color: INK }}>تحرر وتم الاتفاق بين كل من الطرفين</p>

      <div className="mb-4 rounded-lg border p-3" style={{ borderColor: LINE }}>
        <p className="mb-1 text-[13px] font-extrabold" style={{ color: NAVY }}>الطرف الأول ( المؤجر )</p>
        <p className="text-[13px] font-bold" style={{ color: INK }}>السيد / {owner}</p>
        <p className="text-[12.5px]" style={{ color: MUTED }}>بصفته مالك العقار</p>
      </div>

      <div className="mb-4 rounded-lg border p-3" style={{ borderColor: LINE }}>
        <p className="mb-2 text-[13px] font-extrabold" style={{ color: NAVY }}>الطرف الثاني ( المستأجر )</p>
        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Line k="الاسم :" v={f.tenantName} />
          <Line k="الرقم المدني :" v={f.civilId} />
          <Line k="الجنسية :" v={f.nationality} />
          <Line k="المهنة :" v={f.job} />
          <Line k="رقم الهاتف :" v={f.phone} />
        </div>
      </div>

      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "#2a4361" }}>
        على أن يؤجر الطرف الأول للطرف الثاني ( العين ) الواقعة بمنطقة ( <b>{f.area}</b> )
        قطعة رقم ( <b>{f.block}</b> ) شارع ( <b>{f.street}</b> ) عمارة رقم ( <b>{f.buildingNo}</b> )
        الدور ( <b>{f.floor}</b> ) شقة رقم ( <b>{f.unitNo}</b> ) كسكن خاص له ولعائلته وفق الشروط التالية:
      </p>

      <div className="mb-4 grid gap-x-8 gap-y-2 rounded-lg border p-3 sm:grid-cols-2" style={{ borderColor: LINE }}>
        <Line k="مدة هذا العقد :" v={f.duration} />
        <Line k="القيمة الإيجارية الشهرية :" v={KWD(f.rent)} />
        <Line k="يبدأ بتاريخ :" v={dateShort(f.startDate)} />
        <Line k="وينتهي بتاريخ :" v={dateShort(f.endDate)} />
        <Line k="عدد الساكنين :" v={f.occupants ? num(f.occupants) : ""} />
        <Line k="التأمين :" v={f.deposit ? KWD(f.deposit) : ""} />
      </div>

      <ol className="list-inside list-decimal space-y-2 text-[12.5px] leading-relaxed" style={{ color: "#2a4361" }}>
        <li>
          تتجدد مدة هذا العقد تلقائيًا لمدد مماثلة ما لم يخطر أي من الطرفين الطرف الآخر بعدم رغبته في التجديد كتابةً قبل
          انتهاء المدة بشهر على الأقل، وعند حصول التنبيه بالإخلاء فإنه يجب على المستأجر أن يسهّل ويسمح بدخول كل من يرغب
          بمعاينة العين.
        </li>
        <li>
          القيمة الإيجارية الشهرية <b>{KWD(f.rent)}</b> تعتبر دينًا مترصدًا في ذمة الطرف الثاني محدد القيمة وواجب الوفاء.
        </li>
        <li>
          يتعهد ويلتزم الطرف الثاني ( المستأجر ) بسداد الأجرة الشهرية قبل يوم {num(f.dueDay)} من كل شهر ميلادي.
        </li>
        <li>
          يتعهد ويلتزم المستأجر بأن عدد الساكنين في العين محل هذا العقد لا يزيدون عن عدد
          ( {f.occupants ? num(f.occupants) : "    "} ) شخص / أشخاص.
        </li>
        <li>
          في حالة رغبة المستأجر بالإخلاء وإنهاء العقد عليه إعلام المؤجر خطيًا قبل الإخلاء بمدة لا تقل عن شهر، ويجب تسليم
          العين قبل تاريخ 25 من الشهر، وفي حال التأخير وعدم الالتزام بتسليم العين المؤجرة بالموعد فيُحتسب على الطرف الثاني
          إيجار الشهر الذي يليه.
        </li>
        <li>
          يتعهد ويلتزم المستأجر بعدم الجلوس أو التدخين بالمصاعد والممرات والسلالم، ولا يحق له التخزين في أي مكان خارج
          العين المؤجرة أو استخدامها كمخزن للأغراض أو المواد الملتهبة أو المضرة بالصحة، وهو مسؤول قِبل المؤجر عن أي حريق
          يحدث نتيجة إهماله أو تعديه، ولا يحق للمستأجر اعتبار المؤجر مسؤولًا عن تعدي الغير. وفي حالة المخالفة يحق للطرف
          الأول رمي أي أغراض خُزّنت خارج العين ولا يحق له المطالبة بتعويض، كما يلتزم بعدم رمي الأوساخ خارج المكان المخصص
          لذلك وعدم استخدام مواقف السيارات بطريقة خاطئة.
        </li>
        <li>
          إذا تأخر الطرف الثاني عن دفع القيمة الإيجارية في ميعاد استحقاقها يُفسخ العقد فورًا من تلقاء نفسه دون الحاجة إلى
          تنبيه أو إنذار، وتعتبر يد المستأجر يد غاصب، ويختص القضاء المستعجل بالحكم بصفة مستعجلة بطرده من العين، وكذلك من
          حق المؤجر المطالبة بكامل قيمة العقد عن مدته الأصلية أو المحددة والتعويض الاتفاقي في البند الأول واستيفاء
          المستأجر لكافة التعويضات والمصاريف المترتبة على الإخلاء.
        </li>
        <li>
          يقر الطرف الثاني أنه عاين العين محل العقد المعاينة التامة النافية للجهالة وقد وجدها على أحسن حال ومستوفية لكل
          لوازمها التي تمكنه من الانتفاع بها.
        </li>
        <li>
          يتعهد الطرف الثاني بالمحافظة على العين المؤجرة وتسليمها على حالتها كما استلمها، وألّا يُحدث أي تغيير سواء هدم أو
          بناء أو تمديدات كهربائية والستالايت إلا بتصريح كتابي من الطرف الأول.
        </li>
        <li>
          مصروفات رسوم الكهرباء والماء وبلدية الكويت يتحملها الطرف الأول، كما يتحمل الطرف الثاني دفع أي زيادة أو إضافة في
          تسعيرة الخدمات التي تقدمها الجهات الحكومية أو الأهلية كزيادة رسوم مصروفات الماء والكهرباء والنظافة وضريبة
          القيمة المضافة وغيرها من الرسوم التي قد تُفرض على العين المؤجرة، وتعتبر هذه الزيادة جزءًا من هذا العقد الماثل
          وتضاف على القيمة الإيجارية المحددة والملزم بدفعها الطرف الثاني.
        </li>
        <li>
          جميع المنقولات الموجودة بالعين المستأجرة ضامنة للأجرة المعقود عليها، ولا يحق للمستأجر نقلها إلا بعد الوفاء بالأجرة.
        </li>
        <li>
          لا يحق للطرف الثاني التأجير بالباطن أو إيواء الغير أو التنازل عن المكان أو جزء منه دون أخذ موافقة خطية من
          المؤجر، مع دفع قيمة الإيجار مقدمًا في حالة السفر، كما أن الموكلين من الطرف الثاني بإدارة العين أو القاطنين
          يعتبرون ضامنين متضامنين بدفع جميع المبالغ المستحقة من الإيجار، ولا يحق لهم تغيير حق السكن العائلي وذلك يعتبر
          مخالفة لبنود العقد.
        </li>
        <li>
          يتعهد ويلتزم المستأجر بعدم الإضرار بالجيران وإزعاجهم، وأن يحترم الشعائر والأحكام الإسلامية والعادات والتقاليد
          والأعراف في دولة الكويت، ويكون مسؤولًا عن تصرفاته الشخصية وعن تصرفات التابعين له ومن يكون قاطنًا معه، ويُمنع
          منعًا باتًا إدخال أي نوع من الحيوانات داخل العقار.
        </li>
        <li>
          في حال عدم التزام الطرف الثاني بسداد الأجرة الشهرية، يلتزم الطرف الثاني بدفع مبلغ {KWD(data.settings.lateFee)} للطرف
          الأول وذلك نظير الرسوم الإدارية وأتعاب المحاماة.
        </li>
        <li>
          يتعهد ويلتزم الطرف الثاني بجميع ما ذُكر بالعقد حتى في حال تعطيل الدوامات في القطاع الحكومي أو الأهلي أو نشوب
          كوارث طبيعية أو حروب أو ظروف خارجة عن الإرادة أو حالات صحية أو الانقطاع أو التضرر الكلي أو الجزئي في وظيفة وعمل
          الطرف الثاني.
        </li>
        <li>
          في حال مخالفة الطرف الثاني لأي بند من البنود المذكورة في هذا الاتفاق، يعتبر العقد مفسوخًا من تلقاء نفسه دون
          الرجوع إليه، ويحق للطرف الأول المطالبة بتعويض عن الأضرار التي نتجت عن ذلك.
        </li>
        <li>
          يقر المستأجر بأنه يتخذ العين موضوع العقد محلًا مختارًا له المبين عنوانها، وكذلك ( البريد الإلكتروني ) ورقم
          الهاتف المسجل في صدر هذا العقد، وكل إعلان يُرسل له عن طريق البريد الإلكتروني ورقم الهاتف أو عنوان السكن أو أي
          وسيلة تقرها دولة الكويت يعتبر قانونيًا.
        </li>
        <li>
          يدفع المستأجر مبلغ {KWD(data.settings.supervisorFee)} للمشرف الفني على العمارة مع دفع الأجرة الشهرية وذلك نظير قيامه
          بتنظيف العمارة ورمي القمامة.
        </li>
        <li>
          كل ما لم يرد به اتفاق في هذا العقد يخضع لقانون الإيجارات بدولة الكويت، وتختص المحاكم الكويتية بالفصل في
          المنازعات الناشئة عن تنفيذ هذا العقد.
        </li>
      </ol>

      <p className="mt-4 text-center text-[12.5px] font-bold" style={{ color: INK }}>
        حُرر هذا العقد من نسختين بيد كل طرف نسخة للعمل بموجبها
      </p>

      <Signatures a={`الطرف الأول ( المؤجر ) — السيد / ${owner}`} b="الطرف الثاني ( المستأجر )" />
    </>
  );
}

/** العقد معبَّأ من عقد مسجّل في النظام. */
export function ContractDoc({ contract }: { contract: Contract }) {
  const { data } = useStore();
  const tenant = data.tenants.find((t) => t.id === contract.tenantId);
  const { unit, floor, building } = useUnitCtx(contract.unitId);

  return (
    <ContractSheet
      f={{
        tenantName: tenant?.name ?? "",
        civilId: tenant?.civilId ?? "",
        nationality: tenant?.nationality ?? "",
        job: tenant?.workplace ?? "",
        phone: tenant?.phone ?? "",
        area: building?.area ?? "حولي الجنوبي",
        block: (building?.block ?? "قطعة 10").replace("قطعة", "").trim(),
        street: (building?.street ?? "شارع موسى بن نصير").replace("شارع", "").trim(),
        buildingNo: (building?.buildingNo ?? "").replace(/\D+/g, "") || "37",
        floor: floor?.name ?? "",
        unitNo: unit?.number ?? "",
        duration: contract.durationText || "سنة",
        startDate: contract.startDate,
        endDate: contract.endDate,
        rent: contract.rent,
        deposit: contract.deposit,
        dueDay: contract.dueDay || data.settings.dueDay,
        occupants: contract.occupants ?? 0,
        signedAt: contract.signedAt || contract.startDate,
      }}
    />
  );
}

/* ================================ الوصل ================================= */

/** أسماء البنوك كما هي في نموذج المكتب. */
export const BANKS = [
  "الكويت الوطني", "الخليج", "التجاري", "الأهلي",
  "بيت التمويل الكويتي", "بوبيان", "وربة", "الدولي",
];

/** بيانات وصل قابلة للتعبئة يدويًا أو من دفعة مسجّلة. */
export interface ReceiptFields {
  no: string;
  from: string;          // وصلنا من السيد / السادة
  amount: number;
  method: string;        // نقدًا أو رقم الشيك
  bank: string;
  unitNo: string;
  floor: string;
  monthText: string;
  date: string;
  notes?: string;
}

/**
 * وصل الإيجار بنفس صياغة نموذج المكتب حرفيًا
 * (تقرير «طباعة وصل ايجار» في قاعدة Access).
 */
export function ReceiptSheet({ f }: { f: ReceiptFields }) {
  const { data } = useStore();
  const { dinars, fils } = dinarsFils(f.amount);

  return (
    <>
      <div className="mb-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-3">
          <Logo size={44} />
          <div className="text-right">
            <p className="text-[19px] font-extrabold" style={{ color: INK }}>عقار المالك / سلمان السلمان</p>
            <p className="text-[11.5px]" style={{ color: MUTED }}>Real Estate / Salman AlSalman</p>
          </div>
        </div>
        <div className="mx-auto mt-3 inline-block rounded-lg px-8 py-1.5" style={{ background: NAVY }}>
          <p className="text-[19px] font-extrabold text-white">وصل ايجار</p>
        </div>
      </div>

      <div className="mb-5 flex justify-between text-[13px]">
        <Line k="رقم الوصل :" v={f.no} />
        <Line k="التاريخ :" v={dateShort(f.date)} />
        <Line k="اليوم :" v={dayName(f.date)} />
      </div>

      <div className="space-y-4 text-[14px]">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 font-bold" style={{ color: INK }}>وصلنا من السيد / السادة</span>
          <span className="flex-1 border-b border-dotted px-2 pb-1 font-extrabold" style={{ borderColor: INK, color: NAVY }}>
            {f.from || " "}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-2">
          <span className="shrink-0 font-bold" style={{ color: INK }}>مبلغ وقدره</span>
          <span className="min-w-[120px] flex-1 border-b border-dotted px-2 pb-1 text-center font-extrabold" style={{ borderColor: INK, color: NAVY }}>
            {amount(f.amount)}
          </span>
          <span className="shrink-0 font-bold" style={{ color: INK }}>دينار كويتي فقط لاغير</span>
        </div>

        <p className="rounded-lg px-3 py-2 text-[12.5px] font-bold" style={{ background: "#edf3fb", color: NAVY }}>
          فقط {amountInWords(dinars)} دينارًا كويتيًا{fils ? ` و${num(fils)} فلسًا` : ""} لا غير.
        </p>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
          <span className="flex flex-1 items-baseline gap-2">
            <span className="shrink-0 font-bold" style={{ color: INK }}>نقدا / شيك رقم</span>
            <span className="min-w-[80px] flex-1 border-b border-dotted px-2 pb-1 font-bold" style={{ borderColor: INK, color: NAVY }}>
              {f.method || " "}
            </span>
          </span>
          <span className="flex flex-1 items-baseline gap-2">
            <span className="shrink-0 font-bold" style={{ color: INK }}>على بنك</span>
            <span className="min-w-[80px] flex-1 border-b border-dotted px-2 pb-1 font-bold" style={{ borderColor: INK, color: NAVY }}>
              {f.bank || " "}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
          <span className="flex items-baseline gap-2">
            <span className="shrink-0 font-bold" style={{ color: INK }}>وذلك عن ايجار شقة رقم</span>
            <span className="min-w-[70px] border-b border-dotted px-2 pb-1 text-center font-extrabold" style={{ borderColor: INK, color: NAVY }}>
              {f.unitNo || " "}
            </span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="shrink-0 font-bold" style={{ color: INK }}>الدور</span>
            <span className="min-w-[80px] border-b border-dotted px-2 pb-1 text-center font-bold" style={{ borderColor: INK, color: NAVY }}>
              {f.floor || " "}
            </span>
          </span>
          <span className="flex flex-1 items-baseline gap-2">
            <span className="shrink-0 font-bold" style={{ color: INK }}>عن شهر</span>
            <span className="min-w-[90px] flex-1 border-b border-dotted px-2 pb-1 text-center font-bold" style={{ borderColor: INK, color: NAVY }}>
              {f.monthText || " "}
            </span>
          </span>
        </div>

        {f.notes && (
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 font-bold" style={{ color: INK }}>ملاحظات</span>
            <span className="flex-1 border-b border-dotted px-2 pb-1" style={{ borderColor: LINE, color: "#2a4361" }}>{f.notes}</span>
          </div>
        )}
      </div>

      <div className="mt-14 text-left">
        <p className="text-[13px] font-bold" style={{ color: INK }}>توقيع المستلم</p>
        <div className="mr-auto mt-10 w-56 border-b" style={{ borderColor: INK }} />
      </div>

      <p className="mt-8 text-center text-[10.5px]" style={{ color: "#9fb0c4" }}>
        {data.settings.orgName}
      </p>
    </>
  );
}

/** الوصل معبَّأ من دفعة مسجّلة في النظام. */
export function ReceiptDoc({ payment }: { payment: Payment }) {
  const { data } = useStore();
  const tenant = data.tenants.find((t) => t.id === payment.tenantId);
  const { unit, floor } = useUnitCtx(payment.unitId);
  return (
    <ReceiptSheet
      f={{
        no: payment.receiptNo,
        from: tenant?.name ?? "",
        amount: payment.amount,
        method: payment.method === "cheque" ? (payment.reference || "شيك") : methodLabel[payment.method],
        bank: payment.bank ?? "",
        unitNo: unit?.number ?? "",
        floor: floor?.name ?? "",
        monthText: monthAr(payment.period),
        date: payment.paidAt,
        notes: payment.notes,
      }}
    />
  );
}

/* ============================== طلب الإخلاء ============================== */

/** إقرار إخلاء وتسليم العين المؤجرة — منقول من نموذج «طلب اخلا.doc». */
export function EvictionDoc({ unitId, tenantId, date }: { unitId: string; tenantId?: string; date?: string }) {
  const { data } = useStore();
  const tenant = data.tenants.find((t) => t.id === tenantId);
  const { unit, floor, building } = useUnitCtx(unitId);

  return (
    <>
      <LetterHead
        title="طلب إخلاء"
        en="Eviction Acknowledgement"
        meta={<p className="mt-1 text-[11.5px]" style={{ color: MUTED }}>في الكويت — {dateShort(date)}</p>}
      />

      <p className="mb-4 text-[13.5px] font-extrabold" style={{ color: NAVY }}>
        الموضوع : إقرار إخلاء وتسليم العين المؤجرة
      </p>

      <div className="mb-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        <Line k="أقر وأتعهد أنا :" v={tenant?.name} w="sm:col-span-2" />
        <Line k="أحمل بطاقة مدنية رقم :" v={tenant?.civilId} />
        <Line k="رقم الهاتف :" v={tenant?.phone} />
      </div>

      <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "#2a4361" }}>
        إقرارًا نافيًا للجهالة وغير قابل للعدول بإخلاء العين المؤجرة رقم ( <b>{unit?.number}</b> )
        الدور ( <b>{floor?.name}</b> ) بالعقار الكائن بمنطقة <b>{building?.area ?? "حولي الجنوبي"}</b>{" "}
        <b>{building?.block ?? "قطعة 10"}</b> <b>{building?.street ?? "شارع موسى بن نصير"}</b>{" "}
        <b>{building?.parcel ?? "قسيمة رقم 21/79"}</b> <b>{building?.buildingNo ?? "عمارة رقم 37"}</b>
      </p>

      <div className="mb-4">
        <Line k="بتاريخ :" v={dateShort(date)} />
      </div>

      <p className="mb-6 text-[13px] leading-relaxed" style={{ color: "#2a4361" }}>
        وهذا إقرار وتعهد مني نافٍ للجهالة وغير قابل للعدول بأنني سلّمت العين المؤجرة المذكورة أعلاه بالتاريخ المذكور وهي
        خالية من المتاع والشواغل، كما أتعهد وأقر بتسليم المالك براءة ذمة صادرة من وزارة الكهرباء والماء تفيد بتسديد ما
        عليّ من التزامات ومستحقات.
      </p>

      <div className="grid gap-y-3 sm:w-1/2">
        <Line k="الاسم :" v={tenant?.name} />
        <Line k="الرقم المدني :" v={tenant?.civilId} />
        <Line k="التاريخ :" v={dateShort(date)} />
        <Line k="التوقيع :" v="" />
      </div>

      <p className="mt-10 text-center text-[11px]" style={{ color: MUTED }}>
        {data.settings.orgName} — {data.settings.ownerFullName}
      </p>
    </>
  );
}

/* ============================ كشف حساب مستأجر ============================ */

export function TenantStatementDoc({ tenantId }: { tenantId: string }) {
  const { data } = useStore();
  const tenant = data.tenants.find((t) => t.id === tenantId);
  const contracts = data.contracts.filter((c) => c.tenantId === tenantId);
  const payments = data.payments.filter((p) => p.tenantId === tenantId).sort((a, b) => a.period.localeCompare(b.period));
  const active = contracts.find((c) => c.status === "active");
  const unit = data.units.find((u) => u.id === active?.unitId) as Unit | undefined;
  const building = data.buildings.find((b) => b.id === active?.buildingId);
  const due = active ? arrears(data, scope(data, active.buildingId)).find((a) => a.contract.id === active.id) : undefined;
  const total = payments.reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <LetterHead
        title="كشف حساب"
        en="Account Statement"
        meta={<p className="mt-1 text-[11.5px]" style={{ color: MUTED }}>حتى {dateShort(new Date().toISOString())}</p>}
      />

      <div className="mb-5 grid gap-x-8 sm:grid-cols-2">
        <div>
          <Row k="المستأجر" v={tenant?.name ?? "—"} />
          <Row k="الرقم المدني" v={tenant?.civilId ?? "—"} />
          <Row k="رقم الهاتف" v={tenant?.phone ?? "—"} />
        </div>
        <div>
          <Row k="العقار / الوحدة" v={`${building?.name ?? "—"} — ${unit?.number ?? "—"}`} />
          <Row k="القيمة الإيجارية الشهرية" v={active ? KWD(active.rent) : "—"} />
          <Row k="مدة العقد" v={active ? `${dateShort(active.startDate)} — ${dateShort(active.endDate)}` : "—"} />
        </div>
      </div>

      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr style={{ background: "#edf3fb", color: NAVY }}>
            <th className="border p-2 text-right" style={{ borderColor: LINE }}>م</th>
            <th className="border p-2 text-right" style={{ borderColor: LINE }}>الشهر</th>
            <th className="border p-2 text-right" style={{ borderColor: LINE }}>رقم الوصل</th>
            <th className="border p-2 text-right" style={{ borderColor: LINE }}>تاريخ السداد</th>
            <th className="border p-2 text-right" style={{ borderColor: LINE }}>طريقة الدفع</th>
            <th className="border p-2 text-left" style={{ borderColor: LINE }}>المبلغ (د.ك)</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={p.id}>
              <td className="border p-2" style={{ borderColor: LINE }}>{num(i + 1)}</td>
              <td className="border p-2" style={{ borderColor: LINE }}>{monthAr(p.period)}</td>
              <td className="border p-2" style={{ borderColor: LINE }}>{p.receiptNo}</td>
              <td className="border p-2" style={{ borderColor: LINE }}>{dateShort(p.paidAt)}</td>
              <td className="border p-2" style={{ borderColor: LINE }}>{methodLabel[p.method]}</td>
              <td className="border p-2 text-left font-bold tabular-nums" style={{ borderColor: LINE }}>{amount(p.amount)}</td>
            </tr>
          ))}
          {!payments.length && (
            <tr><td colSpan={6} className="border p-4 text-center" style={{ borderColor: LINE, color: MUTED }}>لا توجد دفعات مسجّلة</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className="font-extrabold" style={{ background: "#f9fbfd" }}>
            <td className="border p-2" style={{ borderColor: LINE }} colSpan={5}>إجمالي المسدَّد</td>
            <td className="border p-2 text-left tabular-nums" style={{ borderColor: LINE }}>{amount(total)}</td>
          </tr>
          {due && due.amount > 0 && (
            <tr className="font-extrabold" style={{ background: "#fbeaec", color: "#b3303b" }}>
              <td className="border p-2" style={{ borderColor: LINE }} colSpan={5}>
                المتأخر ({due.missing.map(monthAr).join("، ")})
              </td>
              <td className="border p-2 text-left tabular-nums" style={{ borderColor: LINE }}>{amount(due.amount)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      <Signatures a="إدارة العقار" b="المستأجر" />
    </>
  );
}

/* =========================== كشف مالي للعقار =========================== */

export function BuildingStatementDoc({ buildingId, period }: { buildingId: string; period: string }) {
  const { data } = useStore();
  const building = data.buildings.find((b) => b.id === buildingId);
  const s = scope(data, buildingId);
  const payments = s.payments.filter((p) => p.period === period).sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const expenses = s.expenses.filter((e) => e.date.slice(0, 7) === period).sort((a, b) => a.date.localeCompare(b.date));
  const income = payments.reduce((a, p) => a + p.amount, 0);
  const outgo = expenses.reduce((a, e) => a + e.amount, 0);
  const expected = s.contracts.filter((c) => c.status === "active").reduce((a, c) => a + c.rent, 0);
  const unitById = new Map(data.units.map((u) => [u.id, u]));
  const tenantById = new Map(data.tenants.map((t) => [t.id, t]));

  return (
    <>
      <LetterHead
        title="كشف مالي شهري"
        en="Monthly Statement"
        meta={
          <>
            <p className="mt-1 text-[13px] font-bold" style={{ color: INK }}>{building?.name}</p>
            <p className="text-[11.5px]" style={{ color: MUTED }}>{monthAr(period)}</p>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        {[
          ["الإيجار المستحق", KWD(expected), INK, "#f9fbfd"],
          ["المحصَّل", KWD(income), "#1e8a5f", "#e7f4ee"],
          ["المصروفات", KWD(outgo), "#a87c1e", "#fbf3e1"],
          ["الصافي", KWD(income - outgo), income - outgo >= 0 ? NAVY : "#b3303b", income - outgo >= 0 ? "#edf3fb" : "#fbeaec"],
        ].map(([l, v, c, bg]) => (
          <div key={l} className="rounded-xl p-3" style={{ background: bg }}>
            <p className="text-[11px] font-bold" style={{ color: c }}>{l}</p>
            <p className="text-[14px] font-extrabold tabular-nums" style={{ color: c }}>{v}</p>
          </div>
        ))}
      </div>
      <p className="mb-5 text-[12px]" style={{ color: MUTED }}>
        نسبة التحصيل: <b style={{ color: INK }}>{pct(expected ? (income / expected) * 100 : 0)}</b> ·
        عدد الوحدات: <b style={{ color: INK }}>{num(s.units.length)}</b> ·
        المؤجرة: <b style={{ color: INK }}>{num(s.units.filter((u) => u.status === "occupied").length)}</b>
      </p>

      <p className="mb-1.5 text-[13px] font-extrabold" style={{ color: NAVY }}>أولًا: المقبوضات</p>
      <table className="mb-6 w-full border-collapse text-[12px]">
        <thead>
          <tr style={{ background: "#e7f4ee", color: "#1e8a5f" }}>
            {["م", "الوحدة", "المستأجر", "رقم الوصل", "التاريخ"].map((h) => (
              <th key={h} className="border p-1.5 text-right" style={{ borderColor: LINE }}>{h}</th>
            ))}
            <th className="border p-1.5 text-left" style={{ borderColor: LINE }}>المبلغ (د.ك)</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={p.id}>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{num(i + 1)}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{unitById.get(p.unitId)?.number ?? "—"}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{tenantById.get(p.tenantId)?.name ?? "—"}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{p.receiptNo}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{dateShort(p.paidAt)}</td>
              <td className="border p-1.5 text-left font-bold tabular-nums" style={{ borderColor: LINE }}>{amount(p.amount)}</td>
            </tr>
          ))}
          {!payments.length && <tr><td colSpan={6} className="border p-3 text-center" style={{ borderColor: LINE, color: MUTED }}>لا يوجد</td></tr>}
        </tbody>
        <tfoot>
          <tr className="font-extrabold" style={{ background: "#f9fbfd" }}>
            <td className="border p-1.5" style={{ borderColor: LINE }} colSpan={5}>الإجمالي</td>
            <td className="border p-1.5 text-left tabular-nums" style={{ borderColor: LINE }}>{amount(income)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mb-1.5 text-[13px] font-extrabold" style={{ color: NAVY }}>ثانيًا: المصروفات</p>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr style={{ background: "#fbf3e1", color: "#a87c1e" }}>
            {["م", "البند", "البيان", "الجهة", "التاريخ"].map((h) => (
              <th key={h} className="border p-1.5 text-right" style={{ borderColor: LINE }}>{h}</th>
            ))}
            <th className="border p-1.5 text-left" style={{ borderColor: LINE }}>المبلغ (د.ك)</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e, i) => (
            <tr key={e.id}>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{num(i + 1)}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{expenseLabel[e.category]}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{e.title}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{e.vendor ?? "—"}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{dateShort(e.date)}</td>
              <td className="border p-1.5 text-left font-bold tabular-nums" style={{ borderColor: LINE }}>{amount(e.amount)}</td>
            </tr>
          ))}
          {!expenses.length && <tr><td colSpan={6} className="border p-3 text-center" style={{ borderColor: LINE, color: MUTED }}>لا يوجد</td></tr>}
        </tbody>
        <tfoot>
          <tr className="font-extrabold" style={{ background: "#f9fbfd" }}>
            <td className="border p-1.5" style={{ borderColor: LINE }} colSpan={5}>الإجمالي</td>
            <td className="border p-1.5 text-left tabular-nums" style={{ borderColor: LINE }}>{amount(outgo)}</td>
          </tr>
          <tr className="font-extrabold" style={{ background: "#edf3fb", color: NAVY }}>
            <td className="border p-1.5" style={{ borderColor: LINE }} colSpan={5}>صافي الدخل للشهر</td>
            <td className="border p-1.5 text-left tabular-nums" style={{ borderColor: LINE }}>{amount(income - outgo)}</td>
          </tr>
        </tfoot>
      </table>

      <Signatures a="المحاسب" b="المالك / الوكيل" />
    </>
  );
}

/* ========================= كشف المستأجرين الشامل ========================= */

/** بديل «سجل بيانات العمارة» في البرنامج القديم — كل المستأجرين في جدول واحد. */
export function TenantsRegisterDoc({ buildingId }: { buildingId: string }) {
  const { data } = useStore();
  const building = data.buildings.find((b) => b.id === buildingId);
  const floorById = new Map(data.floors.map((f) => [f.id, f]));
  const tenantById = new Map(data.tenants.map((t) => [t.id, t]));

  const rows = data.contracts
    .filter((c) => c.buildingId === buildingId && c.status === "active")
    .map((c) => ({ c, unit: data.units.find((u) => u.id === c.unitId), tenant: tenantById.get(c.tenantId) }))
    .sort((a, b) => (a.unit?.number ?? "").localeCompare(b.unit?.number ?? "", "ar", { numeric: true }));

  const total = rows.reduce((a, r) => a + r.c.rent, 0);

  return (
    <>
      <LetterHead
        title="سجل المستأجرين"
        en="Tenants Register"
        meta={
          <>
            <p className="mt-1 text-[13px] font-bold" style={{ color: INK }}>{building?.name}</p>
            <p className="text-[11.5px]" style={{ color: MUTED }}>{dateShort(new Date().toISOString())}</p>
          </>
        }
      />

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr style={{ background: "#edf3fb", color: NAVY }}>
            {["م", "الدور", "الشقة", "اسم المستأجر", "الرقم المدني", "الجنسية", "الهاتف", "من", "إلى"].map((h) => (
              <th key={h} className="border p-1.5 text-right" style={{ borderColor: LINE }}>{h}</th>
            ))}
            <th className="border p-1.5 text-left" style={{ borderColor: LINE }}>الإيجار (د.ك)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.c.id}>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{num(i + 1)}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{floorById.get(r.unit?.floorId ?? "")?.name ?? "—"}</td>
              <td className="border p-1.5 font-bold" style={{ borderColor: LINE }}>{r.unit?.number ?? "—"}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{r.tenant?.name ?? "—"}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{r.tenant?.civilId ?? "—"}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{r.tenant?.nationality ?? "—"}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{r.tenant?.phone ?? "—"}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{dateShort(r.c.startDate)}</td>
              <td className="border p-1.5" style={{ borderColor: LINE }}>{dateShort(r.c.endDate)}</td>
              <td className="border p-1.5 text-left font-bold tabular-nums" style={{ borderColor: LINE }}>{amount(r.c.rent)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-extrabold" style={{ background: "#f9fbfd" }}>
            <td className="border p-1.5" style={{ borderColor: LINE }} colSpan={9}>
              إجمالي الإيجار الشهري — {num(rows.length)} وحدة مؤجرة
            </td>
            <td className="border p-1.5 text-left tabular-nums" style={{ borderColor: LINE }}>{amount(total)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-6 text-center text-[10.5px]" style={{ color: "#9fb0c4" }}>
        صادر آليًا من نظام {data.settings.orgName} — {dateAr(new Date().toISOString())}
      </p>
    </>
  );
}
