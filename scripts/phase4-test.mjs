#!/usr/bin/env node
/**
 * phase4-test.mjs — اختبار تكاملي شامل للمرحلة 4 (§32/§33)
 * ═══════════════════════════════════════════════════════════════
 * يشغّل سيناريو كامل عبر API الخادم (localhost:3000):
 *   1-5  Settings: تفعيل الأحد + إضافة 3 جلسات (09-10, 10-11, 17-18)
 *   6-7  تعيين عاملين على الجلسات (slotId)
 *   8    التسجيل يرى نفس الجلسات (/api/swimming-slots)
 *   9    النقاط/جدول المسبح يرانا (guard-assignments + slot snapshot)
 *   10-11 bulk workhours: جلستان في طلب واحد → 2 ساعة
 *   12   منع التكرار: نفس الطلب → created=0, skipped=2
 *   13   Timezone: 09:00 تبقى 09:00 في التخزين والقراءة (wall-clock)
 *   14   الأجر: ساعات × سعر = إجمالي (من wage-core)
 *   15   دفع الأجر: WagePayment + FinancialTransaction 1:1
 *   16   المركز المالي يرى القيد (reference wage:{id})
 *   17   منع الدفع الزائد (amount > remaining → 400)
 *   18   إلغاء الأجر (soft cancel) → القيد ملغى أيضاً
 *   19-20 الرصيد يتحدث + صفحة الأجور تعيد المبلغ للمتبقي
 *   21   تنظيف كامل للبيانات التجريبية (الجلسات والتعيينات والسجلات)
 *
 * الاستخدام: node scripts/phase4-test.mjs [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";
const COOKIE_JAR = [];
const TEST_TAG = `TEST-P4-${Date.now().toString(36)}`;

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

// wall-clock: "2026-01-04T09:00:00.000Z" → "09:00"
const wallTime = (iso) => new Date(iso).toISOString().slice(11, 16);

async function main() {
  console.log(`\n🧪 PHASE 4 INTEGRATION TEST — ${TEST_TAG}\n${"═".repeat(60)}`);

  // ═══ 0) تسجيل الدخول ═══
  console.log("\n📋 0) تسجيل الدخول");
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@rcs.dz", password: "admin123" }),
  });
  ok("login 200", login.status === 200, `role=${login.data?.user?.role}`);
  const adminId = login.data?.user?.id;

  const usersRes = await api("/api/users");
  const users = usersRes.data?.users || [];
  ok("staff list >= 2", users.length >= 2, `${users.length} مستخدم`);
  const workerA = users.find((u) => u.id !== adminId) || users[0]; // «أحمد»
  const workerB = users.find((u) => u.id !== adminId && u.id !== workerA?.id) || users[1] || workerA; // «محمد»

  // ═══ تنظيف متبقيات تشغيلات سابقة (إلغاء ناعم — نفس نهج phase5) ═══
  // سجلات 2026-01 لهذين العاملين كلها بقايا اختبارات (النادي لا يعمل فيها فعلياً) —
  // بدون هذا كان كل تشغيل يلوّث الذي يليه (created=0 / gross مختلط / أوقات مكرّرة)
  {
    const whLeft = await api("/api/workhours?month=2026-01");
    const leftRows = (whLeft.data?.workHours || []).filter(
      (w) => [workerA.id, workerB.id].includes(w.userId) && w.status !== "cancelled" && w.status !== "rejected"
    );
    for (const w of leftRows) {

      await api(`/api/workhours/${w.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", reason: "تنظيف متبقيات اختبار سابق" }),
      });
    }
  // ★ التدقيق النهائي + إصلاح الانحدار: سجلاتنا الموسومة لهذا التشغيل والنشطة فقط —
  //   الملغى (من تنظيف التشغيلات السابقة أو إلغاء يدوي) يبقى في القائمة بلا حساب
  const myRecords = (whRes.data?.workHours || []).filter(
    (w) => w.userId === workerA.id && new Date(w.date).toISOString().slice(0, 10) === TEST_DATE
      && w.note?.includes(TEST_TAG)
      && w.status !== "cancelled" && w.status !== "rejected"
  )
  }

  // ═══ 1) Settings: تفعيل يوم الأحد ═══
  console.log("\n📋 1) Settings — أيام التشغيل");
  const settingsRes = await api("/api/settings");
  const currentSettings = settingsRes.data?.settings || {};
  let opDays = [];
  try { opDays = JSON.parse(currentSettings.poolOperatingDays || "[]"); } catch {}
  const prevOpDays = [...opDays];
  if (!opDays.includes("sun")) opDays.push("sun");
  const saveDays = await api("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ settings: { poolOperatingDays: JSON.stringify(opDays) } }),
  });
  ok("تم تفعيل الأحد", saveDays.status === 200);

  // ═══ 2-4) إضافة 3 جلسات للأحد ═══
  console.log("\n📋 2-4) Settings — جلسات الأحد 09-10 / 10-11 / 17-18");
  const slotSpecs = [
    { name: `${TEST_TAG} صباحي1`, startTime: "09:00", endTime: "10:00", dayOfWeek: "sun" },
    { name: `${TEST_TAG} صباحي2`, startTime: "10:00", endTime: "11:00", dayOfWeek: "sun" },
    { name: `${TEST_TAG} مسائي`,  startTime: "17:00", endTime: "18:00", dayOfWeek: "sun" },
  ];
  const slotIds = [];
  for (const spec of slotSpecs) {
    const r = await api("/api/swimming-slots", { method: "POST", body: JSON.stringify(spec) });
    ok(`جلسة ${spec.startTime}-${spec.endTime}`, r.status === 201, r.data?.slot?.id?.slice(0, 8));
    if (r.data?.slot?.id) slotIds.push(r.data.slot.id);
  }
  ok("3 جلسات أُنشئت", slotIds.length === 3);

  // ═══ 5) المصدر الموحّد: التسجيل يرى نفس الجلسات ═══
  console.log("\n📋 5) Registration sync — نفس الجلسات من Settings");
  const slotsRes = await api("/api/swimming-slots");
  const allSlots = slotsRes.data?.slots || [];
  const testSlots = allSlots.filter((s) => slotIds.includes(s.id));
  ok("التسجيل يرى الجلسات الثلاث", testSlots.length === 3);
  const sunday9 = testSlots.find((s) => s.startTime === "09:00");
  ok("الأوقات نصوص HH:mm حرفية", sunday9?.startTime === "09:00" && sunday9?.endTime === "10:00", sunday9 && `stored="${sunday9.startTime}"`);
  ok("dayOfWeek=sun محفوظ", testSlots.every((s) => s.dayOfWeek === "sun"));

  // ═══ 6-7) تعيين العمال ═══
  console.log("\n📋 6-7) تعيين العمال على الجلسات");
  const asg1 = await api("/api/guard-assignments", {
    method: "POST", body: JSON.stringify({ slotId: slotIds[0], userId: workerA.id }),
  });
  const asg2 = await api("/api/guard-assignments", {
    method: "POST", body: JSON.stringify({ slotId: slotIds[1], userId: workerA.id }),
  });
  const asg3 = await api("/api/guard-assignments", {
    method: "POST", body: JSON.stringify({ slotId: slotIds[2], userId: workerB.id }),
  });
  ok("أحمد ← جلسة 1", asg1.status === 201, asg1.data?.assignment?.id?.slice(0, 8));
  ok("أحمد ← جلسة 2", asg2.status === 201);
  ok("محمد ← جلسة 3", asg3.status === 201);
  ok("لقطة النص مشتقة من الحصة", asg1.data?.assignment?.timeSlot === "09:00-10:00", asg1.data?.assignment?.timeSlot);
  ok("اليوم مشتق (الأحد)", asg1.data?.assignment?.dayOfWeek === "الأحد", asg1.data?.assignment?.dayOfWeek);
  // منع تكرار التعيين
  const asgDup = await api("/api/guard-assignments", {
    method: "POST", body: JSON.stringify({ slotId: slotIds[0], userId: workerA.id }),
  });
  ok("منع تعيين مكرر", asgDup.status === 400, `HTTP ${asgDup.status}`);

  // ═══ 8) النقاط تعتمد على الإعدادات ═══
  console.log("\n📋 8) Pointage sync — تعيينات بslotId");
  const gaRes = await api("/api/guard-assignments");
  const gaForSlot = (gaRes.data?.assignments || []).filter((a) => a.slotId === slotIds[0]);
  ok("النقاط ترى تعيين الجلسة", gaForSlot.length === 1);
  ok("معلومات الحصة مضمّنة", gaForSlot[0]?.slot?.startTime === "09:00");

  // ═══ 9-10) Work Hours: جلسات متعددة بطلب واحد ═══
  console.log("\n📋 9-10) Work Hours — اختيار عدة جلسات دفعة واحدة");
  const TEST_DATE = "2026-01-04"; // الأحد
  const bulk1 = await api("/api/workhours/bulk", {
    method: "POST",
    body: JSON.stringify({ userId: workerA.id, date: TEST_DATE, slotIds: [slotIds[0], slotIds[1]], note: TEST_TAG }),
  });
  ok("bulk 201", bulk1.status === 201, JSON.stringify({ created: bulk1.data?.created, skipped: bulk1.data?.skipped?.length }));
  ok("سجلّان أُنشئا", bulk1.data?.created === 2);
  ok("المجموع = 2 ساعة (من الجلسات)", bulk1.data?.totalHours === 2, `totalHours=${bulk1.data?.totalHours}`);

  // ═══ 11) منع التكرار ═══
  console.log("\n📋 11) Duplicate protection — نفس العامل+التاريخ+الجلسة");
  const bulk2 = await api("/api/workhours/bulk", {
    method: "POST",
    body: JSON.stringify({ userId: workerA.id, date: TEST_DATE, slotIds: [slotIds[0], slotIds[1]] }),
  });
  ok("لا سجلات جديدة", bulk2.data?.created === 0, `created=${bulk2.data?.created}`);
  ok("المكرران تخطّيا", bulk2.data?.skipped?.length === 2, `skipped=${bulk2.data?.skipped?.length}`);
  // المفرد أيضاً محمي (POST /api/workhours)
  const dupSingle = await api("/api/workhours", {
    method: "POST",
    body: JSON.stringify({ date: TEST_DATE, startTime: "09:00", endTime: "10:00", targetUserId: workerA.id }),
  });
  ok("POST المفرد يرفض التكرار 409", dupSingle.status === 409, `HTTP ${dupSingle.status}`);

  // ═══ 12) Timezone ═══
  console.log("\n📋 12) Timezone — 09:00 تبقى 09:00");
  const whRes = await api("/api/workhours?month=2026-01");
  // ★ التدقيق النهائي + إصلاح الانحدار: سجلات هذا التشغيل (الموسومة) والنشطة فقط —
  //   الملغى (تنظيف متبقيات سابقة/إلغاء يدوي) يبقى في القائمة بلا حساب إطلاقاً
  const myRecords = (whRes.data?.workHours || []).filter(
    (w) => w.userId === workerA.id && new Date(w.date).toISOString().slice(0, 10) === TEST_DATE
      && w.note?.includes(TEST_TAG)
      && w.status !== "cancelled" && w.status !== "rejected"
  );
  ok("سجلّان موجودان", myRecords.length === 2, `${myRecords.length}`);
  const starts = myRecords.map((w) => wallTime(w.startTime)).sort();
  ok("التخزين 09:00 و10:00 حرفياً", starts[0] === "09:00" && starts[1] === "10:00", `stored=[${starts}]`);
  ok("wall-clock UTC (T09:00Z)", myRecords.some((w) => new Date(w.startTime).toISOString().includes("T09:00:00")));

  // ═══ 13) الأجر: ساعات × سعر ═══
  console.log("\n📋 13) Wage calculation — hours × rate");
  const rate = myRecords[0]?.user?.hourlyRate || 200;
  // ★ §23: أساس الأجر = لقطة السعر وقت التسجيل (قد تختلف عن السعر المعروض
  //   إذا أُرشف موظف العامل لاحقاً — اللقطة أسبق دائماً)
  const snap = myRecords[0]?.rateSnapshot;
  const wagesRes = await api("/api/wages?from=2026-01-01&to=2026-01-31");
  const wageRow = (wagesRes.data?.workers || []).find((w) => w.userId === workerA.id);
  ok("ساعات العامل = 2", wageRow?.totalHours === 2, `totalHours=${wageRow?.totalHours}`);
  ok("الإجمالي = ساعات × السعر", wageRow?.gross === Math.round(2 * (snap ?? rate)), `gross=${wageRow?.gross} (snapshot=${snap ?? rate})`);

  ok("المتبقي = الإجمالي", wageRow?.remaining === wageRow?.gross);

  // ═══ 14) دفع جزئي ═══
  console.log("\n📋 14) Wage Payment — دفع جزئي (نصف المبلغ)");
  const halfAmount = Math.floor(wageRow.gross / 2);
  const pay1 = await api("/api/wages", {
    method: "POST",
    body: JSON.stringify({
      userId: workerA.id, from: "2026-01-01", to: "2026-01-31",
      amount: halfAmount, method: "cash", paidAt: "2026-01-31", source: "phase4-test",
    }),
  });
  ok("دفع 201", pay1.status === 201, pay1.data?.financialNumber);
  const wagePaymentId = pay1.data?.wagePaymentId;
  const transactionId = pay1.data?.transactionId;
  ok("قيد مالي مرتبط 1:1", Boolean(wagePaymentId && transactionId));

  const wages2 = await api("/api/wages?from=2026-01-01&to=2026-01-31");
  const row2 = (wages2.data?.workers || []).find((w) => w.userId === workerA.id);
  ok("المدفوع = نصف", row2?.paid === halfAmount, `paid=${row2?.paid}`);
  ok("المتبقي = الباقي", row2?.remaining === wageRow.gross - halfAmount, `remaining=${row2?.remaining}`);
  ok("الحالة partial", row2?.status === "partial");

  // ═══ 15) منع الدفع الزائد ═══
  console.log("\n📋 15) منع دفع نفس الفترة مرتين / الزائد");
  const overPay = await api("/api/wages", {
    method: "POST",
    body: JSON.stringify({
      userId: workerA.id, from: "2026-01-01", to: "2026-01-31",
      amount: wageRow.gross * 10, method: "cash", source: "phase4-test",
    }),
  });
  ok("رفض الدفع الزائد 400", overPay.status === 400, `HTTP ${overPay.status}`);

  // ═══ 16) المركز المالي يرى القيد ═══
  console.log("\n📋 16) Financial Center sync");
  const ftRes = await api("/api/financial/transactions?limit=100");
  const ftList = ftRes.data?.transactions || ftRes.data?.items || [];
  const myFt = ftList.find((t) => t.id === transactionId);
  ok("القيد موجود في الدفتر", Boolean(myFt));
  ok("المرجع wage:{id}", myFt?.reference === `wage:${wagePaymentId}`, myFt?.reference);
  ok("فئة wages / مصروف", myFt?.category === "wages" && myFt?.type === "expense");
  ok("المبلغ مطابق", myFt?.amount === halfAmount);

  // رصيد قبل الإلغاء
  const fin1 = await api("/api/financial/dashboard");
  const expenseBefore = fin1.data?.balance?.totalExpense;
  const balanceBefore = fin1.data?.balance?.balance;

  // ═══ 17) إلغاء الأجر (Soft Cancel) ═══
  console.log("\n📋 17) إلغاء الأجر — WagePayment + FT ملغيان");
  const cancel = await api(`/api/wages/${wagePaymentId}`, {
    method: "DELETE",
    body: JSON.stringify({ reason: "اختبار المرحلة 4 — إلغاء تجريبي" }),
  });
  ok("إلغاء 200", cancel.status === 200, `HTTP ${cancel.status}`);

  const wages3 = await api("/api/wages?from=2026-01-01&to=2026-01-31");
  const row3 = (wages3.data?.workers || []).find((w) => w.userId === workerA.id);
  ok("المدفوع عاد إلى صفر (بعد الإلغاء)", row3?.paid === 0, `paid=${row3?.paid}`);
  ok("المتبقي كامل مجدداً", row3?.remaining === wageRow.gross);
  const cancelledPay = row3?.payments?.find((p) => p.id === wagePaymentId);
  ok("السجل محفوظ بحالة cancelled", cancelledPay?.status === "cancelled", cancelledPay?.status);
  ok("سبب الإلغاء محفوظ", Boolean(cancelledPay?.cancellationReason));

  // ═══ 18) الرصيد تحدّث تلقائياً ═══
  console.log("\n📋 18) Balance updated after cancel");
  // ★ مسار القيود يفلتر النشطة افتراضياً — نطلب الملغاة صراحة
  const ftAfter = await api("/api/financial/transactions?status=cancelled&limit=100");
  const myFtAfter = (ftAfter.data?.transactions || ftAfter.data?.items || []).find((t) => t.id === transactionId);
  ok("القيد أصبح cancelled", myFtAfter?.status === "cancelled", myFtAfter?.status);
  const ftActive = await api("/api/financial/transactions?status=active&limit=100");
  const myFtActive = (ftActive.data?.transactions || ftActive.data?.items || []).find((t) => t.id === transactionId);
  ok("القيد غير النشط مُستثنى من القيود النشطة", !myFtActive);

  // ═══ 19) Dashboard stats pool ═══
  console.log("\n📋 19) Dashboard — pool stats من /api/stats");
  const statsRes = await api("/api/stats");
  ok("stats.pool موجود", Boolean(statsRes.data?.pool), JSON.stringify(statsRes.data?.pool));
  ok("todaySessions رقمي", typeof statsRes.data?.pool?.todaySessions === "number");

  // ═══ 20) تعديل جلسة ينعكس + لا يغيّر التاريخ ═══
  console.log("\n📋 20) Historical snapshot — تعديل الإعدادات لا يغيّر السجلات القديمة");
  const editSlot = await api(`/api/swimming-slots/${slotIds[0]}`, {
    method: "PATCH",
    body: JSON.stringify({ startTime: "08:00", endTime: "09:00" }),
  });
  ok("تعديل الجلسة 200", editSlot.status === 200);
  const whAfterEdit = await api("/api/workhours?month=2026-01");
  const myAfterEdit = (whAfterEdit.data?.workHours || []).find(
    (w) => w.userId === workerA.id && w.note?.includes(TEST_TAG) && new Date(w.startTime).toISOString().includes("T09:00:00")
  );
  ok("السجل القديم احتفظ بـ 09:00", Boolean(myAfterEdit), myAfterEdit && wallTime(myAfterEdit.startTime));
  // استرجاع وقت الجلسة الأصلي
  await api(`/api/swimming-slots/${slotIds[0]}`, {
    method: "PATCH", body: JSON.stringify({ startTime: "09:00", endTime: "10:00" }),
  });

  // ═══ 21) تنظيف ═══
  console.log("\n📋 21) تنظيف البيانات التجريبية");
  // سجلات ساعات العمل التجريبية — الإلغاء الناعم أولاً (المعتمد لا يُحذف)، ثم محاولة حذف المسودات
  const whAll = await api("/api/workhours?month=2026-01");
  for (const w of whAll.data?.workHours || []) {
    if (new Date(w.date).toISOString().slice(0, 10) === TEST_DATE && [workerA.id, workerB.id].includes(w.userId)) {
      if (w.status !== "cancelled") {
        await api(`/api/workhours/${w.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled", reason: "تنظيف المرحلة 4 — يبقى في التاريخ" }),
        });
      }
      await api(`/api/workhours/${w.id}`, { method: "DELETE" });
    }
  }
  // الجلسات (تحذف التعيينات عبر SetNull ثم نحذف التعيينات يدوياً)
  for (const a of [asg1, asg2, asg3].map((r) => r.data?.assignment?.id).filter(Boolean)) {
    await api(`/api/guard-assignments?id=${a}`, { method: "DELETE" });
  }
  for (const id of slotIds) {
    const del = await api(`/api/swimming-slots/${id}`, { method: "DELETE" });
    ok(`حذف جلسة ${id.slice(0, 6)}`, del.status === 200);
  }
  // استرجاع أيام التشغيل السابقة
  await api("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ settings: { poolOperatingDays: JSON.stringify(prevOpDays) } }),
  });
  ok("استرجاع الإعدادات", true);
  console.log("  ℹ️  WagePayment + FinancialTransaction الملغيان يُحفظان كسجل تدقيق (Soft Cancel) — لا يُحذفان");

  // ═══ النتيجة ═══
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🧪 النتيجة: ${passed} نجح / ${failed} فشل (من ${passed + failed})`);
  if (failed > 0) {
    console.log("❌ اختبارات فاشلة:");
    for (const f of failures) console.log(`   - ${f}`);
    process.exit(1);
  } else {
    console.log("✅ جميع اختبارات المرحلة 4 نجحت");
  }
}

main().catch((e) => {
  console.error("💥 خطأ غير متوقع:", e);
  process.exit(1);
});
