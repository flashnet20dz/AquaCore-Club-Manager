/**
 * wage-receipt — «وَصْلُ اسْتِلَامِ مُسْتَحَقَّاتٍ مَالِيَّة» نافذة طباعة A4 RTL
 * ══════════════════════════════════════════════════════════════════════════════
 * مطابق للقالب الرسمي للنادي (نفس نمط طباعة العقود والإيصالات: HTML + window.open):
 *  • ترويسة رسمية: الجمهورية / الوزارة / المديرية الولائية / النادي (من قاعدة البيانات)
 *  • رقم الوصل التسلسلي + الموسم الرياضي
 *  • جدول بيانات المستفيد: الاسم واللقب، الصفة/الوظيفة، رقم بطاقة التعريف الوطنية،
 *    تاريخ ومكان الصدور (تُملأ يدوياً على الورق إن لم تكن مسجلة)
 *  • إقرار بالاستلام + المبلغ بالأرقام وبالحروف (تفقيط src/lib/amount-in-words)
 *  • موضوع الدفع (مستحقات أجر الفترة + تفاصيل الحساب) وطريقة الدفع
 *  • حُرّر بـ{المدينة} في: {التاريخ} + مساحتا التوقيع والختم
 * طباعة أرقام لاتينية (fr-DZ) من اليسار إلى اليمين — متسق مع بقية الوثائق.
 */

import { amountToDzdWords } from "@/lib/amount-in-words";

export interface WageReceiptData {
  payment: {
    id: string;
    amount: number;
    method: string; // cash | bank | cheque
    paidAt: string;
    note: string | null;
    periodLabel: string;
    hours: number | null;
    hourRate: number | null;
    grossAmount: number | null;
    prevPaid: number | null;
    financialNumber: string | null;
    receiptNo: string | null;
  };
  worker: {
    name: string;
    jobTitle: string | null;
    nationalId: string | null;
  };
  club: { name: string; city: string };
}

const DOTTED = "..................................................";

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n));
}

/** الموسم الرياضي الجزائري: من شتنبر (9) إلى غشت (8) من السنة الموالية */
function sportSeason(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
  } catch {
    return "....../......";
  }
}

const METHOD_RECEIPT_LINES: Record<string, string> = {
  cash: "نقداً من صندوق النادي",
  bank: "حوالة بنكية / بريدية",
  cheque: "صك بريدي / بنكي",
};

