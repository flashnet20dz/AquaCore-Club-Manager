import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeSubscriberFields, isExemptStatus, formatAmountForExport } from "@/lib/rcs";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getCurrentUser } from "@/lib/session";

// Standardized En-tête for all exports (from Word template)
// Format: Logo + "الرقم: . . ./ن.ر.ه.ر.س YYYY / سعيدة في: ..."

// Format date as YYYY/MM/DD (user requirement)
function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

// Convert number to Arabic words (for "تم تحديد المبلغ بـ:")
function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  const thousands = ["", "ألف", "ألفان", "آلاف"];

  function threeDigits(n: number): string {
    let result = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const o = n % 10;
    if (h > 0) result += hundreds[h];
    if (t === 1 && o === 0) {
      if (result) result += " و";
      result += "عشرة";
    } else if (t === 1 && o > 0) {
      if (result) result += " و";
      const teenWords = ["", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
      result += teenWords[o];
    } else {
      if (t > 1) {
        if (result) result += " و";
        if (o > 0) {
          result += ones[o] + " و" + tens[t];
        } else {
          result += tens[t];
        }
      } else if (o > 0) {
        if (result) result += " و";
        result += ones[o];
      }
    }
    return result;
  }

  let result = "";
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    result += numberToArabicWords(millions) + " مليون";
    num %= 1000000;
    if (num > 0) result += " و";
  }
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands === 1) result += "ألف";
    else if (thousands === 2) result += "ألفان";
    else if (thousands <= 10) result += ones[thousands] + " آلاف";
    else result += numberToArabicWords(thousands) + " ألف";
    num %= 1000;
    if (num > 0) result += " و";
  }
  if (num > 0) {
    result += threeDigits(num);
  }
  return result.trim();
}

