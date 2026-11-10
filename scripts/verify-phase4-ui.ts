import { db } from "../src/lib/db";
import {
  ensureDefaultPool,
  createPoolEnrollmentService,
  transferSubscriberService,
  resolveCardOrFileNumberService,
} from "../src/lib/multi-pool";

async function runPhase4Tests() {
  console.log("=================================================");
  console.log("   AQUACORE MULTI-POOL ARCHITECTURE — PHASE 4   ");
  console.log("      FRONTEND UI INTEGRATION VERIFICATION       ");
  console.log("=================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✓ [PASS ${passed}] ${testName}`);
    } else {
      console.error(`✗ [FAIL] ${testName}`);
      if (detail) console.error(`  Detail: ${detail}`);
    }
  }

  // Find test club
  const club = await db.club.findFirst();
  if (!club) throw new Error("No club found");
  const clubId = club.id;

  // 1. Ensure default pool
  const defaultPool = await ensureDefaultPool(clubId);
  assert(!!defaultPool && defaultPool.isDefault, "Test 1: Default pool is verified and active");

  // 2. Ensure secondary pool
  let secondaryPool = await db.pool.findFirst({
    where: { clubId, code: "UI_TEST_POOL", archivedAt: null },
  });
  if (!secondaryPool) {
    secondaryPool = await db.pool.create({
      data: {
        clubId,
        code: "UI_TEST_POOL",
        name: "مسبح الاختبار UI التدريبي",
        fileNumberPrefix: "UIT",
        isDefault: false,
        capacity: 35,
        lanesCount: 4,
      },
    });
  }
  assert(secondaryPool.fileNumberPrefix === "UIT", "Test 2: Secondary pool with prefix 'UIT' verified");

  // 3. Create subscriber with enrollment in default pool
  const subA = await db.subscriber.create({
    data: {
      clubId,
      poolId: defaultPool.id,
      firstName: "طارق",
      lastName: "المنصوري",
      fileNumber: `UIT-${Date.now().toString().slice(-4)}`,
      gender: "male",
      birthDate: new Date("1995-03-20"),
      subscriptionType: "monthly",
      paymentStatus: "paid",
      lastPaymentDate: new Date(),
    },
  });

  const resA1 = await createPoolEnrollmentService({
    clubId,
    subscriberId: subA.id,
    poolId: defaultPool.id,
    subscriptionType: "monthly",
    startDate: new Date(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  const enrollA1 = resA1.enrollment;
  assert(!!enrollA1 && enrollA1.poolId === defaultPool.id, "Test 3: Subscriber enrolled in default pool");

  // 4. Enroll same subscriber in secondary pool (multi-pool enrollment)
  const resA2 = await createPoolEnrollmentService({
    clubId,
    subscriberId: subA.id,
    poolId: secondaryPool.id,
    subscriptionType: "quarterly",
    startDate: new Date(),
    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });
  const enrollA2 = resA2.enrollment;
  assert(!!enrollA2 && enrollA2.poolId === secondaryPool.id, "Test 4: Same subscriber enrolled in secondary pool");

  // 5. Query subscribers filtered by poolId
  const defaultSubscribers = await db.subscriber.findMany({
    where: {
      clubId,
      enrollments: { some: { poolId: defaultPool.id, status: "active" } },
    },
  });
  const inDefault = defaultSubscribers.some((s) => s.id === subA.id);
  assert(inDefault, "Test 5: Pool-scoped subscriber query correctly finds subscriber in default pool");

  const secondarySubscribers = await db.subscriber.findMany({
    where: {
      clubId,
      enrollments: { some: { poolId: secondaryPool.id, status: "active" } },
    },
  });
  const inSecondary = secondarySubscribers.some((s) => s.id === subA.id);
  assert(inSecondary, "Test 6: Pool-scoped subscriber query correctly finds subscriber in secondary pool");

  // 6. Test ambiguity in check-in when two subscribers have same file number in different pools
  // Setup another subscriber with same fileNumber on secondary pool
  const sharedNum = `AMB-${Date.now().toString().slice(-4)}`;
  const subB = await db.subscriber.create({
    data: {
      clubId,
      poolId: defaultPool.id,
      firstName: "يوسف",
      lastName: "البدوي",
      fileNumber: `SUBB-${Date.now().toString().slice(-4)}`,
      gender: "male",
      birthDate: new Date("1996-01-01"),
      subscriptionType: "monthly",
      paymentStatus: "paid",
      lastPaymentDate: new Date(),
    },
  });
  const enrollShared1 = await db.poolEnrollment.create({
    data: {
      clubId,
      subscriberId: subB.id,
      poolId: defaultPool.id,
      fileNumber: sharedNum,
      subscriptionType: "monthly",
      paymentStatus: "paid",
      startDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "active",
    },
  });

  const subC = await db.subscriber.create({
    data: {
      clubId,
      poolId: null,
      firstName: "كريم",
      lastName: "العاصمي",
      fileNumber: `SUBC-${Date.now().toString().slice(-4)}`,
      gender: "male",
      birthDate: new Date("1997-02-02"),
      subscriptionType: "quarterly",
      paymentStatus: "paid",
      lastPaymentDate: new Date(),
    },
  });
  const enrollShared2 = await db.poolEnrollment.create({
    data: {
      clubId,
      subscriberId: subC.id,
      poolId: secondaryPool.id,
      fileNumber: sharedNum,
      subscriptionType: "quarterly",
      paymentStatus: "paid",
      startDate: new Date(),
      expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      status: "active",
    },
  });

  // Ambiguous resolution without poolId
  const ambResult = await resolveCardOrFileNumberService(
    clubId,
    sharedNum,
    null
  );
  assert(
    "ambiguous" in ambResult && ambResult.ambiguous === true && (ambResult.candidateEnrollments?.length ?? 0) >= 2,
    "Test 7: Unscoped QR checkin correctly detects ambiguity across pools (HTTP 409)"
  );

  // Disambiguated resolution with poolId
  const disResult = await resolveCardOrFileNumberService(
    clubId,
    sharedNum,
    secondaryPool.id
  );
  assert(
    "enrollment" in disResult && disResult.enrollment?.id === enrollShared2.id,
    "Test 8: Scoped QR checkin disambiguates successfully when poolId is provided"
  );

  // 7. Test transfer with UI parameter contract
  const transferResult = await transferSubscriberService({
    clubId,
    subscriberId: subB.id,
    sourcePoolId: defaultPool.id,
    targetPoolId: secondaryPool.id,
    keepFileNumber: false,
    reason: "تحويل تجريبي من واجهة إدارة المنخرطين",
  });
  console.log("transferResult:", transferResult);
  assert(
    Boolean(transferResult.targetEnrollment && transferResult.targetEnrollment.poolId === secondaryPool.id),
    "Test 9: Transfer pool workflow succeeds with UI parameter contract"
  );

  console.log("=================================================");
  console.log(`UI VERIFICATION RESULT: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("=================================================");

  if (passed !== total) process.exit(1);
}

runPhase4Tests().catch((e) => {
  console.error("Verification failed with exception:", e);
  process.exit(1);
}).finally(() => process.exit(0));
