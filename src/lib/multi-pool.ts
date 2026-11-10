import { db } from "@/lib/db";
import crypto from "crypto";

export interface PoolConfig {
  id: string;
  clubId: string;
  name: string;
  code: string;
  fileNumberPrefix?: string | null;
  isDefault: boolean;
  active: boolean;
  status: string;
  capacity: number;
}

export interface EnrollmentInput {
  clubId: string;
  poolId: string;
  subscriberId: string;
  subscriptionType: string;
  paymentStatus: string;
  lastPaymentDate?: Date | null;
  startDate?: Date;
  expiryDate?: Date | null;
  isExempt?: boolean;
  swimmingDays?: string | null;
  timeSlot?: string | null;
  notes?: string | null;
  customFileNumber?: string | null;
}

// ─────────────────────────────────────────────────────────────
// 0. التحقق المعماري الصارم من بادئة الترقيم للمسبح (Prefix Rules)
// ─────────────────────────────────────────────────────────────
export interface PrefixValidationResult {
  valid: boolean;
  error?: string;
  normalizedPrefix?: string;
}

/**
 * يفرض القواعد المعمارية الصارمة لبادئة أرقام ملفات المسابح:
 * 1. المسبح الافتراضي: البادئة فارغة حصراً (empty string).
 * 2. المسبح غير الافتراضي: البادئة إلزامية (غير فارغة).
 * 3. الحد الأقصى للطول: 4 أحرف.
 * 4. الصيغة: حروف إنجليزية وأرقام فقط (A-Z0-9).
 * 5. عدم تكرار البادئة داخل النادي (حتى مع المسابح المؤرشفة).
 */
export function validatePoolPrefixRules(
  prefix: string | null | undefined,
  isDefault: boolean
): PrefixValidationResult {
  const clean = (prefix || "").trim().toUpperCase();

  // 1. المسبح الافتراضي: يجب أن تكون البادئة فارغة دائماً
  if (isDefault) {
    if (clean !== "") {
      return {
        valid: false,
        error: "المسبح الافتراضي لا يمكن أن يحتوي على بادئة ترقيم (يجب أن تكون البادئة فارغة).",
      };
    }
    return { valid: true, normalizedPrefix: "" };
  }

  // 2. المسبح غير الافتراضي: البادئة إلزامية وليست فارغة
  if (!clean) {
    return {
      valid: false,
      error: "كل مسبح فرعي غير افتراضي يجب أن يمتلك بادئة ترقيم خاصة به (مثل B, C, P1).",
    };
  }

  // 3. الحد الأقصى 4 أحرف
  if (clean.length > 4) {
    return {
      valid: false,
      error: `بادئة الترقيم لا يمكن أن تتجاوز 4 أحرف (الطول المدخل: ${clean.length} أحرف).`,
    };
  }

  // 4. الحروف الإنجليزية والأرقام فقط
  if (!/^[A-Z0-9]+$/.test(clean)) {
    return {
      valid: false,
      error: "بادئة الترقيم يجب أن تتكون من حروف إنجليزية وأرقام فقط (A-Z, 0-9) بدون مسافات أو رموز خاصة.",
    };
  }

  return { valid: true, normalizedPrefix: clean };
}

// ─────────────────────────────────────────────────────────────
// 1. توليد معرّف بطاقة عشوائي غير قابل للتخمين (Secure Card UID)
// ─────────────────────────────────────────────────────────────
export function generateSecureCardUid(poolId: string, subscriberId: string): string {
  const randomPart = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(`${poolId}:${subscriberId}:${randomPart}:${Date.now()}`)
    .digest("hex")
    .substring(0, 32);
  return `AQCR-${hash.toUpperCase()}`;
}

// ─────────────────────────────────────────────────────────────
// 2. ضمان وجود المسبح الافتراضي لكل نادٍ (Idempotent)
// ─────────────────────────────────────────────────────────────
export async function ensureDefaultPool(clubId: string, tx: any = db) {
  // فحص هل يوجد مسبح افتراضي مسبقاً
  let defaultPool = await tx.pool.findFirst({
    where: { clubId, isDefault: true },
  });

  if (!defaultPool) {
    // التحقق هل يوجد أي مسبح مسجل أصلاً للنادي
    const anyPool = await tx.pool.findFirst({
      where: { clubId },
      orderBy: { createdAt: "asc" },
    });

    if (anyPool) {
      // تعيين أول مسبح كافتراضي
      defaultPool = await tx.pool.update({
        where: { id: anyPool.id },
        data: { isDefault: true, fileNumberPrefix: anyPool.fileNumberPrefix || "" },
      });
    } else {
      // إنشاء المسبح الرئيسي الافتراضي
      defaultPool = await tx.pool.create({
        data: {
          clubId,
          name: "المسبح الرئيسي",
          code: "MAIN",
          fileNumberPrefix: "", // بادئة فارغة للمسبح الرئيسي
          isDefault: true,
          active: true,
          status: "active",
          capacity: 100,
          description: "المسبح التشغيلي الأساسي للنادي",
        },
      });
    }
  }

  return defaultPool;
}