// Generate signatures HTML for Word exports
function generateSignaturesHTML(sigs: string[]): string {
  const sigLabels: Record<string, string> = {
    president: "إمضاء رئيس الجمعية",
    branch: "رئيس الفرع",
    manager: "مدير الوحدة",
    compound: "مدير ديوان المركب",
    insurance: "تأشيرة التأمين",
  };
  if (sigs.length === 0) return "";

  const cells = sigs.map((sigId) => `
    <td style="text-align:center;vertical-align:bottom;padding:20px 10px 5px;border:none;width:${Math.floor(100 / sigs.length)}%;">
      <div style="border-top:1.5px solid #333;height:40px;margin-bottom:5px;"></div>
      <p style="font-size:10pt;font-weight:bold;color:#333;font-family:'Cairo','Tahoma',Arial;">${sigLabels[sigId] || sigId}</p>
    </td>
  `).join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:40px;">
      <tr>${cells}</tr>
    </table>
  `;
}

function drawEnTete(doc: jsPDF, type: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Try to add the header image (RCS logo)
  try {
    // Use a base URL approach: we'll fetch the image at runtime
    // For PDF, we can add the image as base64 from /public/images/rcs-header.png
    // But since this is server-side, we'll use a placeholder rectangle with text
    doc.setFillColor(15, 118, 110); // teal-700
    doc.rect(margin, 10, pageWidth - margin * 2, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RCS Club - نادي RCS للسباحة", pageWidth / 2, 18, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(type, pageWidth / 2, 25, { align: "center" });
  } catch (e) {
    console.error("Header image error:", e);
  }

  // Reference number fields (from Word template)
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const today = new Date();
  const refY = 35;
  doc.text(`الرقم: . . ./ن.ر.ه.ر.س ${today.getFullYear()}`, pageWidth - margin, refY, { align: "right" });
  doc.text(`سعيدة في: ${formatDate(today)}`, margin, refY);

  return refY + 8; // Return Y position for table start
}

// ─── Type aliases: UI type → API query type ───
// Allows the export panel to expose multiple UI types that map to the same DB query.
const TYPE_ALIASES: Record<string, string> = {
  "subscribers-all": "subscribers",
  "subscribers-active": "subscribers",
  "subscribers-expired": "subscribers",
  "subscribers-expiring": "subscribers",
  "payments": "incoming",
  "financial-stats": "financial",
  "monthly-revenue": "financial",
  "expenses": "financial",
};

// ─── Full title map (covers all UI types) ───
const FULL_TITLE_MAP: Record<string, string> = {
  subscribers: "قائمة المنخرطين",
  "subscribers-all": "قائمة المنخرطين الكاملة",
  "subscribers-active": "قائمة المنخرطين النشطين",
  "subscribers-expired": "قائمة المنخرطين المنتهية",
  "subscribers-expiring": "قائمة المنخرطين قريبة الانتهاء",
  insurance: "قائمة التأمين",
  compound: "قائمة حقوق ديوان المركب",
  incoming: "قائمة الوارد",
  payments: "كشف المدفوعات",
  attendance: "سجل الحضور",
  renewals: "سجل التجديدات",
  financial: "التقرير المالي",
  "financial-stats": "الإحصائيات المالية",
  "monthly-revenue": "تقرير الإيرادات الشهرية",
  expenses: "تقرير المصاريف",
  compensations: "كشف التعويضات",
  "dist-age-categories": "توزيع الفئات العمرية",
  "dist-subscription-types": "توزيع أنواع الاشتراكات",
  "dist-blood-types": "توزيع فصائل الدم",
  "dist-swimming-days": "توزيع أيام السباحة",
  "dist-time-slots": "توزيع التوقيت",
  "work-hours": "كشف ساعات العمل",
  waitlist: "قائمة الانتظار",
  employees: "كشف الموظفين",
  contracts: "كشف العقود",
};

// ─── Export filters (club + ids + date range) ───
interface ExportFilters {
  /** Club-level filter (clubId) — applies to all queries */
  club: Record<string, unknown>;
  /** Filter for subscriber-based queries (club + ids) */
  sub: Record<string, unknown>;
  /** Filter for attendance queries (club + date range on `date`) */
  att: Record<string, unknown>;
  /** Filter for renewal queries (club + date range on `renewalDate`) */
  ren: Record<string, unknown>;
}

function buildExportFilters(clubFilter: Record<string, unknown>, ids: string[], dateFrom: string, dateTo: string): ExportFilters {
  // Sub filter: club + ids
  const sub: Record<string, unknown> = { ...clubFilter };
  if (ids.length > 0) sub.id = { in: ids };

  // Attendance filter: club + date range on `date`
  const att: Record<string, unknown> = { ...clubFilter };
  if (dateFrom || dateTo) {
    const dr: Record<string, Date> = {};
    if (dateFrom) dr.gte = new Date(dateFrom);
    if (dateTo) dr.lte = new Date(`${dateTo}T23:59:59`);
    att.date = dr;
  }

  // Renewal filter: club + date range on `renewalDate`
  const ren: Record<string, unknown> = { ...clubFilter };
  if (dateFrom || dateTo) {
    const dr: Record<string, Date> = {};
    if (dateFrom) dr.gte = new Date(dateFrom);
    if (dateTo) dr.lte = new Date(`${dateTo}T23:59:59`);
    ren.renewalDate = dr;
  }

  return { club: clubFilter, sub, att, ren };
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "xlsx";
    const type = url.searchParams.get("type") || "subscribers";
    const sigs = url.searchParams.get("sigs")?.split(",").filter(Boolean) || [];
    const origin = url.origin;

    // ── New filter params: ids (subscriber selection) + from/to (date range) ──
    const ids = url.searchParams.get("ids")?.split(",").filter(Boolean) || [];
    const dateFrom = url.searchParams.get("from") || "";
    const dateTo = url.searchParams.get("to") || "";

    // ★ Compound-specific params: year, month, selectedIds
    const compoundYear = url.searchParams.get("year");
    const compoundMonth = url.searchParams.get("month");
    const compoundSelectedIds = url.searchParams.get("selectedIds")?.split(",").filter(Boolean) || [];

    // Build filters — for compound, filter by lastPaymentDate within the specified month
    let filters = buildExportFilters(clubFilter, ids, dateFrom, dateTo);

    // ★ If compound type with year/month, add lastPaymentDate filter
    if ((type === "compound") && compoundYear && compoundMonth) {
      const y = parseInt(compoundYear);
      const m = parseInt(compoundMonth);
      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 0, 23, 59, 59);
      // Merge into sub filter
      (filters.sub as Record<string, unknown>).lastPaymentDate = { gte: startDate, lte: endDate };
      // ★ Also check Renewal table — we need to include renewals in that month
      (filters.ren as Record<string, unknown>).renewalDate = { gte: startDate, lte: endDate };
    }

    // ★ If compound with selectedIds, override sub filter to only those IDs
    if ((type === "compound") && compoundSelectedIds.length > 0) {
      (filters.sub as Record<string, unknown>).id = { in: compoundSelectedIds };
    }

    // Load EN-TETE config once (used by PDF + Word)
    const enteteConfig = await loadEnteteConfig(currentUser.clubId);

    if (format === "xlsx" || format === "excel") {
      return await exportExcel(type, filters, { year: compoundYear, month: compoundMonth });
    } else if (format === "pdf") {
      return await exportPdf(type, sigs, enteteConfig, origin, filters, { year: compoundYear, month: compoundMonth });
    } else if (format === "word" || format === "doc") {
      return await exportWord(type, sigs, enteteConfig, origin, filters, { year: compoundYear, month: compoundMonth });
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (e) {
    console.error("Export error:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

async function exportExcel(type: string, filters: ExportFilters = { club: {}, sub: {}, att: {}, ren: {} }, compoundParams?: { year?: string | null; month?: string | null }) {
  const queryType = TYPE_ALIASES[type] || type;
  const wb = XLSX.utils.book_new();
  const today = formatDate(new Date());

  // En-tête data (top rows in each sheet)
  const headerRows: (string | number)[][] = [
    ["نادي RCS للسباحة - RCS Club"],
    [`الرقم: . . ./ن.ر.ه.ر.س ${new Date().getFullYear()}`],
    [`سعيدة في: ${today}`],
    [FULL_TITLE_MAP[type] || type],
    [],
  ];

  let dataRows: Record<string, unknown>[] = [];
  let sheetName = "البيانات";

  if (queryType === "subscribers") {
    const subs = await db.subscriber.findMany({ where: filters.sub, orderBy: { createdAt: "asc" } });
    dataRows = subs.map((s, i) => {
      const c = computeSubscriberFields(s);
      return {
        "رقم": i + 1,
        "رقم الملف": s.fileNumber,
        "اللقب": s.lastName,
        "الاسم": s.firstName,
        "تاريخ الميلاد": formatDate(new Date(s.birthDate)),
        "الجنس": s.gender,
        "العمر": c.age,
        "فصيلة الدم": s.bloodType || "",
        "نوع الاشتراك": s.subscriptionType,
        "تاريخ آخر دفعة": isExemptStatus(s.paymentStatus) ? "" : (s.lastPaymentDate ? formatDate(new Date(s.lastPaymentDate)) : ""),
        "تاريخ الانتهاء": isExemptStatus(s.paymentStatus) ? "" : (c.expiryDate ? formatDate(new Date(c.expiryDate)) : ""),
        "حالة الدفع": s.paymentStatus,
        // ★ EXEMPT subscribers show "معفى" in amount columns (not 0)
        "رسوم الاشتراك": formatAmountForExport(s.paymentStatus, c.subscriptionFee),
        "مصاريف التأمين": formatAmountForExport(s.paymentStatus, c.insuranceFee),
        "حقوق المركب": formatAmountForExport(s.paymentStatus, c.compoundRights),
        "المبلغ الإجمالي": formatAmountForExport(s.paymentStatus, c.totalAmount),
        "حالة التجديد": c.renewalStatus,
        "أيام السباحة": s.swimmingDays || "",
        "التوقيت": s.timeSlot || "",
        "الهاتف": s.phone || "",
      };
    });
    sheetName = "المنخرطون";

    // Summary sheet
    // ★ paid excludes exempt subscribers (they are a separate category)
    const paid = subs.filter((s) => !isExemptStatus(s.paymentStatus) && s.paymentStatus !== "لم يدفع");
    const exemptSubs = subs.filter((s) => isExemptStatus(s.paymentStatus));
    const computed = subs.map((s) => ({ ...s, ...computeSubscriberFields(s) }));
    const summary = [
      { "البند": "إجمالي المنخرطين", "القيمة": subs.length },
      { "البند": "منخرطون مدفوعون", "القيمة": paid.length },
      // ★ EXEMPT count as a separate summary line
      { "البند": "منخرطون معفون", "القيمة": exemptSubs.length },
      { "البند": "إجمالي رسوم الاشتراكات (دج)", "القيمة": computed.reduce((sum, s) => sum + (s.subscriptionFee ?? 0), 0) },
      { "البند": "إجمالي مصاريف التأمين (دج)", "القيمة": computed.reduce((sum, s) => sum + (s.insuranceFee ?? 0), 0) },
      { "البند": "إجمالي حقوق المركب (دج)", "القيمة": computed.reduce((sum, s) => sum + (s.compoundRights ?? 0), 0) },
      { "البند": "الإيرادات الإجمالية (دج)", "القيمة": computed.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0) },
    ];
    const wsSum = XLSX.utils.json_to_sheet([...headerRows, ...summary] as Record<string, unknown>[]);
    wsSum["!cols"] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSum, "ملخص");

  } else if (queryType === "insurance") {
    // قائمة التأمين - كل من دفع 500 دج تأمين
    const subs = await db.subscriber.findMany({ where: filters.sub, orderBy: { createdAt: "asc" } });
    const computed = subs
      .map((s) => ({ ...s, ...computeSubscriberFields(s) }))
      .filter((s) => s.insuranceFee !== null && s.insuranceFee > 0);

    dataRows = computed.map((s, i) => ({
      "رقم": i + 1,
      "رقم الملف": s.fileNumber,
      "اللقب": s.lastName,
      "الاسم": s.firstName,
      "تاريخ الميلاد": formatDate(new Date(s.birthDate)),
      "الجنس": s.gender,
      "العمر": s.age,
      "نوع الاشتراك": s.subscriptionType,
      "حالة الدفع": s.paymentStatus,
      "مبلغ التأمين": s.insuranceFee,
      "تاريخ آخر دفعة": s.lastPaymentDate ? formatDate(new Date(s.lastPaymentDate)) : "",
    }));
    sheetName = "التأمين";

  } else if (queryType === "compound") {
    // ★ قائمة حقوق ديوان المركب — مطابقة لـ compound-rights API
    // استخدم نفس منطق /api/compound-rights: دمج التسجيلات + التجديدات مع dedup
    const startDate = compoundParams?.year && compoundParams?.month
      ? new Date(parseInt(compoundParams.year), parseInt(compoundParams.month) - 1, 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = compoundParams?.year && compoundParams?.month
      ? new Date(parseInt(compoundParams.year), parseInt(compoundParams.month), 0, 23, 59, 59)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    // 1) التسجيلات الجديدة (lastPaymentDate within month)
    const newSubs = await db.subscriber.findMany({
      where: { ...filters.sub, lastPaymentDate: { gte: startDate, lte: endDate } },
      orderBy: { lastPaymentDate: "asc" },
    });
    const computedNew = newSubs
      .map((s) => ({ ...s, ...computeSubscriberFields(s) }))
      .filter((s) => s.compoundRights !== null && s.compoundRights > 0);

    // 2) التجديدات (renewalDate within month)
    const rens = await db.renewal.findMany({
      where: { ...filters.ren, renewalDate: { gte: startDate, lte: endDate } },
      include: { subscriber: true },
      orderBy: { renewalDate: "asc" },
    });
    const renewalEntries = rens
      .filter((r) => r.amount === 1300 || r.amount === 1500)
      .map((r) => {
        const c = computeSubscriberFields(r.subscriber);
        return { ...r.subscriber, ...c, _renewalDate: r.renewalDate, _source: "renewal" as const };
      });

    // 3) دمج بدون تكرار (deduplicate by subscriber id)
    const seenIds = new Set(computedNew.map((s) => s.id));
    const merged = [...computedNew, ...renewalEntries.filter((s) => !seenIds.has(s.id))];

    dataRows = merged.map((s, i) => ({
      "رقم": i + 1,
      "رقم الملف": s.fileNumber,
      "اللقب": s.lastName,
      "الاسم": s.firstName,
      "تاريخ الميلاد": formatDate(new Date(s.birthDate)),
      "الجنس": s.gender,
      "العمر": s.age,
      "نوع الاشتراك": s.subscriptionType,
      "رسوم الاشتراك": s.subscriptionFee,
      "مبلغ الإجمالي": s.totalAmount,
      "حقوق الديوان (1000 دج)": s.compoundRights,
    }));
    sheetName = "حقوق الديوان";

  } else if (queryType === "incoming") {
    // قائمة الوارد - جميع المدفوعات الواردة
    const subs = await db.subscriber.findMany({ where: filters.sub, orderBy: { createdAt: "asc" } });
    const computed = subs
      .map((s) => ({ ...s, ...computeSubscriberFields(s) }))
      .filter((s) => s.totalAmount !== null && s.totalAmount > 0);

    dataRows = computed.map((s, i) => ({
      "رقم": i + 1,
      "رقم الملف": s.fileNumber,
      "اللقب": s.lastName,
      "الاسم": s.firstName,
      "تاريخ الميلاد": formatDate(new Date(s.birthDate)),
      "نوع الاشتراك": s.subscriptionType,
      "حالة الدفع": s.paymentStatus,
      "المبلغ الإجمالي": s.totalAmount,
      "تاريخ الدفعة": s.lastPaymentDate ? formatDate(new Date(s.lastPaymentDate)) : "",
    }));
    sheetName = "الوارد";

  } else if (queryType === "attendance") {
    const atts = await db.attendance.findMany({
      where: filters.att,
      include: { subscriber: true },
      orderBy: { date: "desc" },
    });
    dataRows = atts.map((a, i) => ({
      "رقم": i + 1,
      "التاريخ": formatDate(new Date(a.date)),
      "رقم الملف": a.subscriber.fileNumber,
      "اللقب": a.subscriber.lastName,
      "الاسم": a.subscriber.firstName,
      "تاريخ الميلاد": formatDate(new Date(a.subscriber.birthDate)),
      "وقت الحضور": new Date(a.checkInTime).toLocaleTimeString("ar-DZ"),
      "وقت الانصراف": a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString("ar-DZ") : "",
      "الطريقة": a.method === "qr" ? "QR" : "يدوي",
      "ملاحظة": a.note || "",
    }));
    sheetName = "الحضور";

  } else if (queryType === "renewals") {
    const rens = await db.renewal.findMany({
      where: filters.ren,
      include: { subscriber: true },
      orderBy: { createdAt: "desc" },
    });
    dataRows = rens.map((r, i) => ({
      "رقم": i + 1,
      "التاريخ": formatDate(new Date(r.renewalDate)),
      "رقم الملف": r.subscriber.fileNumber,
      "اللقب": r.subscriber.lastName,
      "الاسم": r.subscriber.firstName,
      "تاريخ الميلاد": formatDate(new Date(r.subscriber.birthDate)),
      "عدد الأشهر": r.months,
      "تاريخ الانتهاء": formatDate(new Date(r.expiryDate)),
      "المبلغ (دج)": r.amount,
      "حالة الدفع": r.paymentStatus,
      "ملاحظة": r.note || "",
    }));
    sheetName = "التجديدات";

  } else if (queryType === "financial") {
    const subs = await db.subscriber.findMany({ where: filters.sub });
    const computed = subs.map((s) => ({ ...s, ...computeSubscriberFields(s) }));
    const paid = computed.filter((s) => !isExemptStatus(s.paymentStatus) && s.paymentStatus !== "لم يدفع");

    dataRows = paid.map((s, i) => ({
      "رقم": i + 1,
      "رقم الملف": s.fileNumber,
      "اللقب والاسم": `${s.lastName} ${s.firstName}`,
      "تاريخ الميلاد": formatDate(new Date(s.birthDate)),
      "نوع الاشتراك": s.subscriptionType,
      "حالة الدفع": s.paymentStatus,
      "رسوم الاشتراك": s.subscriptionFee ?? 0,
      "مصاريف التأمين": s.insuranceFee ?? 0,
      "حقوق المركب": s.compoundRights ?? 0,
      "المبلغ الإجمالي": s.totalAmount ?? 0,
    }));
    // Total row
    dataRows.push({
      "رقم": "" as unknown as number,
      "رقم الملف": "",
      "اللقب والاسم": "المجموع الإجمالي",
      "تاريخ الميلاد": "",
      "نوع الاشتراك": "",
      "حالة الدفع": "",
      "رسوم الاشتراك": paid.reduce((s, x) => s + (x.subscriptionFee ?? 0), 0),
      "مصاريف التأمين": paid.reduce((s, x) => s + (x.insuranceFee ?? 0), 0),
      "حقوق المركب": paid.reduce((s, x) => s + (x.compoundRights ?? 0), 0),
      "المبلغ الإجمالي": paid.reduce((s, x) => s + (x.totalAmount ?? 0), 0),
    } as Record<string, unknown>);
    sheetName = "مالي";
  }

  // Build worksheet with en-tête + data
  const ws = XLSX.utils.json_to_sheet(dataRows.length > 0 ? dataRows : [{ "لا توجد بيانات": "" }]);
  if (dataRows.length > 0) {
    ws["!cols"] = Object.keys(dataRows[0]).map((k) => ({ wch: Math.max(k.length * 1.5, 12) }));
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `RCS_${type}_${new Date().toISOString().split("T")[0]}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function exportPdf(type: string, _sigs: string[], _enteteConfig: EnteteConfig, _origin: string, filters: ExportFilters = { club: {}, sub: {}, att: {}, ren: {} }, compoundParams?: { year?: string | null; month?: string | null }) {
  const queryType = TYPE_ALIASES[type] || type;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const title = FULL_TITLE_MAP[type] || type;
  const startY = drawEnTete(doc, title);

  let head: string[] = [];
  let body: (string | number)[][] = [];

  if (queryType === "subscribers") {
    const subs = await db.subscriber.findMany({ where: filters.sub, orderBy: { createdAt: "asc" } });
    head = ["#", "File", "Last Name", "First Name", "Birth Date", "Gender", "Age", "Type", "Payment", "Fee", "Insurance", "Compound", "Total", "Status"];
    body = subs.map((s, i) => {
      const c = computeSubscriberFields(s);
      return [
        i + 1, s.fileNumber, s.lastName, s.firstName,
        formatDate(new Date(s.birthDate)),
        s.gender, c.age, s.subscriptionType, s.paymentStatus,
        c.subscriptionFee ?? "-", c.insuranceFee ?? "-", c.compoundRights ?? "-",
        c.totalAmount ?? "-",
        c.renewalStatus.replace(/[^\x00-\x7F]/g, "").trim() || "active",
      ];
    });
  } else if (queryType === "insurance") {
    const subs = await db.subscriber.findMany({ where: filters.sub, orderBy: { createdAt: "asc" } });
    const computed = subs
      .map((s) => ({ ...s, ...computeSubscriberFields(s) }))
      .filter((s) => s.insuranceFee !== null && s.insuranceFee > 0);
    head = ["#", "File", "Last Name", "First Name", "Birth Date", "Gender", "Age", "Type", "Insurance Fee"];
    body = computed.map((s, i) => [
      i + 1, s.fileNumber, s.lastName, s.firstName,
      formatDate(new Date(s.birthDate)),
      s.gender, s.age, s.subscriptionType, s.insuranceFee,
    ]);
  } else if (queryType === "compound") {
    // ★ PDF compound — same logic as Excel: merge new + renewals with dedup
    const startDate = compoundParams?.year && compoundParams?.month
      ? new Date(parseInt(compoundParams.year), parseInt(compoundParams.month) - 1, 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = compoundParams?.year && compoundParams?.month
      ? new Date(parseInt(compoundParams.year), parseInt(compoundParams.month), 0, 23, 59, 59)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const newSubs = await db.subscriber.findMany({
      where: { ...filters.sub, lastPaymentDate: { gte: startDate, lte: endDate } },
      orderBy: { lastPaymentDate: "asc" },
    });
    const computedNew = newSubs
      .map((s) => ({ ...s, ...computeSubscriberFields(s) }))
      .filter((s) => s.compoundRights !== null && s.compoundRights > 0);

    const rens = await db.renewal.findMany({
      where: { ...filters.ren, renewalDate: { gte: startDate, lte: endDate } },
      include: { subscriber: true },
      orderBy: { renewalDate: "asc" },
    });
    const renewalEntries = rens
      .filter((r) => r.amount === 1300 || r.amount === 1500)
      .map((r) => {
        const c = computeSubscriberFields(r.subscriber);
        return { ...r.subscriber, ...c };
      });

    const seenIds = new Set(computedNew.map((s) => s.id));
    const merged = [...computedNew, ...renewalEntries.filter((s) => !seenIds.has(s.id))];

    head = ["#", "File", "Last Name", "First Name", "Birth Date", "Gender", "Age", "Fee", "Total", "Compound Rights"];
    body = merged.map((s, i) => [
      i + 1, s.fileNumber, s.lastName, s.firstName,
      formatDate(new Date(s.birthDate)),
      s.gender, s.age, s.subscriptionFee, s.totalAmount, s.compoundRights,
    ]);
  } else if (queryType === "incoming") {
    const subs = await db.subscriber.findMany({ where: filters.sub, orderBy: { createdAt: "asc" } });
    const computed = subs
      .map((s) => ({ ...s, ...computeSubscriberFields(s) }))
      .filter((s) => s.totalAmount !== null && s.totalAmount > 0);
    head = ["#", "File", "Last Name", "First Name", "Birth Date", "Type", "Payment Status", "Amount", "Payment Date"];
    body = computed.map((s, i) => [
      i + 1, s.fileNumber, s.lastName, s.firstName,
      formatDate(new Date(s.birthDate)),
      s.subscriptionType, s.paymentStatus, s.totalAmount,
      s.lastPaymentDate ? formatDate(new Date(s.lastPaymentDate)) : "-",
    ]);
  } else if (queryType === "attendance") {
    const atts = await db.attendance.findMany({
      where: filters.att,
      include: { subscriber: true },
      orderBy: { date: "desc" },
      take: 500,
    });
    head = ["#", "Date", "File", "Last Name", "First Name", "Birth Date", "Check-In", "Method"];
    body = atts.map((a, i) => [
      i + 1,
      formatDate(new Date(a.date)),
      a.subscriber.fileNumber, a.subscriber.lastName, a.subscriber.firstName,
      formatDate(new Date(a.subscriber.birthDate)),
      new Date(a.checkInTime).toLocaleTimeString("en-GB"),
      a.method === "qr" ? "QR" : "Manual",
    ]);
  } else if (queryType === "renewals") {
    const rens = await db.renewal.findMany({
      where: filters.ren,
      include: { subscriber: true },
      orderBy: { createdAt: "desc" },
    });
    head = ["#", "Date", "File", "Last Name", "First Name", "Birth Date", "Months", "Expiry", "Amount", "Status"];
    body = rens.map((r, i) => [
      i + 1,
      formatDate(new Date(r.renewalDate)),
      r.subscriber.fileNumber, r.subscriber.lastName, r.subscriber.firstName,
      formatDate(new Date(r.subscriber.birthDate)),
      r.months,
      formatDate(new Date(r.expiryDate)),
      r.amount, r.paymentStatus,
    ]);
  } else if (queryType === "financial") {
    const subs = await db.subscriber.findMany({ where: filters.sub });
    const computed = subs.map((s) => ({ ...s, ...computeSubscriberFields(s) }));
    const paid = computed.filter((s) => !isExemptStatus(s.paymentStatus) && s.paymentStatus !== "لم يدفع");
    head = ["#", "File", "Name", "Birth Date", "Type", "Sub Fee", "Insurance", "Compound", "Total"];
    body = paid.map((s, i) => [
      i + 1, s.fileNumber, `${s.lastName} ${s.firstName}`,
      formatDate(new Date(s.birthDate)),
      s.subscriptionType,
      s.subscriptionFee ?? 0, s.insuranceFee ?? 0, s.compoundRights ?? 0, s.totalAmount ?? 0,
    ]);
    body.push([
      "", "", "TOTAL", "", "",
      paid.reduce((s, x) => s + (x.subscriptionFee ?? 0), 0),
      paid.reduce((s, x) => s + (x.insuranceFee ?? 0), 0),
      paid.reduce((s, x) => s + (x.compoundRights ?? 0), 0),
      paid.reduce((s, x) => s + (x.totalAmount ?? 0), 0),
    ]);
  }

  autoTable(doc, {
    head: [head],
    body,
    startY,
    styles: { fontSize: 7, cellPadding: 1.2, halign: "center" },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [240, 253, 250] },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === body.length - 1 && type === "financial") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [254, 252, 232];
      }
    },
  });

  const buf = doc.output("arraybuffer");
  const filename = `RCS_${type}_${new Date().toISOString().split("T")[0]}.pdf`;
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ──────────────── Word Export with EN-TETE ────────────────

