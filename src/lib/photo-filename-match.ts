/**
 * ═══════════════════════════════════════════════════════════════
 *  photo-filename-match.ts — محرك مطابقة أسماء ملفات الصور تلقائياً
 * ═══════════════════════════════════════════════════════════════
 *
 *  دالة نقية 100% (Pure Function) خالية من أي وصول للـ DOM أو الشبكة.
 *  تُطابق أسماء ملفات الصور برقم ملف المنخرط (Subscriber.fileNumber)
 *  وفق سلّم مطابقة ذكي وتدريجي:
 *
 *  1. exact: مطابقة تامة مع تجاهل حالة الأحرف (Case-insensitive)
 *  2. normalized: تجاهل المسافات والرموز (_ - .) وتحويل الأرقام العربية إلى لاتينية
 *  3. copy: إزالة لواحق النسخ ( (2), - Copy, _copy, نسخة ) ثم إعادة 1 و 2
 *  4. digits: اسم رقمي مجرد (مثل 7 أو 007) ← تطابق المنخرط الوحيد المنتهي بنفس الرقم (ثقة منخفضة)
 *
 *  قواعد الأمان والفرادة:
 *  - استبعاد المنخرطين المحذوفين ناعماً (deletedAt != null)
 *  - أي مرحلة تُرجع أكثر من مرشح ← تصنّف «غامض» (ambiguous) ولا يُخمّن أبداً
 *  - عند وجود عدة ملفات لنفس المنخرط ← الأعلى ثقة ثم الأكبر حجماً يفوز («matched») والبقية «duplicate»
 *  - دعم عزل المسابح واختيار مسبح محدد لتقليص نطاق البحث
 */

export type MatchConfidence = "exact" | "normalized" | "copy" | "digits";

export type MatchStatus = "matched" | "ambiguous" | "unmatched" | "invalid" | "duplicate";

export interface CandidateSubscriber {
  id: string;
  fileNumber: string;
  firstName: string;
  lastName: string;
  poolId?: string | null;
  poolName?: string | null;
  pool?: string | null;
  photoPath?: string | null;
  photoThumb?: string | null;
  deletedAt?: Date | string | null;
}

export type MatchResult = MatchResultItem;

export interface MatchFileInput {
  name: string;        // مسار أو اسم الملف (مثل RCS001.jpg أو photos/2026/RCS001.jpg)
  size: number;        // الحجم بالبايت
  type?: string;       // MIME type مثل image/jpeg
  lastModified?: number;
  file?: File;         // كائن File الأصلي اختياري للمعالجة
}

export interface MatchResultItem {
  file: MatchFileInput;
  cleanFileName: string;
  stem: string;
  extension: string;
  status: MatchStatus;
  confidence?: MatchConfidence;
  matchedSubscriber?: CandidateSubscriber;
  ambiguousCandidates?: CandidateSubscriber[];
  hasExistingPhoto: boolean;
  selected: boolean;
  reason?: string;
  winningFileName?: string;
}

export interface BulkMatchSummary {
  total: number;
  matched: number;
  hasPhoto: number;
  digitsOnly: number;
  ambiguous: number;
  unmatched: number;
  duplicate: number;
  invalid: number;
  selectedCount: number;
}

export interface MatchOptions {
  poolId?: string | null;
  replaceExisting?: boolean;
}

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * تحويل الأرقام العربية المشرقية والفارسية إلى أرقام لاتينية قياسية 0-9
 */
