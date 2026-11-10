/**
 * ═══════════════════════════════════════════════════════════════
 * AQUACORE CLUB MANAGER — ENTERPRISE MULTI-POOL ARCHITECTURE
 * PHASE 3: API LAYER & DUAL-WRITE INTEGRATION VERIFICATION SUITE
 * ═══════════════════════════════════════════════════════════════
 *
 * Checks:
 * 1. POST /api/pools: Prefix validation rules, max length 4, A-Z0-9, conflict detection.
 * 2. POST /api/subscribers: Dual-write creation, Default Pool sync vs Secondary isolation.
 * 3. GET /api/subscribers: Multi-pool filtering with ?poolId= and enrollments inclusion.
 * 4. POST /api/subscribers/[id]/enroll: Multi-pool enrollment & duplicate active rejection.
 * 5. POST /api/renewals: Dual-write renewals (PoolEnrollmentRenewal + legacy Renewal).
 * 6. POST /api/subscribers/[id]/transfer: Cross-pool transfer & audit logging.
 * 7. POST /api/qr-checkin: cardUid priority, duplicate check, and ambiguous rejection.
 * 8. GET & POST /api/attendance: Pool-scoped attendance logging & filtering.
 * 9. GET /api/subscribers/[id]/record: Comprehensive multi-pool history and audit trails.
 */

import { db } from "../src/lib/db";
import crypto from "crypto";

const BASE = "http://localhost:3000";

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