interface EnteteElement {
  id: string;
  label: string;
  type: "text" | "logo";
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  color?: string;
  italic?: boolean;
  underline?: boolean;
  slot: string;
  src?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
}
interface EnteteConfig {
  elements: EnteteElement[];
  showDivider: boolean;
  dividerColor: string;
  dividerWidth: number;
  referenceNumberText: string;
  dateLocationText: string;
  showReferenceRow: boolean;
}

// Default EN-TETE config (used if database has nothing stored)
const DEFAULT_ENTETE_CONFIG: EnteteConfig = {
  elements: [
    { id: "logo-l", label: "الشعار الأيسر", type: "logo", slot: "header-left", src: "/images/rcs-logo-official.png", width: 70, height: 70, borderRadius: 8 },
    { id: "title", label: "النادي الهاوي", type: "text", slot: "header-center", content: "النادي الهاوي متعدد الرياضات", fontFamily: "Cairo", fontSize: 16, fontWeight: "bold", color: "#0f766e" },
    { id: "subtitle", label: "الرائد - سعيدة", type: "text", slot: "header-center", content: "الرائد - سعيدة", fontFamily: "Cairo", fontSize: 14, fontWeight: "bold", color: "#f59e0b" },
    { id: "branch", label: "فرع السباحة", type: "text", slot: "header-center", content: "فرع السباحة", fontFamily: "Cairo", fontSize: 12, fontWeight: "normal", color: "#555555" },
    { id: "logo-r", label: "الشعار الأيمن", type: "logo", slot: "header-right", src: "/images/rcs-logo-official.png", width: 70, height: 70, borderRadius: 8 },
  ],
  showDivider: true,
  dividerColor: "#0f766e",
  dividerWidth: 2,
  referenceNumberText: "الرقم: . . ./ن.ر.ه.ر.س",
  dateLocationText: "سعيدة في:",
  showReferenceRow: true,
};