// ─────────────────────────────────────────────────────────────
// 3. الترقيم الذري الآمن (Atomic File Number Generator)
// ─────────────────────────────────────────────────────────────
export async function generateAtomicFileNumber(
  clubId: string,
  poolId: string,
  numberingGroup: string = "RCS",
  customFileNumber?: string | null,
  tx: any = db
): Promise<{ fileNumber: string; seq: number }> {
  // جلب تفاصيل المسبح لمعرفة البادئة
  const pool = await tx.pool.findUnique({
    where: { id: poolId },
    select: { id: true, fileNumberPrefix: true, isDefault: true },
  });

  if (!pool) {
    throw new Error("المسبح غير موجود");
  }

  const prefix = (pool.fileNumberPrefix || "").trim();

  // إذا أدخل المستخدم رقماً يدوياً صريحاً
  if (customFileNumber && customFileNumber.trim()) {
    const trimmed = customFileNumber.trim();
    // استخراج القيمة الرقمية إن وجدت لتحديث العداد
    const match = trimmed.match(/(\d+)$/);
    if (match) {
      const explicitNum = parseInt(match[1], 10);
      await tx.poolNumberCounter.upsert({
        where: {
          clubId_poolId_numberingGroup: {
            clubId,
            poolId,
            numberingGroup,
          },
        },
        create: {
          clubId,
          poolId,
          numberingGroup,
          lastValue: explicitNum,
        },
        update: {
          lastValue: {
            // لا نخفض العداد أبداً إذا كان الرقم اليدوي أقل
            increment: 0,
          },
        },
      });
      // تحديث آمن إذا كان الرقم المدخل أكبر من العداد الحالي
      const currentCounter = await tx.poolNumberCounter.findUnique({
        where: {
          clubId_poolId_numberingGroup: {
            clubId,
            poolId,
            numberingGroup,
          },
        },
      });
      if (currentCounter && explicitNum > currentCounter.lastValue) {
        await tx.poolNumberCounter.update({
          where: { id: currentCounter.id },
          data: { lastValue: explicitNum },
        });
      }
    }
    return { fileNumber: trimmed, seq: match ? parseInt(match[1], 10) : 0 };
  }

  // التوليد الذري: تهيئة العداد إذا لم يكن موجوداً
  let counter = await tx.poolNumberCounter.findUnique({
    where: {
      clubId_poolId_numberingGroup: {
        clubId,
        poolId,
        numberingGroup,
      },
    },
  });

  if (!counter) {
    // حساب أعلى رقم حالي مسجل في هذا المسبح لتجنب أي تعارض
    const existingEnrollments = await tx.poolEnrollment.findMany({
      where: { clubId, poolId },
      select: { fileNumber: true },
    });

    let currentMax = 0;
    for (const en of existingEnrollments) {
      const match = en.fileNumber.match(/(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > currentMax) currentMax = val;
      }
    }

    // فحص إضافي في جدول المنخرطين القديم إذا كان المسبح الافتراضي
    if (pool.isDefault) {
      const existingSubs = await tx.subscriber.findMany({
        where: { clubId, fileNumber: { startsWith: numberingGroup } },
        select: { fileNumber: true },
      });
      for (const s of existingSubs) {
        const match = s.fileNumber.match(new RegExp(`^${numberingGroup}(\\d+)$`));
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > currentMax) currentMax = val;
        }
      }
    }

    counter = await tx.poolNumberCounter.upsert({
      where: {
        clubId_poolId_numberingGroup: {
          clubId,
          poolId,
          numberingGroup,
        },
      },
      create: {
        clubId,
        poolId,
        numberingGroup,
        lastValue: currentMax,
      },
      update: {},
    });
  }

  // زيادة العداد ذرياً بمقدار 1
  const updatedCounter = await tx.poolNumberCounter.update({
    where: {
      clubId_poolId_numberingGroup: {
        clubId,
        poolId,
        numberingGroup,
      },
    },
    data: {
      lastValue: { increment: 1 },
    },
  });

  const nextSeq = updatedCounter.lastValue;
  const numPart = String(nextSeq).padStart(3, "0");

  // تركيب رقم الملف النهائي حسب بادئة المسبح:
  // المسبح الافتراضي: RCS001
  // مسبح فرعي ببادئة B: B-RCS001
  const fileNumber = prefix
    ? `${prefix}-${numberingGroup}${numPart}`
    : `${numberingGroup}${numPart}`;

  return { fileNumber, seq: nextSeq };
}