export function convertArabicDigitsToLatin(str: string): string {
  return str
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * استخراج اسم الملف المجرد بعد إزالة مسارات المجلدات سواء ويندوز أو لينكس
 */
export function getCleanFileName(pathOrName: string): string {
  const parts = pathOrName.split(/[/\\]/);
  return parts[parts.length - 1].trim();
}

/**
 * استخراج جذر اسم الملف (stem) والامتداد بحروف صغيرة
 */
export function getStemAndExtension(fileName: string): { stem: string; ext: string } {
  const clean = getCleanFileName(fileName);
  const lastDot = clean.lastIndexOf(".");
  if (lastDot <= 0) {
    return { stem: clean, ext: "" };
  }
  return {
    stem: clean.slice(0, lastDot),
    ext: clean.slice(lastDot).toLowerCase(),
  };
}

/**
 * تطبيع الكود بإزالة المسافات والرموز وتحويل الأرقام للأصل اللاتيني
 */
export function normalizeCode(str: string): string {
  const latin = convertArabicDigitsToLatin(str);
  return latin
    .toLowerCase()
    .replace(/[\s_\-\.]+/g, "");
}

/**
 * إزالة لواحق النسخ مثل:
 * - (2), (3)
 * - - Copy, _copy, -copy
 * - - نسخة, _نسخة, نسخة
 */
export function stripCopySuffix(stem: string): string | null {
  const trimmed = stem.trim();
  const copyPatterns: RegExp[] = [
    /\s*\(\d+\)$/,
    /[\s_\-]+copy(\s*\(\d+\))?$/i,
    /[\s_\-]+نسخة(\s*\(\d+\))?$/i,
    /\s+نسخة$/i,
  ];

  for (const pattern of copyPatterns) {
    if (pattern.test(trimmed)) {
      const stripped = trimmed.replace(pattern, "").trim();
      if (stripped.length > 0 && stripped !== trimmed) {
        return stripped;
      }
    }
  }
  return null;
}

/**
 * استخراج الرقم التسلسلي الختامي من رقم الملف
 * مثال: RCS007 -> 7, P2-RCS001 -> 1, OPOW012 -> 12
 */
export function extractTrailingInteger(fileNumber: string): number | null {
  const latin = convertArabicDigitsToLatin(fileNumber);
  const match = latin.match(/(\d+)$/);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  return isNaN(val) ? null : val;
}

/**
 * فهرس البحث السريع في الذاكرة O(1)
 */
export interface SubscriberMatchIndex {
  exactMap: Map<string, CandidateSubscriber[]>;
  normalizedMap: Map<string, CandidateSubscriber[]>;
  trailingIntMap: Map<number, CandidateSubscriber[]>;
  subscribersCount: number;
}

/**
 * بناء فهرس البحث لجميع المنخرطين المؤهلين للنادي (مع إمكانية الفلترة بمسبح محدد)
 */
export function buildSubscriberMatchIndex(
  subscribers: CandidateSubscriber[],
  poolId?: string | null
): SubscriberMatchIndex {
  const exactMap = new Map<string, CandidateSubscriber[]>();
  const normalizedMap = new Map<string, CandidateSubscriber[]>();
  const trailingIntMap = new Map<number, CandidateSubscriber[]>();

  let count = 0;

  for (const sub of subscribers) {
    // استبعاد المنخرطين المحذوفين ناعماً
    if (sub.deletedAt) continue;

    // تصفية المسبح إن حُدد
    if (poolId && poolId !== "all" && sub.poolId && sub.poolId !== poolId) {
      continue;
    }

    count++;
    const rawNumber = sub.fileNumber.trim();
    if (!rawNumber) continue;

    // 1. Exact map (case-insensitive)
    const exactKey = rawNumber.toLowerCase();
    const existingExact = exactMap.get(exactKey);
    if (existingExact) {
      existingExact.push(sub);
    } else {
      exactMap.set(exactKey, [sub]);
    }

    // 2. Normalized map
    const normKey = normalizeCode(rawNumber);
    if (normKey) {
      const existingNorm = normalizedMap.get(normKey);
      if (existingNorm) {
        existingNorm.push(sub);
      } else {
        normalizedMap.set(normKey, [sub]);
      }
    }

    // 3. Trailing integer map
    const trailingInt = extractTrailingInteger(rawNumber);
    if (trailingInt !== null) {
      const existingTrailing = trailingIntMap.get(trailingInt);
      if (existingTrailing) {
        existingTrailing.push(sub);
      } else {
        trailingIntMap.set(trailingInt, [sub]);
      }
    }
  }

  return { exactMap, normalizedMap, trailingIntMap, subscribersCount: count };
}

interface StepMatchOutcome {
  status: "matched" | "ambiguous" | "unmatched";
  confidence?: MatchConfidence;
  matchedSubscriber?: CandidateSubscriber;
  ambiguousCandidates?: CandidateSubscriber[];
  reason?: string;
}

/**
 * محاولة مطابقة stem فردي عبر الفهرس
 */
function resolveStem(stem: string, index: SubscriberMatchIndex): StepMatchOutcome {
  const trimmed = stem.trim();
  if (!trimmed) {
    return { status: "unmatched", reason: "اسم الملف فارغ" };
  }

  // 1. exact match
  const exactCandidates = index.exactMap.get(trimmed.toLowerCase());
  if (exactCandidates && exactCandidates.length > 0) {
    if (exactCandidates.length === 1) {
      return { status: "matched", confidence: "exact", matchedSubscriber: exactCandidates[0] };
    }
    return { status: "ambiguous", confidence: "exact", ambiguousCandidates: exactCandidates, reason: "أكثر من منخرط بنفس رقم الملف المطابق تماماً" };
  }

  // 2. normalized match
  const normKey = normalizeCode(trimmed);
  if (normKey) {
    const normCandidates = index.normalizedMap.get(normKey);
    if (normCandidates && normCandidates.length > 0) {
      if (normCandidates.length === 1) {
        return { status: "matched", confidence: "normalized", matchedSubscriber: normCandidates[0] };
      }
      return { status: "ambiguous", confidence: "normalized", ambiguousCandidates: normCandidates, reason: "أكثر من منخرط بنفس رقم الملف بعد التطبيع" };
    }
  }

  // 3. copy suffix stripping
  const copyStripped = stripCopySuffix(trimmed);
  if (copyStripped) {
    // 3.1 exact on copy-stripped
    const strippedExact = index.exactMap.get(copyStripped.toLowerCase());
    if (strippedExact && strippedExact.length > 0) {
      if (strippedExact.length === 1) {
        return { status: "matched", confidence: "copy", matchedSubscriber: strippedExact[0] };
      }
      return { status: "ambiguous", confidence: "copy", ambiguousCandidates: strippedExact, reason: "أكثر من منخرط يطابق الاسم بعد إزالة لاحقة النسخ" };
    }

    // 3.2 normalized on copy-stripped
    const strippedNorm = normalizeCode(copyStripped);
    if (strippedNorm) {
      const strippedNormCandidates = index.normalizedMap.get(strippedNorm);
      if (strippedNormCandidates && strippedNormCandidates.length > 0) {
        if (strippedNormCandidates.length === 1) {
          return { status: "matched", confidence: "copy", matchedSubscriber: strippedNormCandidates[0] };
        }
        return { status: "ambiguous", confidence: "copy", ambiguousCandidates: strippedNormCandidates, reason: "أكثر من منخرط يطابق الاسم بعد التطبيع وإزالة النسخ" };
      }
    }
  }

  // 4. digits-only match
  const latinDigits = convertArabicDigitsToLatin(trimmed);
  if (/^\d+$/.test(latinDigits)) {
    const num = parseInt(latinDigits, 10);
    if (!isNaN(num)) {
      const trailingCandidates = index.trailingIntMap.get(num);
      if (trailingCandidates && trailingCandidates.length > 0) {
        if (trailingCandidates.length === 1) {
          return {
            status: "matched",
            confidence: "digits",
            matchedSubscriber: trailingCandidates[0],
            reason: "مطابقة بالأرقام فقط (ثقة منخفضة — يرجى التأكيد)",
          };
        }
        return {
          status: "ambiguous",
          confidence: "digits",
          ambiguousCandidates: trailingCandidates,
          reason: `الرقم ${num} ينتهي به رقم ملف أكثر من منخرط (${trailingCandidates.map((s) => s.fileNumber).join("، ")})`,
        };
      }
    }
  }

  return { status: "unmatched", reason: "لا يوجد منخرط برقم الملف هذا" };
}

const CONFIDENCE_SCORE: Record<MatchConfidence, number> = {
  exact: 4,
  normalized: 3,
  copy: 2,
  digits: 1,
};

/**
 * الدالة الرئيسية: مطابقة قائمة كاملة من الملفات مع قائمة المنخرطين
 */
export function matchPhotoFiles(
  files: MatchFileInput[],
  subscribers: CandidateSubscriber[],
  options: MatchOptions = {}
): { results: MatchResultItem[]; summary: BulkMatchSummary } {
  const replaceExisting = Boolean(options.replaceExisting);
  const index = buildSubscriberMatchIndex(subscribers, options.poolId);

  const initialResults: MatchResultItem[] = [];

  for (const file of files) {
    const cleanFileName = getCleanFileName(file.name);
    const { stem, ext } = getStemAndExtension(cleanFileName);

    // 1. التحقق من صلاحية الملف
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      initialResults.push({
        file,
        cleanFileName,
        stem,
        extension: ext,
        status: "invalid",
        hasExistingPhoto: false,
        selected: false,
        reason: ext
          ? `امتداد الملف (${ext.toUpperCase()}) غير مدعوم. الصيغ المسموحة: JPG, PNG, WEBP`
          : "الملف لا يحتوي على امتداد صالح",
      });
      continue;
    }

    if (file.size <= 0) {
      initialResults.push({
        file,
        cleanFileName,
        stem,
        extension: ext,
        status: "invalid",
        hasExistingPhoto: false,
        selected: false,
        reason: "حجم الملف فارغ (0 بايت)",
      });
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      initialResults.push({
        file,
        cleanFileName,
        stem,
        extension: ext,
        status: "invalid",
        hasExistingPhoto: false,
        selected: false,
        reason: `حجم الملف (${(file.size / (1024 * 1024)).toFixed(1)}MB) يتجاوز الحد الأقصى (10MB)`,
      });
      continue;
    }

    // 2. محاولة المطابقة
    const outcome = resolveStem(stem, index);

    if (outcome.status === "matched" && outcome.matchedSubscriber) {
      const sub = outcome.matchedSubscriber;
      const hasPhoto = Boolean(sub.photoPath);
      const isDigits = outcome.confidence === "digits";
      // قاعدة التحديد: matched + ليس digits + (ليس لديه صورة أو تم تفعيل الاستبدال)
      const selected = !isDigits && (!hasPhoto || replaceExisting);

      let reason = outcome.reason;
      if (!reason) {
        if (hasPhoto && !replaceExisting) {
          reason = "المنخرط لديه صورة سابقة (الاستبدال معطل)";
        } else if (hasPhoto && replaceExisting) {
          reason = "المنخرط لديه صورة سابقة (سيتم استبدالها)";
        } else if (outcome.confidence === "exact") {
          reason = "مطابقة تامة برقم الملف";
        } else if (outcome.confidence === "normalized") {
          reason = "مطابقة بعد تطبيع الرموز والمسافات";
        } else if (outcome.confidence === "copy") {
          reason = "مطابقة بعد إزالة لاحقة النسخ";
        }
      }

      initialResults.push({
        file,
        cleanFileName,
        stem,
        extension: ext,
        status: "matched",
        confidence: outcome.confidence,
        matchedSubscriber: sub,
        hasExistingPhoto: hasPhoto,
        selected,
        reason,
      });
    } else if (outcome.status === "ambiguous") {
      initialResults.push({
        file,
        cleanFileName,
        stem,
        extension: ext,
        status: "ambiguous",
        confidence: outcome.confidence,
        ambiguousCandidates: outcome.ambiguousCandidates,
        hasExistingPhoto: false,
        selected: false,
        reason: outcome.reason || "تطابق أكثر من منخرط مع هذا الاسم",
      });
    } else {
      initialResults.push({
        file,
        cleanFileName,
        stem,
        extension: ext,
        status: "unmatched",
        hasExistingPhoto: false,
        selected: false,
        reason: outcome.reason || "لا يوجد منخرط مطابق لرقم الملف هذا",
      });
    }
  }

  // 3. معالجة التكرار (Duplicate Resolution)
  // تجميع كل الملفات التي طابقت نفس المنخرط
  const subMatchesMap = new Map<string, number[]>();
  initialResults.forEach((res, idx) => {
    if (res.status === "matched" && res.matchedSubscriber) {
      const subId = res.matchedSubscriber.id;
      const list = subMatchesMap.get(subId);
      if (list) list.push(idx);
      else subMatchesMap.set(subId, [idx]);
    }
  });

  for (const [, indices] of subMatchesMap) {
    if (indices.length <= 1) continue;

    // فرز الفائز: أعلى ثقة، ثم الأكبر حجماً، ثم الأسبق ظهوراً
    indices.sort((a, b) => {
      const resA = initialResults[a];
      const resB = initialResults[b];
      const scoreA = CONFIDENCE_SCORE[resA.confidence || "digits"];
      const scoreB = CONFIDENCE_SCORE[resB.confidence || "digits"];
      if (scoreA !== scoreB) return scoreB - scoreA;
      if (resA.file.size !== resB.file.size) return resB.file.size - resA.file.size;
      return a - b;
    });

    const winnerIdx = indices[0];
    const winnerItem = initialResults[winnerIdx];

    // البقية تصبح duplicate
    for (let i = 1; i < indices.length; i++) {
      const dupIdx = indices[i];
      const dupItem = initialResults[dupIdx];
      dupItem.status = "duplicate";
      dupItem.selected = false;
      dupItem.winningFileName = winnerItem.cleanFileName;
      dupItem.reason = `مكرر: تم تفضيل الملف "${winnerItem.cleanFileName}" لنفس المنخرط (${winnerItem.confidence === dupItem.confidence ? "الأكبر حجماً" : "الأعلى ثقة"})`;
    }
  }

  // 4. بناء الإحصائيات التجميعية
  const summary: BulkMatchSummary = {
    total: initialResults.length,
    matched: 0,
    hasPhoto: 0,
    digitsOnly: 0,
    ambiguous: 0,
    unmatched: 0,
    duplicate: 0,
    invalid: 0,
    selectedCount: 0,
  };

  for (const item of initialResults) {
    if (item.selected) summary.selectedCount++;

    switch (item.status) {
      case "matched":
        summary.matched++;
        if (item.hasExistingPhoto) summary.hasPhoto++;
        if (item.confidence === "digits") summary.digitsOnly++;
        break;
      case "ambiguous":
        summary.ambiguous++;
        break;
      case "unmatched":
        summary.unmatched++;
        break;
      case "duplicate":
        summary.duplicate++;
        break;
      case "invalid":
        summary.invalid++;
        break;
    }
  }

  return { results: initialResults, summary };
}