export function openWageReceiptPrint(data: WageReceiptData): boolean {
  const win = window.open("", "_blank", "width=900,height=980");
  if (!win) return false;

  const { payment, worker, club } = data;
  const clubName = escapeHtml(club.name || "النادي");
  const city = escapeHtml(club.city || "").trim();
  const amount = Math.round(payment.amount);
  const words = escapeHtml(amountToDzdWords(amount));
  const receiptNo = payment.receiptNo ? escapeHtml(payment.receiptNo) : DOTTED;
  const year = new Date(payment.paidAt).getFullYear();

  // طريقة الدفع — صك/حوالة مع رقم القيد المالي كمرجع
  const methodLine =
    payment.method === "cash"
      ? `${METHOD_RECEIPT_LINES.cash}${payment.financialNumber ? ` — مرجع القيد: ${escapeHtml(payment.financialNumber)}` : ""}`
      : `${METHOD_RECEIPT_LINES[payment.method] || payment.method}${payment.financialNumber ? ` رقم: ${escapeHtml(payment.financialNumber)}` : ""}`;

  // تفاصيل الحساب (ساعات/سعر/إجمالي/سابق) — تظهر فقط إن توفرت لقطة الحساب
  const calcLine =
    payment.hours !== null && payment.hourRate !== null && payment.grossAmount !== null
      ? `<div class="calc">(${fmtAmount(payment.hours)} ساعة × ${fmtAmount(payment.hourRate)} دج/سا = إجمالي ${fmtAmount(payment.grossAmount)} دج${
          payment.prevPaid ? ` — المدفوع سابقاً: ${fmtAmount(payment.prevPaid)} دج` : ""
        })</div>`
      : "";

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>وصل استلام مستحقات مالية — ${escapeHtml(worker.name)} — ${fmtDate(payment.paidAt)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo','Tajawal','Segoe UI',Tahoma,sans-serif;background:#fff;color:#111827;padding:18px}
  .sheet{max-width:820px;margin:0 auto;border:1.5px solid #1e3a5f;border-radius:10px;overflow:hidden}
  /* ═══ الترويسة الرسمية ═══ */
  .gov{text-align:center;padding:14px 18px 8px;line-height:1.9}
  .gov .l1{font-size:15px;font-weight:800;color:#1e3a5f}
  .gov .l2{font-size:13.5px;font-weight:700;color:#334155}
  .gov .l3{font-size:12.5px;font-weight:600;color:#475569}
  .gov .l4{font-size:14px;font-weight:800;color:#0f766e}
  .doc-title{text-align:center;font-size:19px;font-weight:800;color:#1e3a5f;margin:6px 0 2px;text-decoration:underline;text-underline-offset:5px}
  .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:4px 22px 10px;font-size:12.5px;font-weight:700;color:#334155}
  /* ═══ الأقسام ═══ */
  .body{padding:6px 18px 14px}
  .sec-title{background:#eef4fa;color:#1e3a5f;font-size:13px;font-weight:800;padding:6px 12px;border:1px solid #c9d8ea;border-radius:6px;margin:12px 0 8px}
  table.info{width:100%;border-collapse:collapse;font-size:12.5px}
  table.info th,table.info td{border:1px solid #c9d8ea;padding:7px 10px;vertical-align:middle}
  table.info th{background:#f4f8fc;font-weight:800;color:#1e3a5f;width:34%;text-align:right}
  table.info td{color:#0f172a;font-weight:600}
  table.info td.dots{color:#94a3b8;font-weight:400}
  .declaration{font-size:12.8px;line-height:2.1;color:#1f2937;text-align:justify;padding:2px 4px}
  .amount-lines{margin-top:8px;font-size:13px;font-weight:700;line-height:2.2;color:#0f172a}
  .amount-lines .num{color:#0f766e;font-weight:800;direction:ltr;unicode-bidi:isolate}
  .subject{font-size:13px;font-weight:700;color:#0f172a;line-height:2}
  .subject .calc{font-size:11.5px;font-weight:600;color:#64748b;margin-top:2px}
  /* ═══ التوقيعات ═══ */
  .signs{display:flex;justify-content:space-between;gap:16px;margin-top:26px;padding:0 6px}
  .sig{flex:1;text-align:center;border:1px solid #c9d8ea;border-radius:8px;padding:10px 8px 0;min-height:110px}
  .sig .lbl{font-size:11.5px;font-weight:800;color:#1e3a5f;line-height:1.7}
  .sig .line{border-top:1.5px dotted #94a3b8;margin:52px 18px 0;padding-top:5px;font-size:10px;color:#94a3b8}
  .issued{font-size:12.5px;font-weight:700;color:#334155;margin-top:14px}
  .foot{border-top:1px dashed #cbd5e1;margin-top:16px;padding:8px 20px;font-size:9.5px;color:#94a3b8;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}
  .print-btn{display:block;margin:14px auto;background:#0f766e;color:#fff;border:none;padding:11px 36px;border-radius:9px;font-weight:700;cursor:pointer;font-family:inherit;font-size:14px}
  @media print{body{padding:0}.print-btn{display:none}.sheet{border-width:1.5px;border-radius:0;max-width:none}}
  @page{size:A4 portrait;margin:12mm}
</style></head><body>
  <div class="sheet">
    <div class="gov">
      <div class="l1">الجمهورية الجزائرية الديمقراطية الشعبية</div>
      <div class="l2">وزارة الشباب والرياضة</div>
      ${city ? `<div class="l3">مديرية الشباب والرياضة لولاية ${city}</div>` : ""}
      <div class="l4">${clubName}</div>
    </div>
    <h1 class="doc-title">وَصْلُ اسْتِلَامِ مُسْتَحَقَّاتٍ مَالِيَّة</h1>
    <div class="meta">
      <span>رقم الوصل: ${receiptNo}</span>
      <span>الموسم الرياضي: ${sportSeason(payment.paidAt)}</span>
    </div>
    <div class="body">
      <div class="sec-title">1. بيانات المستفيد</div>
      <table class="info">
        <tr><th>الاسم واللقب</th><td>${escapeHtml(worker.name)}</td></tr>
        <tr><th>الصفة / الوظيفة</th><td class="${worker.jobTitle ? "" : "dots"}">${worker.jobTitle ? escapeHtml(worker.jobTitle) : DOTTED}</td></tr>
        <tr><th>رقم بطاقة التعريف الوطنية</th><td class="${worker.nationalId ? "" : "dots"}" ${worker.nationalId ? 'dir="ltr" style="unicode-bidi:isolate"' : ""}>${worker.nationalId ? escapeHtml(worker.nationalId) : DOTTED}</td></tr>
        <tr><th>تاريخ ومكان الصدور</th><td class="dots">الصادرة بتاريخ: ${DOTTED} عن دائرة / بلدية: ${DOTTED}</td></tr>
      </table>

      <div class="sec-title">2. إقرار بالاستلام والمبلغ</div>
      <p class="declaration">أنا الموقّع(ة) أسفله، أُقِرُّ بأنني استلمت من إدارة ${clubName}، المبلغ المالي المبين أدناه، وذلك بعنوان المستحقات أو التعويض المحدد في هذا الوصل.</p>
      <div class="amount-lines">
        المبلغ بالأرقام: [ <span class="num">${fmtAmount(amount)} دج</span> ]<br/>
        المبلغ بالحروف: ${words}.
      </div>

      <div class="sec-title">3. موضوع الدفع</div>
      <div class="subject">
        مستحقات / أجر: ${escapeHtml(payment.periodLabel)}${calcLine}
        ${payment.note ? `<div style="font-size:11.5px;color:#64748b">ملاحظة: ${escapeHtml(payment.note)}</div>` : ""}
      </div>

      <div class="sec-title">4. طريقة الدفع</div>
      <div class="subject">${escapeHtml(methodLine)}</div>

      <div class="issued">حُرّر ${city ? `بـ${city}` : ""} في: ${fmtDate(payment.paidAt)}</div>

      <div class="signs">
        <div class="sig">
          <div class="lbl">توقيع واستلام المعني(ة) بالأمر</div>
          <div class="line">الاسم والتوقيع</div>
        </div>
        <div class="sig">
          <div class="lbl">ختم وتوقيع إدارة النادي<br/>(أمين المال / رئيس النادي)</div>
          <div class="line">الختم والتوقيع</div>
        </div>
      </div>
    </div>
    <div class="foot">
      <span>${clubName} — AquaCore Club Manager</span>
      <span>وصل رقم ${receiptNo} — طُبع في ${fmtDate(new Date().toISOString())}</span>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">🖨️ طباعة الوصل</button>
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
