import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { computeSubscriberFields, computeSubscriberFieldsDynamic, type Gender, type BloodType, type SubscriptionType, type PaymentStatus, type SwimmingDays, type TimeSlot, type SubscriptionTypeConfig, DEFAULT_TYPES_MAP, normalizePaymentStatus, isExemptStatus } from "@/lib/rcs";
import { postLedgerEntriesBatchTx, type LedgerEntryInput } from "@/lib/financial-posting";
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
      const ms = (value - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  if (typeof value !== "string") return null;
  // Convert Eastern Arabic numerals (٠-٩) to Western (0-9)
  let str = value.trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
  if (!str) return null;

  // If numeric string representing Excel serial date (e.g. "44927")
  if (/^\d{5}$/.test(str)) {
    const num = parseInt(str, 10);
    if (num > 25569 && num < 60000) {
      const ms = (num - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // Strip time part if present (e.g. "18/02/2013 00:00:00" or "2013-02-18T00:00:00.000Z")
  const dateOnly = str.split(/[T\s]/)[0].trim();

  // Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = dateOnly.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
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

  // Try YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const ymdMatch = dateOnly.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
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
  const dmy2Match = dateOnly.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
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

    if (wb.SheetNames.length === 0) {
      return NextResponse.json({ error: "ملف Excel لا يحتوي على أي ورقة عمل" }, { status: 400 });
    }

    // ═══ كاشف أوراق العمل الذكي ═══
    // فحص جميع أوراق العمل لاختيار الورقة التي تحتوي على بيانات المنخرطين الفعلية
    const priorityKeywords = ["منخرط", "مشترك", "بيانات", "سجل", "قائمة", "adherent", "membre", "donnee", "data"];
    const sortedSheetNames = [...wb.SheetNames].sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aPrio = priorityKeywords.some((k) => aLower.includes(k)) ? 1 : 0;
      const bPrio = priorityKeywords.some((k) => bLower.includes(k)) ? 1 : 0;
      return bPrio - aPrio;
    });

    let chosenSheetName = "";
    let chosenHeaderRowIndex = -1;
    let chosenHeaders: string[] = [];
    let chosenRows: Record<string, unknown>[] = [];
    let maxSubscribersFound = -1;

    for (const name of sortedSheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: "", raw: true, header: 1 });
      if (allRows.length < 2) continue;

      let hIdx = -1;
      for (let i = 0; i < Math.min(10, allRows.length); i++) {
        const row = allRows[i].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
        const hasLastName = row.some((c) => ["اللقب", "لقب", "Nom", "nom"].includes(c));
        const hasFirstName = row.some((c) => ["الاسم", "اسم", "Prénom", "prenom", "Prenom"].includes(c));
        const hasFullName = row.some((c) => ["الاسم واللقب", "اللقب والاسم", "الاسم الكامل", "Nom et Prénom", "Nom Prénom"].some((k) => c.includes(k)));
        if ((hasLastName && hasFirstName) || hasFullName) {
          hIdx = i;
          break;
        }
      }

      if (hIdx !== -1) {
        const headerRow = allRows[hIdx].map((c) =>
          String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " ")
        );
        const dataRows: Record<string, unknown>[] = [];
        for (let i = hIdx + 1; i < allRows.length; i++) {
          const row = allRows[i];
          if (!row || row.every((c) => !c || String(c).trim() === "")) continue;
          const obj: Record<string, unknown> = {};
          for (let j = 0; j < headerRow.length; j++) {
            if (headerRow[j]) obj[headerRow[j]] = row[j];
          }
          dataRows.push(obj);
        }

        if (dataRows.length > maxSubscribersFound) {
          maxSubscribersFound = dataRows.length;
          chosenSheetName = name;
          chosenHeaderRowIndex = hIdx;
          chosenHeaders = headerRow;
          chosenRows = dataRows;
        }
      }
    }

    // في حال عدم العثور عبر الفحص الذكي، نرجع لأول ورقة كإجراء احتياطي
    if (chosenHeaderRowIndex === -1 || chosenRows.length === 0) {
      const fallbackSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[fallbackSheetName];
      if (!ws) {
        return NextResponse.json({ error: "تعذر العثور على ورقة البيانات في ملف Excel" }, { status: 400 });
      }
      const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: "", raw: true, header: 1 });
      if (allRows.length === 0) {
        return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });
      }
      let hIdx = -1;
      for (let i = 0; i < Math.min(10, allRows.length); i++) {
        const row = allRows[i].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
        if (row.some((c) => c === "اللقب") || row.some((c) => c === "الاسم") || row.some((c) => c.includes("الاسم واللقب"))) {
          hIdx = i;
          break;
        }
      }
      if (hIdx === -1) {
        return NextResponse.json({
          error: "تعذر العثور على صف العناوين في ملف Excel. تأكد من وجود أعمدة 'اللقب' و 'الاسم'.",
        }, { status: 400 });
      }
      chosenSheetName = fallbackSheetName;
      chosenHeaderRowIndex = hIdx;
      chosenHeaders = allRows[hIdx].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
      for (let i = hIdx + 1; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row || row.every((c) => !c || String(c).trim() === "")) continue;
        const obj: Record<string, unknown> = {};
        for (let j = 0; j < chosenHeaders.length; j++) {
          if (chosenHeaders[j]) obj[chosenHeaders[j]] = row[j];
        }
        chosenRows.push(obj);
      }
    }

    const rows = chosenRows;
    if (rows.length === 0) {
      return NextResponse.json({ error: `لا توجد صفوف بيانات صالحة في الورقة المختارة (${chosenSheetName})` }, { status: 400 });
    }

    // Detect column names (handle various Arabic & French headers from Excel)
    const findKey = (row: Record<string, unknown>, candidates: string[]): string | null => {
      const keys = Object.keys(row);
      // 1. Exact match first across all candidates
      for (const candidate of candidates) {
        const found = keys.find((k) => {
          const normalized = k.trim().replace(/\s+/g, " ").toLowerCase();
          return normalized === candidate.toLowerCase();
        });
        if (found) return found;
      }
      // 2. Contains match only if candidate is longer than 2 characters
      for (const candidate of candidates) {
        if (candidate.length < 3) continue;
        const found = keys.find((k) => {
          const normalized = k.trim().replace(/\s+/g, " ").toLowerCase();
          return normalized.includes(candidate.toLowerCase());
        });
        if (found) return found;
      }
      return null;
    };

    const firstRow = rows[0] || {};
    const lastNameKey = findKey(firstRow, ["اللقب", "لقب", "Nom", "nom"]);
    const firstNameKey = findKey(firstRow, ["الاسم", "اسم", "Prénom", "prenom", "Prenom"]);
    const fullNameKey = findKey(firstRow, ["الاسم واللقب", "اللقب والاسم", "الاسم الكامل", "Nom et Prénom", "Nom Prénom"]);
    const birthDateKey = findKey(firstRow, ["تاريخ الميلاد", "الميلاد", "تاريخ الازدياد", "الازدياد", "تاريخ الولادة", "الولادة", "ت.الميلاد", "ت.الازدياد", "Date de naissance", "Date naissance", "dnaiss", "Date Naiss"]);
    const ageKey = findKey(firstRow, ["العمر", "السن", "age", "Age"]);
    const genderKey = findKey(firstRow, ["الجنس", "النوع", "Sexe", "sexe", "Gender", "gender"]);
    const bloodTypeKey = findKey(firstRow, ["فصيلة الدم", "فصيلة", "الدم", "Groupe sanguin", "Groupe Sanguin", "GS"]);
    const subscriptionTypeKey = findKey(firstRow, ["نوع الاشتراك", "نوع", "الاشتراك", "الصيغة", "Type d'abonnement", "Formule"]);
    const lastPaymentKey = findKey(firstRow, ["تاريخ آخر دفعة", "آخر دفعة", "الدفعة", "تاريخ الدفع", "Date de paiement"]);
    const paymentStatusKey = findKey(firstRow, ["حالة الدفع", "الحالة", "الوضعية", "Statut"]);
    const swimmingDaysKey = findKey(firstRow, ["أيام السباحة", "الأيام", "الايام", "Jours"]);
    const timeSlotKey = findKey(firstRow, ["التوقيت", "الوقت", "الفوج", "Horaire", "Créneau"]);
    const phoneKey = findKey(firstRow, ["رقم الهاتف", "الهاتف", "هاتف", "الجوال", "المحمول", "تلفون", "واتساب", "Telephone", "Téléphone", "Tel", "Tél"]);
    const fileNumberKey = findKey(firstRow, ["رقم الملف", "رقم العضوية", "رقم القيد", "رقم الانخراط", "الملف", "رقم", "N° Dossier", "Dossier", "Matricule", "N°"]);
    const feeKey = findKey(firstRow, ["رسوم الاشتراك", "رسوم", "الرسوم", "سعر الاشتراك", "مبلغ الاشتراك"]);
    const insuranceFeeKey = findKey(firstRow, ["مصاريف التأمين", "التأمين", "مصاريف", "مبلغ التأمين"]);
    const totalAmountKey = findKey(firstRow, ["المبلغ الإجمالي", "الإجمالي", "المبلغ", "المجموع", "Total"]);
    const compoundRightsKey = findKey(firstRow, ["حقوق المركب", "المركب"]);

    if ((!lastNameKey || !firstNameKey) && !fullNameKey) {
      return NextResponse.json({
        error: "تعذر العثور على أعمدة اللقب والاسم. تأكد من أن الصف الأول يحتوي على العناوين الصحيحة.",
      }, { status: 400 });
    }

    // دالة مساعدة لتحليل المبالغ المالية
    const parseAmount = (val: unknown): number => {
      if (typeof val === "number") return isNaN(val) ? 0 : val;
      if (!val) return 0;
      const cleaned = String(val).replace(/[^\d.-]/g, "").trim();
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    // Valid values
    const validGenders = ["ذكر", "أنثى"];
    const validPaymentStatuses = ["مدفوع", "لم يدفع", "تأمين فقط", "اشتراك 300", "معفى"];
    const dbSubTypesAll = await db.subscriptionType.findMany({
      where: { clubId: targetClubId },
      select: { code: true, name: true, active: true, givesMembershipNumber: true, numberingGroup: true },
    });
    const validSubscriptionTypes = dbSubTypesAll.filter((t) => t.active).map((t) => t.code);
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
      fileNumber: string | null;
      sourceFee: number | null;
      sourceInsurance: number | null;
      sourceTotal: number | null;
      errors: string[];
      errorDetails: Array<{
        type: "critical" | "warning";
        message: string;
        column: string;
        columnLabel: string;
        value: string;
        expected?: string;
      }>;
    }

    const parsed: ParsedRow[] = [];
    let errorCount = 0;
    let warnings = 0;

    rows.forEach((row, idx) => {
      let lastName = lastNameKey ? String(row[lastNameKey] || "").trim() : "";
      let firstName = firstNameKey ? String(row[firstNameKey] || "").trim() : "";

      // استخراج الاسم واللقب من عمود الاسم الكامل إن وُجد
      if ((!lastName || !firstName) && fullNameKey && row[fullNameKey]) {
        const full = String(row[fullNameKey]).trim();
        const parts = full.split(/\s+/);
        if (parts.length > 1) {
          if (!lastName) lastName = parts[0];
          if (!firstName) firstName = parts.slice(1).join(" ");
        } else if (parts.length === 1 && parts[0]) {
          if (!lastName) lastName = parts[0];
          if (!firstName) firstName = "—";
        }
      }

      if (!lastName && firstName) lastName = "—";
      if (!firstName && lastName) firstName = "—";

      const r: ParsedRow = {
        row: idx + 2,
        lastName,
        firstName,
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
        sourceFee: feeKey ? parseAmount(row[feeKey]) : null,
        sourceInsurance: insuranceFeeKey ? parseAmount(row[insuranceFeeKey]) : null,
        sourceTotal: totalAmountKey ? parseAmount(row[totalAmountKey]) : null,
        errors: [],
        errorDetails: [],
      };

      // ─── helper لإضافة خطأ ───
      const addError = (type: "critical" | "warning", message: string, column: string, columnLabel: string, value: string, expected?: string) => {
        r.errors.push(message);
        r.errorDetails.push({ type, message, column, columnLabel, value, expected });
        if (type === "warning") warnings++;
      };

      if (!r.lastName || !r.firstName || (r.lastName === "—" && r.firstName === "—")) {
        addError("critical", "اللقب والاسم فارغان", "lastName", "اللقب والاسم", "—", "قيمة غير فارغة");
      }

      // Parse birth date مع دعم ذكي لاستنتاج تاريخ الميلاد من العمر
      let birthDate: Date | null = null;
      let birthDateRaw = "";

      if (birthDateKey && row[birthDateKey]) {
        const bd = row[birthDateKey];
        birthDateRaw = String(bd).trim();
        birthDate = parseDate(bd);
      }

      // إذا لم يتوفر تاريخ ميلاد صالح، نحاول استنتاجه من عمود العمر إن وُجد
      if (!birthDate && ageKey && row[ageKey]) {
        const rawAge = String(row[ageKey]).replace(/[^\d]/g, "");
        const ageNum = parseInt(rawAge, 10);
        if (!isNaN(ageNum) && ageNum > 0 && ageNum < 120) {
          const currentYear = new Date().getFullYear();
          const inferredYear = currentYear - ageNum;
          birthDate = new Date(inferredYear, 0, 1);
          birthDateRaw = `${ageNum} سنة`;
          addError("warning", `تم استنتاج تاريخ الميلاد من العمر (${ageNum} سنة): 01/01/${inferredYear}`, "birthDate", "تاريخ الميلاد", `${ageNum} سنة`);
        }
      }

      // إذا تعذر تحديد تاريخ الميلاد، نضع تاريخاً افتراضياً مع تحذير (بدلاً من استبعاد المشترك)
      if (!birthDate) {
        birthDate = new Date(2000, 0, 1);
        addError("warning", "تاريخ الميلاد غير متوفر — تم تعيين تاريخ افتراضي (01/01/2000) لتفادي استبعاد المنخرط", "birthDate", "تاريخ الميلاد", "—", "تاريخ صالح");
      }

      r.birthDate = birthDate;
      r.birthDateRaw = birthDateRaw;

      // Gender — اختياري، افتراضي "ذكر"
      if (genderKey) {
        const g = String(row[genderKey] || "").trim();
        if (validGenders.includes(g)) {
          r.gender = g;
        } else if (g) {
          addError("warning", `جنس غير قياسي: "${g}" — تم تعيين "ذكر"`, "gender", "الجنس", g, "ذكر / أنثى");
          r.gender = "ذكر";
        } else {
          r.gender = "ذكر";
        }
      } else {
        r.gender = "ذكر";
      }

      // Blood type (اختياري تماماً)
      if (bloodTypeKey) {
        const b = String(row[bloodTypeKey] || "").trim();
        if (validBloodTypes.includes(b)) {
          r.bloodType = b;
        } else {
          r.bloodType = null;
        }
      }

      // Subscription type — "/" دائماً صالح (افتراضي)
      if (subscriptionTypeKey) {
        const t = String(row[subscriptionTypeKey] || "").trim();
        if (t === "" || t === "/" || validSubscriptionTypes.includes(t)) {
          r.subscriptionType = t || "/";
        } else {
          r.subscriptionType = "/";
          addError("warning", `نوع اشتراك غير معروف "${t}" — تم استخدام "/"`, "subscriptionType", "نوع الاشتراك", t, "/, " + validSubscriptionTypes.join(", "));
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
        }
      }

      // Payment status
      if (paymentStatusKey) {
        const p = String(row[paymentStatusKey] || "").trim();
        const normalized = normalizePaymentStatus(p);
        if (normalized) {
          r.paymentStatus = normalized;
        } else if (p) {
          r.paymentStatus = "مدفوع";
        } else {
          r.paymentStatus = "لم يدفع";
        }
      } else {
        r.paymentStatus = "لم يدفع";
      }

      // Swimming days
      if (swimmingDaysKey) {
        r.swimmingDays = String(row[swimmingDaysKey] || "").trim() || null;
      }

      // Time slot
      if (timeSlotKey) {
        r.timeSlot = String(row[timeSlotKey] || "").trim() || null;
      }

      // Phone
      if (phoneKey) {
        const ph = String(row[phoneKey] || "").trim();
        r.phone = ph || null;
      }

      // رقم الملف من Excel إن وُجد
      if (fileNumberKey) {
        const fn = String(row[fileNumberKey] || "").trim();
        r.fileNumber = fn || null;
      }

      if (r.errors.length > 0) errorCount++;
      parsed.push(r);
    });

    // ════ صف صالح = لا أخطاء حرجة ════
    const validRows = parsed.filter((r) => {
      const hasCritical = r.errorDetails.some((e) => e.type === "critical");
      return !hasCritical && r.lastName && r.firstName && r.birthDate;
    });

    // ════ التحقق المالي والمقارنة الاسترشادية ════
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

      // مقارنة الرسوم بدقة من كائن الصف r مباشرة دون أخطاء فهرسة
      let feeMismatch: { sourceFee: number; computedFee: number; difference: number } | null = null;
      if (r.sourceFee !== null && r.sourceFee > 0) {
        const computedFee = c.subscriptionFee ?? 0;
        if (r.sourceFee !== computedFee) {
          feeMismatch = { sourceFee: r.sourceFee, computedFee, difference: r.sourceFee - computedFee };
        }
      }

      let insuranceMismatch: { sourceFee: number; computedFee: number; difference: number } | null = null;
      if (r.sourceInsurance !== null && r.sourceInsurance > 0) {
        const computedIns = c.insuranceFee ?? 0;
        if (r.sourceInsurance !== computedIns) {
          insuranceMismatch = { sourceFee: r.sourceInsurance, computedFee: computedIns, difference: r.sourceInsurance - computedIns };
        }
      }

      let totalMismatch: { sourceTotal: number; computedTotal: number; difference: number } | null = null;
      if (r.sourceTotal !== null && r.sourceTotal > 0) {
        const computedTotal = c.totalAmount ?? 0;
        if (r.sourceTotal !== computedTotal) {
          totalMismatch = { sourceTotal: r.sourceTotal, computedTotal, difference: r.sourceTotal - computedTotal };
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
        feeMismatch,
        insuranceMismatch,
        totalMismatch,
        hasFinancialConflict: !!(feeMismatch || insuranceMismatch || totalMismatch),
      };
    });

    const conflictedRows = financialCheck.filter((r) => r.hasFinancialConflict);

    // ═══ مطابقة المنخرطين مع قاعدة البيانات لتصنيف (مشترك جديد vs تجديد اشتراك) ═══
    const existingSubscribers = await db.subscriber.findMany({
      where: { clubId: targetClubId },
      select: { id: true, fileNumber: true, lastName: true, firstName: true, birthDate: true },
    });

    const existingByNameAndDate = new Map<string, typeof existingSubscribers[0]>();
    const existingByFileNumber = new Map<string, typeof existingSubscribers[0]>();
    for (const sub of existingSubscribers) {
      const nameKey = `${sub.lastName.trim().toLowerCase()}|${sub.firstName.trim().toLowerCase()}|${new Date(sub.birthDate).toISOString().split("T")[0]}`;
      existingByNameAndDate.set(nameKey, sub);
      if (sub.fileNumber) {
        existingByFileNumber.set(sub.fileNumber.trim().toLowerCase(), sub);
      }
    }

    // تحليل المبالغ ومصدرها: اشتراكات جديدة vs تجديد اشتراك vs تأمين
    let newSubsAmount = 0;
    let newSubsCount = 0;
    let renewalsAmount = 0;
    let renewalsCount = 0;
    let insuranceAmount = 0;
    let insuranceCount = 0;
    let compoundAmount = 0;

    const classifiedCheck = financialCheck.map((r) => {
      const nameKey = `${r.lastName.trim().toLowerCase()}|${r.firstName.trim().toLowerCase()}|${r.birthDate ? new Date(r.birthDate).toISOString().split("T")[0] : ""}`;
      const fileKey = r.fileNumber ? r.fileNumber.trim().toLowerCase() : null;
      const matched = (fileKey && existingByFileNumber.get(fileKey)) || existingByNameAndDate.get(nameKey);
      const isExisting = !!matched;

      const subFee = r.sourceFee !== null ? r.sourceFee : (r.computed.subscriptionFee ?? 0);
      const insFee = r.sourceInsurance !== null ? r.sourceInsurance : (r.computed.insuranceFee ?? 0);
      const cmpFee = r.computed.compoundRights ?? 0;
      const isPaid = r.paymentStatus === "مدفوع";

      if (isPaid) {
        if (isExisting) {
          if (subFee > 0) {
            renewalsAmount += subFee;
            renewalsCount++;
          }
        } else {
          if (subFee > 0) {
            newSubsAmount += subFee;
            newSubsCount++;
          }
          if (insFee > 0) {
            insuranceAmount += insFee;
            insuranceCount++;
          }
          if (cmpFee > 0) {
            compoundAmount += cmpFee;
          }
        }
      }

      return {
        ...r,
        isNewSubscriber: !isExisting,
        originType: isExisting ? "renewal" : "new",
        originLabel: isExisting ? "تجديد اشتراك" : "مشترك جديد",
        matchedSubscriberId: matched ? matched.id : null,
        feeBreakdown: {
          subscription: isExisting ? 0 : subFee,
          renewal: isExisting ? subFee : 0,
          insurance: isExisting ? 0 : insFee,
          compound: isExisting ? 0 : cmpFee,
          total: isExisting ? subFee : (subFee + insFee + cmpFee),
        },
      };
    });

    const renewalAnalysis = analyzeRenewalSheet(wb);
    let renewalSheetAmount = 0;
    let renewalSheetCount = 0;
    if (renewalAnalysis.found) {
      for (const s of renewalAnalysis.sample) {
        if (s.amount > 0 && (s.status === "مدفوع" || !s.status)) {
          renewalSheetAmount += s.amount;
          renewalSheetCount++;
        }
      }
    }

    const totalRenewalsAmount = renewalsAmount + renewalSheetAmount;
    const totalRenewalsCount = renewalsCount + renewalSheetCount;
    const grandTotalRevenue = newSubsAmount + insuranceAmount + totalRenewalsAmount + compoundAmount;

    const financialBreakdownSummary = {
      newSubscriptions: { count: newSubsCount, amount: newSubsAmount },
      renewals: { count: totalRenewalsCount, amount: totalRenewalsAmount },
      insurance: { count: insuranceCount, amount: insuranceAmount },
      compound: { count: newSubsCount, amount: compoundAmount },
      grandTotal: grandTotalRevenue,
    };

    if (dryRun) {
      const financialCheckByRow = new Map(classifiedCheck.map((r) => [r.row, r]));
      return NextResponse.json({
        preview: true,
        sheetName: chosenSheetName,
        totalRows: rows.length,
        validRows: validRows.length, // 🔑 يظهر للمستخدم كافة الصفوف الصالحة
        errorRows: errorCount,
        warnings,
        conflictedCount: conflictedRows.length,
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
        sample: classifiedCheck,
        errorSamples: parsed.filter((r) => r.errors.length > 0),
        allRows: parsed.map((r) => {
          const validRow = financialCheckByRow.get(r.row);
          const hasCritical = r.errorDetails.some((e) => e.type === "critical");
          const hasWarning = r.errorDetails.some((e) => e.type === "warning");
          return {
            ...r,
            birthDateDisplay: validRow?.birthDateDisplay || formatDate(r.birthDate),
            lastPaymentDisplay: validRow?.lastPaymentDisplay || formatDate(r.lastPaymentDate),
            computed: validRow?.computed || { age: 0, subscriptionFee: null, insuranceFee: null, compoundRights: null, totalAmount: null },
            rightsRule: validRow?.rightsRule || "—",
            status: hasCritical ? "error" : (hasWarning ? "warning" : "valid"),
            warnings: r.errorDetails.filter((e) => e.type === "warning").map((e) => e.message),
            isNewSubscriber: validRow?.isNewSubscriber ?? true,
            originType: validRow?.originType ?? "new",
            originLabel: validRow?.originLabel ?? "مشترك جديد",
            feeBreakdown: validRow?.feeBreakdown || {
              subscription: r.sourceFee || 0,
              renewal: 0,
              insurance: r.sourceInsurance || 0,
              compound: 0,
              total: r.sourceTotal || 0,
            },
          };
        }),
        summary: {
          totalFees: financialCheck.reduce((s, r) => s + (r.computed.subscriptionFee ?? 0), 0),
          totalInsurance: financialCheck.reduce((s, r) => s + (r.computed.insuranceFee ?? 0), 0),
          totalCompound: financialCheck.reduce((s, r) => s + (r.computed.compoundRights ?? 0), 0),
          totalRevenue: financialCheck.reduce((s, r) => s + (r.computed.totalAmount ?? 0), 0),
          exemptCount: financialCheck.filter((r) => isExemptStatus(r.paymentStatus)).length,
          financialBreakdown: financialBreakdownSummary,
        },
        renewalPreview: renewalAnalysis,
      });
    }

    // Actually import — use batch insert for performance
    const clubFilter = { clubId: targetClubId };
    const existingCount = await db.subscriber.count({ where: clubFilter });

    // 🔑 استيراد كافة الصفوف الصالحة (مع مراعاة التحديد إن وجد)
    const rowsToImport = selectedRows
      ? classifiedCheck.filter((r) => selectedRows.includes(r.row))
      : classifiedCheck;

    const newRows: typeof rowsToImport = [];
    const duplicateRows: { row: number; name: string; reason: string }[] = [];
    const existingToUpdate: { row: typeof rowsToImport[0]; existingId: string }[] = [];
    const seenInFile = new Set<string>();

    for (const r of rowsToImport) {
      const nameKey = `${r.lastName.trim().toLowerCase()}|${r.firstName.trim().toLowerCase()}|${r.birthDate ? new Date(r.birthDate).toISOString().split("T")[0] : ""}`;
      const fileKey = r.fileNumber ? r.fileNumber.trim().toLowerCase() : null;

      // مطابقة المنخرط مع قاعدة البيانات (برقم الملف أو الاسم وتاريخ الميلاد)
      const matchedByFile = fileKey ? existingByFileNumber.get(fileKey) : null;
      const matchedByName = existingByNameAndDate.get(nameKey);
      const existingMatch = matchedByFile || matchedByName;

      if (existingMatch) {
        // المنخرط موجود مسبقاً في النادي — حدّث بياناته (upsert) بدلاً من استبعاده
        existingToUpdate.push({ row: r, existingId: existingMatch.id });
      } else if (seenInFile.has(nameKey)) {
        // مكرر داخل نفس الملف المرفوع
        duplicateRows.push({
          row: r.row,
          name: `${r.lastName} ${r.firstName}`,
          reason: "مكرر داخل نفس الملف",
        });
      } else {
        newRows.push(r);
        seenInFile.add(nameKey);
      }
    }

    // Build all records — استخدام numberingGroup للترقيم وتفادي أي تعارض في أرقام الملفات
    const groupCounters: Record<string, number> = {};
    for (const sub of existingSubscribers) {
      const match = sub.fileNumber.match(/^([A-Za-z*]+)/);
      if (match) {
        const prefix = match[1];
        const numMatch = sub.fileNumber.match(/(\d+)$/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          if (!groupCounters[prefix] || groupCounters[prefix] < num) {
            groupCounters[prefix] = num;
          }
        }
      }
    }

    const assignedFileNumbers = new Set(existingSubscribers.map((s) => s.fileNumber.trim()));
    const records = newRows.map((r) => {
      const typeConfig = dbSubTypesAll.find((t) => t.code === r.subscriptionType);
      const givesMembership = typeConfig ? typeConfig.givesMembershipNumber : true;

      let fileNumber: string;
      if (r.fileNumber && r.fileNumber.trim()) {
        const rawFileNum = r.fileNumber.trim();
        fileNumber = rawFileNum;
        let suffix = 1;
        while (assignedFileNumbers.has(fileNumber)) {
          fileNumber = `${rawFileNum}-${suffix}`;
          suffix++;
        }
      } else if (typeConfig && !givesMembership) {
        const baseCode = r.subscriptionType || "**";
        fileNumber = baseCode;
        let counter = 1;
        while (assignedFileNumbers.has(fileNumber)) {
          fileNumber = `${baseCode}-${counter}`;
          counter++;
        }
      } else {
        const group = typeConfig?.numberingGroup || "RCS";
        if (!groupCounters[group]) groupCounters[group] = 0;
        groupCounters[group]++;
        fileNumber = `${group}${String(groupCounters[group]).padStart(3, "0")}`;
        while (assignedFileNumbers.has(fileNumber)) {
          groupCounters[group]++;
          fileNumber = `${group}${String(groupCounters[group]).padStart(3, "0")}`;
        }
      }
      assignedFileNumbers.add(fileNumber);

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
    const CREATE_BATCH_SIZE = 100;
    const isSqlite = (process.env.DATABASE_URL || "").startsWith("file:");
    for (let i = 0; i < records.length; i += CREATE_BATCH_SIZE) {
      const batch = records.slice(i, i + CREATE_BATCH_SIZE);
      const batchRows = newRows.slice(i, i + CREATE_BATCH_SIZE);
      try {
        const createArgs: any = { data: batch as any };
        if (!isSqlite) {
          createArgs.skipDuplicates = true;
        }
        const result = await db.subscriber.createMany(createArgs);
        imported += result.count;
        // ★ Count exempt imports in this batch
        for (const r of batchRows) {
          if (isExemptStatus(r.paymentStatus)) exemptImported++;
        }
      } catch (batchErr) {
        // فشل الدفعة بأكملها — عدّها كأخطاء وواصل فردياً
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

    // ═══ المرحلة 3: جلب IDs المنخرطين لربط التجديدات والقيود المالية ═══
    let renewalsImported = 0;
    let renewalsSkipped = 0;
    const renewalErrors: { row: number; name: string; error: string }[] = [];
    const renewalRecords: any[] = [];

    const newFileNumbers = records.map((r) => r.fileNumber);
    const newlyCreatedSubs = await db.subscriber.findMany({
      where: {
        clubId: targetClubId,
        fileNumber: { in: newFileNumbers },
      },
      select: { id: true, fileNumber: true },
    });
    const fileNumberToId = new Map<string, string>();
    for (const s of existingSubscribers) {
      fileNumberToId.set(s.fileNumber, s.id);
    }
    for (const s of newlyCreatedSubs) {
      fileNumberToId.set(s.fileNumber, s.id);
    }

    const renewalSheetName = wb.SheetNames.find((n) => n.includes("التجديد"));
    if (renewalSheetName && imported > 0) {
      try {
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
              for (let i = 0; i < renewalRows.length; i++) {
                const row = renewalRows[i];
                const fileNumber = String(row[fnKey] || "").trim();
                if (!fileNumber) { renewalsSkipped++; continue; }

                const renewalDateRaw = renewalDateKey ? row[renewalDateKey] : null;
                if (!renewalDateRaw || !String(renewalDateRaw).trim()) {
                  renewalsSkipped++;
                  continue;
                }

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
                  const createArgs: any = { data: batch };
                  if (!isSqlite) {
                    createArgs.skipDuplicates = true;
                  }
                  const result = await db.renewal.createMany(createArgs);
                  renewalsImported += result.count;
                } catch (e) {
                  console.warn(`Renewal batch failed, trying individual inserts:`, e);
                  for (const rec of batch) {
                    try {
                      await db.renewal.create({ data: rec });
                      renewalsImported++;
                    } catch {
                      renewalsSkipped++;
                    }
                  }
                }
              }
            }
          }
        }
      } catch (renewalErr) {
        console.error("Renewal import error:", renewalErr);
      }
    }

    // ═══ المرحلة 4: ترحيل المبالغ المالية إلى الدفتر المالي الموحد (Ledger Posting) ═══
    const ledgerEntries: LedgerEntryInput[] = [];

    let countNewSubs = 0;
    let totalNewSubsFees = 0;
    let countInsurance = 0;
    let totalNewSubsInsurance = 0;

    // 1) مبالغ المشتركين الجدد (اشتراكات + تأمين)
    for (const r of newRows) {
      if (r.paymentStatus !== "مدفوع") continue;
      const subId = r.fileNumber ? fileNumberToId.get(r.fileNumber) : null;
      const subFee = r.sourceFee !== null ? r.sourceFee : (r.computed.subscriptionFee ?? 0);
      const insFee = r.sourceInsurance !== null ? r.sourceInsurance : (r.computed.insuranceFee ?? 0);
      const paymentDate = r.lastPaymentDate || new Date();

      if (subFee > 0) {
        countNewSubs++;
        totalNewSubsFees += subFee;
        ledgerEntries.push({
          clubId: targetClubId,
          type: "income",
          category: "subscription",
          amount: subFee,
          date: paymentDate,
          subscriberId: subId,
          payeeName: `${r.lastName} ${r.firstName}`,
          reference: subId ? `import:sub:${subId}:subscription` : `import:row:${r.row}:subscription`,
          note: `استيراد: اشتراك منخرط جديد - ${r.lastName} ${r.firstName} (${r.subscriptionType})`,
        });
      }

      if (insFee > 0) {
        countInsurance++;
        totalNewSubsInsurance += insFee;
        ledgerEntries.push({
          clubId: targetClubId,
          type: "income",
          category: "insurance",
          amount: insFee,
          date: paymentDate,
          subscriberId: subId,
          payeeName: `${r.lastName} ${r.firstName}`,
          reference: subId ? `import:sub:${subId}:insurance` : `import:row:${r.row}:insurance`,
          note: `استيراد: تأمين منخرط جديد - ${r.lastName} ${r.firstName}`,
        });
      }
    }

    let countRenewals = 0;
    let totalRenewalsFees = 0;

    // 2) مبالغ تجديد المشتركين المحدثين (تجديدات)
    for (const { row: r, existingId } of existingToUpdate) {
      if (r.paymentStatus !== "مدفوع") continue;
      const subFee = r.sourceFee !== null ? r.sourceFee : (r.computed.subscriptionFee ?? 0);
      const paymentDate = r.lastPaymentDate || new Date();
      if (subFee > 0) {
        countRenewals++;
        totalRenewalsFees += subFee;
        ledgerEntries.push({
          clubId: targetClubId,
          type: "income",
          category: "renewal",
          amount: subFee,
          date: paymentDate,
          subscriberId: existingId,
          payeeName: `${r.lastName} ${r.firstName}`,
          reference: `import:renewal:${existingId}:${paymentDate.toISOString().slice(0, 10)}`,
          note: `استيراد: تجديد اشتراك - ${r.lastName} ${r.firstName}`,
        });
      }
    }

    let liveRenewalSheetAmount = 0;

    // 3) مبالغ ورقة التجديد إن وُجدت
    for (const rec of renewalRecords) {
      if (rec.amount > 0 && rec.paymentStatus === "مدفوع") {
        liveRenewalSheetAmount += rec.amount;
        ledgerEntries.push({
          clubId: targetClubId,
          type: "income",
          category: "renewal",
          amount: rec.amount,
          date: rec.renewalDate || new Date(),
          subscriberId: rec.subscriberId,
          reference: `import:renewal-sheet:${rec.subscriberId}:${rec.renewalDate.toISOString().slice(0, 10)}`,
          note: `استيراد: تجديد اشتراك من ورقة التجديد`,
        });
      }
    }

    const liveGrandTotalRevenue = totalNewSubsFees + totalNewSubsInsurance + totalRenewalsFees + liveRenewalSheetAmount;

    // ترحيل كافة القيود دفعة واحدة إلى الدفتر المالي الموحد
    let postedLedgerCount = 0;
    if (ledgerEntries.length > 0) {
      try {
        const batchRes = await db.$transaction((tx) =>
          postLedgerEntriesBatchTx(tx, targetClubId, ledgerEntries)
        );
        postedLedgerCount = batchRes.posted;
      } catch (lErr) {
        console.warn("Batch ledger posting error during import:", lErr);
      }
    }

    // Log activity
    await db.activity.create({
      data: {
        clubId: targetClubId,
        type: "import",
        description: `تم استيراد ${imported} منخرط (${updated} محدّث) و ${renewalsImported} تجديد، وترحيل ${postedLedgerCount} قيد مالي للدفتر، ${duplicateRows.length} مكرر تم تجاهله`,
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
      exemptImported,
      duplicates: duplicateRows.length,
      conflictedCount: conflictedRows.length,
      financialConflicts: conflictedRows.map((r) => ({
        row: r.row,
        name: `${r.lastName} ${r.firstName}`,
        feeMismatch: r.feeMismatch,
        insuranceMismatch: r.insuranceMismatch,
        totalMismatch: r.totalMismatch,
      })).slice(0, 50),
      renewalsImported,
      renewalsSkipped,
      renewalErrors: renewalErrors.slice(0, 50),
      totalRows: rows.length,
      errors: importErrors,
      // ★ تفصيل المبالغ المالية ومصدرها
      financialBreakdown: {
        newSubscriptions: { count: countNewSubs, amount: totalNewSubsFees },
        renewals: { count: countRenewals + renewalsImported, amount: totalRenewalsFees + liveRenewalSheetAmount },
        insurance: { count: countInsurance, amount: totalNewSubsInsurance },
        grandTotal: liveGrandTotalRevenue,
        ledgerEntriesPosted: postedLedgerCount,
      },
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