// Load EN-TETE config from DB (falls back to default)
async function loadEnteteConfig(clubId: string | null): Promise<EnteteConfig> {
  try {
    if (!clubId) return DEFAULT_ENTETE_CONFIG;
    const setting = await db.setting.findFirst({ where: { clubId, key: "enteteConfig" } });
    if (!setting) return DEFAULT_ENTETE_CONFIG;
    const parsed = JSON.parse(setting.value) as EnteteConfig;
    return { ...DEFAULT_ENTETE_CONFIG, ...parsed };
  } catch {
    return DEFAULT_ENTETE_CONFIG;
  }
}

// Escape HTML special characters to prevent injection in user-edited EN-TETE content
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Convert a base64 data-URL image to absolute URL-friendly form (kept as-is; browsers/Word handle data: URLs)
// For relative paths like "/images/...", convert to absolute using request origin (handled at call site)
function absolutizeImageSrc(src: string | undefined, origin: string): string {
  if (!src) return "";
  if (src.startsWith("data:")) return src;       // base64 — use as-is
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/")) return `${origin}${src}`;
  return src;
}

// Render an element as inline HTML for the header
function renderEnteteElementHTML(el: EnteteElement, origin: string): string {
  if (el.type === "logo") {
    const src = absolutizeImageSrc(el.src, origin);
    return `<img src="${src}" style="height:${el.height || 70}px;width:${el.width || 70}px;border-radius:${el.borderRadius || 0}px;object-fit:contain;" onerror="this.style.display='none'" />`;
  }
  const fontStyle = el.italic ? "italic" : "normal";
  const textDecoration = el.underline ? "underline" : "none";
  return `<p style="font-size:${el.fontSize || 12}pt;font-weight:${el.fontWeight || "normal"};color:${el.color || "#111"};font-style:${fontStyle};text-decoration:${textDecoration};margin:1px;font-family:'${el.fontFamily || "Cairo"}','Tahoma',Arial;">${escapeHtml(el.content || "")}</p>`;
}

