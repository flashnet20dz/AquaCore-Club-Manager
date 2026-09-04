import { db } from "@/lib/db";
import {
  COMPOUND_FEE,
  type CompoundEntry,
  type CompoundListResult,
  type EnteteLogo,
} from "@/lib/compound-format";

/**
 * ══════════════════════════════════════════════════════════════
 *  قائمة حقوق المركب — منطق قاعدة البيانات (الشاشة + التصدير)
 * ──────────────────────────────────────────────────────────────
 *  الدورة الشهرية الرسمية للنادي (حسب الوثيقة الرسمية):
 *  الشهر المحدد "أغسطس 2026" يغطي الفترة: من 29/07/2026 إلى غاية 28/08/2026
 *  أي: من اليوم 29 من الشهر السابق إلى اليوم 28 من الشهر المحدد.
 * ══════════════════════════════════════════════════════════════
 */

export * from "@/lib/compound-format";

export interface CompoundPeriod {
  start: Date;
  end: Date;
}

/** حساب فترة الشهر المحدد حسب الدورة الرسمية 29 ← 28 */
export function getCompoundPeriod(year: number, month: number): CompoundPeriod {
  // البداية: اليوم 29 من الشهر السابق (JS يتقبّل الشهر -1 فينتقل للسنة السابقة تلقائياً)
  const start = new Date(year, month - 2, 29, 0, 0, 0);
  // النهاية: اليوم 28 من الشهر المحدد
  const end = new Date(year, month - 1, 28, 23, 59, 59, 999);
  return { start, end };
}

/**
 * جلب قائمة المنخرطين الذين دفعوا حقوق المركب خلال فترة الشهر المحدد.
 * نفس المنطق للشاشة وللتصدير — مصدر واحد للحقيقة.
 * @param ids اختياري: تصفية بمعرّفات منخرطين محددين (تصدير المحددين)
 */
export async function fetchCompoundList(
  clubId: string | null | undefined,
  year: number,
  month: number,
  ids?: string[]
): Promise<CompoundListResult> {
  const { start, end } = getCompoundPeriod(year, month);

  const idFilter = ids && ids.length > 0 ? { id: { in: ids } } : {};

  // ════ 1) التسجيل الجديد: lastPaymentDate ضمن الفترة ════
  const newSubscribers = await db.subscriber.findMany({
    where: {
      clubId: clubId || undefined,
      lastPaymentDate: { gte: start, lte: end },
      deletedAt: null,
      ...idFilter,
    },
    select: {
      id: true,
      fileNumber: true,
      lastName: true,
      firstName: true,
      birthDate: true,
      subscriptionType: true,
      lastPaymentDate: true,
      paymentStatus: true,
    },
    orderBy: { lastPaymentDate: "asc" },
  });

  // أنواع الاشتراك لمعرفة الأنواع المؤهلة لحقوق المركب
  const subTypes = await db.subscriptionType.findMany({
    where: clubId ? { clubId } : {},
    select: { code: true, subscriptionFee: true, requiresCompoundFee: true },
  });
  const subTypeMap = new Map<string, { fee: number; requiresCompound: boolean }>();
  for (const t of subTypes) {
    subTypeMap.set(t.code, { fee: t.subscriptionFee, requiresCompound: t.requiresCompoundFee });
  }

  // 🔑 فلترة: فقط من يدفع 1300 أو 1500 (يتطلب حقوق المركب)
  const eligibleNew = newSubscribers.filter((s) => {
    const config = subTypeMap.get(s.subscriptionType);
    if (!config) {
      if (s.subscriptionType === "/") return true;
      return false;
    }
    return config.requiresCompound && (config.fee === 1300 || config.fee === 1500);
  });

  // ════ 2) التجديدات: renewalDate ضمن الفترة ════
  const renewals = await db.renewal.findMany({
    where: {
      clubId: clubId || undefined,
      renewalDate: { gte: start, lte: end },
      ...idFilter,
    },
    include: {
      subscriber: {
        select: {
          id: true,
          fileNumber: true,
          lastName: true,
          firstName: true,
          birthDate: true,
          subscriptionType: true,
        },
      },
    },
    orderBy: { renewalDate: "asc" },
  });

  const eligibleRenewals = renewals.filter((r) => r.amount === 1300 || r.amount === 1500);

  // ════ 3) دمج القائمتين دون تكرار (الأحدث يفوز) ════
  const merged = new Map<
    string,
    {
      subscriberId: string;
      fileNumber: string;
      lastName: string;
      firstName: string;
      birthDate: Date;
      date: Date;
      source: "new" | "renewal";
      amount: number;
    }
  >();

  for (const s of eligibleNew) {
    if (!s.lastPaymentDate) continue;
    merged.set(s.id, {
      subscriberId: s.id,
      fileNumber: s.fileNumber,
      lastName: s.lastName,
      firstName: s.firstName,
      birthDate: s.birthDate,
      date: s.lastPaymentDate,
      source: "new",
      amount: COMPOUND_FEE,
    });
  }

  for (const r of eligibleRenewals) {
    const existing = merged.get(r.subscriberId);
    if (!existing || r.renewalDate > existing.date) {
      merged.set(r.subscriberId, {
        subscriberId: r.subscriberId,
        fileNumber: r.subscriber.fileNumber,
        lastName: r.subscriber.lastName,
        firstName: r.subscriber.firstName,
        birthDate: r.subscriber.birthDate,
        date: r.renewalDate,
        source: "renewal",
        amount: COMPOUND_FEE,
      });
    }
  }

  const list = Array.from(merged.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    month,
    year,
    periodFrom: start.toISOString(),
    periodTo: end.toISOString(),
    entries: list.map(
      (r): CompoundEntry => ({
        subscriberId: r.subscriberId,
        fileNumber: r.fileNumber,
        lastName: r.lastName,
        firstName: r.firstName,
        birthDate: r.birthDate.toISOString(),
        date: r.date.toISOString(),
        source: r.source,
        amount: r.amount,
      })
    ),
    stats: {
      total: list.length,
      newCount: list.filter((r) => r.source === "new").length,
      renewalCount: list.filter((r) => r.source === "renewal").length,
      totalCompound: list.length * COMPOUND_FEE,
    },
  };
}

/**
 * جلب شعارات النادي من إعدادات الترويسة (نفس مصدر إعدادات المظهر).
 * حتى 3 شعارات تُرسم في ترويسة المستند.
 * عند غياب الإعدادات: شعار النادي الافتراضي (نفس سلوك ترويسة التصدير العامة).
 */
export async function loadClubLogos(clubId: string | null | undefined): Promise<EnteteLogo[]> {
  try {
    if (!clubId) return [{ src: "/images/rcs-logo-official.png", width: 70, height: 70 }];
    const setting = await db.setting.findFirst({ where: { clubId, key: "enteteConfig" } });
    if (!setting) return [{ src: "/images/rcs-logo-official.png", width: 70, height: 70 }];
    const parsed = JSON.parse(setting.value) as {
      elements?: Array<{ type?: string; src?: string; width?: number; height?: number; slot?: string }>;
    };
    const logoEls = (parsed.elements || []).filter((el) => el.type === "logo" && el.src);
    // حتى 3 شعارات بنفس ترتيب إعدادات الترويسة (في RTL: الأول يظهر يميناً)
    return logoEls
      .slice(0, 3)
      .map((el) => ({ src: el.src!, width: el.width || 70, height: el.height || 70 }));
  } catch {
    return [];
  }
}
