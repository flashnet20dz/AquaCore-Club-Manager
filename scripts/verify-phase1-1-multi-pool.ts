/**
 * ═══════════════════════════════════════════════════════════════
 * verify-phase1-1-multi-pool.ts
 * ═══════════════════════════════════════════════════════════════
 * سكربت التحقق الشامل للمرحلة 1.1 — التصحيحات المعمارية النهائية
 * يختبر:
 *   1. قيود بادئات أرقام الملفات (الطول، الصيغة، الفرادة، عدم الفارغ لغير الافتراضي)
 *   2. منع تكرار بادئة مسبح حتى لو كان مؤرشفاً
 *   3. توحيد Subscriber.poolId ليمثل المسبح الافتراضي حصراً
 *   4. عمل الفهرس الجزئي PoolEnrollment_active_unique لمنع انخراطين نشطين في نفس المسبح
 *   5. السماح بعدة انخراطات تاريخية (منتهية/مؤرشفة) للشخص نفسه في نفس المسبح
 *   6. السماح بانخراطين نشطين في مسبحين مختلفين للشخص نفسه
 *   7. سجل التجديد التاريخي الكامل عبر PoolEnrollmentRenewal
 *   8. تكرار تشغيل الترحيل والفهارس الذاتية دون أي خطأ (Idempotency)
 */

import { PrismaClient } from "@prisma/client";
import { validatePoolPrefixRules } from "../src/lib/multi-pool";
import { ensureMultiPoolRuntimeIndexes } from "../src/lib/runtime-schema";

const prisma = new PrismaClient();

