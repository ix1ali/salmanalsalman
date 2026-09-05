/**
 * سجل مستأجري عمارة تراب — مستورد من قاعدة بيانات المكتب (Microsoft Access)
 * «برنامج ادارة عقار تراب.accdb»، تاريخ الاستيراد 2026-09-06.
 *
 * لم تُغيّر أي قيمة جوهرية. التنظيف اقتصر على:
 *  - توحيد أسماء الأدوار (الارضى/الأرضي، الربع/الرابع، «3»/الثالث…).
 *  - نسبة الوحدة إلى دورها من أول رقمها، فصحّح ذلك الشقة 710 التي كانت مسجّلة في السادس.
 *  - توحيد كتابة الجنسيات (سورى ← سوري، اردنى ← أردني…).
 *  - أرقام قديمة بلا بادئة دور (3، 4، 9، 10) أُعطيت ترقيم دورها (203، 204، 509، 510).
 */

export interface TurabRecord {
  seq: number;          // التسلسل في سجل المكتب
  floor: string;        // اسم الدور
  unit: string;         // رقم الشقة
  kind: "apartment" | "shop" | "storage";
  name: string;         // اسم المستأجر
  civilId: string;      // الرقم المدني أو رقم الجواز
  nationality: string;
  job: string;          // المهنة / جهة العمل
  phone: string;
  rent: number;         // الإيجار الشهري بالدينار الكويتي
  start: string;        // تاريخ بداية أول عقد (YYYY-MM-DD)
  end: string;          // تاريخ الانتهاء المسجّل
  signed: string;       // تاريخ تحرير العقد
}

/** بيانات العقار كما وردت في نموذج العقد وطلب الإخلاء. */
export const TURAB_BUILDING = {
  name: "عمارة تراب",
  code: "TRB",
  area: "حولي الجنوبي",
  block: "قطعة 10",
  street: "شارع موسى بن نصير",
  parcel: "قسيمة 21/79",
  buildingNo: "عمارة رقم 37",
  ownerName: "سلمان محمد أحمد السلمان",
} as const;

/** الأدوار: الأرضي 8 شقق، الأول–السادس 12 لكل دور، السابع 10 = 90 شقة. */
export const TURAB_FLOORS: { level: number; name: string; apartments: number; prefix: string }[] = [
  { level: -1, name: "السرداب", apartments: 0, prefix: "" },
  { level: 0, name: "الأرضي", apartments: 8, prefix: "0" },
  { level: 1, name: "الأول", apartments: 12, prefix: "1" },
  { level: 2, name: "الثاني", apartments: 12, prefix: "2" },
  { level: 3, name: "الثالث", apartments: 12, prefix: "3" },
  { level: 4, name: "الرابع", apartments: 12, prefix: "4" },
  { level: 5, name: "الخامس", apartments: 12, prefix: "5" },
  { level: 6, name: "السادس", apartments: 12, prefix: "6" },
  { level: 7, name: "السابع", apartments: 10, prefix: "7" },
];

