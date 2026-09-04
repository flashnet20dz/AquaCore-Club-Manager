import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { computeSubscriberFields, computeSubscriberFieldsDynamic, type Gender, type BloodType, type SubscriptionType, type PaymentStatus, type SwimmingDays, type TimeSlot, type SubscriptionTypeConfig, DEFAULT_TYPES_MAP, normalizePaymentStatus, isExemptStatus } from "@/lib/rcs";
import * as XLSX from "xlsx";

// Parse dates in multiple formats:
// - DD/MM/YYYY (Arabic/French format — most common in Algeria)
// - YYYY/MM/DD (ISO format)
// - YYYY-MM-DD (ISO with dashes)
// - DD-MM-YYYY
// - Excel serial numbers
// - Date objects
function parseDate(value: unknown): Date | null {
  if (!value) return null;

  // Already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Number — Excel serial date (days since 1899-12-30)
  if (typeof value === "number") {
    if (value > 25569 && value < 60000) {
      // Excel serial date
      const ms = (value - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  if (typeof value !== "string") return null;
  const str = value.trim();
  if (!str) return null;

  // Try DD/MM/YYYY or DD-MM-YYYY (Arabic/French format — preferred)
  // Format: day/month/year
  const dmyMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
      const date = new Date(year, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // Try YYYY/MM/DD or YYYY-MM-DD (ISO format)
  // Format: year/month/day
  const ymdMatch = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
      const date = new Date(year, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // Try DD/MM/YY (2-digit year)
  const dmy2Match = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (dmy2Match) {
    const [, d, m, y] = dmy2Match;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    let year = parseInt(y, 10);
    if (year < 50) year += 2000;
    else if (year < 100) year += 1900;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const date = new Date(year, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // Fallback: try Date constructor
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// Format date for display (DD/MM/YYYY — Arabic preferred)
function formatDate(date: Date | null): string {
  if (!date) return "";
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

// 🔑 زيادة مهلة الطلب لتجنب 504 Gateway Timeout
export const maxDuration = 300; // 5 دقائق

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "import")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const dryRun = formData.get("dryRun") === "true";
    const selectedRowsStr = formData.get("selectedRows") as string | null;
    const selectedRows: number[] | null = selectedRowsStr
      ? JSON.parse(selectedRowsStr).map((n: any) => Number(n))
      : null;

    // 🔑 حل مشكلة superadmin: حدد targetClubId
    let targetClubId: string | null = null;
    if (currentUser.role === "superadmin") {
      // superadmin: استخدم targetClubId من form، أو أول نادٍ نشط
      targetClubId = (formData.get("targetClubId") as string) || null;
      if (!targetClubId) {
        const firstClub = await db.club.findFirst({
          where: { status: "active" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        targetClubId = firstClub?.id || null;
      }
    } else {
      targetClubId = currentUser.clubId || null;
    }

    if (!targetClubId) {
      return NextResponse.json({ error: "لم يتم العثور على نادٍ نشط للاستيراد فيه" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "لم يتم رفع أي ملف" }, { status: 400 });
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });

    // Find the data sheet (first sheet or sheet named "بيانات")
    const sheetName = wb.SheetNames.find((n) => n.includes("بيانات")) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      return NextResponse.json({ error: "تعذر العثور على ورقة البيانات" }, { status: 400 });
    }

    // Convert to JSON (header row detection)
    // The Excel file has a title in row 1, headers in row 2, data from row 3
    // sheet_to_json with header:1 returns array of arrays — we find the header row
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: "", raw: true, header: 1 });

    if (allRows.length === 0) {
      return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });
    }

    // Find the header row — it's the row containing "اللقب" and "الاسم"
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(5, allRows.length); i++) {
      const row = allRows[i].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
      if (row.some((c) => c === "اللقب") && row.some((c) => c === "الاسم")) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json({
        error: "تعذر العثور على صف العناوين. تأكد من وجود أعمدة 'اللقب' و 'الاسم'.",
      }, { status: 400 });
    }

    // Build headers from the header row
    const headerRow = allRows[headerRowIndex].map((c) =>
      String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " ")
    );

    // Build rows as objects keyed by header
    const rows: Record<string, unknown>[] = [];
    for (let i = headerRowIndex + 1; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row || row.every((c) => !c || String(c).trim() === "")) continue;
      const obj: Record<string, unknown> = {};
      for (let j = 0; j < headerRow.length; j++) {
        if (headerRow[j]) obj[headerRow[j]] = row[j];
      }
      rows.push(obj);
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });
    }

    // Detect column names (handle various Arabic headers from Excel)
    const findKey = (row: Record<string, unknown>, candidates: string[]): string | null => {
      const keys = Object.keys(row);
      for (const candidate of candidates) {
        // Match exact or contains (normalize whitespace)
        const found = keys.find((k) => {
          const normalized = k.trim().replace(/\s+/g, " ");
          return normalized === candidate || normalized.includes(candidate);
        });
        if (found) return found;
      }
      return null;
    };

    const firstRow = rows[0];
    const lastNameKey = findKey(firstRow, ["اللقب"]);
    const firstNameKey = findKey(firstRow, ["الاسم"]);
    const birthDateKey = findKey(firstRow, ["تاريخ الميلاد", "الميلاد"]);
    const genderKey = findKey(firstRow, ["الجنس"]);
    const bloodTypeKey = findKey(firstRow, ["فصيلة الدم", "فصيلة", "الدم"]);
    const subscriptionTypeKey = findKey(firstRow, ["نوع الاشتراك", "الاشتراك"]);
    const lastPaymentKey = findKey(firstRow, ["تاريخ آخر دفعة", "آخر دفعة", "الدفعة"]);
    const paymentStatusKey = findKey(firstRow, ["حالة الدفع"]);
    const swimmingDaysKey = findKey(firstRow, ["أيام السباحة", "الأيام"]);
    const timeSlotKey = findKey(firstRow, ["التوقيت"]);
    const phoneKey = findKey(firstRow, ["الهاتف", "هاتف", "رقم الهاتف"]);
    // 🔑 دعم استيراد رقم الملف من Excel مباشرةً
    const fileNumberKey = findKey(firstRow, ["رقم الملف", "رقم", "الملف"]);

    if (!lastNameKey || !firstNameKey) {
      return NextResponse.json({
        error: "تعذر العثور على أعمدة اللقب والاسم. تأكد من أن الصف الأول يحتوي على العناوين الصحيحة.",
      }, { status: 400 });
    }

    // Valid values
    const validGenders = ["ذكر", "أنثى"];
    // ★ validPaymentStatuses now includes "معفى" — the import accepts it directly
    // Also accepts via normalization: معفاة, EXEMPT, EXEMPTED (any case)
    const validPaymentStatuses = ["مدفوع", "لم يدفع", "تأمين فقط", "اشتراك 300", "معفى"];
    // جلب جميع أنواع الاشتراك من قاعدة البيانات (نشطة وغير نشطة)
    const dbSubTypesAll = await db.subscriptionType.findMany({
      where: { clubId: targetClubId },
      select: { code: true, name: true, active: true, givesMembershipNumber: true, numberingGroup: true },
    });
    const validSubscriptionTypes = dbSubTypesAll.filter(t => t.active).map((t) => t.code);
    const validBloodTypes = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

    interface ParsedRow {
      row: number;
      lastName: string;
      firstName: string;
      birthDate: Date | null;
      birthDateRaw: string;
      gender: string | null;
      bloodType: string | null;
      subscriptionType: string | null;
      lastPaymentDate: Date | null;
      lastPaymentRaw: string;
      paymentStatus: string | null;
      swimmingDays: string | null;
      timeSlot: string | null;
      phone: string | null;
      fileNumber: string | null;  // 🔑 رقم الملف من Excel (إن وُجد)
      errors: string[];
      // ─── تفاصيل الأخطاء المنظمة لكل صف ───
      errorDetails: Array<{
        type: "critical" | "warning";
        message: string;
        column: string;        // اسم العمود
        columnLabel: string;   // اسم العمود بالعربية
        value: string;         // القيمة الموجودة
        expected?: string;     // القيمة المتوقعة
      }>;
    }

    const parsed: ParsedRow[] = [];
    let errorCount = 0;
    let warnings = 0;

    rows.forEach((row, idx) => {
      const r: ParsedRow = {
        row: idx + 2,
        lastName: String(row[lastNameKey] || "").trim(),
        firstName: String(row[firstNameKey] || "").trim(),
        birthDate: null,
        birthDateRaw: "",
        gender: null,
        bloodType: null,
        subscriptionType: null,
        lastPaymentDate: null,
        lastPaymentRaw: "",
        paymentStatus: null,
        swimmingDays: null,
        timeSlot: null,
        phone: null,
        fileNumber: null,
        errors: [],
        errorDetails: [],
      };

      // ─── helper لإضافة خطأ ───
      const addError = (type: "critical" | "warning", message: string, column: string, columnLabel: string, value: string, expected?: string) => {
        r.errors.push(message);
        r.errorDetails.push({ type, message, column, columnLabel, value, expected });
        if (type === "warning") warnings++;
      };

      if (!r.lastName || !r.firstName) {
        const missing: string[] = [];
        if (!r.lastName) missing.push("اللقب");
        if (!r.firstName) missing.push("الاسم");
        addError("critical", `${missing.join(" و")} فارغ`, missing[0] === "اللقب" ? "lastName" : "firstName", missing.join(" / "), "—", "قيمة غير فارغة");
      }

      // Parse birth date
      if (birthDateKey) {
        const bd = row[birthDateKey];
        r.birthDateRaw = bd ? String(bd) : "";
        r.birthDate = parseDate(bd);
        if (r.birthDate === null && bd && String(bd).trim()) {
          addError("critical", `تاريخ ميلاد غير صالح: "${bd}"`, "birthDate", "تاريخ الميلاد", String(bd), "DD/MM/YYYY أو YYYY/MM/DD");
        } else if (!bd || !String(bd).trim()) {
          addError("critical", "تاريخ الميلاد فارغ", "birthDate", "تاريخ الميلاد", "—", "تاريخ صالح");
        }
      } else {
        addError("critical", "عمود تاريخ الميلاد غير موجود", "birthDate", "تاريخ الميلاد", "—", "العمود مطلوب");
      }

      // Gender — اختياري، افتراضي "ذكر"
      if (genderKey) {
        const g = String(row[genderKey] || "").trim();
        if (validGenders.includes(g)) {
          r.gender = g;
        } else if (g) {
          addError("critical", `جنس غير صالح: "${g}"`, "gender", "الجنس", g, "ذكر / أنثى");
        } else {
          // فارغ = افتراضي ذكر (لا تحذير)
          r.gender = "ذكر";
        }
      } else {
        r.gender = "ذكر";
      }

      // Blood type (اختياري تماماً — لا يؤثر على صلاحية الصف ولا يُصنف كتحذير)
      if (bloodTypeKey) {
        const b = String(row[bloodTypeKey] || "").trim();
        if (b === "" || b === "/") {
          r.bloodType = null;
          // لا نضيف أي تحذير — فصيلة الدم اختيارية
        } else if (validBloodTypes.includes(b)) {
          r.bloodType = b;
        } else {
          r.bloodType = null;
          // لا نضيف أي تحذير — فقط نتجاهل القيمة غير الصالحة
        }
      }

      // Subscription type — "/" دائماً صالح (افتراضي)
      if (subscriptionTypeKey) {
        const t = String(row[subscriptionTypeKey] || "").trim();
        if (t === "" || t === "/" || validSubscriptionTypes.includes(t)) {
          r.subscriptionType = t || "/";
        } else {
          // النوع غير معروف — استخدم "/" كافتراضي بدلاً من خطأ حرج
          r.subscriptionType = "/";
          addError("warning", `نوع اشتراك غير معروف "${t}" — تم استخدام "/"`, "subscriptionType", "نوع الاشتراك", t, "/, " + validSubscriptionTypes.join(", "));
        }
      } else {
        r.subscriptionType = "/";
      }

      // Last payment date — اختياري (لا تحذير عند الفشل)
      if (lastPaymentKey) {
        const lp = row[lastPaymentKey];
        r.lastPaymentRaw = lp ? String(lp) : "";
        if (lp && String(lp).trim()) {
          r.lastPaymentDate = parseDate(lp);
          // إذا فشل التحليل، نتجاهل بهدوء (لا تحذير)
        }
      }

      // Payment status — افتراضي "مدفوع" إذا كانت القيمة غير صالحة
      // ★ Accepts معفى/معفاة/EXEMPT/EXEMPTED → normalizes to "معفى"
      if (paymentStatusKey) {
        const p = String(row[paymentStatusKey] || "").trim();
        const normalized = normalizePaymentStatus(p);
        if (normalized) {
          r.paymentStatus = normalized;
        } else if (p) {
          // قيمة غير معروفة — استخدم "مدفوع" كافتراضي (لا خطأ حرج)
          r.paymentStatus = "مدفوع";
        } else {
          r.paymentStatus = "لم يدفع";
        }
      } else {
        r.paymentStatus = "لم يدفع";
      }

      // Swimming days — اختياري تماماً (لا تحذير)
      if (swimmingDaysKey) {
        r.swimmingDays = String(row[swimmingDaysKey] || "").trim() || null;
      }

      // Time slot — اختياري تماماً (لا تحذير)
      if (timeSlotKey) {
        r.timeSlot = String(row[timeSlotKey] || "").trim() || null;
      }

      // Phone — اختياري تماماً (لا تحذير)
      if (phoneKey) {
        const ph = String(row[phoneKey] || "").trim();
        r.phone = ph || null;
      }

      // 🔑 رقم الملف من Excel (اختياري — إن وُجد يُستخدم مباشرة)
      if (fileNumberKey) {
        const fn = String(row[fileNumberKey] || "").trim();
        r.fileNumber = fn || null;
      }

      if (r.errors.length > 0) errorCount++;
      parsed.push(r);
    });

    // ════ صف صالح = لا أخطاء حرجة (التحذيرات لا تُستبعد الصف) ════
    // سياسة الاستيراد: الصف صالح طالما لا يحتوي على أخطاء حرجة
    // الحقول الاختيارية (هاتف، أيام سباحة، توقيت، جنس) لها قيم افتراضية
    const validRows = parsed.filter((r) => {
      const hasCritical = r.errorDetails.some((e) => e.type === "critical");
      return !hasCritical &&
        r.lastName &&
        r.firstName &&
        r.birthDate;
    });

    // ════ التحقق المالي: مطابقة الرسوم مع ملف المصدر ════
    // اقرأ أعمدة الرسوم من Excel إن وُجدت
    const feeKey = findKey(firstRow, ["رسوم الاشتراك", "رسوم", "الرسوم"]);
    const insuranceFeeKey = findKey(firstRow, ["مصاريف التأمين", "التأمين", "مصاريف"]);
    const totalAmountKey = findKey(firstRow, ["المبلغ الإجمالي", "الإجمالي", "المبلغ"]);
    const compoundRightsKey = findKey(firstRow, ["حقوق المركب", "المركب"]);

    // Compute financial summary for valid rows (verification)
    // ─── تحميل أنواع الاشتراك من قاعدة البيانات (خصائص ديناميكية) ───
    const dbTypes = await db.subscriptionType.findMany({
      where: { clubId: targetClubId },
    });
    const typesMap: Record<string, SubscriptionTypeConfig> = {};
    for (const t of dbTypes) {
      typesMap[t.code] = {
        code: t.code,
        name: t.name,
        subscriptionFee: t.subscriptionFee,
        insuranceFee: t.insuranceFee,
        compoundRights: t.compoundRights,
        durationDays: t.durationDays,
        givesMembershipNumber: t.givesMembershipNumber,
        requiresInsurance: t.requiresInsurance,
        requiresCompoundFee: t.requiresCompoundFee,
        renewableMonthly: t.renewableMonthly,
        freeSubscription: t.freeSubscription,
      };
    }
    // دالة مساعدة للحصول على إعداد النوع (من DB أو fallback)
    const getTypeConfigFor = (code: string): SubscriptionTypeConfig => {
      return typesMap[code] || DEFAULT_TYPES_MAP[code] || DEFAULT_TYPES_MAP["/"];
    };

    const financialCheck = validRows.map((r) => {
      const typeConfig = getTypeConfigFor(r.subscriptionType as string);
      const mockSub = {
        birthDate: r.birthDate!,
        paymentStatus: r.paymentStatus as PaymentStatus,
        subscriptionType: r.subscriptionType as SubscriptionType,
        lastPaymentDate: r.lastPaymentDate,
      };
      const c = computeSubscriberFieldsDynamic(mockSub, typeConfig);

      // ════ التحقق من تطابق الرسوم مع ملف المصدر ════
      let feeMismatch: { sourceFee: number; computedFee: number; difference: number } | null = null;
      if (feeKey) {
        const sourceFee = Number(rows[validRows.indexOf(r)]?.[feeKey] || 0);
        const computedFee = c.subscriptionFee ?? 0;
        if (sourceFee > 0 && sourceFee !== computedFee) {
          feeMismatch = { sourceFee, computedFee, difference: sourceFee - computedFee };
        }
      }

      let insuranceMismatch: { sourceFee: number; computedFee: number; difference: number } | null = null;
      if (insuranceFeeKey) {
        const sourceIns = Number(rows[validRows.indexOf(r)]?.[insuranceFeeKey] || 0);
        const computedIns = c.insuranceFee ?? 0;
        if (sourceIns > 0 && sourceIns !== computedIns) {
          insuranceMismatch = { sourceFee: sourceIns, computedFee: computedIns, difference: sourceIns - computedIns };
        }
      }

      let totalMismatch: { sourceTotal: number; computedTotal: number; difference: number } | null = null;
      if (totalAmountKey) {
        const sourceTotal = Number(rows[validRows.indexOf(r)]?.[totalAmountKey] || 0);
        const computedTotal = c.totalAmount ?? 0;
        if (sourceTotal > 0 && sourceTotal !== computedTotal) {
          totalMismatch = { sourceTotal, computedTotal, difference: sourceTotal - computedTotal };
        }
      }

      return {
        ...r,
        birthDateDisplay: formatDate(r.birthDate),
        lastPaymentDisplay: formatDate(r.lastPaymentDate),
        computed: c,
        expectedCompoundRights: c.compoundRights,
        rightsRule: typeConfig.freeSubscription
          ? "مجاني"
          : (typeConfig.requiresCompoundFee ? `${typeConfig.compoundRights} دج للديوان` : "مستثنى"),
        // 🔑 تعارضات مالية
        feeMismatch,
        insuranceMismatch,
        totalMismatch,
        hasFinancialConflict: !!(feeMismatch || insuranceMismatch || totalMismatch),
      };
    });

    // ════ فصل الصفوف ذات التعارض المالي ════
    const conflictedRows = financialCheck.filter((r) => r.hasFinancialConflict);
    const cleanRows = financialCheck.filter((r) => !r.hasFinancialConflict);

    if (dryRun) {
      // 🔑 بناء Map<row, validRow> لتسريع البحث (تجنب O(n²))
      const financialCheckByRow = new Map(financialCheck.map(r => [r.row, r]));
      // إرجاع جميع الصفوف للمراجعة الكاملة (وليس فقط عينة)
      return NextResponse.json({
        preview: true,
        totalRows: rows.length,
        validRows: cleanRows.length,
        errorRows: errorCount,
        warnings,
        conflictedCount: conflictedRows.length, // 🔑 عدد التعارضات المالية
        financialConflicts: conflictedRows.map((r) => ({
          row: r.row,
          name: `${r.lastName} ${r.firstName}`,
          fileNumber: r.fileNumber || "—",
          feeMismatch: r.feeMismatch,
          insuranceMismatch: r.insuranceMismatch,
          totalMismatch: r.totalMismatch,
        })),
        detectedColumns: {
          lastName: lastNameKey,
          firstName: firstNameKey,
          birthDate: birthDateKey,
          gender: genderKey,
          bloodType: bloodTypeKey,
          subscriptionType: subscriptionTypeKey,
          lastPaymentDate: lastPaymentKey,
          paymentStatus: paymentStatusKey,
          swimmingDays: swimmingDaysKey,
          timeSlot: timeSlotKey,
          phone: phoneKey,
          fileNumber: fileNumberKey,
        },
        // جميع الصفوف الصالحة (وليس عينة فقط)
        sample: financialCheck,
        // جميع الصفوف التي تحتوي على أخطاء
        errorSamples: parsed.filter((r) => r.errors.length > 0),
        // جميع الصفوف مع حالة (صالح/تحذير/خطأ) للمراجعة الكاملة
        allRows: parsed.map((r) => {
          // 🔑 O(1) lookup بدلاً من O(n)
          const validRow = financialCheckByRow.get(r.row);
          // تحديد الحالة بناءً على errorDetails (critical = error, warning = warning)
          const hasCritical = r.errorDetails.some((e) => e.type === "critical");
          const hasWarning = r.errorDetails.some((e) => e.type === "warning");
          return {
            ...r,
            birthDateDisplay: validRow?.birthDateDisplay || formatDate(r.birthDate),
            lastPaymentDisplay: validRow?.lastPaymentDisplay || formatDate(r.lastPaymentDate),
            computed: validRow?.computed || { age: 0, subscriptionFee: null, insuranceFee: null, compoundRights: null, totalAmount: null },
            rightsRule: validRow?.rightsRule || "—",
            status: hasCritical ? "error" : (hasWarning ? "warning" : "valid"),
            // الاحتفاظ بـ warnings قديم للتوافق
            warnings: r.errorDetails.filter((e) => e.type === "warning").map((e) => e.message),
          };
        }),
        summary: {
          totalFees: financialCheck.reduce((s, r) => s + (r.computed.subscriptionFee ?? 0), 0),
          totalInsurance: financialCheck.reduce((s, r) => s + (r.computed.insuranceFee ?? 0), 0),
          totalCompound: financialCheck.reduce((s, r) => s + (r.computed.compoundRights ?? 0), 0),
          totalRevenue: financialCheck.reduce((s, r) => s + (r.computed.totalAmount ?? 0), 0),
          // ★ Count exempt subscribers detected in the import preview
          exemptCount: financialCheck.filter((r) => isExemptStatus(r.paymentStatus)).length,
        },
        // 🔑 معاينة ورقة التجديد
        renewalPreview: analyzeRenewalSheet(wb),
      });
    }

    // Actually import — use batch insert for performance
    const clubFilter = { clubId: targetClubId };
    const existingCount = await db.subscriber.count({ where: clubFilter });

    // فلترة الصفوف الصالحة حسب التحديد (إن وجد) — تستبعد المتعارضة مالياً
    const rowsToImport = selectedRows
      ? cleanRows.filter((r) => selectedRows.includes(r.row))
      : cleanRows;

    // ═══ منع التكرار: جلب جميع المنخرطين الحاليين للمقارنة ═══
    const existingSubscribers = await db.subscriber.findMany({
      where: { clubId: targetClubId },
      select: { id: true, fileNumber: true, lastName: true, firstName: true, birthDate: true },
    });

    // إنشاء قائمة بمفاتيح فريدة للمقارنة (اللقب + الاسم + تاريخ الميلاد)
    const existingKeys = new Set(
      existingSubscribers.map(s =>
        `${s.lastName.trim().toLowerCase()}|${s.firstName.trim().toLowerCase()}|${new Date(s.birthDate).toISOString().split("T")[0]}`
      )
    );
    // أيضاً قائمة بأرقام الملفات الموجودة
    const existingFileNumbers = new Set(existingSubscribers.map(s => s.fileNumber));

    // تصفية الصفوف: استبعاد المكررين الموجودين مسبقاً
    const newRows: typeof rowsToImport = [];
    const duplicateRows: { row: number; name: string; reason: string }[] = [];
    // 🔑 قائمة بالمنخرطين الموجودين مسبقاً لتحديثهم (upsert) بدلاً من تجاهلهم
    const existingToUpdate: { row: typeof rowsToImport[0]; existingId: string }[] = [];

    for (const r of rowsToImport) {
      const key = `${r.lastName.trim().toLowerCase()}|${r.firstName.trim().toLowerCase()}|${r.birthDate ? new Date(r.birthDate).toISOString().split("T")[0] : ""}`;
      // 🔑 فحص تكرار رقم الملف — حدّث المنخرط الموجود بدلاً من تجاهله
      if (r.fileNumber && existingFileNumbers.has(r.fileNumber.trim())) {
        // ابحث عن ID المنخرط الموجود
        const existingSub = existingSubscribers.find(s => s.fileNumber === (r.fileNumber?.trim() || ""));
        if (existingSub) {
          existingToUpdate.push({ row: r, existingId: existingSub.id });
        } else {
          duplicateRows.push({
            row: r.row,
            name: `${r.lastName} ${r.firstName}`,
            reason: `رقم الملف "${r.fileNumber}" موجود مسبقاً`,
          });
        }
      } else if (existingKeys.has(key)) {
        duplicateRows.push({
          row: r.row,
          name: `${r.lastName} ${r.firstName}`,
          reason: "منخرط موجود مسبقاً (نفس الاسم وتاريخ الميلاد)",
        });
      } else {
        newRows.push(r);
        // إضافة المفتاح للقائمة لمنع التكرار داخل نفس الملف
        existingKeys.add(key);
        // 🔑 أضف رقم الملف أيضاً لمنع تكراره في نفس الملف
        if (r.fileNumber) existingFileNumbers.add(r.fileNumber.trim());
      }
    }

    // Build all records — استخدام numberingGroup للترقيم
    // عداد مستقل لكل مجموعة
    const groupCounters: Record<string, number> = {};

    // حساب العدادات الحالية من قاعدة البيانات لكل مجموعة
    for (const sub of existingSubscribers) {
      const match = sub.fileNumber.match(/^([A-Za-z*]+)/);
      if (match) {
        const prefix = match[1];
        const numMatch = sub.fileNumber.match(/(\d+)$/);
        if (numMatch) {
          const num = parseInt(numMatch[1]);
          if (!groupCounters[prefix] || groupCounters[prefix] < num) {
            groupCounters[prefix] = num;
          }
        }
      }
    }

    const records = newRows.map((r) => {
      const typeConfig = dbSubTypesAll.find(t => t.code === r.subscriptionType);
      const givesMembership = typeConfig ? typeConfig.givesMembershipNumber : true;

      let fileNumber: string;
      // 🔑 استخدم رقم الملف من Excel إن وُجد
      if (r.fileNumber && r.fileNumber.trim()) {
        fileNumber = r.fileNumber.trim();
      } else if (typeConfig && !givesMembership) {
        // النوع لا يمنح رقم عضوية — استخدم الكود نفسه (مثل MJ)
        fileNumber = r.subscriptionType || "**";
      } else {
        // النوع يمنح رقم عضوية — استخدم numberingGroup + عداد
        const group = typeConfig?.numberingGroup || "RCS";
        if (!groupCounters[group]) groupCounters[group] = 0;
        groupCounters[group]++;
        fileNumber = `${group}${String(groupCounters[group]).padStart(3, "0")}`;
      }

      return {
        clubId: targetClubId,
        fileNumber,
        lastName: r.lastName,
        firstName: r.firstName,
        birthDate: r.birthDate!,
        gender: (r.gender || "ذكر") as Gender,
        bloodType: (r.bloodType as BloodType) || null,
        subscriptionType: (r.subscriptionType || "/") as SubscriptionType,
        lastPaymentDate: r.lastPaymentDate,
        paymentStatus: (r.paymentStatus || "لم يدفع") as PaymentStatus,
        swimmingDays: (r.swimmingDays as SwimmingDays) || null,
        timeSlot: (r.timeSlot as TimeSlot) || null,
        phone: r.phone,
      };
    });

    let imported = 0;
    let skipped = 0;
    // ★ Track how many exempt subscribers were imported
    let exemptImported = 0;
    const importErrors: { row: number; name: string; error: string }[] = [];

    // ═══ المرحلة 2: إنشاء المنخرطين — إدراج دفعة (batched createMany) ═══
    // 🔑 نستخدم createMany في دفعات من 100 صف لكل دفعة (بدلاً من إدراج فردي)
    // هذا يقلل عدد round-trips إلى DB بـ 100x، مما يسرّع الاستيراد بشكل كبير.
    // skipDuplicates يضمن عدم فشل الدفعة بأكملها إذا كان هناك تكرار.
    const CREATE_BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += CREATE_BATCH_SIZE) {
      const batch = records.slice(i, i + CREATE_BATCH_SIZE);
      const batchRows = newRows.slice(i, i + CREATE_BATCH_SIZE);
      try {
        const result = await db.subscriber.createMany({
          data: batch as any,
          skipDuplicates: true,
        });
        imported += result.count;
        // ★ Count exempt imports in this batch
        for (const r of batchRows) {
          if (isExemptStatus(r.paymentStatus)) exemptImported++;
        }
      } catch (batchErr) {
        // فشل الدفعة بأكملها — عدّها كأخطاء وواصل
        const errMsg = batchErr instanceof Error ? batchErr.message : "خطأ في الدفعة";
        for (let j = 0; j < batchRows.length; j++) {
          const r = batchRows[j];
          // جرّب إدراج فردي لمعرفة الصف المسبب
          try {
            await db.subscriber.create({ data: batch[j] as any });
            imported++;
            if (isExemptStatus(r.paymentStatus)) exemptImported++;
          } catch (e2) {
            skipped++;
            importErrors.push({
              row: r.row,
              name: `${r.lastName} ${r.firstName} (${r.fileNumber || "بدون رقم"})`,
              error: e2 instanceof Error ? e2.message : errMsg,
            });
          }
        }
      }
    }

    // ═══ المرحلة 2.5: تحديث المنخرطين الموجودين (upsert) — بدفعات متوازية ═══
    // 🔑 بدلاً من تجاهل المكررات، حدّث بياناتهم من Excel
    // نستخدم Promise.all بحد تزامن 10 لتحديث عدة صفوف في وقت واحد.
    let updated = 0;
    const UPDATE_CONCURRENCY = 10;
    for (let i = 0; i < existingToUpdate.length; i += UPDATE_CONCURRENCY) {
      const chunk = existingToUpdate.slice(i, i + UPDATE_CONCURRENCY);
      const results = await Promise.allSettled(chunk.map(async ({ row: r, existingId }) => {
        await db.subscriber.update({
          where: { id: existingId },
          data: {
            lastName: r.lastName,
            firstName: r.firstName,
            birthDate: r.birthDate!,
            gender: (r.gender || "ذكر") as Gender,
            bloodType: (r.bloodType as BloodType) || null,
            subscriptionType: (r.subscriptionType || "/") as SubscriptionType,
            lastPaymentDate: r.lastPaymentDate,
            paymentStatus: (r.paymentStatus || "لم يدفع") as PaymentStatus,
            swimmingDays: (r.swimmingDays as SwimmingDays) || null,
            timeSlot: (r.timeSlot as TimeSlot) || null,
            phone: r.phone,
          },
        });
        return r;
      }));
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          updated++;
          imported++; // عدّ المحديثين ضمن المستوردين
          // ★ Count exempt among updates
          if (isExemptStatus(result.value.paymentStatus)) exemptImported++;
        } else {
          skipped++;
          const r = chunk[j].row;
          importErrors.push({
            row: r.row,
            name: `${r.lastName} ${r.firstName}`,
            error: result.reason instanceof Error ? result.reason.message : "فشل التحديث",
          });
        }
      }
    }

    // ═══ المرحلة 3: انتظر حتى تُعكس المنخرطين في DB، ثم اجلب IDs ═══
    // 🔑 نحتاج IDs الفعلية للمنخرطين المستوردين حديثاً لربط التجديدات
    let renewalsImported = 0;
    let renewalsSkipped = 0;
    const renewalErrors: { row: number; name: string; error: string }[] = [];

    const renewalSheetName = wb.SheetNames.find((n) => n.includes("التجديد"));
    if (renewalSheetName && imported > 0) {
      try {
        // 🔑 لا حاجة لانتظار 500ms — createMany التزامني ينعكس فوراً في DB.

        // 🔑 اجلب IDs للمنخرطين المستوردين حديثاً فقط (بأرقام ملفاتهم)
        const newFileNumbers = records.map(r => r.fileNumber);
        const newlyCreatedSubs = await db.subscriber.findMany({
          where: {
            clubId: targetClubId,
            fileNumber: { in: newFileNumbers },
          },
          select: { id: true, fileNumber: true },
        });
        const fileNumberToId = new Map<string, string>();
        // أضف الموجودين مسبقاً
        for (const s of existingSubscribers) {
          fileNumberToId.set(s.fileNumber, s.id);
        }
        // أضف المستوردين حديثاً
        for (const s of newlyCreatedSubs) {
          fileNumberToId.set(s.fileNumber, s.id);
        }

        // اقرأ ورقة التجديد
        const renewalWs = wb.Sheets[renewalSheetName];
        const renewalAllRows = XLSX.utils.sheet_to_json<unknown[]>(renewalWs, { defval: "", raw: true, header: 1 });

        let renewalHeaderIdx = -1;
        for (let i = 0; i < Math.min(5, renewalAllRows.length); i++) {
          const row = renewalAllRows[i].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
          if (row.some((c) => c === "رقم الملف") && row.some((c) => c.includes("تاريخ التجديد") || c.includes("التجديد"))) {
            renewalHeaderIdx = i;
            break;
          }
        }

        if (renewalHeaderIdx >= 0) {
          const renewalHeaderRow = renewalAllRows[renewalHeaderIdx].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
          const renewalRows: Record<string, unknown>[] = [];
          for (let i = renewalHeaderIdx + 1; i < renewalAllRows.length; i++) {
            const row = renewalAllRows[i];
            if (!row || row.every((c) => !c || String(c).trim() === "")) continue;
            const obj: Record<string, unknown> = {};
            for (let j = 0; j < renewalHeaderRow.length; j++) {
              if (renewalHeaderRow[j]) obj[renewalHeaderRow[j]] = row[j];
            }
            renewalRows.push(obj);
          }

          const findRenewalKey = (row: Record<string, unknown>, candidates: string[]): string | null => {
            const keys = Object.keys(row);
            for (const candidate of candidates) {
              const found = keys.find((k) => {
                const normalized = k.trim().replace(/\s+/g, " ");
                return normalized === candidate || normalized.includes(candidate);
              });
              if (found) return found;
            }
            return null;
          };

          if (renewalRows.length > 0) {
            const firstRenewalRow = renewalRows[0];
            const fnKey = findRenewalKey(firstRenewalRow, ["رقم الملف", "رقم"]);
            const renewalDateKey = findRenewalKey(firstRenewalRow, ["تاريخ التجديد", "التجديد"]);
            const amountKey = findRenewalKey(firstRenewalRow, ["مبلغ التجديد", "المبلغ", "مبلغ"]);
            const paymentStatusKeyR = findRenewalKey(firstRenewalRow, ["حالة الدفع", "الدفع"]);
            const renewalStatusKey = findRenewalKey(firstRenewalRow, ["حالة التجديد", "الحالة"]);

            if (fnKey) {
              const renewalRecords: any[] = [];
              for (let i = 0; i < renewalRows.length; i++) {
                const row = renewalRows[i];
                const fileNumber = String(row[fnKey] || "").trim();
                if (!fileNumber) { renewalsSkipped++; continue; }

                const renewalDateRaw = renewalDateKey ? row[renewalDateKey] : null;
                if (!renewalDateRaw || !String(renewalDateRaw).trim()) {
                  renewalsSkipped++;
                  continue;
                }

                // 🔑 تأكد أن المنخرط موجود قبل إنشاء التجديد
                const subId = fileNumberToId.get(fileNumber);
                if (!subId) {
                  renewalsSkipped++;
                  continue;
                }

                const renewalDate = parseDate(renewalDateRaw);
                if (!renewalDate) { renewalsSkipped++; continue; }

                const amount = amountKey ? Number(row[amountKey] || 0) : 0;
                const paymentStatus = paymentStatusKeyR ? String(row[paymentStatusKeyR] || "مدفوع") : "مدفوع";
                const renewalStatus = renewalStatusKey ? String(row[renewalStatusKey] || "") : "";

                const expiryDate = new Date(renewalDate);
                expiryDate.setDate(expiryDate.getDate() + 30);

                renewalRecords.push({
                  clubId: targetClubId,
                  subscriberId: subId,
                  renewalDate,
                  expiryDate,
                  months: 1,
                  amount,
                  paymentStatus,
                  note: renewalStatus || null,
                });
              }

              // إدراج التجديدات على دفعات
              const RENEWAL_BATCH_SIZE = 500;
              for (let i = 0; i < renewalRecords.length; i += RENEWAL_BATCH_SIZE) {
                const batch = renewalRecords.slice(i, i + RENEWAL_BATCH_SIZE);
                try {
                  const result = await db.renewal.createMany({ data: batch, skipDuplicates: true });
                  renewalsImported += result.count;
                } catch (e) {
                  console.warn(`Renewal batch ${i / RENEWAL_BATCH_SIZE + 1} failed:`, e);
                  renewalsSkipped += batch.length;
                }
              }
            }
          }
        }
      } catch (renewalErr) {
        console.error("Renewal import error:", renewalErr);
        // 🔑 لا نرجع 500 هنا — الاستيراد الرئيسي نجح، التجديدات فشلت جزئياً
      }
    }

    // Log activity
    await db.activity.create({
      data: {
        clubId: targetClubId,
        type: "import",
        description: `تم استيراد ${imported} منخرط (${updated} محدّث) و ${renewalsImported} تجديد، ${duplicateRows.length} مكرر تم تجاهله`,
      },
    });

    // 🔑 إذا فشل الاستيراد بالكامل (0 منخرط + أخطاء)، أرجع 500
    if (imported === 0 && importErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: `فشل الاستيراد: ${importErrors.length} خطأ. أول خطأ: ${importErrors[0]?.error || "غير معروف"}`,
        errors: importErrors.slice(0, 50),
        totalRows: rows.length,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      // ★ Report exempt count in import results
      exemptImported,
      duplicates: duplicateRows.length,
      duplicateDetails: duplicateRows.slice(0, 50),
      // 🔑 التعارضات المالية (لم تُستورد — تحتاج مراجعة يدوية)
      conflictedCount: conflictedRows.length,
      financialConflicts: conflictedRows.map((r) => ({
        row: r.row,
        name: `${r.lastName} ${r.firstName}`,
        feeMismatch: r.feeMismatch,
        insuranceMismatch: r.insuranceMismatch,
        totalMismatch: r.totalMismatch,
      })).slice(0, 50),
      // 🔑 إحصائيات التجديدات
      renewalsImported,
      renewalsSkipped,
      renewalErrors: renewalErrors.slice(0, 50),
      totalRows: rows.length,
      errors: importErrors,
    });
  } catch (e) {
    console.error("Import error:", e);
    return NextResponse.json({ error: "خطأ داخلي: " + (e instanceof Error ? e.message : "") }, { status: 500 });
  }
}