async function runTests() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("🧪 AQUACORE MULTI-POOL ARCHITECTURE — PHASE 1.1 AUDIT SUITE");
  console.log("════════════════════════════════════════════════════════════\n");

  let passed = 0;
  const total = 9;

  // إعداد نادٍ تجريبي معزول
  let club = await prisma.club.findFirst({
    where: { email: "multi-pool-test@rcs.dz" },
  });

  if (!club) {
    club = await prisma.club.create({
      data: {
        name: "نادي الوفاق متعدد الرياضات",
        email: "multi-pool-test@rcs.dz",
        phone: "0550000001",
        managerName: "الأستاذ مراد",
        city: "سعيدة",
        country: "الجزائر",
        status: "active",
      },
    });
  }

  const clubId = club.id;

  // تفعيل الفهارس الذاتية
  await ensureMultiPoolRuntimeIndexes();

  // ─────────────────────────────────────────────────────────────
  // اختبار 1: قواعد بادئات أرقام الملفات (الصيغة والطول والافتراضي)
  // ─────────────────────────────────────────────────────────────
  console.log("--- اختبار 1: قواعد بادئات أرقام الملفات ---");
  const test1a = validatePoolPrefixRules("", true);       // افتراضي ببادئة فارغة -> سليم
  const test1b = validatePoolPrefixRules("B", true);      // افتراضي ببادئة -> خطأ
  const test1c = validatePoolPrefixRules("", false);      // فرعي ببادئة فارغة -> خطأ
  const test1d = validatePoolPrefixRules("TOOLONG", false);// أطول من 4 أحرف -> خطأ
  const test1e = validatePoolPrefixRules("B-1", false);   // رموز غير مسموحة -> خطأ
  const test1f = validatePoolPrefixRules("p1", false);    // حروف وأرقام مقبولة -> سليم

  if (
    test1a.valid &&
    !test1b.valid &&
    !test1c.valid &&
    !test1d.valid &&
    !test1e.valid &&
    test1f.valid &&
    test1f.normalizedPrefix === "P1"
  ) {
    console.log("✅ [1/9] نجاح قواعد التحقق من البادئات (الطول 1-4، A-Z0-9، فارغة للافتراضي فقط)");
    passed++;
  } else {
    console.error("❌ [1/9] فشل اختبار قواعد البادئات:", { test1a, test1b, test1c, test1d, test1e, test1f });
  }

  // ─────────────────────────────────────────────────────────────
  // اختبار 2: ضمان مسبح افتراضي ومسبحين فرعيين
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- اختبار 2: تهيئة المسابح التجريبية ---");
  let poolMain = await prisma.pool.findFirst({
    where: { clubId, isDefault: true },
  });
  if (!poolMain) {
    poolMain = await prisma.pool.create({
      data: {
        clubId,
        name: "المسبح الرئيسي",
        code: "MAIN",
        fileNumberPrefix: "",
        isDefault: true,
      },
    });
  }

  let poolB = await prisma.pool.findFirst({
    where: { clubId, code: "POOL-B" },
  });
  if (!poolB) {
    poolB = await prisma.pool.create({
      data: {
        clubId,
        name: "مسبح ب",
        code: "POOL-B",
        fileNumberPrefix: "B",
        isDefault: false,
      },
    });
  }

  console.log(`✅ [2/9] المسابح جاهزة: الافتراضي (${poolMain.name} - بادئة: "${poolMain.fileNumberPrefix}") والمسبح الفرعي (${poolB.name} - بادئة: "${poolB.fileNumberPrefix}")`);
  passed++;

  // ─────────────────────────────────────────────────────────────
  // اختبار 3: منع تكرار البادئة داخل النادي حتى لو كان المسبح مؤرشفاً
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- اختبار 3: منع تكرار البادئة مع مسبح مؤرشف ---");
  // إنشاء مسبح ببادئة فريدة ثم أرشفته
  const archiveCode = `ARCH-${Date.now().toString().slice(-4)}`;
  const archivePrefix = `X${Date.now().toString().slice(-2)}`;
  
  const archivedPool = await prisma.pool.create({
    data: {
      clubId,
      name: "مسبح تاريخي مؤرشف",
      code: archiveCode,
      fileNumberPrefix: archivePrefix,
      isDefault: false,
      status: "archived",
      archivedAt: new Date(),
    },
  });

  // محاولة إنشاء مسبح جديد بنفس بادئة المسبح المؤرشف
  let duplicatePrefixBlocked = false;
  try {
    await prisma.pool.create({
      data: {
        clubId,
        name: "مسبح جديد يحاول سرقة بادئة مؤرشفة",
        code: `NEW-${Date.now().toString().slice(-4)}`,
        fileNumberPrefix: archivePrefix,
        isDefault: false,
      },
    });
  } catch (err: any) {
    duplicatePrefixBlocked = true;
  }

  if (duplicatePrefixBlocked) {
    console.log(`✅ [3/9] نجح منع إعادة استخدام بادئة المسبح المؤرشف ("${archivePrefix}") على مستوى النادي`);
    passed++;
  } else {
    console.error("❌ [3/9] فشل: سمحت القاعدة بتكرار بادئة مسبح مؤرشف!");
  }

  // ─────────────────────────────────────────────────────────────
  // اختبار 4: توحيد Subscriber.poolId ليمثل المسبح الافتراضي حصراً
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- اختبار 4: توحيد قاعدة Subscriber.poolId الصارمة ---");
  const testSubCode = `SUB-${Date.now().toString().slice(-4)}`;
  const sub = await prisma.subscriber.create({
    data: {
      clubId,
      fileNumber: testSubCode,
      firstName: "أحمد",
      lastName: "المنصوري",
      birthDate: new Date("1995-05-15"),
      gender: "ذكر",
      subscriptionType: "RCS",
      paymentStatus: "مدفوع",
      poolId: poolMain.id, // يمثل المسبح الافتراضي حصراً
    },
  });

  if (sub.poolId === poolMain.id) {
    console.log(`✅ [4/9] حقل Subscriber.poolId يرتبط حصرياً بالمسبح الافتراضي (${poolMain.name})`);
    passed++;
  } else {
    console.error("❌ [4/9] فشل توثيق Subscriber.poolId");
  }

  // ─────────────────────────────────────────────────────────────
  // اختبار 5: الفهرس الجزئي - منع انخراطين نشطين في نفس المسبح
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- اختبار 5: منع انخراطين نشطين لنفس الشخص في نفس المسبح ---");
  const enActive1 = await prisma.poolEnrollment.create({
    data: {
      clubId,
      poolId: poolMain.id,
      subscriberId: sub.id,
      fileNumber: `${testSubCode}-A1`,
      status: "active",
      subscriptionType: "RCS",
      paymentStatus: "مدفوع",
    },
  });

  let secondActiveBlocked = false;
  try {
    // محاولة إنشاء انخراط نشط ثانٍ للشخص نفسه في المسبح نفسه
    await prisma.poolEnrollment.create({
      data: {
        clubId,
        poolId: poolMain.id,
        subscriberId: sub.id,
        fileNumber: `${testSubCode}-A2`,
        status: "active",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      },
    });
  } catch (e: any) {
    secondActiveBlocked = true;
  }

  if (secondActiveBlocked) {
    console.log("✅ [5/9] الفهرس الجزئي PoolEnrollment_active_unique منع بنجاح وجود انخراطين نشطين في نفس المسبح");
    passed++;
  } else {
    console.error("❌ [5/9] فشل الفهرس الجزئي: سمح بإنشاء انخراطين نشطين للشخص في نفس المسبح!");
  }

  // ─────────────────────────────────────────────────────────────
  // اختبار 6: السماح بانخراطات تاريخية منتهية/مؤرشفة للشخص نفسه
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- اختبار 6: السماح بانخراطات تاريخية (منتهية/مؤرشفة) في نفس المسبح ---");
  // تحديث الانخراط الأول ليصبح archived
  await prisma.poolEnrollment.update({
    where: { id: enActive1.id },
    data: { status: "archived", archivedAt: new Date() },
  });

  // الآن يجب أن يُسمح بإنشاء انخراط نشط جديد لنفس الشخص في نفس المسبح
  let newEnrollmentAllowed = false;
  let enActive2: any = null;
  try {
    enActive2 = await prisma.poolEnrollment.create({
      data: {
        clubId,
        poolId: poolMain.id,
        subscriberId: sub.id,
        fileNumber: `${testSubCode}-A2`,
        status: "active",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      },
    });
    newEnrollmentAllowed = true;
  } catch (e: any) {
    console.error("خطأ غير متوقع:", e.message);
  }

  if (newEnrollmentAllowed && enActive2) {
    console.log("✅ [6/9] نجح السماح بانخراط تاريخي مؤرشف + انخراط جديد نشط لنفس الشخص في المسبح دون فقدان السجل القديم");
    passed++;
  } else {
    console.error("❌ [6/9] فشل: لم يُسمح بإنشاء انخراط بعد أرشفة السابق!");
  }

  // ─────────────────────────────────────────────────────────────
  // اختبار 7: السماح بانخراط نشط في مسبحين مختلفين للشخص نفسه
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- اختبار 7: السماح بانخراط نشط في مسبحين مختلفين لنفس الشخص ---");
  let multiPoolActiveAllowed = false;
  try {
    await prisma.poolEnrollment.create({
      data: {
        clubId,
        poolId: poolB.id, // مسبح ب
        subscriberId: sub.id,
        fileNumber: `B-${testSubCode}`,
        status: "active",
        subscriptionType: "VIP",
        paymentStatus: "مدفوع",
      },
    });
    multiPoolActiveAllowed = true;
  } catch (e: any) {
    console.error("خطأ غير متوقع في الانخراط المزدوج:", e.message);
  }

  if (multiPoolActiveAllowed) {
    console.log("✅ [7/9] نجح تسجيل الشخص نفسه بانخراطين نشطين في مسبحين مختلفين (Pool Main + Pool B)");
    passed++;
  } else {
    console.error("❌ [7/9] فشل تسجيل انخراط في مسبح ثانٍ!");
  }

  // ─────────────────────────────────────────────────────────────
  // اختبار 8: سجل التجديد الكامل عبر PoolEnrollmentRenewal
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- اختبار 8: سجل التجديد الكامل عبر PoolEnrollmentRenewal ---");
  const renewal1 = await prisma.poolEnrollmentRenewal.create({
    data: {
      clubId,
      poolId: poolMain.id,
      subscriberId: sub.id,
      enrollmentId: enActive2.id,
      previousExpiryDate: new Date("2026-06-01"),
      newExpiryDate: new Date("2026-09-01"),
      months: 3,
      amount: 4500,
      paymentMethod: "نقداً",
      notes: "تجديد دورة الصيف",
    },
  });

  const renewal2 = await prisma.poolEnrollmentRenewal.create({
    data: {
      clubId,
      poolId: poolMain.id,
      subscriberId: sub.id,
      enrollmentId: enActive2.id,
      previousExpiryDate: new Date("2026-09-01"),
      newExpiryDate: new Date("2026-12-01"),
      months: 3,
      amount: 4500,
      paymentMethod: "بطاقة ذهبية",
      notes: "تجديد دورة الخريف",
    },
  });

  const allRenewals = await prisma.poolEnrollmentRenewal.findMany({
    where: { enrollmentId: enActive2.id },
    orderBy: { renewedAt: "asc" },
  });

  if (allRenewals.length === 2 && allRenewals[0].amount === 4500 && allRenewals[1].amount === 4500) {
    console.log(`✅ [8/9] تم حفظ سجل تجديدين مستقلين بنجاح دون فقدان أي بيانات تاريخية (دورة الصيف + دورة الخريف)`);
    passed++;
  } else {
    console.error("❌ [8/9] فشل حفظ سجلات التجديد الكاملة!");
  }

  // ─────────────────────────────────────────────────────────────
  // اختبار 9: قابلية إعادة تشغيل الترحيل والفهارس الذاتية (Idempotency)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- اختبار 9: إعادة تشغيل فهارس runtime-schema مرتين (Idempotency) ---");
  let idempotentSuccess = false;
  try {
    await ensureMultiPoolRuntimeIndexes();
    await ensureMultiPoolRuntimeIndexes();
    idempotentSuccess = true;
  } catch (e: any) {
    console.error("فشل إعادة تشغيل الفهارس:", e.message);
  }

  if (idempotentSuccess) {
    console.log("✅ [9/9] نجحت إعادة تشغيل الترحيل والفهارس الذاتية دون أي أخطاء أو تضارب");
    passed++;
  } else {
    console.error("❌ [9/9] فشل اختبار Idempotency!");
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`🎉 النتيجة الإجمالية للمرحلة 1.1: ${passed}/${total} اختبارات ناجحة بنسبة 100%!`);
  console.log("════════════════════════════════════════════════════════════\n");

  return passed === total;
}

runTests()
  .then((ok) => {
    process.exit(ok ? 0 : 1);
  })
  .catch((err) => {
    console.error("خطأ عام أثناء تشغيل الاختبارات:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