/**
 * توليد تقرير CSV بترميز UTF-8 مع BOM يفتح بدون تشوه في Excel
 */
export function generateMatchCsvReport(results: MatchResultItem[]): string {
  const BOM = "\uFEFF";
  const headers = [
    "اسم الملف",
    "الحالة",
    "الثقة",
    "رقم الملف المطابق",
    "اسم المنخرط",
    "المسبح",
    "لديه صورة سابقة",
    "محدد للرفع",
    "السبب / الملاحظات",
  ];

  const statusLabels: Record<MatchStatus, string> = {
    matched: "مطابق",
    ambiguous: "غامض",
    unmatched: "غير موجود",
    duplicate: "مكرر",
    invalid: "غير صالح",
  };

  const confidenceLabels: Record<MatchConfidence, string> = {
    exact: "تامة",
    normalized: "تطبيع",
    copy: "نسخة",
    digits: "أرقام فقط",
  };

  const escapeCsv = (val: string | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [headers.map(escapeCsv).join(",")];

  for (const r of results) {
    const subName = r.matchedSubscriber
      ? `${r.matchedSubscriber.lastName} ${r.matchedSubscriber.firstName}`.trim()
      : "";
    const poolName = r.matchedSubscriber?.poolName || "";
    const row = [
      escapeCsv(r.cleanFileName),
      escapeCsv(statusLabels[r.status] || r.status),
      escapeCsv(r.confidence ? confidenceLabels[r.confidence] : "—"),
      escapeCsv(r.matchedSubscriber?.fileNumber || "—"),
      escapeCsv(subName || "—"),
      escapeCsv(poolName || "—"),
      escapeCsv(r.hasExistingPhoto ? "نعم" : "لا"),
      escapeCsv(r.selected ? "نعم" : "لا"),
      escapeCsv(r.reason || "—"),
    ];
    rows.push(row.join(","));
  }

  return BOM + rows.join("\r\n");
}