export const TURAB_RECORDS: TurabRecord[] = [
  { seq: 74, floor: "الأرضي", unit: "002", kind: "apartment", name: "رفيده علي مصطفى احمد", civilId: "p/07832004", nationality: "سوداني", job: "ممرض/شركة بدر السماء للخدمات الطبية", phone: "51042608", rent: 180, start: "2024-07-01", end: "2025-06-30", signed: "2024-06-14" },
  { seq: 131, floor: "الأرضي", unit: "003", kind: "apartment", name: "مصطفى محمود بدر الاشوح", civilId: "293052404586", nationality: "مصري", job: "شركة المروه للسياحة والسفر", phone: "99981871", rent: 200, start: "2026-07-01", end: "2027-06-30", signed: "2024-12-06" },
  { seq: 290, floor: "الأرضي", unit: "004", kind: "apartment", name: "مباركه بنت الهادى عامرى حرم همادى", civilId: "277022607489", nationality: "تونسي", job: "رئيس طباخين", phone: "97431464", rent: 160, start: "2026-01-01", end: "2026-12-31", signed: "2025-12-24" },
  { seq: 319, floor: "الأرضي", unit: "005", kind: "apartment", name: "ابوبكر احمدابكر موسى", civilId: "295032804207", nationality: "سوداني", job: "مساعد بناء/طابوق", phone: "65773587", rent: 190, start: "2026-09-01", end: "2027-08-31", signed: "2026-08-17" },
  { seq: 51, floor: "الأرضي", unit: "006", kind: "apartment", name: "احمد يحيى المفعلاني", civilId: "279110201701", nationality: "سوري", job: "مراقب خرسانة/شركة المعلم المتحدة للتجارة العامة", phone: "97774374", rent: 150, start: "2024-05-01", end: "2025-04-30", signed: "2024-04-18" },
  { seq: 314, floor: "الأرضي", unit: "007", kind: "apartment", name: "احمد محمد عوض سليمان", civilId: "287051703786", nationality: "مصري", job: "محاسب رواتب واجور", phone: "96953231", rent: 140, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-15" },
  { seq: 242, floor: "الأرضي", unit: "008", kind: "apartment", name: "حمزه خليل زعل", civilId: "297062604504", nationality: "سوري", job: "بائع عطور", phone: "99858140", rent: 140, start: "2025-08-01", end: "2025-07-31", signed: "2025-07-23" },
  { seq: 14, floor: "الأرضي", unit: "المحل", kind: "shop", name: "علي إبراهيم سالم الفيلكاوي", civilId: "", nationality: "", job: "", phone: "", rent: 1000, start: "", end: "", signed: "2024-01-22" },
  { seq: 285, floor: "الأول", unit: "107", kind: "apartment", name: "يسرى بنت مصطفى رياحى", civilId: "299062703253", nationality: "تونسي", job: "فنى وسائط متعددة", phone: "55415735", rent: 160, start: "2025-05-01", end: "2026-04-30", signed: "2025-04-25" },
  { seq: 317, floor: "الأول", unit: "108", kind: "apartment", name: "ياسر رشوان احمدرشوان", civilId: "290102301654", nationality: "مصري", job: "سايق سياره خصوصى", phone: "66204465", rent: 160, start: "2026-09-01", end: "2027-08-31", signed: "2026-08-17" },
  { seq: 308, floor: "الأول", unit: "109", kind: "apartment", name: "محمد جمال البب", civilId: "301100102046", nationality: "لبناني", job: "سايق سيارة خصوصى", phone: "94945016", rent: 200, start: "2026-07-01", end: "2027-06-30", signed: "2026-06-23" },
  { seq: 256, floor: "الأول", unit: "110", kind: "apartment", name: "على مامون عبدالله احمد", civilId: "290010902831", nationality: "يمني", job: "بائع عطور", phone: "55176866", rent: 175, start: "2025-09-01", end: "2026-08-31", signed: "2025-08-28" },
  { seq: 268, floor: "الأول", unit: "111", kind: "apartment", name: "ليو دينا لا جان مويسو", civilId: "292032102762", nationality: "فلبيني", job: "عامل مخازن", phone: "60063033", rent: 140, start: "2025-10-01", end: "2026-09-30", signed: "2025-09-17" },
  { seq: 298, floor: "الأول", unit: "112", kind: "apartment", name: "محمود الجندى حسن الجندى حسيين", civilId: "292121304796", nationality: "مصري", job: "مدرس لغه عربيه", phone: "97020572", rent: 140, start: "2026-06-01", end: "2027-05-31", signed: "2026-05-20" },
  { seq: 219, floor: "الثالث", unit: "301", kind: "apartment", name: "نورة بنت الهادى عياد", civilId: "271122105403", nationality: "تونسي", job: "حلاقه/مصفف شعرنسانى", phone: "65943004", rent: 140, start: "2025-01-04", end: "2026-03-31", signed: "2025-03-20" },
  { seq: 310, floor: "الثالث", unit: "302", kind: "apartment", name: "اسلام محمد توفيق عبدالظاهر", civilId: "290060111333", nationality: "مصري", job: "كاتب ادخال بيانات", phone: "98060864", rent: 140, start: "2026-07-01", end: "2027-06-30", signed: "2026-06-28" },
  { seq: 160, floor: "الثالث", unit: "303", kind: "apartment", name: "احمد مصطفى عبدالعزيز محمد", civilId: "290100108674", nationality: "مصري", job: "باحث قانونى", phone: "", rent: 160, start: "2025-01-01", end: "2025-12-31", signed: "2024-12-31" },
  { seq: 307, floor: "الثالث", unit: "304", kind: "apartment", name: "احمد محمد احمد الطاهر", civilId: "298040503168", nationality: "سوداني", job: "مطورنظم المعلومات", phone: "96047712", rent: 200, start: "2026-07-01", end: "2027-06-30", signed: "2026-06-22" },
  { seq: 171, floor: "الثالث", unit: "305", kind: "apartment", name: "محمد صالح عبد الرحيم ضميره", civilId: "296100802938", nationality: "أردني", job: "مطور نظم المعلومات", phone: "55325833", rent: 160, start: "2025-01-01", end: "2025-12-31", signed: "2025-01-04" },
  { seq: 246, floor: "الثالث", unit: "306", kind: "apartment", name: "ايمن سعيد إسماعيل حماده", civilId: "285110804108", nationality: "مصري", job: "مدير علاقات عامه", phone: "60089864", rent: 160, start: "2025-09-01", end: "2026-08-31", signed: "2025-08-18" },
  { seq: 320, floor: "الثالث", unit: "307", kind: "apartment", name: "وسام مصطفى عبدالرحمن الشرقاوى", civilId: "278080704062", nationality: "مصري", job: "مدرس", phone: "55033899", rent: 160, start: "2026-09-01", end: "2027-08-31", signed: "2026-08-19" },
  { seq: 108, floor: "الثالث", unit: "308", kind: "apartment", name: "هيام احمد علي", civilId: "276062203775", nationality: "سوري", job: "سكرتيرة", phone: "50192060", rent: 160, start: "2024-11-01", end: "2025-10-31", signed: "2024-11-03" },
  { seq: 321, floor: "الثالث", unit: "309", kind: "apartment", name: "عبد السلام محمد عبدالسلام محمد بندق", civilId: "265011702394", nationality: "مصري", job: "مخلص معاملات", phone: "90922631", rent: 200, start: "2026-09-01", end: "2027-08-31", signed: "2026-08-23" },
  { seq: 295, floor: "الثالث", unit: "310", kind: "apartment", name: "بركات حمزه ابوالعلا فراج", civilId: "270010403188", nationality: "مصري", job: "كاتب", phone: "97973616", rent: 160, start: "2026-05-01", end: "2027-04-30", signed: "2026-04-25" },
  { seq: 284, floor: "الثالث", unit: "311", kind: "apartment", name: "محمد عدنان جاد عدنان", civilId: "287032606112", nationality: "مصري", job: "معد وجبات سريعه", phone: "98773676", rent: 140, start: "2025-12-01", end: "2026-11-30", signed: "2025-11-27" },
  { seq: 269, floor: "الثالث", unit: "312", kind: "apartment", name: "سهيل ديليب شودانكار ديليب", civilId: "297070702665", nationality: "هندي", job: "محلل نظم", phone: "55041372", rent: 140, start: "2025-10-01", end: "2026-09-30", signed: "2025-09-20" },
  { seq: 3, floor: "الثاني", unit: "203", kind: "apartment", name: "عماد احمد هلال", civilId: "269041201468", nationality: "سوري", job: "", phone: "", rent: 450, start: "2023-08-01", end: "2024-08-01", signed: "2024-08-01" },
  { seq: 4, floor: "الثاني", unit: "204", kind: "apartment", name: "رلى على ابوسويد", civilId: "", nationality: "", job: "", phone: "", rent: 450, start: "", end: "", signed: "2024-01-22" },
  { seq: 10, floor: "الخامس", unit: "509", kind: "apartment", name: "يعقوب احمد حسن عباس", civilId: "", nationality: "", job: "", phone: "", rent: 450, start: "", end: "", signed: "2024-01-22" },
  { seq: 9, floor: "الخامس", unit: "510", kind: "apartment", name: "عبدالوهاب محمد أبو الحسن", civilId: "", nationality: "", job: "", phone: "", rent: 400, start: "", end: "", signed: "2024-01-22" },
  { seq: 299, floor: "الرابع", unit: "401", kind: "apartment", name: "فارس بن صابر بوعوينة", civilId: "n527729", nationality: "تونسي", job: "مصور فوتوغرافى/إعلانات", phone: "51669759", rent: 140, start: "2026-06-01", end: "2027-05-31", signed: "2026-05-21" },
  { seq: 312, floor: "الرابع", unit: "402", kind: "apartment", name: "ساجده جواد شاخى", civilId: "286112402297", nationality: "إيراني", job: "سكرتير", phone: "50327779", rent: 140, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-10" },
  { seq: 146, floor: "الرابع", unit: "403", kind: "apartment", name: "محمود نبيل التلا", civilId: "291071801123", nationality: "سوري", job: "مندوب مشتريات شركه ابيات ميغا ستور", phone: "", rent: 160, start: "2025-01-01", end: "2025-12-31", signed: "2024-12-22" },
  { seq: 196, floor: "الرابع", unit: "404", kind: "apartment", name: "اسامه محمد حسنى النتشه", civilId: "268090700664", nationality: "أردني", job: "مراقب قوالب خرسانه", phone: "66820101", rent: 200, start: "2025-01-07", end: "2026-06-30", signed: "2025-02-02" },
  { seq: 155, floor: "الرابع", unit: "405", kind: "apartment", name: "حاتم بن الشاذلي سويسي", civilId: "296020204022", nationality: "تونسي", job: "بائع مواد انشاينه", phone: "97520863", rent: 160, start: "2025-01-01", end: "2025-01-01", signed: "2024-12-24" },
  { seq: 150, floor: "الرابع", unit: "406", kind: "apartment", name: "احمد كمال توفيق نمر", civilId: "288123000487", nationality: "أردني", job: "مخلص معاملات", phone: "", rent: 160, start: "2025-01-01", end: "2025-12-31", signed: "2024-12-23" },
  { seq: 99, floor: "الرابع", unit: "407", kind: "apartment", name: "يوسف محمد محمود كليب", civilId: "270120600086", nationality: "أردني", job: "كراج الحديث الأول لتصليح السيارات", phone: "65723747", rent: 160, start: "2024-10-01", end: "2025-09-30", signed: "2024-10-05" },
  { seq: 296, floor: "الرابع", unit: "408", kind: "apartment", name: "فريد يوسف سميد", civilId: "276060516233", nationality: "سوري", job: "مراسل", phone: "61001335", rent: 160, start: "2026-06-01", end: "2026-05-30", signed: "2026-05-14" },
  { seq: 309, floor: "الرابع", unit: "409", kind: "apartment", name: "محمد احمد إبراهيم عبد المنعم", civilId: "288101510734", nationality: "مصري", job: "سايق سيارة خصوصى", phone: "94403068", rent: 200, start: "2026-07-01", end: "2027-06-30", signed: "2026-06-24" },
  { seq: 164, floor: "الرابع", unit: "410", kind: "apartment", name: "شادى محمود احمد محمد", civilId: "283112203753", nationality: "مصري", job: "مخلص معاملات", phone: "55283220", rent: 160, start: "2025-01-01", end: "2025-12-31", signed: "2024-12-20" },
  { seq: 313, floor: "الرابع", unit: "411", kind: "apartment", name: "محمود محمداحمد محمود", civilId: "280011516319", nationality: "مصري", job: "باحث قانونى", phone: "97344325", rent: 140, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-14" },
  { seq: 315, floor: "الرابع", unit: "412", kind: "apartment", name: "محمود عبدالهادى محمدحفنى", civilId: "283040403018", nationality: "مصري", job: "بائع أدوات منزليه", phone: "97904518", rent: 140, start: "2026-08-01", end: "2027-07-30", signed: "2026-07-16" },
  { seq: 72, floor: "السابع", unit: "701", kind: "apartment", name: "عبدالقادر محمد موسى", civilId: "291011301696", nationality: "سوري", job: "مطعم كاس الخليج", phone: "94997617", rent: 200, start: "2024-09-01", end: "2025-06-30", signed: "2024-07-01" },
  { seq: 103, floor: "السابع", unit: "702", kind: "apartment", name: "علاء محمد حسين ابريق", civilId: "281042600948", nationality: "أردني", job: "شركة سوق طيور الجنه المركزي", phone: "66108234", rent: 200, start: "2024-11-01", end: "2025-10-31", signed: "2024-10-10" },
  { seq: 302, floor: "السابع", unit: "703", kind: "apartment", name: "محمود احمد امين خلف", civilId: "290062505256", nationality: "مصري", job: "سايق شاحنه", phone: "92299398", rent: 160, start: "2025-07-01", end: "2027-06-30", signed: "2026-06-16" },
  { seq: 303, floor: "السابع", unit: "704", kind: "apartment", name: "محمد وليد حسيب الحاج خليل", civilId: "279121803548", nationality: "أردني", job: "باع تجهيزات صناعيه/عام", phone: "66712700", rent: 160, start: "2026-07-01", end: "2027-06-30", signed: "2026-06-17" },
  { seq: 300, floor: "السابع", unit: "705", kind: "apartment", name: "على صلاح الدين سامى ضيف الله", civilId: "298041005216", nationality: "أردني", job: "مصمم ديكور داخلى", phone: "51219981", rent: 200, start: "2026-06-01", end: "2027-05-31", signed: "2026-05-17" },
  { seq: 244, floor: "السابع", unit: "706", kind: "apartment", name: "روسيلى فيليسيتاس سابلا", civilId: "261061503467", nationality: "فلبيني", job: "سلامه محمد على احمد النجار", phone: "66647214", rent: 200, start: "2025-09-01", end: "2026-08-31", signed: "2025-08-16" },
  { seq: 251, floor: "السابع", unit: "707", kind: "apartment", name: "ادهم وجيه نون", civilId: "291082406874", nationality: "لبناني", job: "مخلص معاملات", phone: "96967992", rent: 145, start: "2025-09-01", end: "2026-08-31", signed: "2025-08-25" },
  { seq: 97, floor: "السابع", unit: "708", kind: "apartment", name: "محمد امين التستوري", civilId: "جواز سفر / H915311", nationality: "تونسي", job: "بائع هدايا", phone: "60419436", rent: 140, start: "2024-10-01", end: "2025-09-30", signed: "2024-10-05" },
  { seq: 248, floor: "السابع", unit: "709", kind: "apartment", name: "امير رافت صبحى فهيم", civilId: "287031002499", nationality: "مصري", job: "سايق سياره خصوصى", phone: "51242772", rent: 130, start: "2025-09-01", end: "2026-08-31", signed: "2025-08-23" },
  { seq: 221, floor: "السابع", unit: "710", kind: "apartment", name: "احمد الرفاعى مصطفى عقده", civilId: "295010199317", nationality: "مصري", job: "صيدلى /عام", phone: "94745934", rent: 130, start: "2024-05-10", end: "2025-09-30", signed: "2024-10-05" },
  { seq: 288, floor: "السادس", unit: "601", kind: "apartment", name: "محمد احمد البدوى كامل منيسى", civilId: "292050903926", nationality: "مصري", job: "مهندس", phone: "94779524", rent: 140, start: "2026-01-01", end: "2026-12-31", signed: "2025-12-15" },
  { seq: 235, floor: "السادس", unit: "602", kind: "apartment", name: "محمد جمال حفظى طبعونى", civilId: "292032107467", nationality: "أردني", job: "مندوب تجارى", phone: "66714600", rent: 140, start: "2025-01-06", end: "2026-05-31", signed: "2025-05-20" },
  { seq: 311, floor: "السادس", unit: "603", kind: "apartment", name: "منصوراحمد راغب شعبان جوده", civilId: "290092906747", nationality: "مصري", job: "سكرتير", phone: "65670637", rent: 160, start: "2026-07-01", end: "2027-06-30", signed: "2026-06-28" },
  { seq: 140, floor: "السادس", unit: "604", kind: "apartment", name: "معتصم مسعود محمد مسعود", civilId: "264111800229", nationality: "أردني", job: "", phone: "94452045", rent: 200, start: "2025-01-01", end: "2025-12-31", signed: "2024-12-19" },
  { seq: 289, floor: "السادس", unit: "605", kind: "apartment", name: "حمادة عبدالمنعم محمد منصور الرفاعى", civilId: "292010603857", nationality: "مصري", job: "سائق", phone: "94132567", rent: 160, start: "2026-01-01", end: "2026-12-31", signed: "2025-12-23" },
  { seq: 127, floor: "السادس", unit: "606", kind: "apartment", name: "أنور باشا إبراهيم باشا", civilId: "297090301949", nationality: "هندي", job: "شركة لتس اند مور للحلويات والمعجنات", phone: "60686483", rent: 160, start: "2024-12-15", end: "2025-12-14", signed: "2024-12-06" },
  { seq: 12, floor: "السرداب", unit: "السرداب", kind: "storage", name: "محمود احمد محمد الدراوشة", civilId: "", nationality: "", job: "", phone: "", rent: 700, start: "", end: "", signed: "2024-01-22" },
];