// ─────────────────────────────────────────────────────────────
// 4. ترحيل المنخرطين القدامى إلى المسبح الافتراضي (Idempotent & Fast Batch)
// ─────────────────────────────────────────────────────────────
const readyClubsCache = new Set<string>();
const inflightReadyChecks = new Map<string, Promise<any>>();

export async function ensureClubMultiPoolReady(clubId: string) {
  if (!clubId) return null;
  if (readyClubsCache.has(clubId)) return ensureDefaultPool(clubId);

  const existingPromise = inflightReadyChecks.get(clubId);
  if (existingPromise) return existingPromise;

  const job = (async () => {
    try {
      const defaultPool = await ensureDefaultPool(clubId);
      const pendingCount = await db.subscriber.count({
        where: { clubId, enrollments: { none: {} } },
      });
      if (pendingCount > 0) {
        await migrateLegacySubscribers(clubId);
      } else {
        await Promise.all([
          db.subscriber.updateMany({
            where: { clubId, poolId: null, enrollments: { some: { poolId: defaultPool.id } } },
            data: { poolId: defaultPool.id },
          }).catch(() => null),
          db.attendance.updateMany({ where: { clubId, poolId: null }, data: { poolId: defaultPool.id } }).catch(() => null),
          db.swimmingTimeSlot.updateMany({ where: { clubId, poolId: null }, data: { poolId: defaultPool.id } }).catch(() => null),
        ]);
      }
      readyClubsCache.add(clubId);
      return defaultPool;
    } finally {
      inflightReadyChecks.delete(clubId);
    }
  })();

  inflightReadyChecks.set(clubId, job);
  return job;
}

export async function migrateLegacySubscribers(clubId: string, tx: any = db) {
  const defaultPool = await ensureDefaultPool(clubId, tx);

  // المنخرطون الذين لم يُسجل لهم أي انخراط بعد
  const subscribersWithoutEnrollment = await tx.subscriber.findMany({
    where: {
      clubId,
      enrollments: { none: {} },
    },
    include: {
      renewals: {
        orderBy: { renewalDate: "desc" },
        take: 1,
      },
    },
  });

  let migratedCount = 0;

  if (subscribersWithoutEnrollment.length > 0) {
    // 1. إنشاء الانخراطات دفعة واحدة (سريع وآمن دون مهلة على السحابة)
    const enrollmentData = subscribersWithoutEnrollment.map((sub: any) => ({
      clubId,
      poolId: defaultPool.id,
      subscriberId: sub.id,
      fileNumber: sub.fileNumber,
      status: sub.deletedAt ? "archived" : "active",
      subscriptionType: sub.subscriptionType || "RCS",
      paymentStatus: sub.paymentStatus || "لم يدفع",
      lastPaymentDate: sub.lastPaymentDate,
      expiryDate: sub.renewals?.[0]?.expiryDate || null,
      swimmingDays: sub.swimmingDays,
      timeSlot: sub.timeSlot,
      startDate: sub.createdAt || new Date(),
    }));

    try {
      await tx.poolEnrollment.createMany({ data: enrollmentData });
      migratedCount = enrollmentData.length;
    } catch {
      // احتياط عند سباق متزامن: إنشاء فردي آمن
      for (const row of enrollmentData) {
        const exists = await tx.poolEnrollment.findFirst({
          where: { clubId, poolId: defaultPool.id, subscriberId: row.subscriberId },
          select: { id: true },
        });
        if (!exists) {
          await tx.poolEnrollment.create({ data: row }).catch(() => null);
          migratedCount++;
        }
      }
    }

    // 2. إنشاء بطاقات العضوية للانخراطات الجديدة التي لا تملك بطاقة
    const enrollmentsNeedingCards = await tx.poolEnrollment.findMany({
      where: {
        clubId,
        poolId: defaultPool.id,
        cards: { none: {} },
      },
      select: {
        id: true,
        subscriberId: true,
        fileNumber: true,
        expiryDate: true,
        startDate: true,
      },
    });

    if (enrollmentsNeedingCards.length > 0) {
      const cardData = enrollmentsNeedingCards.map((enr: any) => ({
        clubId,
        poolId: defaultPool.id,
        subscriberId: enr.subscriberId,
        enrollmentId: enr.id,
        cardUid: generateSecureCardUid(defaultPool.id, enr.subscriberId),
        cardNumber: enr.fileNumber,
        status: "active",
        issueDate: enr.startDate || new Date(),
        expiryDate: enr.expiryDate,
      }));
      await tx.membershipCard.createMany({ data: cardData }).catch(async () => {
        for (const c of cardData) {
          await tx.membershipCard.create({ data: c }).catch(() => null);
        }
      });
    }

    // 3. مزامنة العداد التسلسلي (PoolNumberCounter) لتجنب تصادم أرقام الملفات
    let maxSeq = 0;
    for (const sub of subscribersWithoutEnrollment) {
      const nums = String(sub.fileNumber || "").match(/\d+/g);
      if (nums) {
        const val = parseInt(nums[nums.length - 1], 10);
        if (!isNaN(val) && val > maxSeq && val < 1000000) maxSeq = val;
      }
    }
    if (maxSeq > 0) {
      const existingCounter = await tx.poolNumberCounter.findUnique({
        where: { clubId_poolId_numberingGroup: { clubId, poolId: defaultPool.id, numberingGroup: "RCS" } },
      }).catch(() => null);
      if (!existingCounter) {
        await tx.poolNumberCounter.create({
          data: { clubId, poolId: defaultPool.id, numberingGroup: "RCS", lastValue: maxSeq },
        }).catch(() => null);
      } else if (existingCounter.lastValue < maxSeq) {
        await tx.poolNumberCounter.update({
          where: { id: existingCounter.id },
          data: { lastValue: maxSeq },
        }).catch(() => null);
      }
    }
  }

  // تحديث poolId على المنخرطين المرتبطين بالمسبح الافتراضي فقط كمرجع توافق أساسي
  await tx.subscriber.updateMany({
    where: { clubId, poolId: null, enrollments: { some: { poolId: defaultPool.id } } },
    data: { poolId: defaultPool.id },
  }).catch(() => null);

  // تحديث الحضور القديم الذي ليس له poolId
  await tx.attendance.updateMany({
    where: { clubId, poolId: null },
    data: { poolId: defaultPool.id },
  }).catch(() => null);

  // تحديث الحصص القديمة التي ليس لها poolId
  await tx.swimmingTimeSlot.updateMany({
    where: { clubId, poolId: null },
    data: { poolId: defaultPool.id },
  }).catch(() => null);

  return { defaultPool, migratedCount };
}