// Generate EN-TETE HTML dynamically from stored config
function generateEnteteHTML(title: string, config: EnteteConfig, origin: string): string {
  const today = new Date();
  const year = today.getFullYear();
  const dateStr = formatDate(today);

  const leftEls = config.elements.filter((e) => e.slot === "header-left").map((e) => renderEnteteElementHTML(e, origin)).join("");
  const centerEls = config.elements.filter((e) => e.slot === "header-center").map((e) => renderEnteteElementHTML(e, origin)).join("");
  const rightEls = config.elements.filter((e) => e.slot === "header-right").map((e) => renderEnteteElementHTML(e, origin)).join("");

  const headerTable = `
    <div style="text-align:center;margin-bottom:5px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:20%;text-align:right;vertical-align:middle;">${rightEls}</td>
          <td style="width:60%;text-align:center;vertical-align:middle;">${centerEls}</td>
          <td style="width:20%;text-align:left;vertical-align:middle;">${leftEls}</td>
        </tr>
      </table>
    </div>
  `;

  const refRow = config.showReferenceRow ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-family:'Cairo','Tahoma',Arial;">
      <tr>
        <td style="text-align:right;font-size:11pt;font-weight:bold;direction:rtl;">${escapeHtml(config.referenceNumberText)} ${year}</td>
        <td style="text-align:left;font-size:11pt;font-weight:bold;direction:rtl;">${escapeHtml(config.dateLocationText)} ${dateStr}</td>
      </tr>
    </table>
  ` : "";

  const divider = config.showDivider
    ? `<hr style="border:${config.dividerWidth || 2}px solid ${config.dividerColor || "#0f766e"};margin:5px 0 15px 0;" />`
    : "";

  return `
    ${headerTable}
    ${refRow}
    ${divider}
    <h2 style="text-align:center;font-size:14pt;font-weight:bold;color:#0f766e;margin:10px 0 20px;font-family:'Cairo','Tahoma',Arial;">${escapeHtml(title)}</h2>
  `;
}

