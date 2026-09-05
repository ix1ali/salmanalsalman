"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { Icon, Logo } from "./Icons";
import { KWD, dateShort, expenseLabel, methodLabel, monthAr, num, pct } from "@/lib/format";
import type { Contract, Payment } from "@/lib/types";
import { arrears, scope } from "@/lib/selectors";

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

function DocHeader({ title, subtitle, meta }: { title: string; subtitle?: string; meta?: React.ReactNode }) {
  const { data } = useStore();
  return (
    <div className="mb-6 border-b-2 border-[#123a6b] pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo size={46} />
          <div>
            <p className="text-[17px] font-extrabold text-[#0b2545]">{data.settings.orgName}</p>
            <p className="text-[12px] text-[#7089a3]">إدارة العقارات والإيجارات — دولة الكويت</p>
          </div>
        </div>
        <div className="text-left">
          <p className="text-[19px] font-extrabold text-[#123a6b]">{title}</p>
          {subtitle && <p className="text-[12px] text-[#7089a3]">{subtitle}</p>}
          {meta}
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3 border-b border-dashed border-[#e4eaf2] py-1.5 text-[13px]">
    <span className="font-semibold text-[#7089a3]">{k}</span>
    <span className="font-bold text-[#0b2545]">{v}</span>
  </div>
);

const Signatures = ({ a = "الطرف الأول (المالك / الوكيل)", b = "الطرف الثاني (المستأجر)" }) => (
  <div className="mt-10 grid grid-cols-2 gap-8 text-center text-[12.5px]">
    {[a, b].map((label) => (
      <div key={label}>
        <p className="font-bold text-[#0b2545]">{label}</p>
        <div className="mx-auto mt-10 w-4/5 border-b border-[#0b2545]" />
        <p className="mt-1 text-[11px] text-[#7089a3]">الاسم والتوقيع</p>
      </div>
    ))}
  </div>
);

/* ================================ العقد ================================= */

export function ContractDoc({ contract }: { contract: Contract }) {
  const { data } = useStore();
  const unit = data.units.find((u) => u.id === contract.unitId);
  const tenant = data.tenants.find((t) => t.id === contract.tenantId);
  const building = data.buildings.find((b) => b.id === contract.buildingId);
  const floor = data.floors.find((f) => f.id === unit?.floorId);
  const months = Math.max(
    1,
    Math.round((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (30.44 * 86400000))
  );

  return (
    <>
      <DocHeader
        title="عقد إيجار"
        subtitle={`رقم ${contract.no}`}
        meta={<p className="mt-1 text-[11.5px] text-[#7089a3]">حرر بتاريخ {dateShort(contract.createdAt)}</p>}
      />

      <p className="mb-4 text-[13px] leading-relaxed text-[#2a4361]">
        إنه في يوم {dateShort(contract.startDate)} تم الاتفاق بين كل من الطرف الأول
        <b> {building?.ownerName || data.settings.orgName} </b>
        بصفته مالك/وكيل العقار، والطرف الثاني <b>{tenant?.name}</b> بصفته المستأجر، على تأجير الوحدة الموضحة بياناتها أدناه
        وفق الشروط الآتية.
      </p>

      <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[13px] font-extrabold text-[#123a6b]">بيانات العقار</p>
          <Row k="العمارة" v={building?.name ?? "—"} />
          <Row k="المنطقة" v={`${building?.area ?? ""} ${building?.block ?? ""}`} />
          <Row k="الشارع / القسيمة" v={`${building?.street ?? ""} — ${building?.buildingNo ?? ""}`} />
          <Row k="الرقم الآلي" v={building?.paciNo ?? "—"} />
          <Row k="الدور" v={floor?.name ?? "—"} />
          <Row k="رقم الوحدة" v={unit?.number ?? "—"} />
          <Row k="المساحة" v={unit?.area ? `${unit.area} م²` : "—"} />
          <Row k="عدد الغرف" v={num(unit?.rooms ?? 0)} />
          <Row k="عداد الكهرباء" v={unit?.meterNo ?? "—"} />
        </div>
        <div>
          <p className="mb-1 text-[13px] font-extrabold text-[#123a6b]">بيانات المستأجر</p>
          <Row k="الاسم" v={tenant?.name ?? "—"} />
          <Row k="الرقم المدني" v={tenant?.civilId ?? "—"} />
          <Row k="الجنسية" v={tenant?.nationality ?? "—"} />
          <Row k="الهاتف" v={tenant?.phone ?? "—"} />
          <Row k="جهة العمل" v={tenant?.workplace ?? "—"} />

          <p className="mb-1 mt-4 text-[13px] font-extrabold text-[#123a6b]">بيانات العقد</p>
          <Row k="مدة العقد" v={`${months} شهر`} />
          <Row k="من" v={dateShort(contract.startDate)} />
          <Row k="إلى" v={dateShort(contract.endDate)} />
          <Row k="الإيجار الشهري" v={KWD(contract.rent)} />
          <Row k="التأمين" v={KWD(contract.deposit)} />
          <Row k="يوم الاستحقاق" v={`${contract.dueDay} من كل شهر`} />
          <Row k="طريقة الدفع" v={methodLabel[contract.payMethod]} />
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[13px] font-extrabold text-[#123a6b]">الشروط والأحكام</p>
        <ol className="list-inside list-decimal space-y-1.5 text-[12.5px] leading-relaxed text-[#2a4361]">
          <li>{contract.terms || "يلتزم المستأجر بسداد الإيجار في موعده المتفق عليه."}</li>
          <li>يلتزم المستأجر باستعمال العين المؤجرة للغرض المخصص لها وعدم تأجيرها من الباطن إلا بموافقة خطية من المالك.</li>
          <li>يتحمل المستأجر قيمة استهلاك الكهرباء والماء وأي رسوم خدمات تخص وحدته.</li>
          <li>يلتزم المستأجر بالمحافظة على العين المؤجرة وإصلاح أي تلف ناتج عن سوء الاستعمال.</li>
          <li>يُرد مبلغ التأمين عند إخلاء الوحدة بعد خصم ما يستحق من إيجار أو تلفيات أو فواتير.</li>
          <li>يجدد العقد تلقائيًا لمدة مماثلة ما لم يخطر أحد الطرفين الآخر برغبته في عدم التجديد قبل شهر من تاريخ الانتهاء.</li>
          <li>يخضع هذا العقد لأحكام قانون الإيجار في دولة الكويت، وتختص محاكم الكويت بنظر أي نزاع.</li>
        </ol>
      </div>

      <Signatures />
      <p className="mt-8 text-center text-[10.5px] text-[#9fb0c4]">
        هذا المستند صادر آليًا من نظام {data.settings.orgName} — {dateShort(new Date().toISOString())}
      </p>
    </>
  );
}

/* ================================ الوصل ================================= */

export function ReceiptDoc({ payment }: { payment: Payment }) {
  const { data } = useStore();
  const unit = data.units.find((u) => u.id === payment.unitId);
  const tenant = data.tenants.find((t) => t.id === payment.tenantId);
  const building = data.buildings.find((b) => b.id === payment.buildingId);
  const floor = data.floors.find((f) => f.id === unit?.floorId);

  return (
    <>
      <DocHeader
        title="وصل استلام إيجار"
        subtitle={`رقم ${payment.receiptNo}`}
        meta={<p className="mt-1 text-[11.5px] text-[#7089a3]">{dateShort(payment.paidAt)}</p>}
      />

      <div className="mb-5 rounded-2xl border-2 border-[#123a6b] bg-[#edf3fb] p-5 text-center">
        <p className="text-[12.5px] font-bold text-[#0e2f58]">المبلغ المستلم</p>
        <p className="mt-1 text-[30px] font-extrabold leading-none text-[#0b2545]">{KWD(payment.amount)}</p>
        <p className="mt-1.5 text-[12.5px] text-[#0e2f58]">عن إيجار شهر {monthAr(payment.period)}</p>
      </div>

      <div className="grid gap-x-8 sm:grid-cols-2">
        <div>
          <Row k="المستأجر" v={tenant?.name ?? "—"} />
          <Row k="الرقم المدني" v={tenant?.civilId ?? "—"} />
          <Row k="الهاتف" v={tenant?.phone ?? "—"} />
        </div>
        <div>
          <Row k="العمارة" v={building?.name ?? "—"} />
          <Row k="الدور / الوحدة" v={`${floor?.name ?? "—"} — ${unit?.number ?? "—"}`} />
          <Row k="طريقة الدفع" v={methodLabel[payment.method]} />
          {payment.reference && <Row k="المرجع" v={payment.reference} />}
        </div>
      </div>

      {payment.notes && (
        <p className="mt-4 rounded-xl bg-[#f8fafc] p-3 text-[12.5px] text-[#2a4361]">
          <b>ملاحظات: </b>{payment.notes}
        </p>
      )}

      <p className="mt-6 text-[12.5px] leading-relaxed text-[#2a4361]">
        استلمنا من السيد/ة <b>{tenant?.name}</b> مبلغًا وقدره <b>{KWD(payment.amount)}</b> وذلك عن إيجار
        الوحدة رقم <b>{unit?.number}</b> في <b>{building?.name}</b> لشهر <b>{monthAr(payment.period)}</b>،
        وهذا الوصل بمثابة إبراء عن الشهر المذكور فقط.
      </p>

      <Signatures a="المستلم (إدارة العقار)" b="المستأجر" />
      <p className="mt-8 text-center text-[10.5px] text-[#9fb0c4]">
        وصل رقم {payment.receiptNo} — صادر آليًا من نظام {data.settings.orgName}
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
  const unit = data.units.find((u) => u.id === active?.unitId);
  const building = data.buildings.find((b) => b.id === active?.buildingId);
  const due = active ? arrears(data, scope(data, active.buildingId)).find((a) => a.contract.id === active.id) : undefined;
  const total = payments.reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <DocHeader title="كشف حساب مستأجر" subtitle={tenant?.name} meta={<p className="mt-1 text-[11.5px] text-[#7089a3]">حتى {dateShort(new Date().toISOString())}</p>} />

      <div className="mb-5 grid gap-x-8 sm:grid-cols-2">
        <div>
          <Row k="المستأجر" v={tenant?.name ?? "—"} />
          <Row k="الرقم المدني" v={tenant?.civilId ?? "—"} />
          <Row k="الهاتف" v={tenant?.phone ?? "—"} />
        </div>
        <div>
          <Row k="العمارة / الوحدة" v={`${building?.name ?? "—"} — ${unit?.number ?? "—"}`} />
          <Row k="الإيجار الشهري" v={active ? KWD(active.rent) : "—"} />
          <Row k="مدة العقد" v={active ? `${dateShort(active.startDate)} — ${dateShort(active.endDate)}` : "—"} />
        </div>
      </div>

      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-[#edf3fb] text-[#0b2545]">
            <th className="border border-[#cbd7e5] p-2 text-right">م</th>
            <th className="border border-[#cbd7e5] p-2 text-right">الشهر</th>
            <th className="border border-[#cbd7e5] p-2 text-right">رقم الوصل</th>
            <th className="border border-[#cbd7e5] p-2 text-right">تاريخ الدفع</th>
            <th className="border border-[#cbd7e5] p-2 text-right">الطريقة</th>
            <th className="border border-[#cbd7e5] p-2 text-left">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={p.id}>
              <td className="border border-[#cbd7e5] p-2">{i + 1}</td>
              <td className="border border-[#cbd7e5] p-2">{monthAr(p.period)}</td>
              <td className="border border-[#cbd7e5] p-2">{p.receiptNo}</td>
              <td className="border border-[#cbd7e5] p-2">{dateShort(p.paidAt)}</td>
              <td className="border border-[#cbd7e5] p-2">{methodLabel[p.method]}</td>
              <td className="border border-[#cbd7e5] p-2 text-left font-bold tabular-nums">{KWD(p.amount, false)}</td>
            </tr>
          ))}
          {!payments.length && (
            <tr><td colSpan={6} className="border border-[#cbd7e5] p-4 text-center text-[#7089a3]">لا توجد دفعات مسجلة</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-[#f8fafc] font-extrabold">
            <td className="border border-[#cbd7e5] p-2" colSpan={5}>إجمالي المدفوع</td>
            <td className="border border-[#cbd7e5] p-2 text-left tabular-nums">{KWD(total, false)}</td>
          </tr>
          {due && due.amount > 0 && (
            <tr className="bg-[#fbeaec] font-extrabold text-[#b3303b]">
              <td className="border border-[#cbd7e5] p-2" colSpan={5}>
                المتأخر ({due.missing.map(monthAr).join("، ")})
              </td>
              <td className="border border-[#cbd7e5] p-2 text-left tabular-nums">{KWD(due.amount, false)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      <Signatures a="إدارة العقار" b="المستأجر" />
    </>
  );
}

/* =========================== كشف مالي للعمارة =========================== */

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
      <DocHeader title="كشف مالي شهري" subtitle={building?.name} meta={<p className="mt-1 text-[11.5px] text-[#7089a3]">{monthAr(period)}</p>} />

      <div className="mb-5 grid grid-cols-4 gap-2 text-center">
        {[
          ["الإيجار المستحق", KWD(expected, false), "#0b2545", "#f8fafc"],
          ["المحصّل", KWD(income, false), "#1e8a5f", "#e7f4ee"],
          ["المصاريف", KWD(outgo, false), "#a87c1e", "#fbf3e1"],
          ["الصافي", KWD(income - outgo, false), income - outgo >= 0 ? "#0b2545" : "#b3303b", income - outgo >= 0 ? "#edf3fb" : "#fbeaec"],
        ].map(([l, v, c, bg]) => (
          <div key={l} className="rounded-xl p-3" style={{ background: bg }}>
            <p className="text-[11px] font-bold" style={{ color: c }}>{l}</p>
            <p className="text-[15px] font-extrabold tabular-nums" style={{ color: c }}>{v}</p>
          </div>
        ))}
      </div>
      <p className="mb-5 text-[12px] text-[#7089a3]">
        نسبة التحصيل: <b className="text-[#0b2545]">{pct(expected ? (income / expected) * 100 : 0)}</b> ·
        عدد الوحدات: <b className="text-[#0b2545]">{num(s.units.length)}</b> ·
        المؤجرة: <b className="text-[#0b2545]">{num(s.units.filter((u) => u.status === "occupied").length)}</b>
      </p>

      <p className="mb-1.5 text-[13px] font-extrabold text-[#123a6b]">أولًا: المقبوضات</p>
      <table className="mb-6 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#e7f4ee] text-[#1e8a5f]">
            <th className="border border-[#cbd7e5] p-1.5 text-right">م</th>
            <th className="border border-[#cbd7e5] p-1.5 text-right">الوحدة</th>
            <th className="border border-[#cbd7e5] p-1.5 text-right">المستأجر</th>
            <th className="border border-[#cbd7e5] p-1.5 text-right">الوصل</th>
            <th className="border border-[#cbd7e5] p-1.5 text-right">التاريخ</th>
            <th className="border border-[#cbd7e5] p-1.5 text-left">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={p.id}>
              <td className="border border-[#cbd7e5] p-1.5">{i + 1}</td>
              <td className="border border-[#cbd7e5] p-1.5">{unitById.get(p.unitId)?.number ?? "—"}</td>
              <td className="border border-[#cbd7e5] p-1.5">{tenantById.get(p.tenantId)?.name ?? "—"}</td>
              <td className="border border-[#cbd7e5] p-1.5">{p.receiptNo}</td>
              <td className="border border-[#cbd7e5] p-1.5">{dateShort(p.paidAt)}</td>
              <td className="border border-[#cbd7e5] p-1.5 text-left font-bold tabular-nums">{KWD(p.amount, false)}</td>
            </tr>
          ))}
          {!payments.length && <tr><td colSpan={6} className="border border-[#cbd7e5] p-3 text-center text-[#7089a3]">لا يوجد</td></tr>}
        </tbody>
        <tfoot>
          <tr className="bg-[#f8fafc] font-extrabold">
            <td className="border border-[#cbd7e5] p-1.5" colSpan={5}>الإجمالي</td>
            <td className="border border-[#cbd7e5] p-1.5 text-left tabular-nums">{KWD(income, false)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mb-1.5 text-[13px] font-extrabold text-[#123a6b]">ثانيًا: المصروفات</p>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#fbf3e1] text-[#a87c1e]">
            <th className="border border-[#cbd7e5] p-1.5 text-right">م</th>
            <th className="border border-[#cbd7e5] p-1.5 text-right">البند</th>
            <th className="border border-[#cbd7e5] p-1.5 text-right">البيان</th>
            <th className="border border-[#cbd7e5] p-1.5 text-right">الجهة</th>
            <th className="border border-[#cbd7e5] p-1.5 text-right">التاريخ</th>
            <th className="border border-[#cbd7e5] p-1.5 text-left">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e, i) => (
            <tr key={e.id}>
              <td className="border border-[#cbd7e5] p-1.5">{i + 1}</td>
              <td className="border border-[#cbd7e5] p-1.5">{expenseLabel[e.category]}</td>
              <td className="border border-[#cbd7e5] p-1.5">{e.title}</td>
              <td className="border border-[#cbd7e5] p-1.5">{e.vendor ?? "—"}</td>
              <td className="border border-[#cbd7e5] p-1.5">{dateShort(e.date)}</td>
              <td className="border border-[#cbd7e5] p-1.5 text-left font-bold tabular-nums">{KWD(e.amount, false)}</td>
            </tr>
          ))}
          {!expenses.length && <tr><td colSpan={6} className="border border-[#cbd7e5] p-3 text-center text-[#7089a3]">لا يوجد</td></tr>}
        </tbody>
        <tfoot>
          <tr className="bg-[#f8fafc] font-extrabold">
            <td className="border border-[#cbd7e5] p-1.5" colSpan={5}>الإجمالي</td>
            <td className="border border-[#cbd7e5] p-1.5 text-left tabular-nums">{KWD(outgo, false)}</td>
          </tr>
          <tr className="bg-[#edf3fb] font-extrabold text-[#0b2545]">
            <td className="border border-[#cbd7e5] p-1.5" colSpan={5}>صافي الدخل للشهر</td>
            <td className="border border-[#cbd7e5] p-1.5 text-left tabular-nums">{KWD(income - outgo, false)}</td>
          </tr>
        </tfoot>
      </table>

      <Signatures a="المحاسب" b="المالك / الوكيل" />
    </>
  );
}
