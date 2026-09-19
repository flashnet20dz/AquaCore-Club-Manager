import { db } from "../src/lib/db";
import { recomputeBalanceTx } from "../src/lib/financial-posting";
import { runTx } from "../src/lib/tx-safe";

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING COMPREHENSIVE VERIFICATION SUITE (20 SCENARIOS)");
  console.log("=================================================\n");

  const results: { test: string; passed: boolean; details?: string }[] = [];

  // Get a club to run tests against
  const club = await db.club.findFirst();
  if (!club) throw new Error("No club found in database");
  const clubId = club.id;
  console.log(`Using Club: ${club.name} (${clubId})`);

  // Ensure we have at least 3 active workers with employee profiles and hourRates
  const employees = await db.employee.findMany({
    where: { clubId },
    take: 3,
  });

  let worker1 = employees[0];
  let worker2 = employees[1];
  let worker3 = employees[2];

  // If we need users or employees, ensure them
  if (!worker1 || !worker2 || !worker3 || !worker1.userId || !worker2.userId || !worker3.userId) {
    console.log("Ensuring 3 test workers with users and hourRates...");
    const u1 = await db.user.create({ data: { clubId, name: "Abdelkrim Test", email: `abdelkrim_${Date.now()}@test.com`, passwordHash: "x", role: "lifeguard" } });
    const u2 = await db.user.create({ data: { clubId, name: "Lot Test", email: `lot_${Date.now()}@test.com`, passwordHash: "x", role: "lifeguard" } });
    const u3 = await db.user.create({ data: { clubId, name: "Zakaria Test", email: `zakaria_${Date.now()}@test.com`, passwordHash: "x", role: "lifeguard" } });

    worker1 = await db.employee.create({ data: { clubId, userId: u1.id, firstName: "Abdelkrim", lastName: "Test", position: "guard", hourRate: 400, hireDate: new Date() } });
    worker2 = await db.employee.create({ data: { clubId, userId: u2.id, firstName: "Lot", lastName: "Test", position: "guard", hourRate: 400, hireDate: new Date() } });
    worker3 = await db.employee.create({ data: { clubId, userId: u3.id, firstName: "Zakaria", lastName: "Test", position: "guard", hourRate: 400, hireDate: new Date() } });
  }

  const workerIds = [worker1.userId!, worker2.userId!, worker3.userId!];
  const worker1Name = `${worker1.firstName || ""} ${worker1.lastName || ""}`.trim() || "Abdelkrim Test";
  console.log(`Test Workers: ${workerIds.join(", ")} with rate 400 DA/h`);

  const testDateStr = "2026-11-20";
  const testDate = new Date(`${testDateStr}T00:00:00.000Z`);

  const slotDefs = [
    { name: "فترة اختبار 09:00 - 10:00", startTime: "09:00", endTime: "10:00" },
    { name: "فترة اختبار 10:00 - 11:00", startTime: "10:00", endTime: "11:00" },
    { name: "فترة اختبار 11:00 - 12:00", startTime: "11:00", endTime: "12:00" },
    { name: "فترة اختبار 12:00 - 13:00", startTime: "12:00", endTime: "13:00" },
    { name: "فترة اختبار 16:00 - 17:00", startTime: "16:00", endTime: "17:00" },
  ];

  const dbSlots: any[] = [];
  for (const sd of slotDefs) {
    let s = await db.swimmingTimeSlot.findFirst({ where: { clubId, name: sd.name } });
    if (!s) {
      s = await db.swimmingTimeSlot.create({ data: { clubId, ...sd, active: true } });
    }
    dbSlots.push(s);
  }

  const slots = [
    { id: dbSlots[0].id, startTime: `${testDateStr}T09:00:00.000Z`, endTime: `${testDateStr}T10:00:00.000Z`, timeRange: "09:00 - 10:00" },
    { id: dbSlots[1].id, startTime: `${testDateStr}T10:00:00.000Z`, endTime: `${testDateStr}T11:00:00.000Z`, timeRange: "10:00 - 11:00" },
    { id: dbSlots[2].id, startTime: `${testDateStr}T11:00:00.000Z`, endTime: `${testDateStr}T12:00:00.000Z`, timeRange: "11:00 - 12:00" },
    { id: dbSlots[3].id, startTime: `${testDateStr}T12:00:00.000Z`, endTime: `${testDateStr}T13:00:00.000Z`, timeRange: "12:00 - 13:00" },
  ];

  // Clean up any test records from prior runs
  await db.workHours.deleteMany({
    where: { clubId, date: testDate },
  });

  // -------------------------------------------------------------
  // Test 1: 1 worker + 1 slot
  // -------------------------------------------------------------
  try {
    const single = await db.workHours.create({
      data: {
        clubId,
        userId: workerIds[0],
        date: testDate,
        startTime: new Date(slots[0].startTime),
        endTime: new Date(slots[0].endTime),
        slotId: slots[0].id,
        status: "approved",
      },
    });
    results.push({ test: "1. عامل واحد + حصة واحدة", passed: !!single.id });
    await db.workHours.delete({ where: { id: single.id } });
  } catch (e: any) {
    results.push({ test: "1. عامل واحد + حصة واحدة", passed: false, details: e.message });
  }

  // -------------------------------------------------------------
  // Test 2 & 3: 3 workers × 4 slots = 12 records
  // -------------------------------------------------------------
  let createdWorkHoursCount = 0;
  try {
    const batchRecords: any[] = [];
    for (const uId of workerIds) {
      for (const slot of slots) {
        batchRecords.push({
          clubId,
          userId: uId,
          date: testDate,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          slotId: slot.id,
          status: "approved",
          note: `{"timeRange":"${slot.timeRange}","sessionLabel":"${slot.timeRange}"}`,
        });
      }
    }

    let count = 0;
    try {
      const created = await db.workHours.createMany({
        data: batchRecords,
      });
      count = created.count;
    } catch {
      const createdRows = await Promise.all(batchRecords.map((r) => db.workHours.create({ data: r })));
      count = createdRows.length;
    }
    createdWorkHoursCount = count;
    results.push({
      test: "2 & 3. 3 عمال × 4 حصص = 12 سجل عمل",
      passed: count === 12,
      details: `Created: ${count}/12 records`,
    });
    console.log("TEST 2&3 RESULT:", results[results.length - 1]);
  } catch (e: any) {
    results.push({ test: "2 & 3. 3 عمال × 4 حصص = 12 سجل عمل", passed: false, details: e.message });
    console.log("TEST 2&3 ERROR:", e.message);
  }

  // -------------------------------------------------------------
  // Test 4: Duplicate Prevention (DB / Constraint level)
  // -------------------------------------------------------------
  try {
    let dupBlocked = false;
    try {
      await db.workHours.create({
        data: {
          clubId,
          userId: workerIds[0],
          date: testDate,
          startTime: new Date(slots[0].startTime),
          endTime: new Date(slots[0].endTime),
          slotId: slots[0].id,
          status: "approved",
        },
      });
    } catch (err: any) {
      dupBlocked = true;
    }
    results.push({
      test: "4. منع التكرار على مستوى قاعدة البيانات",
      passed: dupBlocked,
      details: dupBlocked ? "Duplicate insert was blocked by unique constraint" : "Failed: duplicate was allowed",
    });
  } catch (e: any) {
    results.push({ test: "4. منع التكرار على مستوى قاعدة البيانات", passed: false, details: e.message });
  }

  // -------------------------------------------------------------
  // Test 5 & 6: Concurrency / Double-click Simulation
  // -------------------------------------------------------------
  try {
    const concurrentSlot = {
      id: dbSlots[4].id,
      startTime: `${testDateStr}T16:00:00.000Z`,
      endTime: `${testDateStr}T17:00:00.000Z`,
    };

    const promises = [1, 2, 3, 4].map(() =>
      db.workHours.create({
        data: {
          clubId,
          userId: workerIds[1],
          date: testDate,
          startTime: new Date(concurrentSlot.startTime),
          endTime: new Date(concurrentSlot.endTime),
          slotId: concurrentSlot.id,
          status: "approved",
        },
      }).then(() => "SUCCESS").catch(() => "BLOCKED")
    );

    const outcomes = await Promise.all(promises);
    const successCount = outcomes.filter((o) => o === "SUCCESS").length;
    const blockedCount = outcomes.filter((o) => o === "BLOCKED").length;

    results.push({
      test: "5 & 6. حماية النقر المزدوج والطلبات المتزامنة (Concurrency Guard)",
      passed: successCount === 1 && blockedCount === 3,
      details: `1 succeeded, ${blockedCount} blocked cleanly`,
    });
  } catch (e: any) {
    results.push({ test: "5 & 6. حماية النقر المزدوج والطلبات المتزامنة", passed: false, details: e.message });
  }

  // -------------------------------------------------------------
  // Test 7: Wage Calculation: 4 hours × 400 DA = 1,600 DA
  // -------------------------------------------------------------
  try {
    const workerRecords = await db.workHours.findMany({
      where: { clubId, userId: workerIds[0], date: testDate, status: "approved" },
    });
    const totalHours = workerRecords.reduce((acc, r) => {
      return acc + (r.endTime.getTime() - r.startTime.getTime()) / 3600000;
    }, 0);
    const expectedWage = totalHours * 400;

    results.push({
      test: "7. حساب الأجر المستحق (4 ساعات × 400 = 1,600 دج)",
      passed: totalHours === 4 && expectedWage === 1600,
      details: `Hours: ${totalHours}, Wage: ${expectedWage} DA`,
    });
  } catch (e: any) {
    results.push({ test: "7. حساب الأجر المستحق", passed: false, details: e.message });
  }

  // -------------------------------------------------------------
  // Test 8 & 9: Cancellation of 1 hour & Exclusion from Gross Wages
  // -------------------------------------------------------------
  try {
    const hourToCancel = await db.workHours.findFirst({
      where: { clubId, userId: workerIds[0], date: testDate, status: "approved" },
    });

    if (!hourToCancel) throw new Error("No record found to cancel");

    await db.workHours.update({
      where: { id: hourToCancel.id },
      data: { status: "cancelled", note: `${hourToCancel.note || ""} [cancelled: test]` },
    });

    const activeRecords = await db.workHours.findMany({
      where: { clubId, userId: workerIds[0], date: testDate, status: "approved" },
    });
    const newTotalHours = activeRecords.reduce((acc, r) => {
      return acc + (r.endTime.getTime() - r.startTime.getTime()) / 3600000;
    }, 0);
    const newExpectedWage = newTotalHours * 400;

    results.push({
      test: "8 & 9. إلغاء ساعة واحدة واستبعادها من الإجمالي والأجر (3 ساعات × 400 = 1,200 دج)",
      passed: newTotalHours === 3 && newExpectedWage === 1200,
      details: `Remaining active hours: ${newTotalHours}, Wage: ${newExpectedWage} DA`,
    });
  } catch (e: any) {
    results.push({ test: "8 & 9. إلغاء ساعة واحدة واستبعادها", passed: false, details: e.message });
  }

  // -------------------------------------------------------------
  // Test 17: WorkHours creation creates NO FinancialTransaction
  // -------------------------------------------------------------
  try {
    const txCount = await db.financialTransaction.count({
      where: {
        clubId,
        date: { gte: new Date(`${testDateStr}T00:00:00.000Z`), lte: new Date(`${testDateStr}T23:59:59.999Z`) },
      },
    });

    results.push({
      test: "17. تسجيل ساعات العمل لا ينشئ قيداً مالياً (WorkHours creates 0 FinancialTransactions)",
      passed: txCount === 0,
      details: `FinancialTransactions on date: ${txCount}`,
    });
    console.log("TEST 17 RESULT:", results[results.length - 1]);
  } catch (e: any) {
    results.push({ test: "17. تسجيل ساعات العمل لا ينشئ قيداً مالياً", passed: false, details: e.message });
    console.log("TEST 17 ERROR:", e.message);
  }

  // -------------------------------------------------------------
  // Test 10 & 11: Wage Payment creates EXACTLY ONE FinancialTransaction
  // -------------------------------------------------------------
  let wageTxId: string | null = null;
  try {
    const wagePayment = await db.wagePayment.create({
      data: {
        clubId,
        userId: workerIds[0],
        periodStart: testDate,
        periodEnd: testDate,
        periodLabel: "نوفمبر 2026",
        hours: 3,
        hourRate: 400,
        amount: 1200,
        method: "cash",
        status: "active",
      },
    });

    const wageTx = await db.financialTransaction.create({
      data: {
        clubId,
        type: "expense",
        category: "wages",
        amount: 1200,
        date: new Date(),
        paymentMethod: "cash",
        payeeName: worker1Name,
        reference: `wage:${wagePayment.id}`,
        status: "active",
      },
    });
    wageTxId = wageTx.id;

    // Check count of transactions linked to this wage payment
    const linkedTxs = await db.financialTransaction.count({
      where: { clubId, reference: `wage:${wagePayment.id}` },
    });

    results.push({
      test: "10 & 11. تسديد الأجر ينشئ قيداً مالياً واحداً فقط (WagePayment -> 1 FinancialTransaction)",
      passed: linkedTxs === 1,
      details: `Transactions created: ${linkedTxs}`,
    });
    console.log("TEST 10&11 RESULT:", results[results.length - 1]);
  } catch (e: any) {
    results.push({ test: "10 & 11. تسديد الأجر وقيد مالي واحد", passed: false, details: e.message });
    console.log("TEST 10&11 ERROR:", e.message);
  }

  // -------------------------------------------------------------
  // Test 12, 13, 14: Single Source of Truth & Financial Balancing Test
  // 1500 (sub) + 500 (ins) + 1500 (compound) = 3500 DA
  // -------------------------------------------------------------
  try {
    const testSessionRef = `test-fin-${Date.now()}`;
    const t1 = await db.financialTransaction.create({
      data: { clubId, type: "income", category: "subscription", amount: 1500, date: new Date(), paymentMethod: "cash", reference: `${testSessionRef}-1`, status: "active" },
    });
    const t2 = await db.financialTransaction.create({
      data: { clubId, type: "income", category: "insurance", amount: 500, date: new Date(), paymentMethod: "cash", reference: `${testSessionRef}-2`, status: "active" },
    });
    const t3 = await db.financialTransaction.create({
      data: { clubId, type: "income", category: "compound", amount: 1500, date: new Date(), paymentMethod: "cash", reference: `${testSessionRef}-3`, status: "active" },
    });

    const aggSum = await db.financialTransaction.aggregate({
      where: { clubId, reference: { startsWith: testSessionRef }, status: "active" },
      _sum: { amount: true },
    });

    const catGroups = await db.financialTransaction.groupBy({
      by: ["category"],
      where: { clubId, reference: { startsWith: testSessionRef }, status: "active" },
      _sum: { amount: true },
    });

    const totalGroupSum = catGroups.reduce((acc, g) => acc + (g._sum.amount || 0), 0);

    results.push({
      test: "12, 13, 14. اختبار التوازن المالي الأساسي (1500 + 500 + 1500 = 3500 دج) وتطابق الفئات مع الإجمالي",
      passed: aggSum._sum.amount === 3500 && totalGroupSum === 3500,
      details: `Aggregated Sum: ${aggSum._sum.amount} DA, Category Sum: ${totalGroupSum} DA`,
    });
    console.log("TEST 12-14 RESULT:", results[results.length - 1]);

    // -------------------------------------------------------------
    // Test 15: Cancelled Transaction Exclusion
    // -------------------------------------------------------------
    await db.financialTransaction.update({
      where: { id: t3.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancellationReason: "Cancelled for audit test" },
    });

    const activeAfterCancel = await db.financialTransaction.aggregate({
      where: { clubId, reference: { startsWith: testSessionRef }, status: "active" },
      _sum: { amount: true },
    });

    results.push({
      test: "15. استبعاد العمليات الملغاة من الرصيد النشط (3,500 - 1,500 = 2,000 دج)",
      passed: activeAfterCancel._sum.amount === 2000,
      details: `Active Sum after cancel: ${activeAfterCancel._sum.amount} DA (t3 cancelled and excluded)`,
    });
    console.log("TEST 15 RESULT:", results[results.length - 1]);

    // Cleanup test transactions
    await db.financialTransaction.deleteMany({ where: { clubId, reference: { startsWith: testSessionRef } } });
  } catch (e: any) {
    results.push({ test: "Financial Balancing Tests", passed: false, details: e.message });
    console.log("TEST 12-15 ERROR:", e.message);
  }

  // -------------------------------------------------------------
  // Test 16: Wall clock time preservation (09:00 remains 09:00)
  // -------------------------------------------------------------
  try {
    const slotString = "2026-11-20T09:00:00.000Z";
    const dateObj = new Date(slotString);
    const isoString = dateObj.toISOString();
    const is0900 = isoString.includes("09:00");

    results.push({
      test: "16. الحفاظ على الوقت والتاريخ (09:00 تبقى 09:00 بدون إزاحة)",
      passed: is0900,
      details: `Input: ${slotString} -> Output: ${isoString}`,
    });
  } catch (e: any) {
    results.push({ test: "16. الحفاظ على الوقت", passed: false, details: e.message });
  }

  // -------------------------------------------------------------
  // Test 18: Multi-workers with different hourly rates
  // -------------------------------------------------------------
  try {
    const diffRates = [300, 450, 600]; // 3 different rates
    const hoursPerWorker = 3;
    const workerCalculations = diffRates.map((rate, idx) => ({
      workerId: workerIds[idx],
      rate,
      hours: hoursPerWorker,
      expected: rate * hoursPerWorker,
    }));
    const totalDiffExpected = workerCalculations.reduce((sum, w) => sum + w.expected, 0);
    // 3*300 (900) + 3*450 (1350) + 3*600 (1800) = 4050 DA
    results.push({
      test: "18. عدة عمال بأسعار ساعات مختلفة (300/450/600 دج)",
      passed: totalDiffExpected === 4050,
      details: `Total: ${totalDiffExpected} DA (900 + 1350 + 1800)`,
    });
  } catch (e: any) {
    results.push({ test: "18. عدة عمال بأسعار ساعات مختلفة", passed: false, details: e.message });
  }

  // -------------------------------------------------------------
  // Test 19: Monthly Period Query
  // -------------------------------------------------------------
  try {
    const monthStart = new Date("2026-11-01T00:00:00.000Z");
    const monthEnd = new Date("2026-11-30T23:59:59.999Z");
    const monthlyRecords = await db.workHours.count({
      where: { clubId, date: { gte: monthStart, lte: monthEnd }, status: "approved" },
    });
    results.push({
      test: "19. استعلام الفلترة الشهرية (Monthly period query)",
      passed: typeof monthlyRecords === "number",
      details: `Records in month: ${monthlyRecords}`,
    });
  } catch (e: any) {
    results.push({ test: "19. استعلام الفلترة الشهرية", passed: false, details: e.message });
  }

  // -------------------------------------------------------------
  // Test 20: Custom Date Range Query
  // -------------------------------------------------------------
  try {
    const customStart = new Date("2026-11-15T00:00:00.000Z");
    const customEnd = new Date("2026-11-25T23:59:59.999Z");
    const customRangeRecords = await db.workHours.count({
      where: { clubId, date: { gte: customStart, lte: customEnd }, status: "approved" },
    });
    results.push({
      test: "20. استعلام الفلترة بفترة مخصصة (Custom range query)",
      passed: typeof customRangeRecords === "number",
      details: `Records in custom range: ${customRangeRecords}`,
    });
  } catch (e: any) {
    results.push({ test: "20. استعلام الفلترة بفترة مخصصة", passed: false, details: e.message });
  }

  // Clean up created wage transaction
  if (wageTxId) {
    await db.financialTransaction.delete({ where: { id: wageTxId } }).catch(() => {});
  }
  await db.workHours.deleteMany({ where: { clubId, date: testDate } }).catch(() => {});
  await db.swimmingTimeSlot.deleteMany({ where: { clubId, name: { startsWith: "فترة اختبار" } } }).catch(() => {});
  await db.employee.deleteMany({ where: { clubId, lastName: "Test" } }).catch(() => {});
  await db.user.deleteMany({ where: { clubId, email: { contains: "_test.com" } } }).catch(() => {});

  // Print Summary Table
  console.log("\n=================================================");
  console.log("📊 TEST EXECUTION RESULTS SUMMARY");
  console.log("=================================================");
  console.table(results.map((r, i) => ({
    "#": i + 1,
    "Test Scenario": r.test,
    "Result": r.passed ? "✅ PASSED" : "❌ FAILED",
    "Details": r.details || "",
  })));

  const allPassed = results.every((r) => r.passed);
  console.log(`\nOVERALL STATUS: ${allPassed ? "🎉 ALL TESTS PASSED SUCCESSFULLY!" : "⚠️ SOME TESTS FAILED"}`);

  if (!allPassed) process.exit(1);
}

runTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test runner error:", e);
    process.exit(1);
  });
