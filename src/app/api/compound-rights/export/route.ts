import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/session";
import {
  fetchCompoundList,
  loadClubLogos,
  OFFICIAL_HEADER_LINES,
  OFFICIAL_SIGNATURES,
  formatDateDMY,
  formatAmountDZD,
  numberToArabicWords,
  COMPOUND_FEE,
  type CompoundEntry,
  type EnteteLogo,
} from "@/lib/compound-list";

/**
 * GET /api/compound-rights/export?year=2026&month=8&format=word|excel
 *                          &ids=id1,id2 (اختياري — تصدير محددين)
 *                          &sigs=president,compound,unit (اختياري)
 *
 * ★ تصدير "القائمة الاسمية للمنخرطين في النادي فرع السباحة"
 *   بنفس المنطق المستعمل في الشاشة (fetchCompoundList) وبنفس الفترة الرسمية (29 → 28)
 *   وبشكل مطابق للوثيقة الرسمية للنادي:
 *   ترويسة رسمية + الرقم/سعيدة في + العنوان + الفترة + جدول (الرقم/اللقب/الاسم/المبلغ)
 *   + المجموع + التفقيط + الإمضاءات
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "word";
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));
    const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));
    const ids = url.searchParams.get("ids")?.split(",").filter(Boolean) || [];
    const sigs = url.searchParams.get("sigs")?.split(",").filter(Boolean) || ["president", "compound", "unit"];

    const clubId = currentUser.role === "superadmin"
      ? (url.searchParams.get("clubId") || undefined)
      : currentUser.clubId;

    // ★ نفس منطق الشاشة تماماً — القائمة المحمّلة = القائمة المعروضة
    const result = await fetchCompoundList(clubId, year, month, ids.length > 0 ? ids : undefined);
    const logos = await loadClubLogos(currentUser.clubId);

    const periodFrom = formatDateDMY(new Date(result.periodFrom));
    const periodTo = formatDateDMY(new Date(result.periodTo));
    const today = formatDateDMY(new Date());
    const docYear = new Date().getFullYear();
    const total = result.stats.totalCompound;

    const baseName = `قائمة_المنخرطين_${year}-${String(month).padStart(2, "0")}${ids.length > 0 ? "_محددين" : ""}`;

    if (format === "excel" || format === "xlsx") {
      return buildExcel(result.entries, total, { year, month, periodFrom, periodTo, baseName });
    }

    // الافتراضي: Word
    return buildWord(result.entries, total, {
      year,
      month,
      periodFrom,
      periodTo,
      today,
      docYear,
      baseName,
      logos,
      sigs: sigs.map((s) => OFFICIAL_SIGNATURES[s] || s),
      origin: url.origin,
    });
  } catch (e) {
    console.error("compound-rights/export error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ══════════════════════════ Word (.doc) ══════════════════════════

function absolutize(src: string, origin: string): string {
  if (src.startsWith("data:") || src.startsWith("http")) return src;
  if (src.startsWith("/")) return `${origin}${src}`;
  return src;
}

function buildWord(
  entries: CompoundEntry[],
  total: number,
  ctx: {
    year: number; month: number; periodFrom: string; periodTo: string;
    today: string; docYear: number; baseName: string;
    logos: EnteteLogo[]; sigs: string[]; origin: string;
  }
) {
  const amountWords = numberToArabicWords(total);

  // صفوف الجدول — الأعمدة الأربعة الرسمية فقط: الرقم / اللقب / الاسم / المبلغ
  const rows = entries.map((e, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="name">${escapeHtml(e.lastName)}</td>
        <td class="name">${escapeHtml(e.firstName)}</td>
        <td class="amt">${formatAmountDZD(COMPOUND_FEE)}</td>
      </tr>`).join("");

  // الشعارات (يمين / يسار / وسط) كما في الوثيقة الرسمية
  const logos = ctx.logos;
  const logoImg = (l: EnteteLogo | undefined) =>
    l ? `<img src="${absolutize(l.src, ctx.origin)}" style="height:80px;width:80px;object-fit:contain;" />` : "";
  const rightLogo = logoImg(logos[0]);
  const leftLogo = logoImg(logos[1]);
  const centerLogo = logoImg(logos[2]);

  const headerLines = OFFICIAL_HEADER_LINES.map(
    (line) => `<p class="h-line">${escapeHtml(line)}</p>`
  ).join("");

  // الإمضاءات — ثلاثة أعمدة (أو أقل حسب الاختيار)
  const sigCells = (ctx.sigs.length > 0 ? ctx.sigs : ["رئيس الجمعية:", "مدير ديوان المركب المتعدد الرياضات", "رئيس الوحدة:"])
    .map((label) => `<td class="sig-cell"><p class="sig">${escapeHtml(label)}</p></td>`)
    .join("");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar">
<head><meta charset="utf-8">
<title>${escapeHtml(ctx.baseName)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
@page Section1 { size: 595.3pt 841.9pt; margin: 1.6cm 1.4cm 1.6cm 1.4cm; mso-page-orientation: portrait; }
div.Section1 { page: Section1; }
body { font-family: 'Simplified Arabic','Traditional Arabic','Times New Roman',Tahoma,Arial; direction: rtl; color: #000; }
p { margin: 0; }
table { border-collapse: collapse; width: 100%; }
/* ─── الترويسة ─── */
table.hdr { border: none; margin-bottom: 4pt; }
table.hdr td { border: none; vertical-align: middle; text-align: center; padding: 0; }
.h-line { text-align: center; font-size: 13pt; font-weight: bold; line-height: 1.35; }
/* ─── الرقم + التاريخ ─── */
table.ref { border: none; margin: 10pt 0 6pt 0; }
table.ref td { border: none; font-size: 13pt; font-weight: bold; padding: 0; width: 50%; }
/* ─── العنوان ─── */
.doc-title { text-align: center; font-size: 16pt; font-weight: bold; text-decoration: underline; margin: 10pt 0 4pt 0; }
.doc-period { text-align: center; font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 0 0 10pt 0; }
/* ─── الجدول الرئيسي ─── */
table.main td, table.main th { border: 1pt solid #000; padding: 3pt 6pt; font-size: 12pt; }
table.main th { font-weight: bold; text-align: center; background: #f2f2f2; }
td.num { text-align: center; width: 9%; font-weight: bold; }
td.name { text-align: center; width: 34%; }
td.amt { text-align: center; width: 23%; font-weight: bold; white-space: nowrap; }
tr.total td { font-weight: bold; font-size: 13pt; background: #f2f2f2; }
/* ─── التفقيط ─── */
.words { text-align: right; font-size: 13.5pt; font-weight: bold; margin: 14pt 2pt 0 2pt; }
.words span { text-decoration: underline; }
/* ─── الإمضاءات ─── */
table.sigs { border: none; margin-top: 48pt; }
table.sigs td.sig-cell { border: none; text-align: center; width: 33.3%; padding: 0 6pt; }
p.sig { font-size: 12.5pt; font-weight: bold; }
</style></head>
<body dir="rtl"><div class="Section1">

  <table class="hdr"><tr>
    <td style="width:18%;">${rightLogo}</td>
    <td style="width:64%;">${headerLines}</td>
    <td style="width:18%;">${leftLogo}${centerLogo ? `<br/>${centerLogo}` : ""}</td>
  </tr></table>

  <table class="ref"><tr>
    <td style="text-align:right;">الرقم: . . . / ن.ر.ه.ر.س ${ctx.docYear}</td>
    <td style="text-align:left;">سعيدة في: ${ctx.today}</td>
  </tr></table>

  <p class="doc-title">القائمة الاسمية للمنخرطين في النادي فرع السباحة</p>
  <p class="doc-period">من تاريخ ${ctx.periodFrom} إلى غاية ${ctx.periodTo}</p>

  <table class="main">
    <tr>
      <th>الرقم</th><th>اللقب</th><th>الاسم</th><th>المبلغ</th>
    </tr>
    ${rows}
    <tr class="total">
      <td colspan="3" style="text-align:center;">المجموع</td>
      <td class="amt">${formatAmountDZD(total)}</td>
    </tr>
  </table>

  <p class="words">تم تحديد المبلغ بـ: <span>${amountWords} دينار جزائري</span></p>

  <table class="sigs"><tr>${sigCells}</tr></table>

</div></body></html>`;

  return new NextResponse("\ufeff" + html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ctx.baseName + ".doc")}`,
    },
  });
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ══════════════════════════ Excel (.xlsx) ══════════════════════════

function buildExcel(
  entries: CompoundEntry[],
  total: number,
  ctx: { year: number; month: number; periodFrom: string; periodTo: string; baseName: string }
) {
  const wb = XLSX.utils.book_new();

  const aoa: (string | number)[][] = [
    [OFFICIAL_HEADER_LINES[0]],
    [OFFICIAL_HEADER_LINES[1]],
    [OFFICIAL_HEADER_LINES[2]],
    [OFFICIAL_HEADER_LINES[3]],
    [],
    ["القائمة الاسمية للمنخرطين في النادي فرع السباحة"],
    [`من تاريخ ${ctx.periodFrom} إلى غاية ${ctx.periodTo}`],
    [],
    ["الرقم", "اللقب", "الاسم", "المبلغ"],
    ...entries.map((e, i) => [i + 1, e.lastName, e.firstName, COMPOUND_FEE] as (string | number)[]),
    [],
    ["", "", "المجموع", total],
    [`تم تحديد المبلغ بـ: ${numberToArabicWords(total)} دينار جزائري (${formatAmountDZD(total)})`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, "قائمة المنخرطين");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ctx.baseName + ".xlsx")}`,
    },
  });
}