// ─────────────────────────────────────────────────────────────
// 5. التحقق الأمني من ملكية النادي (Strict Multi-Tenancy Guard)
// ─────────────────────────────────────────────────────────────
export async function assertClubOwnership(
  clubId: string,
  entities: {
    poolId?: string;
    subscriberId?: string;
    enrollmentId?: string;
  },
  tx: any = db
): Promise<void> {
  if (entities.poolId) {
    const pool = await tx.pool.findFirst({
      where: { id: entities.poolId, clubId },
      select: { id: true },
    });
    if (!pool) {
      throw new Error(`المسبح (${entities.poolId}) غير تابع لهذا النادي أو غير موجود.`);
    }
  }

  if (entities.subscriberId) {
    const sub = await tx.subscriber.findFirst({
      where: { id: entities.subscriberId, clubId },
      select: { id: true },
    });
    if (!sub) {
      throw new Error(`المنخرط (${entities.subscriberId}) غير تابع لهذا النادي أو غير موجود.`);
    }
  }

  if (entities.enrollmentId) {
    const en = await tx.poolEnrollment.findFirst({
      where: { id: entities.enrollmentId, clubId },
      select: { id: true },
    });
    if (!en) {
      throw new Error(`الانخراط (${entities.enrollmentId}) غير تابع لهذا النادي أو غير موجود.`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 6. خدمة إنشاء انخراط ذري في مسبح (Create Pool Enrollment Service)
// ─────────────────────────────────────────────────────────────
export interface CreatePoolEnrollmentParams {
  clubId: string;
  poolId: string;
  subscriberId: string;
  subscriptionType: string;
  paymentStatus?: string;
  lastPaymentDate?: Date | null;
  startDate?: Date;
  expiryDate?: Date | null;
  isExempt?: boolean;
  swimmingDays?: string | null;
  timeSlot?: string | null;
  notes?: string | null;
  customFileNumber?: string | null;
  tx?: any;
}

export async function createPoolEnrollmentService(params: CreatePoolEnrollmentParams) {
  const runner = async (tx: any) => {
    const {
      clubId,
      poolId,
      subscriberId,
      subscriptionType,
      paymentStatus = "مدفوع",
      lastPaymentDate = new Date(),
      startDate = new Date(),
      expiryDate = null,
      isExempt = false,
      swimmingDays = null,
      timeSlot = null,
      notes = null,
      customFileNumber = null,
    } = params;

    // 1. التحقق من ملكية الكيانات
    await assertClubOwnership(clubId, { poolId, subscriberId }, tx);

    const pool = await tx.pool.findUnique({
      where: { id: poolId },
      select: { id: true, name: true, isDefault: true, fileNumberPrefix: true, active: true },
    });

    if (!pool || !pool.active) {
      throw new Error("المسبح غير موجود أو معطل");
    }

    // 2. التحقق من عدم وجود انخراط نشط مسبقاً للشخص في هذا المسبح
    const existingActive = await tx.poolEnrollment.findFirst({
      where: {
        clubId,
        poolId,
        subscriberId,
        status: "active",
      },
    });

    if (existingActive) {
      throw new Error(
        `المنخرط يمتلك انخراطاً نشطاً بالفعل في مسبح "${pool.name}" برقم الملف (${existingActive.fileNumber}). لا يمكن إنشاء انخراط نشط مكرر.`
      );
    }

    // 3. التحقق من قواعد البادئة وتوليد رقم الملف الذري
    const prefixCheck = validatePoolPrefixRules(pool.fileNumberPrefix, pool.isDefault);
    if (!prefixCheck.valid) {
      throw new Error(`خطأ في بادئة المسبح: ${prefixCheck.error}`);
    }

    const subType = await tx.subscriptionType.findFirst({
      where: { clubId, code: subscriptionType },
    });
    const numberingGroup = subType?.numberingGroup || "RCS";

    let fileNumber: string;
    if (subType && !subType.givesMembershipNumber) {
      const pfx = prefixCheck.normalizedPrefix || "";
      fileNumber = pfx ? `${pfx}-${subscriptionType}` : subscriptionType;
    } else {
      const numResult = await generateAtomicFileNumber(
        clubId,
        pool.id,
        numberingGroup,
        customFileNumber,
        tx
      );
      fileNumber = numResult.fileNumber;
    }

    // 4. إنشاء الانخراط التشغيلي
    const enrollment = await tx.poolEnrollment.create({
      data: {
        clubId,
        poolId: pool.id,
        subscriberId,
        fileNumber,
        status: "active",
        subscriptionType,
        paymentStatus,
        lastPaymentDate,
        startDate,
        expiryDate,
        isExempt,
        swimmingDays,
        timeSlot,
        notes,
      },
    });

    // 5. إنشاء بطاقة العضوية المشفرة
    const cardUid = generateSecureCardUid(pool.id, subscriberId);
    const card = await tx.membershipCard.create({
      data: {
        clubId,
        poolId: pool.id,
        subscriberId,
        enrollmentId: enrollment.id,
        cardUid,
        cardNumber: fileNumber,
        status: "active",
        issueDate: lastPaymentDate || startDate,
        expiryDate,
      },
    });

    // 6. تطبيق قاعدة Subscriber.poolId الصارمة:
    // إذا كان المسبح المستهدف هو المسبح الافتراضي (Default Pool)، نحدّث الحقول القديمة في Subscriber.
    // إذا كان مسبحاً ثانوياً، لا نلمس Subscriber.poolId إطلاقاً!
    if (pool.isDefault) {
      await tx.subscriber.update({
        where: { id: subscriberId },
        data: {
          poolId: pool.id,
          fileNumber,
          subscriptionType,
          paymentStatus,
          lastPaymentDate,
          swimmingDays,
          timeSlot,
        },
      });
    }

    return { enrollment, card, pool };
  };

  if (params.tx) {
    return runner(params.tx);
  }
  return db.$transaction(runner);
}

// ─────────────────────────────────────────────────────────────
// 7. خدمة تجديد الانخراط التاريخي الكامل (Renew Pool Enrollment Service)
// ─────────────────────────────────────────────────────────────
export interface RenewPoolEnrollmentParams {
  clubId: string;
  enrollmentId: string;
  months?: number;
  newExpiryDate?: Date;
  amount?: number;
  paymentMethod?: string;
  transactionId?: string;
  subscriptionType?: string;
  renewedById?: string;
  notes?: string;
  tx?: any;
}

export async function renewPoolEnrollmentService(params: RenewPoolEnrollmentParams) {
  const runner = async (tx: any) => {
    const {
      clubId,
      enrollmentId,
      months = 1,
      newExpiryDate,
      amount = 0,
      paymentMethod = "نقداً",
      transactionId = null,
      subscriptionType,
      renewedById = null,
      notes = null,
    } = params;

    await assertClubOwnership(clubId, { enrollmentId }, tx);

    const enrollment = await tx.poolEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { pool: true, subscriber: true },
    });

    if (!enrollment) {
      throw new Error("الانخراط غير موجود");
    }

    const previousExpiry = enrollment.expiryDate;
    let targetExpiry: Date;

    if (newExpiryDate) {
      targetExpiry = new Date(newExpiryDate);
    } else {
      const baseDate = previousExpiry && new Date(previousExpiry) > new Date()
        ? new Date(previousExpiry)
        : new Date();
      targetExpiry = new Date(baseDate);
      targetExpiry.setMonth(targetExpiry.getMonth() + months);
    }

    const renewalTimestamp = new Date();
    const effectiveSubType = subscriptionType || enrollment.subscriptionType;

    // 1. تسجيل سجل التجديد الكامل وغير المنقوص في PoolEnrollmentRenewal
    const renewalRecord = await tx.poolEnrollmentRenewal.create({
      data: {
        clubId,
        poolId: enrollment.poolId,
        subscriberId: enrollment.subscriberId,
        enrollmentId: enrollment.id,
        previousExpiryDate: previousExpiry,
        newExpiryDate: targetExpiry,
        renewedAt: renewalTimestamp,
        renewedById,
        subscriptionType: effectiveSubType,
        months,
        amount,
        paymentMethod,
        transactionId,
        notes,
      },
    });

    // 2. تحديث الانخراط التشغيلي
    const updatedEnrollment = await tx.poolEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "active",
        expiryDate: targetExpiry,
        lastPaymentDate: renewalTimestamp,
        paymentStatus: "مدفوع",
        renewedAt: renewalTimestamp,
        renewalCount: { increment: 1 },
        previousExpiryDate: previousExpiry,
        subscriptionType: effectiveSubType,
      },
    });

    // 3. تحديث صلاحية البطاقة
    await tx.membershipCard.updateMany({
      where: { enrollmentId: enrollment.id, status: "active" },
      data: { expiryDate: targetExpiry },
    });

    // 4. تطبيق قاعدة Subscriber.poolId الصارمة:
    // إذا كان الانخراط في المسبح الافتراضي، نحدث تاريخ الدفع وحالة الدفع في Subscriber
    if (enrollment.pool.isDefault) {
      await tx.subscriber.update({
        where: { id: enrollment.subscriberId },
        data: {
          lastPaymentDate: renewalTimestamp,
          paymentStatus: "مدفوع",
          subscriptionType: effectiveSubType,
        },
      });
    }

    return { enrollment: updatedEnrollment, renewalRecord };
  };

  if (params.tx) {
    return runner(params.tx);
  }
  return db.$transaction(runner);
}