async function exportWord(type: string, sigs: string[] = [], enteteConfig: EnteteConfig = DEFAULT_ENTETE_CONFIG, origin: string = "", filters: ExportFilters = { club: {}, sub: {}, att: {}, ren: {} }, compoundParams?: { year?: string | null; month?: string | null }) {
  const queryType = TYPE_ALIASES[type] || type;
  const today = new Date();
  const year = today.getFullYear();
  const dateStr = formatDate(today);

  const title = FULL_TITLE_MAP[type] || type;

  let tableHeaders = "";
  let tableRows = "";

  if (queryType === "subscribers") {
    const subs = await db.subscriber.findMany({ where: filters.sub, orderBy: { createdAt: "asc" } });
    tableHeaders = "<th>#</th><th>رقم الملف</th><th>اللقب</th><th>الاسم</th><th>تاريخ الميلاد</th><th>الجنس</th><th>العمر</th><th>فصيلة الدم</th><th>نوع الاشتراك</th><th>تاريخ آخر دفعة</th><th>تاريخ الانتهاء</th><th>حالة الدفع</th><th>رسوم الاشتراك</th><th>مصاريف التأمين</th><th>حقوق المركب</th><th>المبلغ الإجمالي</th><th>حالة التجديد</th>";
    tableRows = subs.map((s, i) => {
      const c = computeSubscriberFields(s);
      return `<tr>
        <td style="text-align:center;">${i + 1}</td>
        <td style="text-align:center;font-family:monospace;">${s.fileNumber}</td>
        <td>${s.lastName}</td>
        <td>${s.firstName}</td>
        <td style="text-align:center;">${formatDate(new Date(s.birthDate))}</td>
        <td style="text-align:center;">${s.gender}</td>
        <td style="text-align:center;">${c.age}</td>
        <td style="text-align:center;">${s.bloodType || "—"}</td>
        <td style="text-align:center;">${s.subscriptionType}</td>
        <td style="text-align:center;">${s.lastPaymentDate ? formatDate(new Date(s.lastPaymentDate)) : "—"}</td>
        <td style="text-align:center;">${c.expiryDate ? formatDate(new Date(c.expiryDate)) : "—"}</td>
        <td style="text-align:center;">${s.paymentStatus}</td>
        <td style="text-align:center;">${c.subscriptionFee ?? "—"}</td>
        <td style="text-align:center;">${c.insuranceFee ?? "—"}</td>
        <td style="text-align:center;">${c.compoundRights ?? "—"}</td>
        <td style="text-align:center;font-weight:bold;">${c.totalAmount ?? "—"}</td>
        <td style="text-align:center;">${c.renewalStatus}</td>
      </tr>`;
    }).join("");
  } else if (queryType === "insurance") {
    // Insurance list: only (اللقب، الاسم، تاريخ الميلاد) per user requirement
    const subs = await db.subscriber.findMany({ where: filters.sub, orderBy: { createdAt: "asc" } });
    const computed = subs.map((s) => ({ ...s, ...computeSubscriberFields(s) })).filter((s) => s.insuranceFee !== null && s.insuranceFee > 0);
    tableHeaders = "<th>#</th><th>اللقب</th><th>الاسم</th><th>تاريخ الميلاد</th>";
    tableRows = computed.map((s, i) => `<tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${s.lastName}</td>
      <td>${s.firstName}</td>
      <td style="text-align:center;">${formatDate(new Date(s.birthDate))}</td>
    </tr>`).join("");
  } else if (queryType === "compound") {
    // ★ Compound rights list (Word) — same logic as Excel/PDF: merge new + renewals with dedup
    const startDate = compoundParams?.year && compoundParams?.month
      ? new Date(parseInt(compoundParams.year), parseInt(compoundParams.month) - 1, 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = compoundParams?.year && compoundParams?.month
      ? new Date(parseInt(compoundParams.year), parseInt(compoundParams.month), 0, 23, 59, 59)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    // 1) التسجيلات الجديدة
    const newSubs = await db.subscriber.findMany({
      where: { ...filters.sub, lastPaymentDate: { gte: startDate, lte: endDate } },
      orderBy: { lastPaymentDate: "asc" },
    });
    const computedNew = newSubs
      .map((s) => ({ ...s, ...computeSubscriberFields(s) }))
      .filter((s) => s.compoundRights !== null && s.compoundRights > 0);

    // 2) التجديدات
    const rens = await db.renewal.findMany({
      where: { ...filters.ren, renewalDate: { gte: startDate, lte: endDate } },
      include: { subscriber: true },
      orderBy: { renewalDate: "asc" },
    });
    const renewalEntries = rens
      .filter((r) => r.amount === 1300 || r.amount === 1500)
      .map((r) => {
        const c = computeSubscriberFields(r.subscriber);
        return { ...r.subscriber, ...c };
      });

    // 3) دمج بدون تكرار
    const seenIds = new Set(computedNew.map((s) => s.id));
    const merged = [...computedNew, ...renewalEntries.filter((s) => !seenIds.has(s.id))];
    const totalAmount = merged.length * 1000;
    tableHeaders = "<th>#</th><th>اللقب</th><th>الاسم</th><th>المبلغ (دج)</th>";
    tableRows = merged.map((s, i) => `<tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${s.lastName}</td>
      <td>${s.firstName}</td>
      <td style="text-align:center;font-weight:bold;color:#0369a1;">1000</td>
    </tr>`).join("");
    // Add total row
    tableRows += `<tr style="background:#fef3c7;font-weight:bold;">
      <td colspan="3" style="text-align:center;">المجموع</td>
      <td style="text-align:center;color:#0369a1;">${totalAmount} دج</td>
    </tr>`;
    // Store the "تم تحديد المبلغ بـ:" for this type
    (tableRows as any) += `<!--COMPOUND_TOTAL:${totalAmount}-->`;
  } else if (queryType === "incoming") {
    const subs = await db.subscriber.findMany({ where: filters.sub, orderBy: { createdAt: "asc" } });
    const computed = subs.map((s) => ({ ...s, ...computeSubscriberFields(s) })).filter((s) => s.totalAmount !== null && s.totalAmount > 0);
    tableHeaders = "<th>#</th><th>رقم الملف</th><th>اللقب</th><th>الاسم</th><th>تاريخ الميلاد</th><th>نوع الاشتراك</th><th>حالة الدفع</th><th>المبلغ الإجمالي</th><th>تاريخ الدفعة</th>";
    tableRows = computed.map((s, i) => `<tr>
      <td style="text-align:center;">${i + 1}</td>
      <td style="text-align:center;font-family:monospace;">${s.fileNumber}</td>
      <td>${s.lastName}</td>
      <td>${s.firstName}</td>
      <td style="text-align:center;">${formatDate(new Date(s.birthDate))}</td>
      <td style="text-align:center;">${s.subscriptionType}</td>
      <td style="text-align:center;">${s.paymentStatus}</td>
      <td style="text-align:center;font-weight:bold;">${s.totalAmount} دج</td>
      <td style="text-align:center;">${s.lastPaymentDate ? formatDate(new Date(s.lastPaymentDate)) : "—"}</td>
    </tr>`).join("");
  } else if (queryType === "attendance") {
    const atts = await db.attendance.findMany({ where: filters.att, include: { subscriber: true }, orderBy: { date: "desc" }, take: 500 });
    tableHeaders = "<th>#</th><th>التاريخ</th><th>رقم الملف</th><th>اللقب</th><th>الاسم</th><th>تاريخ الميلاد</th><th>وقت الحضور</th><th>الطريقة</th>";
    tableRows = atts.map((a, i) => `<tr>
      <td style="text-align:center;">${i + 1}</td>
      <td style="text-align:center;">${formatDate(new Date(a.date))}</td>
      <td style="text-align:center;font-family:monospace;">${a.subscriber.fileNumber}</td>
      <td>${a.subscriber.lastName}</td>
      <td>${a.subscriber.firstName}</td>
      <td style="text-align:center;">${formatDate(new Date(a.subscriber.birthDate))}</td>
      <td style="text-align:center;">${new Date(a.checkInTime).toLocaleTimeString("ar-DZ")}</td>
      <td style="text-align:center;">${a.method === "qr" ? "QR" : "يدوي"}</td>
    </tr>`).join("");
  } else if (queryType === "renewals") {
    const rens = await db.renewal.findMany({ where: filters.ren, include: { subscriber: true }, orderBy: { createdAt: "desc" } });
    tableHeaders = "<th>#</th><th>التاريخ</th><th>رقم الملف</th><th>اللقب</th><th>الاسم</th><th>تاريخ الميلاد</th><th>عدد الأشهر</th><th>تاريخ الانتهاء</th><th>المبلغ</th><th>حالة الدفع</th>";
    tableRows = rens.map((r, i) => `<tr>
      <td style="text-align:center;">${i + 1}</td>
      <td style="text-align:center;">${formatDate(new Date(r.renewalDate))}</td>
      <td style="text-align:center;font-family:monospace;">${r.subscriber.fileNumber}</td>
      <td>${r.subscriber.lastName}</td>
      <td>${r.subscriber.firstName}</td>
      <td style="text-align:center;">${formatDate(new Date(r.subscriber.birthDate))}</td>
      <td style="text-align:center;">${r.months}</td>
      <td style="text-align:center;">${formatDate(new Date(r.expiryDate))}</td>
      <td style="text-align:center;font-weight:bold;">${r.amount} دج</td>
      <td style="text-align:center;">${r.paymentStatus}</td>
    </tr>`).join("");
  } else if (queryType === "financial") {
    const subs = await db.subscriber.findMany({ where: filters.sub });
    const computed = subs.map((s) => ({ ...s, ...computeSubscriberFields(s) }));
    const paid = computed.filter((s) => !isExemptStatus(s.paymentStatus) && s.paymentStatus !== "لم يدفع");
    tableHeaders = "<th>#</th><th>رقم الملف</th><th>اللقب والاسم</th><th>تاريخ الميلاد</th><th>نوع الاشتراك</th><th>رسوم الاشتراك</th><th>مصاريف التأمين</th><th>حقوق المركب</th><th>المبلغ الإجمالي</th>";
    tableRows = paid.map((s, i) => `<tr>
      <td style="text-align:center;">${i + 1}</td>
      <td style="text-align:center;font-family:monospace;">${s.fileNumber}</td>
      <td>${s.lastName} ${s.firstName}</td>
      <td style="text-align:center;">${formatDate(new Date(s.birthDate))}</td>
      <td style="text-align:center;">${s.subscriptionType}</td>
      <td style="text-align:center;">${s.subscriptionFee ?? 0} دج</td>
      <td style="text-align:center;">${s.insuranceFee ?? 0} دج</td>
      <td style="text-align:center;">${s.compoundRights ?? 0} دج</td>
      <td style="text-align:center;font-weight:bold;color:#0f766e;">${s.totalAmount ?? 0} دج</td>
    </tr>`).join("");
    // Add total row
    tableRows += `<tr style="background:#fef3c7;font-weight:bold;">
      <td colspan="5" style="text-align:center;">المجموع الإجمالي</td>
      <td style="text-align:center;">${paid.reduce((s, x) => s + (x.subscriptionFee ?? 0), 0)} دج</td>
      <td style="text-align:center;">${paid.reduce((s, x) => s + (x.insuranceFee ?? 0), 0)} دج</td>
      <td style="text-align:center;">${paid.reduce((s, x) => s + (x.compoundRights ?? 0), 0)} دج</td>
      <td style="text-align:center;color:#0f766e;">${paid.reduce((s, x) => s + (x.totalAmount ?? 0), 0)} دج</td>
    </tr>`;
  }

  const entete = generateEnteteHTML(title, enteteConfig, origin);
  const sigsHTML = generateSignaturesHTML(sigs);
  // Narrow margins for "incoming" (étroites), normal for others
  const pageMargin = queryType === "incoming" ? "margin: 1.27cm;" : "margin: 15mm;";
  // Compound total amount in words — ★ recompute using same merged list as above
  let compoundTotalText = "";
  if (queryType === "compound") {
    // Extract total from the tableRows comment we stored earlier
    const match = (tableRows as string).match(/<!--COMPOUND_TOTAL:(\d+)-->/);
    const total = match ? parseInt(match[1]) : 0;
    if (total > 0) {
      const amountInWords = numberToArabicWords(total);
      compoundTotalText = `<p style="text-align:right;font-size:12pt;font-weight:bold;margin-top:15px;font-family:'Cairo','Tahoma',Arial;direction:rtl;">تم تحديد المبلغ بـ: <span style="color:#0369a1;">${amountInWords} دينار جزائري (${total.toLocaleString("en-US")} دج)</span></p>`;
    }
    // Clean the comment from tableRows for the final HTML
    tableRows = (tableRows as string).replace(/<!--COMPOUND_TOTAL:\d+-->/, "");
  }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>${title} - نادي RCS</title>
<style>
@page { size: A4 landscape; ${pageMargin} }
body { font-family: 'Cairo', 'Tahoma', Arial, sans-serif; font-size: 10pt; line-height: 1.5; direction: rtl; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; }
th { background-color: #0f766e; color: white; padding: 5px; text-align: center; border: 1px solid #ccc; font-weight: bold; }
td { padding: 4px 5px; border: 1px solid #ccc; }
tr:nth-child(even) { background-color: #f0fdfa; }
</style>
</head>
<body>
${entete}
<table>
<thead><tr>${tableHeaders}</tr></thead>
<tbody>
${tableRows || '<tr><td colspan="20" style="text-align:center;padding:20px;">لا توجد بيانات</td></tr>'}
</tbody>
</table>
${compoundTotalText}
${sigsHTML}

</body>
</html>`;

  const filename = `RCS_${type}_${new Date().toISOString().split("T")[0]}.doc`;
  return new NextResponse(html, {
    headers: {
      // ★ application/msword is the correct MIME for HTML-based .doc files
      // (the previous .docx MIME caused Word to render the file as empty
      // because .docx is a ZIP-based format, not HTML)
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
