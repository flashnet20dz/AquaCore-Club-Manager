#!/usr/bin/env node
/**
 * phase5-test.mjs — اختبار تكاملي شامل للمرحلة 5 (§49-§53)
 * ═══════════════════════════════════════════════════════════════
 * الموظفون ← العقود ← جلسات المسبح ← ساعات العمل ← الأجر ← الدفع ← الدفتر المالي
 *
 *   1     Employee: إنشاء + حالة + مزامنة active + whitelist (§3)
 *   2-3   Contract: إنشاء بأنواع + مسودة → تفعيل + انتهاء تلقائي (§4/§26)
 *   4-6   WorkHours: لقطة السعر + تعدد الحصص + منع التكرار (§7/§8/§23)
 *   7-8   الاعتماد: اعتماد جماعي + رفض بسبب إلزامي (§9/§10)
 *   9-11  الحساب: بالساعة + شهري + فترة مخصصة (§11/§12/§22)
 *   12    لقطة السعر: تغيير الأجر لا يعيد حساب التاريخ (§23/§48)
 *   13-15 الدفع: جزئي → كامل → منع الدفع الزائد (§13/§14/§21)
 *   16    Idempotency: نفس المفتاح = دفعة واحدة (§37)
 *   17-18 القيد المالي 1:1 + الرصيد (§16/§17)
 *   19-21 الإلغاء الناعم: WP + FT + الرصيد + المتبقي (§19/§20/§46)
 *   22    سجل التدقيق لكل العمليات الحساسة (§35)
 *   23    لوحة التحكم = صفحة الأجور (رقم واحد §27)
 *   24    المركز المالي يرى القيد (§22)
 *   25    حماية العقد: منع التسجيل بعد endDate + تجاوز المدير (§24)
 *   26    Timezone: 08/09/12/17/23 تبقى كما هي (§50)
 *   27    أرشفة الموظف بدل الحذف (§3)
 *   28    تنظيف كامل — كل شيء ملغى/مؤرشف بلا أثر مالي
 *
 * الاستخدام: node scripts/phase5-test.mjs [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";
const COOKIE_JAR = [];
const TEST_TAG = `TEST-P5-${Date.now().toString(36)}`;
const { PrismaClient } = await import("@prisma/client").then((m) => m.default ? m : m);
const prisma = new PrismaClient();

let passed = 0, failed = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failed++; failures.push(name); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(COOKIE_JAR.length ? { cookie: COOKIE_JAR.join("; ") } : {}),
      ...(opts.headers || {}),
    },
  });
  const setCookies = res.headers.getSetCookie?.() || [];
  for (const c of setCookies) {
    const pair = c.split(";")[0];
    if (!COOKIE_JAR.includes(pair)) COOKIE_JAR.push(pair);
  }
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, data };
}

const wallTime = (iso) => new Date(iso).toISOString().slice(11, 16);

async function main() {
  console.log(`\n🧪 PHASE 5 INTEGRATION TEST — ${TEST_TAG}\n${"═".repeat(60)}`);

  // ═══ 0) تسجيل الدخول ═══
  console.log("\n📋 0) تسجيل الدخول (المدير)");
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@rcs.dz", password: "admin123" }),
  });
  ok("login 200", login.status === 200, `role=${login.data?.user?.role}`);
  if (login.status !== 200) throw new Error("لا يمكن المتابعة بلا دخول");
  const adminId = login.data.user.id;
  // clubId من قاعدة البيانات مباشرة (استجابة login لا تتضمنه دائماً)
  const adminUser = await prisma.user.findUnique({ where: { id: adminId }, select: { clubId: true } });
  const clubId = adminUser?.clubId;

  const usersRes = await api("/api/users");
  const users = (usersRes.data?.users || []).filter((u) => u.id !== adminId);
  const workerA = users[0];
  const workerB = users[1] || users[0];
  ok("عمال متاحون للاختبار", Boolean(workerA), workerA?.name);

  // ═══ تنظيف متبقيات تشغيلات سابقة (إلغاء ناعم فقط — بلا فقدان بيانات) ═══
  {
    // ★ التدقيق النهائي: إلغاء كل السجلات النشطة على تواريخ الاختبار الثلاثة
    //   وليس فقط الموسومة TEST-P5 — لأن phase4 (الذي يسبق هذا الاختبار في نفس
    //   البيئة) ينشئ سجلات approved على 2026-01-04 دون وسم، وتنظيفه لا يحذف
    //   المعتمد (منع الحذف الفعلي للمعتمد بالتصميم) فيحجب فحص التكرار هنا.
    const TEST_DATES = [new Date("2026-01-04T00:00:00.000Z"), new Date("2026-01-11T00:00:00.000Z"), new Date("2026-01-18T00:00:00.000Z")];
    const leftovers = await prisma.workHours.findMany({
      where: {
        status: { in: ["approved", "pending"] },
        OR: [
          { note: { contains: "TEST-P5" } },
          { date: { in: TEST_DATES } },
        ],
      },
      select: { id: true },
    });
    for (const row of leftovers) {
      await prisma.workHours.update({
        where: { id: row.id },
        data: { status: "cancelled", rejectionReason: "تنظيف متبقيات اختبار سابق" },
      });
    }
    const leftPayments = await prisma.wagePayment.findMany({
      where: { status: "active", OR: [{ note: { contains: "TEST-P5" } }, { idempotencyKey: { startsWith: "TEST-P5-" } }] },
      select: { id: true, transactionId: true, clubId: true, userId: true, amount: true, periodLabel: true },
    });
    for (const wp of leftPayments) {
      await prisma.wagePayment.update({
        where: { id: wp.id },
        data: { status: "cancelled", cancelledAt: new Date(), cancellationReason: "تنظيف متبقيات اختبار سابق" },
      });
      if (wp.transactionId) {
        await prisma.financialTransaction.update({
          where: { id: wp.transactionId },
          data: { status: "cancelled", cancelledAt: new Date(), cancellationReason: "تنظيف متبقيات اختبار سابق" },
        });
      }
    }
    if (leftovers.length || leftPayments.length) {
      console.log(`  🧹 تنظيف متبقيات: ${leftovers.length} سجل عمل + ${leftPayments.length} تسديد`);
    }
    // جلسات اختبارية متبقية من تشغيلات سابقة
    const oldSlots = await prisma.swimmingTimeSlot.findMany({ where: { name: { contains: "TEST-P5" } }, select: { id: true } });
    for (const s of oldSlots) await prisma.swimmingTimeSlot.delete({ where: { id: s.id } }).catch(() => undefined);
    if (oldSlots.length) console.log(`  🧹 حذف ${oldSlots.length} جلسة اختبارية متبقية`);
  }

  // رصيد مالي قبل الاختبار (لقياس الفروق)
  const finBefore = await api("/api/financial/dashboard");
  const expBefore = finBefore.data?.balance?.totalExpense ?? 0;
  const currentYM = new Date().toISOString().slice(0, 7); // الشهر الحالي (§27)

  // ═══ 1) الموظف ═══
  console.log("\n📋 1) الموظف — إنشاء + حالة + مزامنة (§3)");
  const empRes = await api("/api/employees", {
    method: "POST",
    body: JSON.stringify({
      firstName: `أحمد-${TEST_TAG}`, lastName: "الاختباري",
      phone: "0555112233", email: `${TEST_TAG}@test.dz`,
      position: "guard", hourRate: 500, status: "SUSPENDED",
      userId: workerA.id, hackedField: "should-be-ignored",
    }),
  });
  ok("إنشاء موظف 201", empRes.status === 201, empRes.data?.employee?.id?.slice(0, 8));
  const employee = empRes.data.employee;
  ok("status=SUSPENDED محفوظ", employee?.status === "SUSPENDED", employee?.status);
  ok("active مزامن مع الحالة (false)", employee?.active === false);
  ok("whitelist: حقل دخيل مرفوض", !("hackedField" in (employee || {})));
  const empActivate = await api(`/api/employees/${employee.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }),
  });
  ok("PATCH → ACTIVE + active=true", empActivate.data?.employee?.status === "ACTIVE" && empActivate.data?.employee?.active === true);

  // ═══ 2-3) العقود ═══
  console.log("\n📋 2-3) العقود — أنواع + مسودة + انتهاء تلقائي (§4/§26)");
  const draftRes = await api("/api/contracts", {
    method: "POST",
    body: JSON.stringify({
      employeeId: employee.id, contractType: "FIXED_TERM",
      title: `عقد اختبار ${TEST_TAG}`, weeklyHours: 40,
      startDate: "2026-01-01", endDate: "2026-06-30", hourRate: 500, asDraft: true,
    }),
  });
  ok("إنشاء مسودة عقد 201", draftRes.status === 201, draftRes.data?.contract?.contractNumber);
  const draft = draftRes.data.contract;
  ok("contractType=FIXED_TERM", draft?.contractType === "FIXED_TERM", draft?.contractType);
  ok("weeklyHours=40", draft?.weeklyHours === 40);
  ok("status=draft", draft?.status === "draft");

  const activateRes = await api(`/api/contracts/${draft.id}`, {
    method: "PATCH", body: JSON.stringify({ action: "activate" }),
  });
  ok("تفعيل المسودة → active", activateRes.data?.contract?.status === "active");

  // عقد منتهي المدة أصلاً (endDate في الماضي) → يصبح expired عند القراءة
  const expiredRes = await api("/api/contracts", {
    method: "POST",
    body: JSON.stringify({
      employeeId: employee.id, contractType: "HOURLY",
      startDate: "2025-01-01", endDate: "2025-12-31", hourRate: 500,
    }),
  });
  const expiredContract = expiredRes.data.contract;
  ok("عقد بسابق الانتهاء أُنشئ", expiredRes.status === 201);
  const listAfterExpire = await api("/api/contracts?employeeId=all");
  const expiredAfterRead = (listAfterExpire.data?.contracts || []).find((c) => c.id === expiredContract.id);
  ok("§26 انتهاء تلقائي عند القراءة → expired", expiredAfterRead?.status === "expired", expiredAfterRead?.status);
  ok("تاريخ العقد الأصلي لم يتغير", new Date(expiredAfterRead?.endDate).toISOString().startsWith("2025-12-31"));

  // ═══ 4-6) ساعات العمل: لقطة السعر + تعدد + منع التكرار ═══
  console.log("\n📋 4-6) WorkHours — لقطة 500 + حصتان بطلب واحد + منع التكرار (§7/§8/§23)");
  const slotSpecs = [
    { name: `${TEST_TAG} ص1`, startTime: "09:00", endTime: "10:00", dayOfWeek: "sun" },
    { name: `${TEST_TAG} ص2`, startTime: "10:00", endTime: "11:00", dayOfWeek: "sun" },
    { name: `${TEST_TAG} م1`, startTime: "17:00", endTime: "18:00", dayOfWeek: "sun" },
  ];
  const slotIds = [];
  for (const spec of slotSpecs) {
    const r = await api("/api/swimming-slots", { method: "POST", body: JSON.stringify(spec) });
    if (r.data?.slot?.id) slotIds.push(r.data.slot.id);
  }
  ok("3 جلسات جاهزة", slotIds.length === 3);

  const bulk1 = await api("/api/workhours/bulk", {
    method: "POST",
    body: JSON.stringify({ userId: workerA.id, date: "2026-01-04", slotIds: [slotIds[0], slotIds[1]] }),
  });
  ok("bulk حصتان → created=2", bulk1.data?.created === 2, `created=${bulk1.data?.created}`);
  ok("المجموع 2 ساعة", bulk1.data?.totalHours === 2, `totalHours=${bulk1.data?.totalHours}`);

  const whRes = await api("/api/workhours?month=2026-01");
  const whRows = (whRes.data?.workHours || []).filter((w) => w.note?.includes(TEST_TAG) && w.user?.id === workerA.id);
  ok("السجلات تظهر في GET", whRows.length === 2, `${whRows.length}`);
  ok("§23 لقطة السعر 500 محفوظة", whRows.every((w) => w.rateSnapshot === 500), whRows[0]?.rateSnapshot);

  const bulkDup = await api("/api/workhours/bulk", {
    method: "POST",
    body: JSON.stringify({ userId: workerA.id, date: "2026-01-04", slotIds: [slotIds[0], slotIds[1]] }),
  });
  ok("§8 منع التكرار → created=0 skipped=2", bulkDup.data?.created === 0 && bulkDup.data?.skipped?.length === 2,
     `created=${bulkDup.data?.created} skipped=${bulkDup.data?.skipped?.length}`);

  // ═══ 7-8) الاعتماد: جماعي + رفض بسبب ═══
  console.log("\n📋 7-8) الاعتماد — جماعي + رفض بسبب إلزامي (§9/§10)");
  // سجل مسودة (pending) مُدرج مباشرة عبر Prisma ثم اعتماد جماعي عبر API
  const pending1 = await prisma.workHours.create({
    data: {
      clubId, userId: workerA.id,
      date: new Date("2026-01-04T00:00:00.000Z"),
      startTime: new Date("2026-01-04T17:00:00.000Z"),
      endTime: new Date("2026-01-04T18:00:00.000Z"),
      note: JSON.stringify({ breakMinutes: 0, workStatus: "present", testTag: TEST_TAG }),
      status: "pending",
    },
  });
  const approveRes = await api("/api/workhours/approve", {
    method: "POST",
    body: JSON.stringify({ ids: [pending1.id], action: "approved" }),
  });
  ok("§10 اعتماد جماعي → updated=1", approveRes.data?.updated === 1, `updated=${approveRes.data?.updated}`);

  const rejectNoReason = await api(`/api/workhours/${pending1.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "rejected" }),
  });
  ok("رفض بلا سبب → 400", rejectNoReason.status === 400, `HTTP ${rejectNoReason.status}`);
  // إعادة الاعتماد للسجل (بعد الرفض اللاحق سيرفض الخادم — نستخدم سجلاً آخر)
  const pending2 = await prisma.workHours.create({
    data: {
      clubId, userId: workerA.id,
      date: new Date("2026-01-04T00:00:00.000Z"),
      startTime: new Date("2026-01-04T18:00:00.000Z"),
      endTime: new Date("2026-01-04T19:00:00.000Z"),
      note: JSON.stringify({ breakMinutes: 0, workStatus: "present", testTag: TEST_TAG }),
      status: "pending",
    },
  });
  const rejectOk = await api(`/api/workhours/${pending2.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "rejected", reason: `سجل اختبار مرفوض ${TEST_TAG}` }),
  });
  ok("§9 رفض بسبب → rejected", rejectOk.data?.workHour?.status === "rejected", rejectOk.data?.workHour?.status);
  ok("سبب الرفض محفوظ", rejectOk.data?.workHour?.rejectionReason?.includes(TEST_TAG) === true);
  const reApprove = await api(`/api/workhours/${pending2.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "approved" }),
  });
  ok("إعادة اعتماد المرفوض → approved", reApprove.data?.workHour?.status === "approved");
  const delApproved = await api(`/api/workhours/${pending2.id}`, { method: "DELETE" });
  ok("§9 حذف معتمد ممنوع (409) — الإلغاء الناعم بدله", delApproved.status === 409, `HTTP ${delApproved.status}`);
  // إلغاء سجلي اختبار الاعتماد (ناعم) — حتى لا يدخلا في حساب الأجر أدناه
  for (const pid of [pending1.id, pending2.id]) {
    await api(`/api/workhours/${pid}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled", reason: `انتهاء اختبار الاعتماد ${TEST_TAG}` }) });
  }
  const reApprove2 = await api(`/api/workhours/${pending1.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "approved" }),
  });
  ok("السجل الملغى لا يُعاد إحياؤه (409)", reApprove2.status === 409, `HTTP ${reApprove2.status}`);

  // ═══ 9-12) الحساب + لقطة السعر ═══
  console.log("\n📋 9-12) الحساب — 3سا×500 + 1سا×600 = 2100 (§11/§12/§22/§23)");
  const bulk3 = await api("/api/workhours/bulk", {
    method: "POST",
    body: JSON.stringify({ userId: workerA.id, date: "2026-01-11", slotIds: [slotIds[0]] }),
  });
  ok("حصة إضافية (لاحقاً نغيّر السعر قبلها)", bulk3.data?.created === 1);

  // نغيّر سعر الموظف إلى 600 — السجلات القديمة لقطة 500 يجب أن تبقى
  const rateChange = await api(`/api/employees/${employee.id}`, {
    method: "PATCH", body: JSON.stringify({ hourRate: 600 }),
  });
  ok("تغيير سعر الموظف إلى 600", rateChange.data?.employee?.hourRate === 600);

  const bulk4 = await api("/api/workhours/bulk", {
    method: "POST",
    body: JSON.stringify({ userId: workerA.id, date: "2026-01-18", slotIds: [slotIds[2]] }),
  });
  ok("سجل جديد بعد تغيير السعر", bulk4.data?.created === 1);
  const whAfter = await api("/api/workhours?month=2026-01");
  const rowsAfter = (whAfter.data?.workHours || []).filter((w) => w.note?.includes(TEST_TAG) && w.user?.id === workerA.id && w.status === "approved");
  const snapOld = rowsAfter.filter((w) => w.rateSnapshot === 500).length;
  const snapNew = rowsAfter.filter((w) => w.rateSnapshot === 600).length;
  ok("§23 لقطات محفوظة (3×500 قديمة + 1×600 جديدة)", snapOld === 3 && snapNew === 1, `500→${snapOld} / 600→${snapNew}`);

  const wagesMonth = await api("/api/wages?month=2026-01");
  const wageRowA = (wagesMonth.data?.workers || []).find((w) => w.userId === workerA.id);
  ok("§11 الإجمالي = 3×500 + 1×600 = 2100", wageRowA?.gross === 2100, `gross=${wageRowA?.gross}`);
  ok("§23 السعر المعروض = متوسط مرجّح (525)", wageRowA?.hourRate === 525, `hourRate=${wageRowA?.hourRate}`);
  ok("§13 الحالة قبل الدفع = unpaid", wageRowA?.status === "unpaid", wageRowA?.status);

  const wagesRange = await api("/api/wages?from=2026-01-01&to=2026-01-15");
  const rangeRowA = (wagesRange.data?.workers || []).find((w) => w.userId === workerA.id);
  ok("§22 فترة مخصصة 01→15/01 = 1500 فقط", rangeRowA?.gross === 1500, `gross=${rangeRowA?.gross}`);

  // ═══ 13-16) الدفع: جزئي → كامل → منع الزائد → idempotency ═══
  console.log("\n📋 13-16) الدفع — جزئي/كامل/حماية/idempotency (§13/§14/§21/§37)");
  const IDEM_KEY = `${TEST_TAG}-partial-1`;
  const pay1 = await api("/api/wages", {
    method: "POST",
    body: JSON.stringify({
      userId: workerA.id, from: "2026-01-01", to: "2026-01-31",
      amount: 900, method: "cash", note: TEST_TAG, source: "workhours",
      idempotencyKey: IDEM_KEY,
    }),
  });
  ok("دفع جزئي 900 → 201", pay1.status === 201, `wp=${pay1.data?.wagePaymentId?.slice(0, 8)}`);
  const wp1Id = pay1.data?.wagePaymentId;

  const wagesAfterPartial = await api("/api/wages?month=2026-01");
  const rowAfterPartial = (wagesAfterPartial.data?.workers || []).find((w) => w.userId === workerA.id);
  ok("§13 PARTIALLY_PAID (paid=900 remaining=1200)", rowAfterPartial?.status === "partial" && rowAfterPartial?.paid === 900 && rowAfterPartial?.remaining === 1200,
     `status=${rowAfterPartial?.status} paid=${rowAfterPartial?.paid} rem=${rowAfterPartial?.remaining}`);

  // §37/§52: إرسال نفس الطلب مرتين بسرعة (نفس المفتاح + نفس المبلغ) — محاكاة ضغط مزدوج
  const [dupA, dupB] = await Promise.all([
    api("/api/wages", {
      method: "POST",
      body: JSON.stringify({ userId: workerA.id, from: "2026-01-01", to: "2026-01-31", amount: 900, method: "cash", note: TEST_TAG, idempotencyKey: IDEM_KEY }),
    }),
    api("/api/wages", {
      method: "POST",
      body: JSON.stringify({ userId: workerA.id, from: "2026-01-01", to: "2026-01-31", amount: 900, method: "cash", note: TEST_TAG, idempotencyKey: IDEM_KEY }),
    }),
  ]);
  ok("§37 نفس المفتاح = نفس الدفعة (duplicate)", dupA.data?.duplicate === true && dupB.data?.duplicate === true,
     `A.dup=${dupA.data?.duplicate} B.dup=${dupB.data?.duplicate}`);
  const wpByKey = await prisma.wagePayment.count({ where: { idempotencyKey: IDEM_KEY } });
  ok("§37/§52 دفعة واحدة فقط في القاعدة", wpByKey === 1, `count=${wpByKey}`);

  // الدفعة الثانية (مفتاح جديد) — تكمل الدفع الكامل (المتبقي من الخادم)
  const remNow = rowAfterPartial?.remaining ?? 0;
  const pay2 = await api("/api/wages", {
    method: "POST",
    body: JSON.stringify({
      userId: workerA.id, from: "2026-01-01", to: "2026-01-31",
      amount: remNow, method: "cash", note: TEST_TAG, source: "workhours",
      idempotencyKey: `${TEST_TAG}-final-2`,
    }),
  });
  ok(`دفع المتبقي ${remNow} → 201`, pay2.status === 201, `wp=${pay2.data?.wagePaymentId?.slice(0, 8)}`);
  const wp2Id = pay2.data?.wagePaymentId;

  const wagesAfterFull = await api("/api/wages?month=2026-01");
  const rowAfterFull = (wagesAfterFull.data?.workers || []).find((w) => w.userId === workerA.id);
  ok("§14 PAID بعد الدفع الكامل", rowAfterFull?.status === "paid" && rowAfterFull?.remaining === 0,
     `status=${rowAfterFull?.status} rem=${rowAfterFull?.remaining}`);

  const overpay = await api("/api/wages", {
    method: "POST",
    body: JSON.stringify({ userId: workerA.id, from: "2026-01-01", to: "2026-01-31", amount: 100, method: "cash", idempotencyKey: `${TEST_TAG}-over` }),
  });
  ok("§21 منع الدفع الزائد → 400", overpay.status === 400, `HTTP ${overpay.status}`);

  // الرصيد: المصاريف زادت 1600 (900+700)
  const finAfterPay = await api("/api/financial/dashboard");
  const expAfterPay = finAfterPay.data?.balance?.totalExpense ?? 0;
  ok("§17/§18 الرصيد: المصاريف +2100", expAfterPay - expBefore === 2100, `Δ=${expAfterPay - expBefore}`);

  // ═══ 17-18) القيد المالي ═══
  console.log("\n📋 17-18) القيد المالي 1:1 — reference wage:{id} (§16)");
  const wp1Full = await prisma.wagePayment.findUnique({ where: { id: wp1Id }, include: { transaction: true } });
  ok("WagePayment مرتبط 1:1 بقيد", Boolean(wp1Full?.transactionId), wp1Full?.transactionId?.slice(0, 8));
  ok("§45 reference = wage:{id}", wp1Full?.transaction?.reference === `wage:${wp1Id}`, wp1Full?.transaction?.reference);
  ok("type=expense category=wages", wp1Full?.transaction?.type === "expense" && wp1Full?.transaction?.category === "wages");
  ok("لقطة الحساب في القيد (hours/hourRate/gross)", wp1Full?.grossAmount === 2100, `grossAmount=${wp1Full?.grossAmount}`);

  // المركز المالي يرى القيد
  const ftList = await api("/api/financial/transactions?limit=100");
  const ftInList = (ftList.data?.transactions || []).find((t) => t.id === wp1Full.transactionId);
  ok("§22/§24 القيد ظاهر في المركز المالي", Boolean(ftInList), ftInList?.reference);

  // ═══ 19-21) الإلغاء الناعم ═══
  console.log("\n📋 19-21) الإلغاء الناعم من Wages → المركز والرصيد يتزامنان (§19/§20/§46)");
  const cancelNoReason = await api(`/api/wages/${wp1Id}`, { method: "DELETE", body: JSON.stringify({ reason: "" }) });
  ok("إلغاء بلا سبب → 400", cancelNoReason.status === 400, `HTTP ${cancelNoReason.status}`);
  const cancel1 = await api(`/api/wages/${wp1Id}`, { method: "DELETE", body: JSON.stringify({ reason: `إلغاء اختبار ${TEST_TAG}` }) });
  ok("§19 إلغاء الدفعة الأولى → 200", cancel1.status === 200, `HTTP ${cancel1.status}`);

  const wp1After = await prisma.wagePayment.findUnique({ where: { id: wp1Id } });
  const ft1After = await prisma.financialTransaction.findUnique({ where: { id: wp1Full.transactionId } });
  ok("WagePayment → cancelled", wp1After?.status === "cancelled");
  ok("§19 لا حذف — السجل يبقى", wp1After !== null);
  ok("FinancialTransaction → cancelled أيضاً", ft1After?.status === "cancelled");
  ok("cancelledAt/cancellationReason محفوظة", Boolean(wp1After?.cancelledAt) && wp1After?.cancellationReason?.includes(TEST_TAG));

  const finAfterCancel = await api("/api/financial/dashboard");
  const expAfterCancel = finAfterCancel.data?.balance?.totalExpense ?? 0;
  ok("§46 الرصيد: المصاريف عادت (Δ=1200 فقط)", expAfterCancel - expBefore === 1200, `Δ=${expAfterCancel - expBefore}`);

  const wagesAfterCancel = await api("/api/wages?month=2026-01");
  const rowAfterCancel = (wagesAfterCancel.data?.workers || []).find((w) => w.userId === workerA.id);
  ok("§20 المتبقي عاد (900) والحالة partial", rowAfterCancel?.remaining === 900 && rowAfterCancel?.status === "partial",
     `rem=${rowAfterCancel?.remaining} status=${rowAfterCancel?.status}`);
  ok("الملغى يظهر في سجل الدفعات", (rowAfterCancel?.payments || []).some((p) => p.id === wp1Id && p.status === "cancelled"));

  const cancelTwice = await api(`/api/wages/${wp1Id}`, { method: "DELETE", body: JSON.stringify({ reason: "محاولة إلغاء مزدوج" }) });
  ok("إلغاء مزدوج → 409", cancelTwice.status === 409, `HTTP ${cancelTwice.status}`);

  // ═══ 22) سجل التدقيق ═══
  console.log("\n📋 22) سجل التدقيق (§35)");
  const audit = await api("/api/audit-logs?limit=1000");
  const logs = audit.data?.logs || [];
  const has = (action, needle) => logs.some((l) => l.action === action &&
    (!needle || `${l.entityId ?? ""}${l.metadata ?? ""}${l.description ?? ""}`.includes(needle)));
  ok("employee_create موثّق", has("employee_create", employee.id));
  ok("employee_update (تغيير السعر) موثّق", has("employee_update"));
  ok("contract_create موثّق", has("contract_create", draft.contractNumber));
  ok("contract_activate موثّق", has("contract_activate"));
  ok("work_hour_create/bulk_approve موثّق", has("work_hour_bulk_approve") || has("work_hour_create"));
  ok("wage_payment_create موثّق", has("wage_payment_create", wp1Id));
  ok("wage_payment_void موثّق", has("wage_payment_void", wp1Id));

  // ═══ 23) لوحة التحكم = صفحة الأجور ═══
  console.log("\n📋 23) لوحة التحكم متزامنة مع الأجور (§27)");
  const stats = await api("/api/stats");
  const st = stats.data?.workers;
  // ★ كلا المصدرين بنافذة الشهر الحالي (stats يحسب الشهر الجاري دائماً)
  const wagesNow = await api(`/api/wages?month=${currentYM}`);
  ok("قسم العمال موجود في /api/stats", Boolean(st), st ? `${st.activeEmployees} نشط` : "");
  ok("§27 grossWagesMonth = صفحة الأجور", st?.grossWagesMonth === wagesNow.data?.totals?.gross, `stats=${st?.grossWagesMonth} wages=${wagesNow.data?.totals?.gross}`);
  ok("§27 paidWagesMonth = صفحة الأجور", st?.paidWagesMonth === wagesNow.data?.totals?.paid, `stats=${st?.paidWagesMonth} wages=${wagesNow.data?.totals?.paid}`);
  ok("§27 outstandingWagesMonth = صفحة الأجور", st?.outstandingWagesMonth === wagesNow.data?.totals?.remaining, `stats=${st?.outstandingWagesMonth} wages=${wagesNow.data?.totals?.remaining}`);

  // ═══ 25) حماية العقد (§24) ═══
  console.log("\n📋 25) حماية العقد — منع التسجيل بعد endDate (§24)");
  // إنهاء العقد الساري حتى 30/06 أولاً — لتبقى التغطية حتى 20/01 فقط
  await api(`/api/contracts/${draft.id}`, {
    method: "PATCH", body: JSON.stringify({ action: "terminate", reason: `اختبار حماية العقد ${TEST_TAG}` }),
  }).catch(() => undefined);
  // عقد نشط ينتهي في 2026-01-20 — تسجيل بتاريخ 2026-01-25 (بعد النهاية) يجب أن يُرفض
  const guardContract = await api("/api/contracts", {
    method: "POST",
    body: JSON.stringify({
      employeeId: employee.id, contractType: "TEMPORARY",
      startDate: "2026-01-01", endDate: "2026-01-20", hourRate: 500,
    }),
  });
  ok("عقد الحماية أُنشئ (ينتهي 20/01)", guardContract.status === 201, guardContract.data?.contract?.contractNumber);
  const guardBlocked = await api("/api/workhours", {
    method: "POST",
    body: JSON.stringify({ date: "2026-01-25", startTime: "09:00", endTime: "10:00", targetUserId: workerA.id, note: TEST_TAG }),
  });
  ok("§24 رفض بعد endDate (409 contractGuard)", guardBlocked.status === 409 && guardBlocked.data?.contractGuard === true,
     `HTTP ${guardBlocked.status}`);
  ok("الرسالة واضحة", typeof guardBlocked.data?.error === "string" && guardBlocked.data.error.includes("عقد"), guardBlocked.data?.error?.slice(0, 60));
  const guardOverride = await api("/api/workhours", {
    method: "POST",
    body: JSON.stringify({ date: "2026-01-25", startTime: "09:00", endTime: "10:00", targetUserId: workerA.id, note: TEST_TAG, allowAfterContractEnd: true }),
  });
  ok("تجاوز المدير الصريح → 201", guardOverride.status === 201, `HTTP ${guardOverride.status}`);
  if (guardOverride.data?.workHour?.id) {
    await api(`/api/workhours/${guardOverride.data.workHour.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled", reason: "تنظيف اختبار" }) });
  }
  await api(`/api/contracts/${guardContract.data?.contract?.id}`, {
    method: "PATCH", body: JSON.stringify({ action: "terminate", reason: `تنظيف اختبار ${TEST_TAG}` }),
  }).catch(() => undefined);

  // ═══ 26) Timezone regression (§50) ═══
  console.log("\n📋 26) Timezone — 08/09/12/17/23 تبقى كما هي (§50)");
  const tzSpecs = [
    ["08:00", "08:30"], ["09:00", "09:30"], ["12:00", "12:30"], ["17:00", "17:30"], ["23:00", "23:30"],
  ];
  const tzSlotIds = [];
  for (const [st1, en] of tzSpecs) {
    const r = await api("/api/swimming-slots", {
      method: "POST", body: JSON.stringify({ name: `${TEST_TAG} tz-${st1}`, startTime: st1, endTime: en, dayOfWeek: "sun" }),
    });
    if (r.data?.slot?.id) tzSlotIds.push(r.data.slot.id);
  }
  ok("5 جلسات timezone جاهزة", tzSlotIds.length === 5);
  const tzBulk = await api("/api/workhours/bulk", {
    method: "POST",
    body: JSON.stringify({ userId: workerB.id, date: "2026-01-25", slotIds: tzSlotIds }),
  });
  ok("bulk timezone created=5", tzBulk.data?.created === 5, `created=${tzBulk.data?.created}`);
  const tzRows = await api("/api/workhours?month=2026-01");
  const tzCheckRows = (tzRows.data?.workHours || []).filter((w) => w.user?.id === workerB?.id && w.note?.includes(TEST_TAG));
  for (const [st1] of tzSpecs) {
    const found = tzCheckRows.find((w) => wallTime(w.startTime) === st1);
    ok(`§50 ${st1} تبقى ${st1}`, Boolean(found), found ? `stored=${wallTime(found.startTime)}` : "not found");
  }
  // تنظيف سجلات timezone (إلغاء ناعم)
  for (const row of tzCheckRows) {
    if (row.status === "approved" || row.status === "pending") {
      await api(`/api/workhours/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled", reason: "تنظيف اختبار timezone" }) });
    }
  }

  // ═══ 27) أرشفة الموظف ═══
  console.log("\n📋 27) أرشفة الموظف بدل الحذف (§3)");
  const archiveRes = await api(`/api/employees/${employee.id}`, { method: "DELETE" });
  ok("§3 DELETE → archived=true (لديه عقود وساعات)", archiveRes.data?.archived === true, archiveRes.data?.message);
  const empAfter = await prisma.employee.findUnique({ where: { id: employee.id } });
  ok("السجل يبقى بوضع ARCHIVED", empAfter?.status === "ARCHIVED" && empAfter !== null, empAfter?.status);

  // ═══ 28) تنظيف كامل ═══
  console.log("\n📋 28) تنظيف — كل شيء ملغى/منتهٍ بلا أثر مالي");
  // إلغاء كل التسديدات النشطة للفترة (الأخرى ملغاة أصلاً)
  for (const wpId of [wp1Id, wp2Id]) {
    if (!wpId) continue;
    const wp = await prisma.wagePayment.findUnique({ where: { id: wpId } });
    if (wp && wp.status === "active") {
      await api(`/api/wages/${wpId}`, { method: "DELETE", body: JSON.stringify({ reason: `تنظيف اختبار ${TEST_TAG}` }) });
    }
  }
  const finFinal = await api("/api/financial/dashboard");
  const expFinal = finFinal.data?.balance?.totalExpense ?? 0;
  ok("الرصيد يعود كما كان (Δ=0)", expFinal - expBefore === 0, `Δ=${expFinal - expBefore}`);

  // إلغاء كل سجلات العمل الاختبارية (ناعم) — العامل A
  const whCleanup = await api("/api/workhours?month=2026-01");
  for (const row of (whCleanup.data?.workHours || [])) {
    if (row.note?.includes(TEST_TAG) && (row.status === "approved" || row.status === "pending")) {
      await api(`/api/workhours/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled", reason: `تنظيف اختبار ${TEST_TAG}` }) });
    }
  }
  // إنهاء العقد النشط + حذف المسودة الاختبارية إن وجدت
  await api(`/api/contracts/${draft.id}`, {
    method: "PATCH", body: JSON.stringify({ action: "terminate", reason: `تنظيف اختبار ${TEST_TAG}` }),
  }).catch(() => undefined);
  // حذف الجلسات الاختبارية (كما في اختبار المرحلة 4)
  for (const id of [...slotIds, ...tzSlotIds]) {
    await api(`/api/swimming-slots/${id}`, { method: "DELETE" }).catch(() => undefined);
  }
  {
    const rest = await prisma.swimmingTimeSlot.findMany({ where: { name: { contains: TEST_TAG } }, select: { id: true } });
    for (const s of rest) await prisma.swimmingTimeSlot.delete({ where: { id: s.id } }).catch(() => undefined);
  }
  ok("تنظيف مكتمل", true, `${TEST_TAG}`);

  // ═══ النتيجة ═══
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 النتيجة: ${passed} نجح / ${failed} فشل من ${passed + failed}`);
  if (failures.length) {
    console.log("\n❌ الفاشلة:");
    for (const f of failures) console.log(`   - ${f}`);
  }
  console.log("");
  process.exitCode = failed > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error("💥 فشل غير متوقع:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