// ═══ تحليل ورقة التجديد للمعاينة (dryRun) ═══
function analyzeRenewalSheet(wb: XLSX.WorkBook): {
  found: boolean;
  totalRows: number;
  renewedCount: number;
  sample: Array<{ fileNumber: string; name: string; renewalDate: string | null; amount: number; status: string }>;
} {
  const sheetName = wb.SheetNames.find((n) => n.includes("التجديد"));
  if (!sheetName) {
    return { found: false, totalRows: 0, renewedCount: 0, sample: [] };
  }
  const ws = wb.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: "", raw: true, header: 1 });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, allRows.length); i++) {
    const row = allRows[i].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
    if (row.some((c) => c === "رقم الملف") && row.some((c) => c.includes("تاريخ التجديد") || c.includes("التجديد"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return { found: true, totalRows: 0, renewedCount: 0, sample: [] };
  }

  const headerRow = allRows[headerIdx].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
  const findKey = (candidates: string[]): string | null => {
    for (const candidate of candidates) {
      const found = headerRow.find((k) => k === candidate || k.includes(candidate));
      if (found) return found;
    }
    return null;
  };

  const fnKey = findKey(["رقم الملف", "رقم"]);
  const lastNameKey = findKey(["اللقب"]);
  const firstNameKey = findKey(["الاسم"]);
  const renewalDateKey = findKey(["تاريخ التجديد", "التجديد"]);
  const amountKey = findKey(["مبلغ التجديد", "المبلغ", "مبلغ"]);
  const statusKey = findKey(["حالة التجديد", "الحالة"]);

  if (!fnKey) {
    return { found: true, totalRows: 0, renewedCount: 0, sample: [] };
  }

  const fnIdx = headerRow.indexOf(fnKey);
  const lnIdx = lastNameKey ? headerRow.indexOf(lastNameKey) : -1;
  const fn2Idx = firstNameKey ? headerRow.indexOf(firstNameKey) : -1;
  const rdIdx = renewalDateKey ? headerRow.indexOf(renewalDateKey) : -1;
  const amIdx = amountKey ? headerRow.indexOf(amountKey) : -1;
  const stIdx = statusKey ? headerRow.indexOf(statusKey) : -1;

  let totalRows = 0;
  let renewedCount = 0;
  const sample: any[] = [];

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.every((c) => !c || String(c).trim() === "")) continue;
    totalRows++;
    const fileNumber = String(row[fnIdx] || "").trim();
    if (!fileNumber) continue;
    const renewalDateRaw = rdIdx >= 0 ? row[rdIdx] : null;
    const hasRenewal = renewalDateRaw && String(renewalDateRaw).trim();
    if (hasRenewal) renewedCount++;
    if (sample.length < 5) {
      sample.push({
        fileNumber,
        name: `${lnIdx >= 0 ? String(row[lnIdx] || "") : ""} ${fn2Idx >= 0 ? String(row[fn2Idx] || "") : ""}`.trim(),
        renewalDate: hasRenewal ? String(renewalDateRaw) : null,
        amount: amIdx >= 0 ? Number(row[amIdx] || 0) : 0,
        status: stIdx >= 0 ? String(row[stIdx] || "") : "",
      });
    }
  }

  return { found: true, totalRows, renewedCount, sample };
}
