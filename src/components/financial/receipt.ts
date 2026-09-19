/**
 * receipt — نافذة طباعة إيصال رسمي A4 RTL (نفس نمط طباعة العقود: HTML + window.open)
 * ══════════════════════════════════════════════════════════════════════════════
 *  • اسم النادي (من /api/settings — fallback «AquaCore»)
 *  • رقم العملية FIN + رقم الإيصال (reference) + التاريخ والوقت
 *  • المبلغ بالحروف العربية (src/lib/amount-in-words)
 *  • طريقة الدفع + السبب/الملاحظة + مساحتا توقيع وختم
 *  • طباعة حرارية friendly: عرض مرن بلا كسر عند الضيق (flex-wrap + max-width:100%)
 */

import { amountToDzdWords } from "@/lib/amount-in-words";
import { categoryLabel, paymentMethodLabel, typeLabel } from "./labels";

export interface ReceiptTxData {
  number?: string | null;
  reference?: string | null;
  type: string; // income | expense
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  payeeName?: string | null;
  note?: string | null;
}

export const FALLBACK_CLUB_NAME = "AquaCore";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDateTime(s: string): string {
  try {
    return new Date(s).toLocaleString("ar-DZ", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return s;
  }
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n));
}

export function openReceiptPrint(tx: ReceiptTxData, clubName?: string): boolean {
  const win = window.open("", "_blank", "width=860,height=760");
  if (!win) return false;

  const isIncome = tx.type === "income";
  const accent = isIncome ? "#0d9488" : "#e11d48"; // teal / rose — لا أزرق
  const docTitle = isIncome ? "إيصال استلام" : "إيصال صرف";
  const club = escapeHtml((clubName && clubName.trim()) || FALLBACK_CLUB_NAME);
  const fin = tx.number ? escapeHtml(tx.number) : "—";
  const amountStr = `${isIncome ? "+" : "−"}${fmtAmount(tx.amount)} دج`;
  const words = escapeHtml(amountToDzdWords(tx.amount));

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(docTitle)} ${fin}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo','Tajawal','Segoe UI',Tahoma,sans-serif;padding:24px;color:#111827;background:#fff}
  .sheet{max-width:760px;width:100%;margin:0 auto;border:2px solid ${accent};border-radius:14px;overflow:hidden}
  .head{background:${accent}0d;border-bottom:2px solid ${accent};padding:18px 22px;text-align:center}
  .club{font-size:20px;font-weight:800;color:#0f172a}
  .club-sub{font-size:11px;color:#64748b;margin-top:2px}
  .doc-title{display:inline-block;margin-top:10px;background:${accent};color:#fff;font-size:14px;font-weight:700;padding:5px 26px;border-radius:999px}
  .fin-line{margin-top:10px;font-size:15px;font-weight:800;letter-spacing:.5px;color:${accent};font-family:'Courier New',monospace;direction:ltr}
  .body{padding:18px 22px}
  .row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;padding:8px 0;border-bottom:1px dashed #e2e8f0;font-size:13px}
  .row:last-child{border-bottom:none}
  .row .label{color:#64748b;font-weight:500;white-space:nowrap}
  .row .value{font-weight:700;color:#0f172a;text-align:left;word-break:break-word;max-width:60%}
  .amount-box{background:${accent}10;border:1.5px solid ${accent}55;border-radius:10px;padding:14px;margin:14px 0;text-align:center}
  .amount-box .lbl{font-size:11px;color:#64748b;margin-bottom:4px}
  .amount-box .num{font-size:26px;font-weight:800;color:${accent};direction:ltr}
  .amount-box .words{margin-top:6px;font-size:12.5px;font-weight:600;color:#334155;line-height:1.7}
  .note-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:12px;color:#334155;margin-top:10px;line-height:1.7}
  .signs{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-top:26px;padding:0 8px}
  .sig{text-align:center;font-size:11px;color:#64748b;flex:1;min-width:130px}
  .sig .line{border-top:1.5px solid #94a3b8;margin-top:38px;padding-top:5px;font-weight:600;color:#334155}
  .stamp{width:96px;height:96px;border:2px dashed #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10.5px;color:#94a3b8;margin:0 auto}
  .foot{border-top:1px dashed #e2e8f0;margin-top:18px;padding:10px 22px;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}
  .print-btn{display:block;margin:16px auto;background:${accent};color:#fff;border:none;padding:11px 34px;border-radius:9px;font-weight:700;cursor:pointer;font-family:inherit;font-size:14px}
  @media print{body{padding:0}.print-btn{display:none}.sheet{border-width:1.5px}}
  /* طباعة حرارية friendly — عرض ضيق لا يكسر التنسيق */
  @media (max-width:480px){body{padding:6px}.head{padding:12px}.body{padding:10px 12px}.club{font-size:16px}.amount-box .num{font-size:20px}.row .value{max-width:100%}}
</style></head><body>
  <div class="sheet">
    <div class="head">
      <div class="club">🏊 ${club}</div>
      <div class="club-sub">وثيقة مالية رسمية</div>
      <div class="doc-title">${docTitle}</div>
      <div class="fin-line">${fin}</div>
    </div>
    <div class="body">
      <div class="row"><span class="label">رقم الإيصال / المرجع</span><span class="value">${tx.reference ? escapeHtml(tx.reference) : "—"}</span></div>
      <div class="row"><span class="label">التاريخ والوقت</span><span class="value">${fmtDateTime(tx.date)}</span></div>
      <div class="row"><span class="label">النوع</span><span class="value">${typeLabel(tx.type)}</span></div>
      <div class="row"><span class="label">الفئة</span><span class="value">${escapeHtml(categoryLabel(tx.category))}</span></div>
      <div class="row"><span class="label">${isIncome ? "الدافع" : "المستفيد"}</span><span class="value">${tx.payeeName ? escapeHtml(tx.payeeName) : "—"}</span></div>
      <div class="row"><span class="label">طريقة الدفع</span><span class="value">${escapeHtml(paymentMethodLabel(tx.paymentMethod))}</span></div>
      <div class="amount-box">
        <div class="lbl">المبلغ</div>
        <div class="num">${amountStr}</div>
        <div class="words">${words}</div>
      </div>
      ${tx.note ? `<div class="note-box"><b>السبب / ملاحظة:</b> ${escapeHtml(tx.note)}</div>` : ""}
      <div class="signs">
        <div class="sig"><div class="line">توقيع المحاسب</div></div>
        <div class="stamp">ختم النادي</div>
        <div class="sig"><div class="line">توقيع ${isIncome ? "الدافع" : "المستلم"}</div></div>
      </div>
    </div>
    <div class="foot">
      <span>${club} — AquaCore Club Manager</span>
      <span>طُبع في: ${fmtDateTime(new Date().toISOString())}</span>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">طباعة الإيصال</button>
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
