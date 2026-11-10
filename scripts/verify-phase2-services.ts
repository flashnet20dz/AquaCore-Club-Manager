/**
 * ═══════════════════════════════════════════════════════════════
 * AQUACORE CLUB MANAGER — ENTERPRISE MULTI-POOL ARCHITECTURE
 * PHASE 2: SERVICES & ATOMIC LOGIC LAYER VERIFICATION SUITE
 * ═══════════════════════════════════════════════════════════════
 *
 * Checks:
 * 1. validatePoolPrefixRules: default vs non-default rules, length, alphanumeric.
 * 2. ensureDefaultPool: idempotent default pool discovery/creation.
 * 3. assertClubOwnership: multi-tenant isolation, cross-club rejection.
 * 4. generateAtomicFileNumber: sequential numbering, prefix formatting.
 * 5. createPoolEnrollmentService: default pool sync vs secondary pool isolation.
 * 6. Duplicate active enrollment prevention: partial index + service guard.
 * 7. renewPoolEnrollmentService: PoolEnrollmentRenewal audit integrity.
 * 8. transferSubscriberService: atomic pool transfer + card replacement + audit.
 * 9. resolveCardOrFileNumberService: cardUid priority & ambiguous fileNumber rejection.
 */

import { db } from "../src/lib/db";
import {
  validatePoolPrefixRules,
  generateSecureCardUid,
  ensureDefaultPool,
  generateAtomicFileNumber,
  assertClubOwnership,
  createPoolEnrollmentService,
  renewPoolEnrollmentService,
  transferSubscriberService,
  resolveCardOrFileNumberService,
} from "../src/lib/multi-pool";

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(id: number, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [Test ${id}] ${name}: ${details}`);
}

async function runPhase2Tests() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🚀 STARTING PHASE 2 SERVICE & ATOMIC LOGIC VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const timestamp = Date.now();
  const testClubId = `test-p2-club-${timestamp}`;
  const otherClubId = `test-p2-other-club-${timestamp}`;

  try {
    // ═════════════════════════════════════════════════════════════
    // SETUP TEST ENVIRONMENT
    // ═════════════════════════════════════════════════════════════
    const testClub = await db.club.create({
      data: {
        id: testClubId,
        name: `نادي الاختبار للمرحلة الثانية ${timestamp}`,
        city: "سعيدة",
        country: "الجزائر",
        managerName: "المدير الفني للخدمات",
        phone: "0550000002",
        email: `phase2-${timestamp}@rcs.dz`,
        status: "active",
      },
    });

    const otherClub = await db.club.create({
      data: {
        id: otherClubId,
        name: `نادي غريب للاختبار ${timestamp}`,
        city: "وهران",
        country: "الجزائر",
        managerName: "مدير خارجي",
        phone: "0550000003",
        email: `other-${timestamp}@rcs.dz`,
        status: "active",
      },
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 1: validatePoolPrefixRules
    // ─────────────────────────────────────────────────────────────
    const t1_default_empty = validatePoolPrefixRules("", true);
    const t1_default_has_prefix = validatePoolPrefixRules("POOL", true);
    const t1_nondef_empty = validatePoolPrefixRules("", false);
    const t1_nondef_too_long = validatePoolPrefixRules("TOOLONG", false);
    const t1_nondef_invalid_chars = validatePoolPrefixRules("B-1!", false);
    const t1_nondef_valid = validatePoolPrefixRules("b1", false);

    const test1_passed =
      t1_default_empty.valid &&
      t1_default_empty.normalizedPrefix === "" &&
      !t1_default_has_prefix.valid &&
      !t1_nondef_empty.valid &&
      !t1_nondef_too_long.valid &&
      !t1_nondef_invalid_chars.valid &&
      t1_nondef_valid.valid &&
      t1_nondef_valid.normalizedPrefix === "B1";

    record(
      1,
      "validatePoolPrefixRules: فحص القواعد المعمارية لبادئات أرقام الملفات",
      test1_passed,
      test1_passed
        ? "اجتازت جميع شروط التحقق (فارغة للمسبح الافتراضي، إلزامية لغير الافتراضي، حد أقصى 4، حروف وأرقام فقط)"
        : "فشل التحقق من بعض قواعد البادئة"
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 2: ensureDefaultPool (Idempotent Creation & Lookup)
    // ─────────────────────────────────────────────────────────────
    const poolDefault1 = await ensureDefaultPool(testClubId);
    const poolDefault2 = await ensureDefaultPool(testClubId);

    const test2_passed =
      poolDefault1.id === poolDefault2.id &&
      poolDefault1.isDefault === true &&
      (poolDefault1.fileNumberPrefix === "" || poolDefault1.fileNumberPrefix === null);

    record(
      2,
      "ensureDefaultPool: إنشاء واسترجاع المسبح الافتراضي بشكل Idempotent",
      test2_passed,
      test2_passed
        ? `تم إنشاء وضمان المسبح الافتراضي بنجاح (id: ${poolDefault1.id}, prefix: "")`
        : "فشل استرجاع أو إنشاء المسبح الافتراضي"
    );

    // إنشاء مسبح ثانوي فرعي
    const secondaryPool = await db.pool.create({
      data: {
        clubId: testClubId,
        name: "المسبح الأولمبي B",
        code: `OLYMPIC-${timestamp}`,
        fileNumberPrefix: "OB",
        isDefault: false,
        active: true,
        status: "active",
        capacity: 80,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 3: assertClubOwnership (Strict Multi-Tenancy Guard)
    // ─────────────────────────────────────────────────────────────
    let t3_rejected = false;
    try {
      // محاولة التحقق من مسبح النادي الأول باستخدام clubId للنادي الثاني
      await assertClubOwnership(otherClubId, { poolId: poolDefault1.id });
    } catch {
      t3_rejected = true;
    }

    let t3_accepted = false;
    try {
      await assertClubOwnership(testClubId, { poolId: poolDefault1.id });
      t3_accepted = true;
    } catch {
      t3_accepted = false;
    }

    const test3_passed = t3_rejected && t3_accepted;
    record(
      3,
      "assertClubOwnership: العزل الأمني الصارم ومنع تسريب الكيانات بين الأندية",
      test3_passed,
      test3_passed
        ? "تم قبول الكيان التابع للنادي ورفض محاولة الوصول من نادٍ آخر بنجاح"
        : "فشل التحقق من العزل المتعدد"
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 4: generateAtomicFileNumber (Sequential & Prefixed)
    // ─────────────────────────────────────────────────────────────
    const numDef1 = await generateAtomicFileNumber(testClubId, poolDefault1.id, "RCS");
    const numDef2 = await generateAtomicFileNumber(testClubId, poolDefault1.id, "RCS");
    const numSec1 = await generateAtomicFileNumber(testClubId, secondaryPool.id, "RCS");

    const test4_passed =
      numDef1.fileNumber === "RCS001" &&
      numDef2.fileNumber === "RCS002" &&
      numSec1.fileNumber === "OB-RCS001";

    record(
      4,
      "generateAtomicFileNumber: الترقيم الذري التسلسلي مع البادئات المحددة للمسابح",
      test4_passed,
      test4_passed
        ? `المسبح الافتراضي (${numDef1.fileNumber}, ${numDef2.fileNumber}) والمسبح الفرعي (${numSec1.fileNumber})`
        : `قيم ترقيم غير متوقعة: def1=${numDef1.fileNumber}, def2=${numDef2.fileNumber}, sec1=${numSec1.fileNumber}`
    );

    // إنشاء منخرطين للاختبار
    const subscriber1 = await db.subscriber.create({
      data: {
        clubId: testClubId,
        fileNumber: "INIT-001",
        firstName: "أحمد",
        lastName: "المنصوري",
        birthDate: new Date("1995-05-15"),
        gender: "ذكر",
        phone: "0551112233",
        subscriptionType: "RCS",
        paymentStatus: "غير مدفوع",
      },
    });

    const subscriber2 = await db.subscriber.create({
      data: {
        clubId: testClubId,
        fileNumber: "INIT-002",
        firstName: "كريم",
        lastName: "بلقاسم",
        birthDate: new Date("1998-08-20"),
        gender: "ذكر",
        phone: "0554445566",
        subscriptionType: "RCS",
        paymentStatus: "غير مدفوع",
      },
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 5: createPoolEnrollmentService & Subscriber.poolId Rule
    // ─────────────────────────────────────────────────────────────
    // 5.1 انخراط في المسبح الافتراضي -> يجب تحديث Subscriber.poolId
    const enDefResult = await createPoolEnrollmentService({
      clubId: testClubId,
      poolId: poolDefault1.id,
      subscriberId: subscriber1.id,
      subscriptionType: "RCS",
      paymentStatus: "مدفوع",
    });

    const sub1AfterDef = await db.subscriber.findUnique({ where: { id: subscriber1.id } });

    // 5.2 انخراط نفس المنخرط في المسبح الثانوي -> Subscriber.poolId لا يجب أن يتغير!
    const enSecResult = await createPoolEnrollmentService({
      clubId: testClubId,
      poolId: secondaryPool.id,
      subscriberId: subscriber1.id,
      subscriptionType: "RCS",
      paymentStatus: "مدفوع",
    });

    const sub1AfterSec = await db.subscriber.findUnique({ where: { id: subscriber1.id } });

    const test5_passed =
      enDefResult.enrollment.fileNumber === "RCS003" &&
      enSecResult.enrollment.fileNumber === "OB-RCS002" &&
      sub1AfterDef?.poolId === poolDefault1.id &&
      sub1AfterSec?.poolId === poolDefault1.id && // لم يتغير إلى secondaryPool.id
      enDefResult.card.cardUid.startsWith("AQCR-") &&
      enSecResult.card.cardUid.startsWith("AQCR-");

    record(
      5,
      "createPoolEnrollmentService: قاعدة Subscriber.poolId الصارمة (مرآة المسبح الافتراضي فقط)",
      test5_passed,
      test5_passed
        ? `Subscriber.poolId ظل ثابتاً على المسبح الافتراضي (${sub1AfterSec?.poolId}) بعد الانخراط في مسبح ثانٍ`
        : "تغير Subscriber.poolId إلى مسبح ثانوي أو لم يتم توليد البطاقات بشكل صحيح"
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Duplicate Active Enrollment Prevention
    // ─────────────────────────────────────────────────────────────
    let t6_prevented = false;
    try {
      await createPoolEnrollmentService({
        clubId: testClubId,
        poolId: poolDefault1.id,
        subscriberId: subscriber1.id,
        subscriptionType: "RCS",
      });
    } catch (e: any) {
      if (e.message.includes("يمتلك انخراطاً نشطاً بالفعل")) {
        t6_prevented = true;
      }
    }

    record(
      6,
      "Duplicate Active Prevention: منع تكرار الانخراطات النشطة للشخص في نفس المسبح",
      t6_prevented,
      t6_prevented
        ? "تم رفض إنشاء انخراط نشط مكرر لنفس الشخص في المسبح نفسه بنجاح"
        : "فشل منع الانخراط المكرر"
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 7: renewPoolEnrollmentService (PoolEnrollmentRenewal Audit)
    // ─────────────────────────────────────────────────────────────
    const renewal1 = await renewPoolEnrollmentService({
      clubId: testClubId,
      enrollmentId: enDefResult.enrollment.id,
      months: 3,
      amount: 4500,
      paymentMethod: "نقداً",
      notes: "تجديد فصلي 3 أشهر مع توثيق مالي",
    });

    const renewalRecordInDb = await db.poolEnrollmentRenewal.findFirst({
      where: { enrollmentId: enDefResult.enrollment.id },
    });

    const updatedEnrollmentInDb = await db.poolEnrollment.findUnique({
      where: { id: enDefResult.enrollment.id },
    });

    const test7_passed =
      renewalRecordInDb !== null &&
      renewalRecordInDb.amount === 4500 &&
      renewalRecordInDb.months === 3 &&
      updatedEnrollmentInDb?.renewalCount === 1 &&
      updatedEnrollmentInDb?.status === "active";

    record(
      7,
      "renewPoolEnrollmentService: التجديد المالي والتاريخي الكامل عبر PoolEnrollmentRenewal",
      test7_passed,
      test7_passed
        ? `سجل التجديد موثق بالكامل (المبلغ: ${renewalRecordInDb?.amount}، الشهور: ${renewalRecordInDb?.months}، العداد: ${updatedEnrollmentInDb?.renewalCount})`
        : "فشل توثيق التجديد أو تحديث عداد التجديدات"
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 8: transferSubscriberService (Cross-Pool Transfer & Audit)
    // ─────────────────────────────────────────────────────────────
    // إنشاء انخراط لـ subscriber2 في poolDefault1 ثم نقله إلى secondaryPool
    const enSub2 = await createPoolEnrollmentService({
      clubId: testClubId,
      poolId: poolDefault1.id,
      subscriberId: subscriber2.id,
      subscriptionType: "RCS",
    });

    const transferResult = await transferSubscriberService({
      clubId: testClubId,
      subscriberId: subscriber2.id,
      sourcePoolId: poolDefault1.id,
      targetPoolId: secondaryPool.id,
      keepFileNumber: false,
      reason: "نقل تدريبي بناءً على طلب المنخرط",
    });

    const sourceAfterTransfer = await db.poolEnrollment.findUnique({
      where: { id: enSub2.enrollment.id },
    });

    const transferAuditLog = await db.subscriberTransfer.findFirst({
      where: { subscriberId: subscriber2.id },
    });

    const fileHistoryLog = await db.fileNumberHistory.findFirst({
      where: { subscriberId: subscriber2.id },
    });

    const test8_passed =
      sourceAfterTransfer?.status === "transferred" &&
      transferResult.targetEnrollment.status === "active" &&
      transferAuditLog !== null &&
      transferAuditLog.oldFileNumber !== transferAuditLog.newFileNumber &&
      fileHistoryLog !== null;

    record(
      8,
      "transferSubscriberService: النقل الذري بين المسابح مع أرشفة القديم وتوليد رقم جديد وسجلات التدقيق",
      test8_passed,
      test8_passed
        ? `تمت أرشفة الانخراط المصدر وتوليد رقم جديد (${transferResult.newFileNumber}) وتوثيق النقل وتاريخ الأرقام`
        : "فشل عملية النقل أو تسجيلات التدقيق"
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 9: resolveCardOrFileNumberService (Ambiguity Rejection)
    // ─────────────────────────────────────────────────────────────
    // 9.1 فحص بواسطة cardUid
    const resByCardUid = await resolveCardOrFileNumberService(
      testClubId,
      enDefResult.card.cardUid
    );

    // 9.2 فحص معرّف بطاقة مسبح مع تحديد سياق المسبح
    const resWithContext = await resolveCardOrFileNumberService(
      testClubId,
      enDefResult.enrollment.fileNumber,
      poolDefault1.id
    );

    // 9.3 اختبار التعارض والغموض:
    // لننشئ انخراطين نشطين في مسبحين مختلفين بنفس رقم الملف لتجربة الرفض المعماري الصارم
    const subscriber3 = await db.subscriber.create({
      data: {
        clubId: testClubId,
        fileNumber: "INIT-003",
        firstName: "طارق",
        lastName: "الغموض",
        birthDate: new Date("2000-01-01"),
        gender: "ذكر",
        phone: "0559998877",
        subscriptionType: "RCS",
        paymentStatus: "غير مدفوع",
      },
    });

    const sharedFileNum = "CUSTOM-DUAL-999";
    await db.poolEnrollment.create({
      data: {
        clubId: testClubId,
        poolId: poolDefault1.id,
        subscriberId: subscriber3.id,
        fileNumber: sharedFileNum,
        status: "active",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      },
    });

    await db.poolEnrollment.create({
      data: {
        clubId: testClubId,
        poolId: secondaryPool.id,
        subscriberId: subscriber3.id,
        fileNumber: sharedFileNum,
        status: "active",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      },
    });

    // الآن نبحث عن sharedFileNum بدون تمرير سياق المسبح
    const resAmbiguous = await resolveCardOrFileNumberService(
      testClubId,
      sharedFileNum,
      null
    );

    const test9_passed =
      resByCardUid.found === true &&
      resByCardUid.card?.id === enDefResult.card.id &&
      resWithContext.found === true &&
      resWithContext.enrollment?.id === enDefResult.enrollment.id &&
      resAmbiguous.found === false &&
      resAmbiguous.ambiguous === true &&
      (resAmbiguous.candidateEnrollments?.length ?? 0) === 2;

    record(
      9,
      "resolveCardOrFileNumberService: أولوية cardUid والرفض المعماري الصارم للأرقام الملتبسة عبر المسابح",
      test9_passed,
      test9_passed
        ? `نجح التحقق: cardUid مؤكد 100%، وتم رفض الرقم الملتبس (${sharedFileNum}) مع إرجاع ${resAmbiguous.candidateEnrollments?.length} خيارات للمستخدم`
        : `فشل التحقق من حل المعرفات أو كشف الغموض (ambiguous=${resAmbiguous.ambiguous})`
    );

  } catch (err) {
    console.error("💥 خطأ غير متوقع أثناء تشغيل اختبارات المرحلة الثانية:", err);
  } finally {
    // تنظيف بيانات الاختبار
    console.log("\n🧹 تنظيف بيانات الاختبار المؤقتة...");
    await db.fileNumberHistory.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.subscriberTransfer.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.poolEnrollmentRenewal.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.membershipCard.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.attendance.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.poolEnrollment.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.poolNumberCounter.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.subscriber.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.pool.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.club.deleteMany({ where: { id: { in: [testClubId, otherClubId] } } }).catch(() => null);
    console.log("✅ اكتمل التنظيف بنجاح.");
  }

  // ═════════════════════════════════════════════════════════════
  // SUMMARY REPORT
  // ═════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 ملخص نتائج اختبارات المرحلة الثانية (Phase 2):");
  console.log("═══════════════════════════════════════════════════════════");

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log(`النتائج: ${passedCount} / ${totalCount} (${Math.round((passedCount / totalCount) * 100)}%) اجتياز ناجح.`);

  if (passedCount === totalCount && totalCount === 9) {
    console.log("🏆 تم التحقق بنجاح 100% من جميع خدمات الطبقة المنطقية الذرية (Phase 2 Ready!).");
    process.exit(0);
  } else {
    console.error("❌ فشل اختبار أو أكثر. يرجى المراجعة.");
    process.exit(1);
  }
}

runPhase2Tests();
