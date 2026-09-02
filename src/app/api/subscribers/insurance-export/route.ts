import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  OFFICIAL_HEADER_LINES,
  OFFICIAL_SIGNATURES,
  SIGNATURE_OPTIONS,
  MONTH_NAMES,
  formatDateDMY,
  type EnteteLogo,
} from "@/lib/compound-format";
import { loadClubLogos } from "@/lib/compound-list";

/**
 * GET /api/subscribers/insurance-export
 *
 * ★ تصدير قائمة التأمين الرسمية — بنفس أسلوب وثيقة حقوق المركب:
 *   ترويسة رسمية + الرقم/سعيدة في + العنوان حسب الحالة
 *   + جدول (الرقم / اللقب / الاسم / تاريخ الميلاد)
 *   + عدد المنخرطين + الإمضاءات أسفل الوثيقة
 *
 * المعاملات:
 *   format   = word | excel | logos (logos = JSON للشعارات لتوليد PDF على العميل)
 *   status   = all | insured | uninsured | selected (افتراضي: all)
 *   ids      = id1,id2 (لـ status=selected — تصدير المحددين)
 *   q        = بحث بالاسم أو رقم الملف
 *   month    = YYYY-MM (شهر آخر دفعة)
 *   birthFrom / birthTo = YYYY-MM-DD (مدى تاريخ الميلاد)
 *   sigs     = president,compound,unit,branch,insurance (افتراضي: الخمسة كلهم)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["admin", "assistant", "superadmin"].includes(user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "word";
    const status = url.searchParams.get("status") || "all";
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const month = url.searchParams.get("month") || ""; // YYYY-MM
    const birthFrom = url.searchParams.get("birthFrom") || "";
    const birthTo = url.searchParams.get("birthTo") || "";
    const idsParam = url.searchParams.get("ids")?.split(",").filter(Boolean) || [];
    const sigs = url.searchParams.get("sigs")?.split(",").filter(Boolean) || Object.keys(OFFICIAL_SIGNATURES);

    const clubFilter = user.role === "superadmin" ? {} : { clubId: user.clubId! };

    // ════ وضع الشعارات فقط (لتوليد PDF على العميل) ════
    if (format === "logos") {
      const logos = await loadClubLogos(user.clubId);
      return NextResponse.json({ logos });
    }

    // ════ 1) كل المنخرطين (بلا أي حد عددي) ════
    const subscribers = await db.subscriber.findMany({
      where: { ...clubFilter, deletedAt: null },
      select: {
        id: true,
        fileNumber: true,
        lastName: true,
        firstName: true,
        birthDate: true,
        lastPaymentDate: true,
      },
      orderBy: { fileNumber: "asc" },
    });

    // ════ 2) معرّفات المؤمَّنين (دفعة تأمين — بلا حد، نفس مصدر insurance-status) ════
    const payRows = await db.payment.findMany({
      where: { category: "insurance", subscriberId: { not: null }, ...clubFilter },
      select: { subscriberId: true },
    });
    const insuredSet = new Set(
      payRows.map((r) => r.subscriberId).filter((x): x is string => Boolean(x))
    );

    // ════ 3) الفلاتر (نفس منطق الشاشة — القائمة المعروضة = القائمة المصدَّرة) ════
    const list = subscribers.filter((s) => {
      const insured = insuredSet.has(s.id);
      if (status === "insured" && !insured) return false;
      if (status === "uninsured" && insured) return false;
      if (status === "selected" && !idsParam.includes(s.id)) return false;
      if (month && s.lastPaymentDate) {
        const d = s.lastPaymentDate;
        const subMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (subMonth !== month) return false;
      }
      if (birthFrom) {
        const from = new Date(birthFrom);
        from.setHours(0, 0, 0, 0);
        if (s.birthDate < from) return false;
      }
      if (birthTo) {
        const to = new Date(birthTo);
        to.setHours(23, 59, 59, 999);
        if (s.birthDate > to) return false;
      }
      if (q) {
        const hay = `${s.lastName} ${s.firstName} ${s.fileNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const logos = await loadClubLogos(user.clubId);
    const today = formatDateDMY(new Date());
    const docYear = new Date().getFullYear();
    const count = list.length;

    const statusLabel =
      status === "insured" ? "المنخرطون المؤمَّنون"
      : status === "uninsured" ? "المنخرطون غير المؤمَّنين"
      : "إجمالي المنخرطين";

    const title =
      status === "insured" ? "القائمة الاسمية للمنخرطين المؤمَّنين — فرع السباحة"
      : status === "uninsured" ? "القائمة الاسمية للمنخرطين غير المؤمَّنين — فرع السباحة"
      : "القائمة الاسمية لمنخرطي النادي فرع السباحة";

    // معلومات الفترة الاختيارية (شهر الدفعة / مدى الميلاد)
    const periodParts: string[] = [];
    if (month) {
      const [y, m] = month.split("-").map(Number);
      if (y && m >= 1 && m <= 12) periodParts.push(`شهر ${MONTH_NAMES[m - 1]} ${y}`);
    }
    if (birthFrom && birthTo) periodParts.push(`المواليد من ${formatDateDMY(new Date(birthFrom))} إلى ${formatDateDMY(new Date(birthTo))}`);
    else if (birthFrom) periodParts.push(`المواليد من ${formatDateDMY(new Date(birthFrom))}`);
    else if (birthTo) periodParts.push(`المواليد إلى غاية ${formatDateDMY(new Date(birthTo))}`);

    const sigLabels = sigs.map((s) => SIGNATURE_OPTIONS.find((o) => o.id === s)?.label || OFFICIAL_SIGNATURES[s] || s);
    const baseName = `قائمة_التأمين_${statusLabel.replace(/\s+/g, "_")}`;

    const rows = list.map((s, i) => ({
      num: i + 1,
      lastName: s.lastName,
      firstName: s.firstName,
      birthDate: formatDateDMY(new Date(s.birthDate)),
    }));

    if (format === "excel" || format === "xlsx") {
      return buildExcel(rows, count, { title, statusLabel, periodParts, sigLabels, baseName });
    }

    return buildWord(rows, count, {
      title, statusLabel, periodParts, today, docYear, baseName, logos, sigLabels,
      origin: url.origin,
    });
  } catch (e) {
    console.error("insurance-export error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ══════════════════════════ Word (.doc) ══════════════════════════

function absolutize(src: string, origin: string): string {
  if (src.startsWith("data:") || src.startsWith("http")) return src;
  if (src.startsWith("/")) return `${origin}${src}`;
  return src;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** تقسيم الإمضاءات صفوفاً من 3 خلايا */