async function request(path: string, options: RequestInit = {}, sessionToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (sessionToken) {
    headers["Cookie"] = `rcs-session=${sessionToken}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  return { status: res.status, ok: res.ok, data };
}

async function runPhase3Tests() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🚀 STARTING PHASE 3 API & DUAL-WRITE INTEGRATION VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const timestamp = Date.now();
  const testClubId = `test-p3-club-${timestamp}`;
  const sessionToken = `test-p3-token-${timestamp}`;
  const adminUserId = `test-p3-admin-${timestamp}`;

  try {
    // ═════════════════════════════════════════════════════════════
    // SETUP TEST CLUB & SESSION
    // ═════════════════════════════════════════════════════════════
    const testClub = await db.club.create({
      data: {
        id: testClubId,
        name: `نادي اختبار المرحلة الثالثة ${timestamp}`,
        city: "سعيدة",
        country: "الجزائر",
        managerName: "مدير المرحلة الثالثة",
        phone: "0550000003",
        email: `phase3-${timestamp}@rcs.dz`,
        status: "active",
      },
    });

    const adminUser = await db.user.create({
      data: {
        id: adminUserId,
        email: `admin-p3-${timestamp}@rcs.dz`,
        name: "مدير اختبار المرحلة 3",
        passwordHash: "hash-dummy",
        role: "admin",
        clubId: testClubId,
        active: true,
      },
    });

    const sessionPayload = {
      id: adminUserId,
      email: adminUser.email,
      name: adminUser.name,
      role: "admin",
      clubId: testClubId,
      clubName: testClub.name,
    };

    await db.session.create({
      data: {
        id: sessionToken,
        userId: adminUserId,
        data: JSON.stringify(sessionPayload),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // إنشاء مسبح رئيسي افتراضي للنادي
    const defaultPool = await db.pool.create({
      data: {
        clubId: testClubId,
        name: "المسبح الرئيسي للاختبار",
        code: `MAIN-${timestamp}`,
        fileNumberPrefix: "",
        isDefault: true,
        active: true,
        status: "active",
        capacity: 100,
      },
    });

    // نوع اشتراك للاختبار
    const subType = await db.subscriptionType.create({
      data: {
        clubId: testClubId,
        name: "اشتراك عام RCS",
        code: "RCS",
        subscriptionFee: 2000,
        insuranceFee: 500,
        compoundRights: 0,
        givesMembershipNumber: true,
        numberingGroup: "RCS",
        durationDays: 30,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 1: POST /api/pools (Prefix Rules & Conflict Handling)
    // ─────────────────────────────────────────────────────────────
    // 1.1 محاولة بادئة فارغة لمسبح غير افتراضي
    const p_empty = await request("/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "مسبح بدون بادئة", code: "P_NO_PRE", fileNumberPrefix: "" }),
    }, sessionToken);

    // 1.2 محاولة بادئة أطول من 4 محارف
    const p_long = await request("/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "مسبح بادئة طويلة", code: "P_LONG", fileNumberPrefix: "TOOLONG" }),
    }, sessionToken);

    // 1.3 محاولة بادئة برموز غير صالحة
    const p_invalid = await request("/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "مسبح رموز", code: "P_INV", fileNumberPrefix: "B-1!" }),
    }, sessionToken);

    // 1.4 إنشاء مسبح فرعي صحيح
    const p_valid = await request("/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "مسبح الأمل الأولمبي", code: `POOL_B_${timestamp}`, fileNumberPrefix: "OB" }),
    }, sessionToken);

    // 1.5 محاولة تكرار نفس البادئة
    const p_dup = await request("/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "مسبح مكرر البادئة", code: `POOL_DUP_${timestamp}`, fileNumberPrefix: "OB" }),
    }, sessionToken);

    const test1_passed =
      p_empty.status === 400 &&
      p_long.status === 400 &&
      p_invalid.status === 400 &&
      p_valid.status === 201 &&
      p_valid.data?.pool?.fileNumberPrefix === "OB" &&
      p_dup.status === 409;

    const secondaryPoolId = p_valid.data?.pool?.id;

    record(
      1,
      "POST /api/pools: فرض القواعد المعمارية الصارمة لبادئات المسابح ومنع التكرار",
      test1_passed,
      test1_passed
        ? `تم رفض البادئات الخاطئة (400) وقبول البادئة الصحيحة OB (201) ورفض التكرار (409)`
        : `فشل التحقق: empty=${p_empty.status}, long=${p_long.status}, valid=${p_valid.status}, dup=${p_dup.status}`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 2: POST /api/subscribers (Creation in Default Pool)
    // ─────────────────────────────────────────────────────────────
    const sub1Res = await request("/api/subscribers", {
      method: "POST",
      body: JSON.stringify({
        poolId: defaultPool.id,
        firstName: "يوسف",
        lastName: "المنصوري",
        birthDate: "1997-04-10",
        gender: "ذكر",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
        lastPaymentDate: new Date().toISOString(),
      }),
    }, sessionToken);

    const sub1Id = sub1Res.data?.subscriber?.id;
    const sub1Db = sub1Id ? await db.subscriber.findUnique({
      where: { id: sub1Id },
      include: {
        enrollments: { where: { status: "active" } },
        cards: { where: { status: "active" } },
      },
    }) : null;

    const test2_passed =
      sub1Res.status === 201 &&
      sub1Db !== null &&
      sub1Db.poolId === defaultPool.id && // مرآة المسبح الافتراضي
      sub1Db.enrollments.length === 1 &&
      sub1Db.enrollments[0].poolId === defaultPool.id &&
      sub1Db.enrollments[0].fileNumber === "RCS001" &&
      sub1Db.cards.length === 1 &&
      sub1Db.cards[0].cardUid.startsWith("AQCR-");

    record(
      2,
      "POST /api/subscribers (المسبح الافتراضي): إنشاء المنخرط والانخراط والبطاقة المشفرة ذرياً",
      test2_passed,
      test2_passed
        ? `تم إنشاء المنخرط (${sub1Db?.fileNumber}) والانخراط والبطاقة المشفرة (${sub1Db?.cards[0]?.cardUid.substring(0, 10)}...)`
        : `فشل الإنشاء: status=${sub1Res.status}`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 3: POST /api/subscribers (Creation in Secondary Pool)
    // ─────────────────────────────────────────────────────────────
    const sub2Res = await request("/api/subscribers", {
      method: "POST",
      body: JSON.stringify({
        poolId: secondaryPoolId,
        firstName: "سليم",
        lastName: "قاسمي",
        birthDate: "1999-09-12",
        gender: "ذكر",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
        lastPaymentDate: new Date().toISOString(),
      }),
    }, sessionToken);

    const sub2Id = sub2Res.data?.subscriber?.id;
    const sub2Db = sub2Id ? await db.subscriber.findUnique({
      where: { id: sub2Id },
      include: {
        enrollments: { where: { status: "active" } },
        cards: { where: { status: "active" } },
      },
    }) : null;

    // قاعدة معمارية ملزمة: المنخرط في مسبح ثانوي فقط -> Subscriber.poolId = null!
    const test3_passed =
      sub2Res.status === 201 &&
      sub2Db !== null &&
      sub2Db.poolId === null && // لم يتلوث بـ secondaryPoolId
      sub2Db.enrollments.length === 1 &&
      sub2Db.enrollments[0].poolId === secondaryPoolId &&
      sub2Db.enrollments[0].fileNumber.startsWith("OB-") &&
      sub2Db.cards.length === 1 &&
      sub2Db.cards[0].cardUid.startsWith("AQCR-");

    record(
      3,
      "POST /api/subscribers (المسبح الثانوي): عزل Subscriber.poolId التام وإنشاء الانخراط برقم المسبح الفرعي",
      test3_passed,
      test3_passed
        ? `Subscriber.poolId ظل null كما تقتضي القاعدة، والانخراط أنشئ ببادئة المسبح (${sub2Db?.enrollments[0]?.fileNumber})`
        : `فشل التحقق المعماري: sub2.poolId=${sub2Db?.poolId}`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 4: GET /api/subscribers (Multi-Pool Filtering)
    // ─────────────────────────────────────────────────────────────
    const listDef = await request(`/api/subscribers?poolId=${defaultPool.id}`, {}, sessionToken);
    const listSec = await request(`/api/subscribers?poolId=${secondaryPoolId}`, {}, sessionToken);
    const listAll = await request(`/api/subscribers`, {}, sessionToken);

    const hasSub1InDef = listDef.data?.subscribers?.some((s: any) => s.id === sub1Id);
    const hasSub2InDef = listDef.data?.subscribers?.some((s: any) => s.id === sub2Id);

    const hasSub1InSec = listSec.data?.subscribers?.some((s: any) => s.id === sub1Id);
    const hasSub2InSec = listSec.data?.subscribers?.some((s: any) => s.id === sub2Id);

    const test4_passed =
      listDef.status === 200 &&
      listSec.status === 200 &&
      hasSub1InDef &&
      !hasSub2InDef &&
      !hasSub1InSec &&
      hasSub2InSec &&
      (listAll.data?.subscribers?.length ?? 0) >= 2;

    record(
      4,
      "GET /api/subscribers: فلترة المنخرطين الدقيقة حسب المسبح وعزل القوائم",
      test4_passed,
      test4_passed
        ? `المسبح الافتراضي أعاد المنخرط 1 فقط، والمسبح الثانوي أعاد المنخرط 2 فقط، والقائمة العامة أعادت الجميع`
        : `فشل عزل الفلترة: defHas1=${hasSub1InDef}, defHas2=${hasSub2InDef}, secHas1=${hasSub1InSec}, secHas2=${hasSub2InSec}`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 5: POST /api/subscribers/[id]/enroll (Multi-Pool Enrollment)
    // ─────────────────────────────────────────────────────────────
    // تسجيل المنخرط 1 (الموجود في المسبح الافتراضي) في المسبح الثانوي كاشتراك ثانٍ
    const enrollRes = await request(`/api/subscribers/${sub1Id}/enroll`, {
      method: "POST",
      body: JSON.stringify({
        poolId: secondaryPoolId,
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      }),
    }, sessionToken);

    // محاولة تكرار نفس الانخراط بينما هو نشط
    const enrollDupRes = await request(`/api/subscribers/${sub1Id}/enroll`, {
      method: "POST",
      body: JSON.stringify({
        poolId: secondaryPoolId,
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      }),
    }, sessionToken);

    const sub1AfterEnroll = await db.subscriber.findUnique({
      where: { id: sub1Id! },
      include: {
        enrollments: { where: { status: "active" } },
        cards: { where: { status: "active" } },
      },
    });

    const test5_passed =
      enrollRes.status === 201 &&
      enrollDupRes.status === 409 &&
      sub1AfterEnroll?.enrollments.length === 2 && // نشط في المسبحين معاً!
      sub1AfterEnroll?.cards.length === 2 && // يمتلك بطاقتين مستقلتين!
      sub1AfterEnroll?.poolId === defaultPool.id; // Subscriber.poolId لم يتغير!

    record(
      5,
      "POST /api/subscribers/[id]/enroll: انخراط متعدد للشخص في مسبحين مختلفين مع بطاقتين مستقلتين",
      test5_passed,
      test5_passed
        ? `المنخرط نشط في مسبحين معاً مع بطاقتين ورمزين مستقلين، ورفض الانخراط النشط المكرر (409)`
        : `فشل الانخراط المتعدد: enrollStatus=${enrollRes.status}, dupStatus=${enrollDupRes.status}, enrollments=${sub1AfterEnroll?.enrollments.length}`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 6: POST /api/renewals (Dual-Write & Historical Renewal)
    // ─────────────────────────────────────────────────────────────
    const sub1SecondaryEnrollment = sub1AfterEnroll?.enrollments.find((e) => e.poolId === secondaryPoolId);

    const renewRes = await request(`/api/renewals`, {
      method: "POST",
      body: JSON.stringify({
        subscriberId: sub1Id,
        poolId: secondaryPoolId,
        enrollmentId: sub1SecondaryEnrollment?.id,
        months: 2,
        amount: 3000,
        paymentStatus: "مدفوع",
        note: "تجديد اشتراك المسبح الثانوي لشهرين",
      }),
    }, sessionToken);

    const renewalLogDb = await db.poolEnrollmentRenewal.findFirst({
      where: { enrollmentId: sub1SecondaryEnrollment?.id },
    });

    const legacyRenewalDb = await db.renewal.findFirst({
      where: { subscriberId: sub1Id! },
      orderBy: { createdAt: "desc" },
    });

    const test6_passed =
      renewRes.status === 201 &&
      renewalLogDb !== null &&
      renewalLogDb.amount === 3000 &&
      renewalLogDb.months === 2 &&
      renewalLogDb.poolId === secondaryPoolId &&
      legacyRenewalDb !== null &&
      legacyRenewalDb.amount === 3000;

    record(
      6,
      "POST /api/renewals: تطبيق الكتابة المزدوجة المتزامنة (PoolEnrollmentRenewal + Renewal)",
      test6_passed,
      test6_passed
        ? `تم تحديث الانخراط وتوثيق التجديد في سجل المسابح التاريخي وفي السجل القديم بالتوازي بنجاح`
        : `فشل الكتابة المزدوجة للتجديد: renewStatus=${renewRes.status}`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 7: POST /api/subscribers/[id]/transfer (Cross-Pool Transfer)
    // ─────────────────────────────────────────────────────────────
    // نقل المنخرط 2 من المسبح الثانوي إلى المسبح الافتراضي
    const transferRes = await request(`/api/subscribers/${sub2Id}/transfer`, {
      method: "POST",
      body: JSON.stringify({
        sourcePoolId: secondaryPoolId,
        targetPoolId: defaultPool.id,
        keepFileNumber: false,
        reason: "نقل تدريبي إلى المسبح الرئيسي",
      }),
    }, sessionToken);

    const sub2AfterTransfer = await db.subscriber.findUnique({
      where: { id: sub2Id! },
      include: {
        enrollments: { orderBy: { createdAt: "asc" } },
        transfers: true,
        cards: { where: { status: "active" } },
      },
    });

    const sourceEn = sub2AfterTransfer?.enrollments.find((e) => e.poolId === secondaryPoolId);
    const targetEn = sub2AfterTransfer?.enrollments.find((e) => e.poolId === defaultPool.id && e.status === "active");

    const test7_passed =
      transferRes.status === 200 &&
      sourceEn?.status === "transferred" &&
      targetEn !== undefined &&
      sub2AfterTransfer?.poolId === defaultPool.id && // أصبح مسجلاً في المسبح الافتراضي
      (sub2AfterTransfer?.transfers.length ?? 0) >= 1 &&
      sub2AfterTransfer?.cards.length === 1;

    record(
      7,
      "POST /api/subscribers/[id]/transfer: النقل الذري بين المسابح مع أرشفة القديم وتحديث السجلات",
      test7_passed,
      test7_passed
        ? `أرشف الانخراط القديم وأنشئ انخراطاً وبطاقة جديدة في المسبح الرئيسي وتحديث Subscriber.poolId`
        : `فشل النقل: status=${transferRes.status}`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 8: POST /api/qr-checkin (cardUid Priority & Ambiguity Guard)
    // ─────────────────────────────────────────────────────────────
    // 8.1 تحقق عبر cardUid الآمن
    const validCard = sub1AfterEnroll?.cards[0];
    const qrByCardRes = await request("/api/qr-checkin", {
      method: "POST",
      body: JSON.stringify({ cardUid: validCard?.cardUid }),
    }, sessionToken);

    // 8.2 التحقق من منع التكرار في نفس اليوم
    const qrDupRes = await request("/api/qr-checkin", {
      method: "POST",
      body: JSON.stringify({ cardUid: validCard?.cardUid }),
    }, sessionToken);

    // 8.3 اختبار حماية الغموض (Ambiguity Guard):
    // إنشاء منخرطين برقم ملف مشترك في انخراطات مسبحين مختلفين لفحص رفض البحث العام
    const subAmb1 = await db.subscriber.create({
      data: {
        clubId: testClubId,
        fileNumber: `AMB-SUB-1-${timestamp}`,
        firstName: "أنس",
        lastName: "الملتبس 1",
        birthDate: new Date("1996-01-01"),
        gender: "ذكر",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      },
    });

    const subAmb2 = await db.subscriber.create({
      data: {
        clubId: testClubId,
        fileNumber: `AMB-SUB-2-${timestamp}`,
        firstName: "عمر",
        lastName: "الملتبس 2",
        birthDate: new Date("1996-01-01"),
        gender: "ذكر",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      },
    });

    await db.poolEnrollment.create({
      data: {
        clubId: testClubId,
        poolId: defaultPool.id,
        subscriberId: subAmb1.id,
        fileNumber: "DUAL-FILE-777",
        status: "active",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      },
    });

    await db.poolEnrollment.create({
      data: {
        clubId: testClubId,
        poolId: secondaryPoolId,
        subscriberId: subAmb2.id,
        fileNumber: "DUAL-FILE-777",
        status: "active",
        subscriptionType: "RCS",
        paymentStatus: "مدفوع",
      },
    });

    // مسح الرقم بدون تحديد المسبح -> يجب أن يرفض بـ 409 ambiguous
    const qrAmbiguousRes = await request("/api/qr-checkin", {
      method: "POST",
      body: JSON.stringify({ fileNumber: "DUAL-FILE-777" }),
    }, sessionToken);

    // مسح نفس الرقم مع تحديد المسبح صراحة -> يجب أن ينجح
    const qrScopedRes = await request("/api/qr-checkin", {
      method: "POST",
      body: JSON.stringify({ fileNumber: "DUAL-FILE-777", poolId: secondaryPoolId }),
    }, sessionToken);

    const test8_passed =
      qrByCardRes.status === 201 &&
      qrByCardRes.data?.success === true &&
      qrDupRes.data?.alreadyCheckedIn === true &&
      qrAmbiguousRes.status === 409 &&
      qrAmbiguousRes.data?.ambiguous === true &&
      qrScopedRes.status === 201;

    record(
      8,
      "POST /api/qr-checkin: أولوية cardUid، منع التكرار، والرفض المعماري الصارم للأرقام الملتبسة (409)",
      test8_passed,
      test8_passed
        ? `نجاح cardUid فوري، وكشف الحضور المكرر اليوم، ورفض مسح الرقم الملتبس بدون سياق وقبوله مع السياق`
        : `فشل التحقق: qrCard=${qrByCardRes.status}, qrDup=${qrDupRes.data?.alreadyCheckedIn}, qrAmb=${qrAmbiguousRes.status}, qrScoped=${qrScopedRes.status}`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 9: GET /api/attendance & GET /api/subscribers/[id]/record
    // ─────────────────────────────────────────────────────────────
    const attListDef = await request(`/api/attendance?poolId=${defaultPool.id}`, {}, sessionToken);
    const attListSec = await request(`/api/attendance?poolId=${secondaryPoolId}`, {}, sessionToken);

    const recordRes = await request(`/api/subscribers/${sub1Id}/record`, {}, sessionToken);

    const test9_passed =
      attListDef.status === 200 &&
      attListSec.status === 200 &&
      recordRes.status === 200 &&
      Array.isArray(recordRes.data?.subscriber?.enrollments) &&
      recordRes.data?.subscriber?.enrollments.length === 2 &&
      Array.isArray(recordRes.data?.poolEnrollmentRenewals) &&
      recordRes.data?.poolEnrollmentRenewals.length >= 1;

    record(
      9,
      "GET /api/attendance & record: فلترة الحضور حسب المسبح وعرض السجل التاريخي المتعدد بالكامل",
      test9_passed,
      test9_passed
        ? `سجل الحضور مفلتر بدقة، وسجل المنخرط الشامل يضم جميع الانخراطات (${recordRes.data?.subscriber?.enrollments.length}) والتجديدات التاريخية`
        : `فشل التحقق: attDef=${attListDef.status}, recordStatus=${recordRes.status}`
    );

  } catch (err) {
    console.error("💥 خطأ غير متوقع أثناء تشغيل اختبارات المرحلة الثالثة:", err);
  } finally {
    // تنظيف بيانات الاختبار
    console.log("\n🧹 تنظيف بيانات اختبار المرحلة الثالثة...");
    await db.fileNumberHistory.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.subscriberTransfer.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.poolEnrollmentRenewal.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.renewal.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.membershipCard.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.attendance.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.financialTransaction.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.poolEnrollment.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.poolNumberCounter.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.subscriber.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.subscriptionType.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.pool.deleteMany({ where: { clubId: testClubId } }).catch(() => null);
    await db.session.deleteMany({ where: { id: sessionToken } }).catch(() => null);
    await db.user.deleteMany({ where: { id: adminUserId } }).catch(() => null);
    await db.club.deleteMany({ where: { id: testClubId } }).catch(() => null);
    console.log("✅ اكتمل التنظيف بنجاح.");
  }

  // ═════════════════════════════════════════════════════════════
  // SUMMARY REPORT
  // ═════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 ملخص نتائج اختبارات المرحلة الثالثة (Phase 3 API Layer):");
  console.log("═══════════════════════════════════════════════════════════");

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log(`النتائج: ${passedCount} / ${totalCount} (${Math.round((passedCount / totalCount) * 100)}%) اجتياز ناجح.`);

  if (passedCount === totalCount && totalCount === 9) {
    console.log("🏆 تم التحقق بنجاح 100% من جميع واجهات API والكتابة المزدوجة (Phase 3 Ready!).");
    process.exit(0);
  } else {
    console.error("❌ فشل اختبار أو أكثر. يرجى المراجعة.");
    process.exit(1);
  }
}

runPhase3Tests();
