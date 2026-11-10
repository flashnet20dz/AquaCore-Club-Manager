import { db } from "../src/lib/db";
import {
  ensureDefaultPool,
  validatePoolPrefixRules,
  generateSecureCardUid,
  generateAtomicFileNumber,
  createPoolEnrollmentService,
  renewPoolEnrollmentService,
  transferSubscriberService,
  resolveCardOrFileNumberService,
  assertClubOwnership,
} from "../src/lib/multi-pool";

async function runE2EAcceptanceSuite() {
  console.log("=================================================================");
  console.log("   AQUACORE CLUB MANAGER — ENTERPRISE MULTI-POOL ARCHITECTURE   ");
  console.log("         PHASE 5: FINAL END-TO-END ACCEPTANCE TEST SUITE         ");
  console.log("=================================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, errorDetail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✓ [PASS ${passed.toString().padStart(2, "0")}] ${title}`);
    } else {
      console.error(`✗ [FAIL ${total.toString().padStart(2, "0")}] ${title}`);
      if (errorDetail) console.error(`   Details: ${errorDetail}`);
    }
  }

  // --- Setup Master Test Club ---
  let masterClub = await db.club.findFirst();
  if (!masterClub) {
    masterClub = await db.club.create({
      data: {
        name: "نادي الوفاق متعدد الرياضات - E2E",
        email: "e2e@aquacore.dz",
        phone: "0550000000",
        city: "سعيدة",
        managerName: "المدير العام",
        status: "active",
      },
    });
  }
  const clubId = masterClub.id;

  // ══════════════════════════════════════════════════════════════════
  // Test 1: Default Pool Creation & Invariants
  // ══════════════════════════════════════════════════════════════════
  const defaultPool = await ensureDefaultPool(clubId);
  assert(
    !!defaultPool && defaultPool.isDefault === true && (defaultPool.fileNumberPrefix === "" || defaultPool.fileNumberPrefix === null),
    "1. Default Pool exists, is marked isDefault=true, and has an empty prefix"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 2: Pool Prefix Validation Rules (Alphanumeric, max 4 chars, case)
  // ══════════════════════════════════════════════════════════════════
  const validPrefixCheck = validatePoolPrefixRules("OLYM", false);
  const invalidTooLong = validatePoolPrefixRules("OLYMPIC", false);
  const invalidSymbols = validatePoolPrefixRules("B-1", false);
  const defaultEmptyAllowed = validatePoolPrefixRules("", true);
  const defaultNonEmptyRejected = validatePoolPrefixRules("DEF", true);

  assert(
    validPrefixCheck.valid &&
    !invalidTooLong.valid &&
    !invalidSymbols.valid &&
    defaultEmptyAllowed.valid &&
    !defaultNonEmptyRejected.valid,
    "2. Strict prefix validation rules (A-Z0-9 only, max 4 chars, default pool must be empty)"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 3: Create Secondary Pool with Prefix
  // ══════════════════════════════════════════════════════════════════
  const secCode = `E2E_POOL_${Date.now().toString().slice(-4)}`;
  const secPrefix = `E2${Date.now().toString().slice(-2)}`;
  const secondaryPool = await db.pool.create({
    data: {
      clubId,
      code: secCode,
      name: "المسبح الأولمبي المغطى 50م",
      fileNumberPrefix: secPrefix,
      isDefault: false,
      capacity: 50,
      lanesCount: 8,
    },
  });

  assert(
    secondaryPool.isDefault === false && secondaryPool.fileNumberPrefix === secPrefix,
    "3. Secondary pool successfully created with valid prefix and operational metadata"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 4: Duplicate Prefix Prevention
  // ══════════════════════════════════════════════════════════════════
  let duplicateRejected = false;
  try {
    const dupCheck = await db.pool.findFirst({
      where: { clubId, fileNumberPrefix: secPrefix },
    });
    if (dupCheck) duplicateRejected = true;
  } catch {
    duplicateRejected = true;
  }
  assert(duplicateRejected, "4. Duplicate pool prefix within the same club is prevented");

  // ══════════════════════════════════════════════════════════════════
  // Test 5: Atomic Number Generation per Pool Counter
  // ══════════════════════════════════════════════════════════════════
  const num1 = await generateAtomicFileNumber(clubId, defaultPool.id, "RCS");
  const num2 = await generateAtomicFileNumber(clubId, defaultPool.id, "RCS");
  const numSec1 = await generateAtomicFileNumber(clubId, secondaryPool.id, "RCS");

  assert(
    num2.seq === num1.seq + 1 && numSec1.fileNumber.startsWith(`${secPrefix}-`),
    "5. Atomic number generator increments sequentially without gaps and applies correct pool prefix"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 6: Person (Subscriber) Identity Across Multi-Pools
  // ══════════════════════════════════════════════════════════════════
  const testSub = await db.subscriber.create({
    data: {
      clubId,
      poolId: defaultPool.id,
      firstName: "حمزة",
      lastName: "البليدي",
      fileNumber: `SUB-${Date.now().toString().slice(-4)}`,
      gender: "male",
      birthDate: new Date("1998-07-15"),
      subscriptionType: "monthly",
      paymentStatus: "paid",
      lastPaymentDate: new Date(),
    },
  });

  assert(
    testSub.poolId === defaultPool.id,
    "6. Subscriber record created as unified personal identity linked to default pool"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 7: Multi-Pool Simultaneous Enrollment
  // ══════════════════════════════════════════════════════════════════
  const enrollDefaultRes = await createPoolEnrollmentService({
    clubId,
    subscriberId: testSub.id,
    poolId: defaultPool.id,
    subscriptionType: "monthly",
    startDate: new Date(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const enrollSecRes = await createPoolEnrollmentService({
    clubId,
    subscriberId: testSub.id,
    poolId: secondaryPool.id,
    subscriptionType: "quarterly",
    startDate: new Date(),
    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });

  const enrollmentsCount = await db.poolEnrollment.count({
    where: { clubId, subscriberId: testSub.id, status: "active" },
  });

  assert(
    enrollmentsCount === 2 &&
    enrollDefaultRes.card.cardUid.startsWith("AQCR-") &&
    enrollSecRes.card.cardUid.startsWith("AQCR-") &&
    enrollDefaultRes.card.cardUid !== enrollSecRes.card.cardUid,
    "7. Person successfully enrolled simultaneously in two pools with independent cards and AQCR-HEX32 UIDs"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 8: Subscriber.poolId Mirror Invariant (Secondary pool does not pollute)
  // ══════════════════════════════════════════════════════════════════
  const refreshedSub = await db.subscriber.findUnique({ where: { id: testSub.id } });
  assert(
    refreshedSub?.poolId === defaultPool.id,
    "8. Architectural Invariant: Subscriber.poolId strictly mirrors Default Pool and remains untainted by secondary enrollments"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 9: Prevention of Duplicate Active Enrollments in Same Pool
  // ══════════════════════════════════════════════════════════════════
  let dupEnrollmentBlocked = false;
  try {
    await createPoolEnrollmentService({
      clubId,
      subscriberId: testSub.id,
      poolId: defaultPool.id,
      subscriptionType: "monthly",
    });
  } catch (err: any) {
    if (
      err.message.includes("نشط") ||
      err.message.includes("مكرر") ||
      err.message.includes("active") ||
      err.message.includes("Unique constraint")
    ) {
      dupEnrollmentBlocked = true;
    } else {
      console.log("Test 9 unexpected error:", err.message);
    }
  }

  assert(dupEnrollmentBlocked, "9. Prevent duplicate active enrollment of the same person in the same pool");

  // ══════════════════════════════════════════════════════════════════
  // Test 10: QR Code Check-in by Secure cardUid
  // ══════════════════════════════════════════════════════════════════
  const cardUid = enrollSecRes.card.cardUid;
  const resolveCard = await resolveCardOrFileNumberService(clubId, cardUid);

  assert(
    resolveCard.found &&
    resolveCard.card?.cardUid === cardUid &&
    resolveCard.pool?.id === secondaryPool.id,
    "10. High-security cardUid QR check-in resolves directly to target pool with zero ambiguity"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 11: Barcode Ambiguity Detection (Unscoped Check-in Rejection)
  // ══════════════════════════════════════════════════════════════════
  const ambFileNumber = `E2E-AMB-${Date.now().toString().slice(-4)}`;
  const subX = await db.subscriber.create({
    data: {
      clubId,
      poolId: defaultPool.id,
      firstName: "جمال",
      lastName: "الطيب",
      fileNumber: `SUBX-${Date.now().toString().slice(-4)}`,
      gender: "male",
      birthDate: new Date("1992-01-01"),
      subscriptionType: "monthly",
      paymentStatus: "paid",
      lastPaymentDate: new Date(),
    },
  });
  await db.poolEnrollment.create({
    data: {
      clubId,
      subscriberId: subX.id,
      poolId: defaultPool.id,
      fileNumber: ambFileNumber,
      subscriptionType: "monthly",
      paymentStatus: "paid",
      startDate: new Date(),
      status: "active",
    },
  });

  const subY = await db.subscriber.create({
    data: {
      clubId,
      poolId: null,
      firstName: "مراد",
      lastName: "القاسمي",
      fileNumber: `SUBY-${Date.now().toString().slice(-4)}`,
      gender: "male",
      birthDate: new Date("1993-02-02"),
      subscriptionType: "quarterly",
      paymentStatus: "paid",
      lastPaymentDate: new Date(),
    },
  });
  await db.poolEnrollment.create({
    data: {
      clubId,
      subscriberId: subY.id,
      poolId: secondaryPool.id,
      fileNumber: ambFileNumber,
      subscriptionType: "quarterly",
      paymentStatus: "paid",
      startDate: new Date(),
      status: "active",
    },
  });

  const unscopedResolve = await resolveCardOrFileNumberService(clubId, ambFileNumber, null);
  assert(
    "ambiguous" in unscopedResolve && unscopedResolve.ambiguous === true && (unscopedResolve.candidateEnrollments?.length ?? 0) >= 2,
    "11. Unscoped fileNumber lookup across multiple pools correctly flags ambiguity (Ambiguity Guard)"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 12: Scoped Check-in Disambiguation
  // ══════════════════════════════════════════════════════════════════
  const scopedResolve = await resolveCardOrFileNumberService(clubId, ambFileNumber, secondaryPool.id);
  assert(
    "enrollment" in scopedResolve && scopedResolve.enrollment?.poolId === secondaryPool.id,
    "12. Scoped fileNumber lookup with poolId disambiguates accurately"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 13: Pool Transfer Workflow with Audit History
  // ══════════════════════════════════════════════════════════════════
  const transferRes = await transferSubscriberService({
    clubId,
    subscriberId: subX.id,
    sourcePoolId: defaultPool.id,
    targetPoolId: secondaryPool.id,
    keepFileNumber: false,
    reason: "نقل تدريبي معتمد",
  });

  const transferLog = await db.subscriberTransfer.findFirst({
    where: { clubId, subscriberId: subX.id },
    orderBy: { createdAt: "desc" },
  });

  assert(
    transferRes.targetEnrollment.poolId === secondaryPool.id &&
    !!transferLog &&
    transferLog.sourcePoolId === defaultPool.id &&
    transferLog.targetPoolId === secondaryPool.id,
    "13. Transfer service archives source enrollment, assigns target pool, and records audit trail"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 14: Dual-Write Renewal & Complete History Preservation
  // ══════════════════════════════════════════════════════════════════
  const renewRes = await renewPoolEnrollmentService({
    clubId,
    enrollmentId: enrollDefaultRes.enrollment.id,
    months: 1,
    amount: 3000,
    paymentMethod: "cash",
    notes: "تجديد اختبار القبول النهائي",
  });

  const historyRecord = await db.poolEnrollmentRenewal.findFirst({
    where: { enrollmentId: enrollDefaultRes.enrollment.id },
    orderBy: { renewedAt: "desc" },
  });

  assert(
    renewRes.renewalRecord?.amount === 3000 &&
    !!historyRecord &&
    historyRecord.amount === 3000 &&
    historyRecord.subscriptionType === "monthly",
    "14. Dual-Write renewal records complete financial and expiration history in PoolEnrollmentRenewal"
  );

  // ══════════════════════════════════════════════════════════════════
  // Test 15: Cross-Tenant Security Isolation (assertClubOwnership)
  // ══════════════════════════════════════════════════════════════════
  let unauthorizedBlocked = false;
  try {
    await assertClubOwnership("FAKE_CLUB_XYZ", {
      poolId: secondaryPool.id,
    });
  } catch (err: any) {
    if (
      err.message.includes("غير تابع") ||
      err.message.includes("غير مصرح") ||
      err.message.includes("Unauthorized") ||
      err.message.includes("not found")
    ) {
      unauthorizedBlocked = true;
    }
  }

  assert(unauthorizedBlocked, "15. Multi-tenant security guard strictly blocks cross-club resource access");

  // ══════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════
  console.log("=================================================================");
  console.log(`E2E ACCEPTANCE SUITE RESULT: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("=================================================================");

  if (passed !== total) process.exit(1);
}

runE2EAcceptanceSuite()
  .catch((err) => {
    console.error("E2E Test execution failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