function sigRowsHtml(sigLabels: string[]): string {
  const rows: string[] = [];
  for (let i = 0; i < sigLabels.length; i += 3) {
    const chunk = sigLabels.slice(i, i + 3);
    while (chunk.length < 3) chunk.push("");
    rows.push(
      `<tr>${chunk.map((l) => `<td class="sig-cell">${l ? `<p class="sig">${escapeHtml(l)}</p>` : ""}</td>`).join("")}</tr>`
    );
  }
  return rows.join("");
}

function buildWord(
  rows: { num: number; lastName: string; firstName: string; birthDate: string }[],
  count: number,
  ctx: {
    title: string; statusLabel: string; periodParts: string[];
    today: string; docYear: number; baseName: string;
    logos: EnteteLogo[]; sigLabels: string[]; origin: string;
  }
) {
  const bodyRows = rows.map((r) => `
      <tr>
        <td class="num">${r.num}</td>
        <td class="name">${escapeHtml(r.lastName)}</td>
        <td class="name">${escapeHtml(r.firstName)}</td>
        <td class="birth">${escapeHtml(r.birthDate)}</td>
      </tr>`).join("");

  const logos = ctx.logos;
  const logoImg = (l: EnteteLogo | undefined) =>
    l ? `<img src="${absolutize(l.src, ctx.origin)}" style="height:80px;width:80px;object-fit:contain;" />` : "";

  const headerLines = OFFICIAL_HEADER_LINES.map(
    (line) => `<p class="h-line">${escapeHtml(line)}</p>`
  ).join("");

  const periodLine = ctx.periodParts.length > 0
    ? `<p class="doc-period">${escapeHtml(ctx.periodParts.join(" — "))}</p>`
    : "";

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
td.name { text-align: center; width: 30%; }
td.birth { text-align: center; width: 31%; font-weight: bold; white-space: nowrap; }
tr.total td { font-weight: bold; font-size: 13pt; background: #f2f2f2; }
/* ─── العدد ─── */
.count-line { text-align: right; font-size: 13.5pt; font-weight: bold; margin: 14pt 2pt 0 2pt; }
.count-line span { text-decoration: underline; }
/* ─── الإمضاءات ─── */
table.sigs { border: none; margin-top: 46pt; }
table.sigs td.sig-cell { border: none; text-align: center; width: 33.3%; padding: 14pt 6pt 0; }
p.sig { font-size: 12.5pt; font-weight: bold; }
</style></head>
<body dir="rtl"><div class="Section1">

  <table class="hdr"><tr>
    <td style="width:18%;">${logoImg(logos[0])}</td>
    <td style="width:64%;">${headerLines}</td>
    <td style="width:18%;">${logoImg(logos[1])}${logos[2] ? `<br/>${logoImg(logos[2])}` : ""}</td>
  </tr></table>

  <table class="ref"><tr>
    <td style="text-align:right;">الرقم: . . . / ن.ر.ه.ر.س ${ctx.docYear}</td>
    <td style="text-align:left;">سعيدة في: ${ctx.today}</td>
  </tr></table>

  <p class="doc-title">${escapeHtml(ctx.title)}</p>
  ${periodLine}
  <p class="doc-period">الحالة: ${escapeHtml(ctx.statusLabel)}</p>

  <table class="main">
    <tr>
      <th>الرقم</th><th>اللقب</th><th>الاسم</th><th>تاريخ الميلاد</th>
    </tr>
    ${bodyRows}
    <tr class="total">
      <td colspan="3" style="text-align:center;">عدد المنخرطين</td>
      <td class="birth">${count}</td>
    </tr>
  </table>

  <p class="count-line">عدد المنخرطين المذكورين في هذه القائمة: <span>${count}</span></p>

  <table class="sigs">${sigRowsHtml(ctx.sigLabels)}</table>

</div></body></html>`;

  return new NextResponse("\ufeff" + html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ctx.baseName + ".doc")}`,
    },
  });
}

// ══════════════════════════ Excel (.xlsx) ══════════════════════════

function buildExcel(
  rows: { num: number; lastName: string; firstName: string; birthDate: string }[],
  count: number,
  ctx: {
    title: string; statusLabel: string; periodParts: string[];
    sigLabels: string[]; baseName: string;
  }
) {
  const wb = XLSX.utils.book_new();

  const aoa: (string | number)[][] = [
    OFFICIAL_HEADER_LINES,
    [],
    [ctx.title],
    [`الحالة: ${ctx.statusLabel}`],
    ...ctx.periodParts.map((p) => [p] as string[]),
    [],
    ["الرقم", "اللقب", "الاسم", "تاريخ الميلاد"],
    ...rows.map((r) => [r.num, r.lastName, r.firstName, r.birthDate] as (string | number)[]),
    [],
    ["", "", "عدد المنخرطين", count],
    [],
    ...ctx.sigLabels.map((s) => [s] as string[]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, "قائمة التأمين");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ctx.baseName + ".xlsx")}`,
    },
  });
}
