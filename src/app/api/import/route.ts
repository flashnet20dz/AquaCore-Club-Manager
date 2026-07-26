import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { computeSubscriberFields, computeSubscriberFieldsDynamic, type Gender, type BloodType, type SubscriptionType, type PaymentStatus, type SwimmingDays, type TimeSlot, type SubscriptionTypeConfig, DEFAULT_TYPES_MAP } from "@/lib/rcs";
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
      targetClubId = currentUser.clubId;
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
    const validPaymentStatuses = ["مدفوع", "لم يدفع", "تأمين فقط", "اشتراك 300"];
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

      // Gender
      if (genderKey) {
        const g = String(row[genderKey] || "").trim();
        if (validGenders.includes(g)) {
          r.gender = g;
        } else if (g) {
          addError("critical", `جنس غير صالح: "${g}"`, "gender", "الجنس", g, "ذكر / أنثى");
        } else {
          addError("warning", "الجنس غير محدد", "gender", "الجنس", "—", "ذكر / أنثى");
        }
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

      // Subscription type
      if (subscriptionTypeKey) {
        const t = String(row[subscriptionTypeKey] || "").trim();
        if (t === "" || validSubscriptionTypes.includes(t)) {
          r.subscriptionType = t || "/";
        } else {
          addError("critical", `نوع اشتراك غير صالح: "${t}"`, "subscriptionType", "نوع الاشتراك", t, "/, OPOW, DJS, FCS, RCS, POLICE, MJ");
        }
      } else {
        r.subscriptionType = "/";
      }

      // Last payment date
      if (lastPaymentKey) {
        const lp = row[lastPaymentKey];
        r.lastPaymentRaw = lp ? String(lp) : "";
        if (lp && String(lp).trim()) {
          r.lastPaymentDate = parseDate(lp);
          if (r.lastPaymentDate === null) {
            addError("warning", `تاريخ دفعة غير صالح: "${lp}"`, "lastPaymentDate", "تاريخ آخر دفعة", String(lp), "DD/MM/YYYY أو YYYY/MM/DD");
          }
        }
      }

      // Payment status
      if (paymentStatusKey) {
        const p = String(row[paymentStatusKey] || "").trim();
        if (validPaymentStatuses.includes(p)) {
          r.paymentStatus = p;
        } else if (p) {
          addError("critical", `حالة دفع غير صالحة: "${p}"`, "paymentStatus", "حالة الدفع", p, "مدفوع / لم يدفع / تأمين فقط / اشتراك 300");
        } else {
          r.paymentStatus = "لم يدفع";
        }
      } else {
        r.paymentStatus = "لم يدفع";
      }

      // Swimming days (warning if missing)
      if (swimmingDaysKey) {
        r.swimmingDays = String(row[swimmingDaysKey] || "").trim() || null;
        if (!r.swimmingDays) {
          addError("warning", "أيام السباحة غير معرفة", "swimmingDays", "أيام السباحة", "—", "مثال: الأحد والأربعاء");
        }
      }

      // Time slot (warning if missing)
      if (timeSlotKey) {
        r.timeSlot = String(row[timeSlotKey] || "").trim() || null;
        if (!r.timeSlot) {
          addError("warning", "التوقيت غير موجود", "timeSlot", "التوقيت", "—", "مثال: 10:00-11:00");
        }
      }

      // Phone (warning if missing or invalid)
      if (phoneKey) {
        const ph = String(row[phoneKey] || "").trim();
        r.phone = ph || null;
        if (!ph) {
          addError("warning", "رقم الهاتف غير موجود", "phone", "الهاتف", "—", "رقم هاتف صالح");
        } else if (!/^[\d\s+\-()]{8,}$/.test(ph)) {
          addError("warning", `رقم هاتف غير صالح: "${ph}"`, "phone", "الهاتف", ph, "أرقام فقط مع + و -");
        }
      }

      // 🔑 رقم الملف من Excel (اختياري — إن وُجد يُستخدم مباشرة)
      if (fileNumberKey) {
        const fn = String(row[fileNumberKey] || "").trim();
        r.fileNumber = fn || null;
      }

      if (r.errors.length > 0) errorCount++;
      parsed.push(r);
    });

    // Filter valid rows — صف صالح = لا أخطاء حرجة (التحذيرات مقبولة)
    const validRows = parsed.filter((r) =>
      r.errorDetails.filter((e) => e.type === "critical").length === 0 &&
      r.lastName &&
      r.firstName &&
      r.birthDate
    );

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
      // استخدام الدالة الديناميكية مع إعداد النوع من قاعدة البيانات
      const c = computeSubscriberFieldsDynamic(mockSub, typeConfig);
      return {
        ...r,
        birthDateDisplay: formatDate(r.birthDate),
        lastPaymentDisplay: formatDate(r.lastPaymentDate),
        computed: c,
        expectedCompoundRights: c.compoundRights,
        rightsRule: typeConfig.freeSubscription
          ? "مجاني"
          : (typeConfig.requiresCompoundFee ? `${typeConfig.compoundRights} دج للديوان` : "مستثنى"),
      };
    });

    if (dryRun) {
      // إرجاع جميع الصفوف للمراجعة الكاملة (وليس فقط عينة)
      return NextResponse.json({
        preview: true,
        totalRows: rows.length,
        validRows: validRows.length,
        errorRows: errorCount,
        warnings,
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
          // إذا كان صالحاً، أضف البيانات المالية المحسوبة
          const validRow = financialCheck.find((v) => v.row === r.row);
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
        },
      });
    }

    // Actually import — use batch insert for performance
    const clubFilter = { clubId: targetClubId };
    const existingCount = await db.subscriber.count({ where: clubFilter });

    // فلترة الصفوف الصالحة حسب التحديد (إن وجد)
    const rowsToImport = selectedRows
      ? validRows.filter((r) => selectedRows.includes(r.row))
      : validRows;

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

    for (const r of rowsToImport) {
      const key = `${r.lastName.trim().toLowerCase()}|${r.firstName.trim().toLowerCase()}|${r.birthDate ? new Date(r.birthDate).toISOString().split("T")[0] : ""}`;
      // 🔑 فحص تكرار رقم الملف أيضاً
      if (r.fileNumber && existingFileNumbers.has(r.fileNumber.trim())) {
        duplicateRows.push({
          row: r.row,
          name: `${r.lastName} ${r.firstName}`,
          reason: `رقم الملف "${r.fileNumber}" موجود مسبقاً`,
        });
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
        gender: (r.gender || "ذكر") as Gender,  // 🔑 افتراضي: ذكر
        bloodType: (r.bloodType as BloodType) || null,
        subscriptionType: (r.subscriptionType || "/") as SubscriptionType,  // 🔑 افتراضي: /
        lastPaymentDate: r.lastPaymentDate,
        paymentStatus: (r.paymentStatus || "لم يدفع") as PaymentStatus,  // 🔑 افتراضي: لم يدفع
        swimmingDays: (r.swimmingDays as SwimmingDays) || null,
        timeSlot: (r.timeSlot as TimeSlot) || null,
        phone: r.phone,
      };
    });

    let imported = 0;
    let skipped = 0;
    const importErrors: { row: number; name: string; error: string }[] = [];

    // Try batch insert first (much faster)
    try {
      const result = await db.subscriber.createMany({
        data: records,
        skipDuplicates: true,
      });
      imported = result.count;
      skipped = records.length - imported;
    } catch (batchError) {
      // Fallback: insert one by one if batch fails (e.g., duplicate detection)
      console.warn("Batch insert failed, falling back to individual inserts:", batchError);
      for (let i = 0; i < newRows.length; i++) {
        const r = newRows[i];
        try {
          await db.subscriber.create({ data: records[i] });
          imported++;
        } catch (e) {
          skipped++;
          importErrors.push({
            row: r.row,
            name: `${r.lastName} ${r.firstName}`,
            error: e instanceof Error ? e.message : "خطأ غير معروف",
          });
        }
      }
    }

    // Log activity
    await db.activity.create({
      data: {
        clubId: targetClubId,
        type: "import",
        description: `تم استيراد ${imported} منخرط جديد، ${duplicateRows.length} مكرر تم تجاهله`,
      },
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      duplicates: duplicateRows.length,
      duplicateDetails: duplicateRows.slice(0, 50), // أول 50 مكرر
      totalRows: rows.length,
      errors: importErrors,
    });
  } catch (e) {
    console.error("Import error:", e);
    return NextResponse.json({ error: "خطأ داخلي: " + (e instanceof Error ? e.message : "") }, { status: 500 });
  }
}