// ─────────────────────────────────────────────────────────────
// 8. خدمة نقل المنخرط بين المسابح (Transfer Subscriber Service)
// ─────────────────────────────────────────────────────────────
export interface TransferSubscriberParams {
  clubId: string;
  subscriberId: string;
  sourcePoolId: string;
  targetPoolId: string;
  keepFileNumber?: boolean;
  customFileNumber?: string | null;
  transferredById?: string;
  reason?: string;
  tx?: any;
}

export async function transferSubscriberService(params: TransferSubscriberParams) {
  const runner = async (tx: any) => {
    const {
      clubId,
      subscriberId,
      sourcePoolId,
      targetPoolId,
      keepFileNumber = false,
      customFileNumber = null,
      transferredById = null,
      reason = null,
    } = params;

    if (sourcePoolId === targetPoolId) {
      throw new Error("لا يمكن نقل المنخرط إلى نفس المسبح.");
    }

    await assertClubOwnership(clubId, { subscriberId, poolId: sourcePoolId }, tx);
    await assertClubOwnership(clubId, { poolId: targetPoolId }, tx);

    const [sourcePool, targetPool, subscriber] = await Promise.all([
      tx.pool.findUnique({ where: { id: sourcePoolId } }),
      tx.pool.findUnique({ where: { id: targetPoolId } }),
      tx.subscriber.findUnique({ where: { id: subscriberId } }),
    ]);

    if (!sourcePool || !targetPool || !subscriber) {
      throw new Error("بيانات المسبح أو المنخرط غير مكتملة.");
    }

    // جلب الانخراط الحالي في المسبح المصدر
    const sourceEnrollment = await tx.poolEnrollment.findFirst({
      where: { clubId, poolId: sourcePoolId, subscriberId, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    const oldFileNumber = sourceEnrollment?.fileNumber || subscriber.fileNumber;
    let newFileNumber = oldFileNumber;
    let seq = 0;

    if (!keepFileNumber) {
      const subType = await tx.subscriptionType.findFirst({
        where: { clubId, code: sourceEnrollment?.subscriptionType || subscriber.subscriptionType },
      });
      const group = subType?.numberingGroup || "RCS";
      const numResult = await generateAtomicFileNumber(
        clubId,
        targetPoolId,
        group,
        customFileNumber,
        tx
      );
      newFileNumber = numResult.fileNumber;
      seq = numResult.seq;
    }

    // أرشفة الانخراط في المسبح المصدر
    if (sourceEnrollment) {
      await tx.poolEnrollment.update({
        where: { id: sourceEnrollment.id },
        data: {
          status: "transferred",
          archivedAt: new Date(),
        },
      });
      // تعطيل البطاقة السابقة في المسبح المصدر
      await tx.membershipCard.updateMany({
        where: { enrollmentId: sourceEnrollment.id, status: "active" },
        data: { status: "replaced", revokedAt: new Date(), revokedReason: `تم النقل إلى مسبح ${targetPool.name}` },
      });
    }

    // إنشاء أو تحديث الانخراط في المسبح الهدف
    const existingTarget = await tx.poolEnrollment.findFirst({
      where: { clubId, poolId: targetPoolId, subscriberId },
      orderBy: { createdAt: "desc" },
    });

    let targetEnrollment;
    if (existingTarget) {
      targetEnrollment = await tx.poolEnrollment.update({
        where: { id: existingTarget.id },
        data: {
          fileNumber: newFileNumber,
          status: "active",
          archivedAt: null,
          subscriptionType: sourceEnrollment?.subscriptionType || subscriber.subscriptionType,
          paymentStatus: sourceEnrollment?.paymentStatus || subscriber.paymentStatus,
          lastPaymentDate: sourceEnrollment?.lastPaymentDate || subscriber.lastPaymentDate,
          swimmingDays: sourceEnrollment?.swimmingDays || subscriber.swimmingDays,
          timeSlot: sourceEnrollment?.timeSlot || subscriber.timeSlot,
          renewedAt: new Date(),
        },
      });
    } else {
      targetEnrollment = await tx.poolEnrollment.create({
        data: {
          clubId,
          poolId: targetPoolId,
          subscriberId,
          fileNumber: newFileNumber,
          status: "active",
          subscriptionType: sourceEnrollment?.subscriptionType || subscriber.subscriptionType,
          paymentStatus: sourceEnrollment?.paymentStatus || subscriber.paymentStatus,
          lastPaymentDate: sourceEnrollment?.lastPaymentDate || subscriber.lastPaymentDate,
          swimmingDays: sourceEnrollment?.swimmingDays || subscriber.swimmingDays,
          timeSlot: sourceEnrollment?.timeSlot || subscriber.timeSlot,
        },
      });
    }

    // إنشاء بطاقة عضوية جديدة في المسبح الهدف
    const cardUid = generateSecureCardUid(targetPoolId, subscriberId);
    const newCard = await tx.membershipCard.create({
      data: {
        clubId,
        poolId: targetPoolId,
        subscriberId,
        enrollmentId: targetEnrollment.id,
        cardUid,
        cardNumber: newFileNumber,
        status: "active",
        issueDate: new Date(),
      },
    });

    // توثيق النقل في SubscriberTransfer
    const transferLog = await tx.subscriberTransfer.create({
      data: {
        clubId,
        subscriberId,
        sourcePoolId,
        targetPoolId,
        sourceEnrollmentId: sourceEnrollment?.id || null,
        targetEnrollmentId: targetEnrollment.id,
        transferFileNumber: keepFileNumber,
        oldFileNumber,
        newFileNumber,
        reason,
        transferredById,
      },
    });

    // إذا تغير رقم الملف، نسجل في FileNumberHistory
    if (oldFileNumber !== newFileNumber) {
      await tx.fileNumberHistory.create({
        data: {
          clubId,
          subscriberId,
          enrollmentId: targetEnrollment.id,
          poolId: targetPoolId,
          oldFileNumber,
          newFileNumber,
          reason: reason || `نقل من مسبح ${sourcePool.name} إلى ${targetPool.name}`,
          changedById: transferredById,
        },
      });
    }

    // قاعدة Subscriber.poolId الصارمة:
    // إذا كان المسبح الهدف هو المسبح الافتراضي -> نحدّث Subscriber.poolId
    // إذا كان المسبح المصدر هو الافتراضي والهدف ليس افتراضياً -> يصبح Subscriber.poolId = null (ما لم يوجد انخراط آخر في الافتراضي)
    if (targetPool.isDefault) {
      await tx.subscriber.update({
        where: { id: subscriberId },
        data: {
          poolId: targetPool.id,
          fileNumber: newFileNumber,
          subscriptionType: targetEnrollment.subscriptionType,
          paymentStatus: targetEnrollment.paymentStatus,
        },
      });
    } else if (sourcePool.isDefault) {
      // فحص هل يوجد انخراط آخر لا يزال نشطاً في المسبح الافتراضي
      const remainingDefault = await tx.poolEnrollment.findFirst({
        where: { clubId, poolId: sourcePoolId, subscriberId, status: "active" },
      });
      if (!remainingDefault) {
        await tx.subscriber.update({
          where: { id: subscriberId },
          data: { poolId: null },
        });
      }
    }

    return {
      transferLog,
      targetEnrollment,
      newCard,
      oldFileNumber,
      newFileNumber,
    };
  };

  if (params.tx) {
    return runner(params.tx);
  }
  return db.$transaction(runner);
}

// ─────────────────────────────────────────────────────────────
// 9. خدمة حل معرّفات QR والبطاقات (Resolve Card & QR Service)
// ─────────────────────────────────────────────────────────────
export interface ResolveCardResult {
  found: boolean;
  ambiguous?: boolean;
  message?: string;
  subscriber?: any;
  enrollment?: any;
  card?: any;
  pool?: any;
  candidateEnrollments?: any[];
}

export async function resolveCardOrFileNumberService(
  clubId: string,
  identifier: string,
  poolIdContext?: string | null,
  tx: any = db
): Promise<ResolveCardResult> {
  const clean = identifier.trim();
  if (!clean) {
    return { found: false, message: "رمز البطاقة أو رقم الملف فارغ." };
  }

  // ════ الأولوية 1: البحث بالمعرف التشفيري الآمن (cardUid: AQCR-...) ════
  const card = await tx.membershipCard.findUnique({
    where: { cardUid: clean },
    include: {
      subscriber: true,
      enrollment: true,
      pool: true,
    },
  });

  if (card && card.clubId === clubId) {
    return {
      found: true,
      card,
      enrollment: card.enrollment,
      subscriber: card.subscriber,
      pool: card.pool,
    };
  }

  // ════ الأولوية 2: البحث برقم الملف (fileNumber) للتوافق القديم ════
  // الحالة أ: تم تمرير سياق المسبح المحدد صراحة
  if (poolIdContext) {
    const enrollment = await tx.poolEnrollment.findFirst({
      where: {
        clubId,
        poolId: poolIdContext,
        fileNumber: clean,
        status: "active",
      },
      include: {
        subscriber: true,
        pool: true,
        cards: { where: { status: "active" }, take: 1 },
      },
    });

    if (enrollment) {
      return {
        found: true,
        enrollment,
        subscriber: enrollment.subscriber,
        pool: enrollment.pool,
        card: enrollment.cards[0] || null,
      };
    }
  }

  // الحالة ب: لم يتم تمرير سياق المسبح (جهاز مسح QR عام)
  // نبحث عن كل الانخراطات النشطة بهذا الرقم في النادي
  const candidateEnrollments = await tx.poolEnrollment.findMany({
    where: {
      clubId,
      fileNumber: clean,
      status: "active",
    },
    include: {
      subscriber: true,
      pool: true,
      cards: { where: { status: "active" }, take: 1 },
    },
  });

  // إذا وجد انخراط نشط واحد فقط -> تطابق تام ومؤكد
  if (candidateEnrollments.length === 1) {
    const single = candidateEnrollments[0];
    return {
      found: true,
      enrollment: single,
      subscriber: single.subscriber,
      pool: single.pool,
      card: single.cards[0] || null,
    };
  }

  // ⚠️ إذا وجد أكثر من انخراط نشط لنفس رقم الملف عبر مسابح مختلفة:
  // نرفض التطابق الغامض فوراً حماية للبيانات ونطلب تحديد المسبح (الشرط 3 من المهندس)
  if (candidateEnrollments.length > 1) {
    return {
      found: false,
      ambiguous: true,
      message: `رقم الملف (${clean}) مسجل في عدة مسابح نشطة (${candidateEnrollments.map((c: any) => c.pool.name).join("، ")}). يرجى اختيار المسبح المستهدف لإتمام تسجيل الحضور بدقة.`,
      candidateEnrollments: candidateEnrollments.map((c: any) => ({
        id: c.id,
        enrollmentId: c.id,
        poolId: c.pool.id,
        poolName: c.pool.name,
        fileNumber: c.fileNumber,
        status: c.status,
        subscriptionType: c.subscriptionType,
        subscriberName: `${c.subscriber.lastName} ${c.subscriber.firstName}`,
        pool: {
          id: c.pool.id,
          name: c.pool.name,
          color: c.pool.color,
          fileNumberPrefix: c.pool.fileNumberPrefix,
        },
        subscriber: {
          id: c.subscriber.id,
          lastName: c.subscriber.lastName,
          firstName: c.subscriber.firstName,
          fileNumber: c.subscriber.fileNumber,
        },
      })),
    };
  }

  // الحالة ج: فحص المسبح الافتراضي كخيار أخير للتوافق
  const defaultPool = await tx.pool.findFirst({
    where: { clubId, isDefault: true },
  });
  if (defaultPool) {
    const legacySub = await tx.subscriber.findFirst({
      where: {
        clubId,
        fileNumber: clean,
        deletedAt: null,
      },
    });
    if (legacySub) {
      return {
        found: true,
        subscriber: legacySub,
        pool: defaultPool,
        message: "تم التعرف على المنخرط عبر سجل التوافق في المسبح الافتراضي.",
      };
    }
  }

  return { found: false, message: `لم يتم العثور على أي بطاقة أو انخراط صالح برقم (${clean}).` };
}
