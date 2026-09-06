/**
 * workhours-cancel-totals-test.mjs — اختبار انحدار «السجل الملغى يبقى في الإجمالي»
 * ═══════════════════════════════════════════════════════════════════════════════
 * السيناريو المُبلَّغ عنه (بلاغ CANCELLED WORK HOURS STILL INCLUDED IN TOTALS):
 *   - 14 ساعة نشطة → 5,600 دج (400 دج/ساعة)
 *   - إلغاء سجل واحد 1س/400 دج
 *   - المتوقع: الإجماليات التشغيلية تصير 13 ساعة / 5,200 دج فوراً
 *     والسجل الملغى يبقى في القائمة (تاريخ/تدقيق) ولا يُحذف
 *
 * يغطي أيضاً:
 *   - منع الإلغاء المزدوج (نفس الطلب مرتين + طلبان متزامنان)
 *   - حماية الأجر المدفوع (paidWageGuard): سجل داخل فترة مسدَّدة لا يُلغى
 *     إلا بعد إلغاء التسديد عبر آلية العكس الرقابية (DELETE /api/wages/[id])
 *   - إلغاء الساعات لا ينشئ أي قيد مالي (Δ الدفتر = 0)
 *   - الملخص يأتي من الخادم (GET /api/workhours → summary) وليس حساب واجهة
 *
 * Usage: node scripts/workhours-cancel-totals-test.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "admin@rcs.dz";
const PASSWORD = process.env.TEST_PASSWORD || "admin123";

// يوم الاختبار — بعيد عن بيانات المستخدم الحقيقية (02/09) داخل نفس الشهر المعروض
const DATE = process.env.TEST_DATE || "2026-09-15";
const MONTH = DATE.slice(0, 7);

let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; results.push(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`فشل الدخول: ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  const sess = sc.map((c) => c.split(";")[0]).find((c) => c.startsWith("rcs-session="));
  if (!sess) throw new Error("لا كوكي جلسة في استجابة الدخول");
  return sess;
}

async function api(cookie, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "User-Agent": "Mozilla/5.0",
      ...(opts.headers || {}),
    },
  });
  let body = null;
  try { body = await res.json(); } catch { /* html */ }
  return { status: res.status, body };
}

console.log(`\n🧪 WORKHOURS CANCEL-TOTALS — اختبار انحدار الإجماليات بعد الإلغاء (${BASE})\n`);

const cookie = await login();
const me = await api(cookie, "/api/auth/me");
check("تسجيل الدخول", me.status === 200 && me.body?.user, `role=${me.body?.user?.role}`);
const clubId = me.body?.user?.clubId;
if (!clubId) { console.error("⚠️ لا نادي للمستخدم — لا يمكن إكمال الاختبار"); process.exit(1); }
const clubHeader = { "x-club-id": clubId };

// ─── العمال: حتى 3 مستخدمين من النادي (مطابق لبلاغ: Abdelkrim/Lot/zakaria) ───
const usersRes = await api(cookie, "/api/users", { headers: clubHeader });
const users = (Array.isArray(usersRes.body) ? usersRes.body : usersRes.body?.users || [])
  .filter((u) => u.id && u.name);
const testUsers = users.slice(0, 3);
check("توفر عمال للاختبار", testUsers.length >= 1, testUsers.map((u) => u.name).join(" | "));

// توزيع 14 حصة ساعة واحدة (09:00 → 21:00 بدايات) — 6/5/3 مطابق لأرقام البلاغ
const DISTRIBUTIONS = [[6, 5, 3], [7, 7], [14]];
const dist = DISTRIBUTIONS[testUsers.length - 1] || DISTRIBUTIONS[0];
const STARTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
const plan = [];
testUsers.forEach((u, ui) => {
  for (let k = 0; k < dist[ui]; k++) plan.push({ user: u, startTime: STARTS[k], endTime: hourAfter(STARTS[k]) });
});
function hourAfter(t) {
  const h = String(parseInt(t.split(":")[0], 10) + 1).padStart(2, "0");
  return `${h}:00`;
}

// ─── الدفتر المالي قبل (الإلغاء يجب ألا يحرّكه إطلاقاً) ───
async function ledger() {
  const r = await api(cookie, "/api/financial/dashboard?period=year", { headers: clubHeader });
  if (r.status !== 200) return null;
  return { income: r.body?.balance?.totalIncome, expense: r.body?.balance?.totalExpense };
}
const finBefore = await ledger();

// ─── تنظيف يوم الاختبار: إلغاء أي تسديدات نشطة تغطي اليوم + إلغاء السجلات النشطة ───
async function cleanTestDate() {
  // 1) ألغِ أي تسديدات أجر نشطة تغطي يوم الاختبار (لتجاوز paidWageGuard أثناء التنظيف)
  const wagesRes = await api(cookie, `/api/wages?from=${DATE}&to=${DATE}`, { headers: clubHeader });
  const workers = wagesRes.body?.workers || [];
  for (const w of workers) {
    for (const p of w.payments || []) {
      if (!p.legacy && p.status !== "cancelled" && (p.periodLabel || "").includes(DATE.split("-").reverse().join("/"))) {
        await api(cookie, `/api/wages/${p.id}`, {
          method: "DELETE", headers: clubHeader,
          body: JSON.stringify({ reason: "تنظيف بيئة الاختبار" }),
        });
      }
    }
  }
  // 2) ألغِ (ناعماً) كل السجلات النشطة ليوم الاختبار لهؤلاء العمال
  const list = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
  const rows = (list.body?.workHours || [])
    .filter((w) => testUsers.some((u) => u.id === w.userId) && (w.date || "").startsWith(DATE));
  for (const w of rows) {
    if (w.status !== "cancelled") {
      await api(cookie, `/api/workhours/${w.id}`, {
        method: "PATCH", headers: clubHeader,
        body: JSON.stringify({ status: "cancelled", reason: "تنظيف بيئة الاختبار" }),
      });
    }
    await api(cookie, `/api/workhours/${w.id}`, { method: "DELETE", headers: clubHeader });
  }
  // 3) تحقق: صفر سجلات نشطة في اليوم
  const after = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
  return (after.body?.workHours || [])
    .filter((w) => testUsers.some((u) => u.id === w.userId) && (w.date || "").startsWith(DATE) && w.status !== "cancelled" && w.status !== "rejected").length;
}

console.log("\n▶️ 0) تنظيف يوم الاختبار");
const remain0 = await cleanTestDate();
check("اليوم نظيف قبل الاختبار (صفر سجلات نشطة)", remain0 === 0, `متبقي نشط=${remain0}`);

// ═══ 1) إنشاء 14 حصة (ساعة لكل حصة) — المصفوفة: 6/5/3 ═══
console.log("\n▶️ 1) تسجيل 14 ساعة نشطة (نفس أرقام البلاغ)");
let createdOk = 0;
const createdIds = [];
for (const item of plan) {
  const r = await api(cookie, "/api/workhours", {
    method: "POST", headers: clubHeader,
    body: JSON.stringify({
      date: DATE,
      startTime: item.startTime,
      endTime: item.endTime,
      targetUserId: item.user.id,
      allowAfterContractEnd: true,
    }),
  });
  if (r.status === 201 && r.body?.workHour?.id) {
    createdOk++;
    createdIds.push({ id: r.body.workHour.id, userId: item.user.id, name: item.user.name, rate: r.body.workHour.rateSnapshot ?? 0 });
  } else if (!(r.status === 409)) {
    console.log(`   ⚠️ إنشاء ${item.startTime} لـ${item.user.name}: ${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
  }
}
check("إنشاء 14 سجل ساعات", createdOk === 14, `أُنشئ=${createdOk}/14`);

// ═══ 2) الملخص قبل الإلغاء: 14 ساعة ═══
console.log("\n▶️ 2) الملخص قبل الإلغاء");
let g1 = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
const rows1 = g1.body?.workHours || [];
const sum1 = g1.body?.summary;
const activeBefore = rows1.filter((w) => testUsers.some((u) => u.id === w.userId) && (w.date || "").startsWith(DATE) && w.status !== "cancelled" && w.status !== "rejected");
const expectedWage1 = createdIds.reduce((s, x) => s + x.rate, 0);
check("الخادم يرجع summary (الاستبعاد في الاستعلام لا الواجهة)", Boolean(sum1?.totals), `rule=${sum1?.rule}`);
check("14 ساعة نشطة في القائمة", activeBefore.length === 14, `نشط=${activeBefore.length}`);
check("الإجمالي 14.0 ساعة", sum1?.totals?.totalHours === 14, `الساعات=${sum1?.totals?.totalHours}`);
check("الإجمالي المالي = مجموع اللقطات", sum1?.totals?.totalWage === expectedWage1, `الأجر=${sum1?.totals?.totalWage} دج متوقع=${expectedWage1}`);
if (createdIds.every((x) => x.rate === 400)) {
  check("أرقام البلاغ بالضبط: 5,600 دج", sum1?.totals?.totalWage === 5600, `${sum1?.totals?.totalWage} دج`);
} else {
  console.log(`   ℹ️ لقطات الأسعار غير موحّدة على 400 — التحقق النسبي يكفي (${[...new Set(createdIds.map((x) => x.rate))].join(",")})`);
}
// صفوف العمال: ساعات كل عامل مطابقة للتوزيع
const perUser1 = sum1?.perUser || [];
for (let ui = 0; ui < testUsers.length; ui++) {
  const row = perUser1.find((x) => x.userId === testUsers[ui].id);
  check(`صف ${testUsers[ui].name}: ${dist[ui]} سا`, row?.totalHours === dist[ui], `الساعات=${row?.totalHours}`);
  const expectedUserWage = createdIds.filter((x) => x.userId === testUsers[ui].id).reduce((s, x) => s + x.rate, 0);
  check(`أجر ${testUsers[ui].name} من اللقطات`, row?.totalWage === expectedUserWage, `الأجر=${row?.totalWage} متوقع=${expectedUserWage}`);
}

// ═══ 3) إلغاء سجل واحد (1 ساعة) — الفحص المحوري ═══
console.log("\n▶️ 3) إلغاء سجل 1 ساعة");
const victimUserIdx = 1; // العامل الثاني (مطابق «Lot» في البلاغ)
const victim = createdIds.find((x) => x.userId === testUsers[victimUserIdx].id) || createdIds[0];
const victimRate = victim.rate;
const c1 = await api(cookie, `/api/workhours/${victim.id}`, {
  method: "PATCH", headers: clubHeader,
  body: JSON.stringify({ status: "cancelled", reason: "اختبار انحدار الإجماليات — إلغاء ساعة" }),
});
check("الإلغاء نجح (200)", c1.status === 200, `status=${c1.status} ${JSON.stringify(c1.body?.error || "")}`);
check("الحالة في الاستجابة = cancelled", c1.body?.workHour?.status === "cancelled");
check("توثيق الإلغاء: cancelledAt/cancelledById", Boolean(c1.body?.workHour?.cancelledAt) && Boolean(c1.body?.workHour?.cancelledById));

// ═══ 4) الملخص بعد الإلغاء: 13 ساعة — السجل الملغى يبقى في القائمة ═══
console.log("\n▶️ 4) الملخص بعد الإلغاء (المحور: 14→13)");
g1 = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
const rows2 = g1.body?.workHours || [];
const sum2 = g1.body?.summary;
const cancelledRow = rows2.find((w) => w.id === victim.id);
check("السجل الملغى ما زال في القائمة (لا حذف — تاريخ/تدقيق)", Boolean(cancelledRow), `status=${cancelledRow?.status}`);
check("حالته في القائمة = cancelled", cancelledRow?.status === "cancelled");
const activeAfter = rows2.filter((w) => testUsers.some((u) => u.id === w.userId) && (w.date || "").startsWith(DATE) && w.status !== "cancelled" && w.status !== "rejected");
check("النشط صار 13", activeAfter.length === 13, `نشط=${activeAfter.length}`);
check("الإجمالي انخفض إلى 13.0 ساعة", sum2?.totals?.totalHours === 13, `الساعات=${sum2?.totals?.totalHours}`);
check("الأجر انخفض بمقدار سعر الساعة الملغاة", sum2?.totals?.totalWage === expectedWage1 - victimRate, `الأجر=${sum2?.totals?.totalWage} متوقع=${expectedWage1 - victimRate}${victimRate === 400 ? " (5,200 دج — رقم البلاغ)" : ""}`);
const row2 = (sum2?.perUser || []).find((x) => x.userId === victim.userId);
check("صف العامل نزل ساعة واحدة", row2?.totalHours === dist[victimUserIdx] - 1, `${row2?.totalHours} سا`);
check("أيام الحضور نزلت واحدة لنفس العامل", row2?.presentDays === dist[victimUserIdx] - 1, `أيام=${row2?.presentDays}`);

// ═══ 5) منع الإلغاء المزدوج ═══
console.log("\n▶️ 5) منع الإلغاء المزدوج");
const dc = await api(cookie, `/api/workhours/${victim.id}`, {
  method: "PATCH", headers: clubHeader,
  body: JSON.stringify({ status: "cancelled", reason: "محاولة إلغاء مزدوج" }),
});
check("إلغاء ملغى → 409", dc.status === 409, `status=${dc.status}`);

// طلبان متزامنان على نفس السجل النشط: واحد 200 وواحد 409 حتماً
// (14 − 1 إلغاء الخطوة 3 − 1 إلغاء السباق = 12 نشطاً)
const concurrencyVictim = createdIds.find((x) => x.id !== victim.id && x.userId === victim.userId) || createdIds.find((x) => x.id !== victim.id);
const [cc1, cc2] = await Promise.all([
  api(cookie, `/api/workhours/${concurrencyVictim.id}`, {
    method: "PATCH", headers: clubHeader,
    body: JSON.stringify({ status: "cancelled", reason: "سباق إلغاء متزامن A" }),
  }),
  api(cookie, `/api/workhours/${concurrencyVictim.id}`, {
    method: "PATCH", headers: clubHeader,
    body: JSON.stringify({ status: "cancelled", reason: "سباق إلغاء متزامن B" }),
  }),
]);
const okCount = [cc1, cc2].filter((r) => r.status === 200).length;
const conflictCount = [cc1, cc2].filter((r) => r.status === 409).length;
check("سباق إلغاء مزدوج: واحد 200 بالضبط", okCount === 1, `200×${okCount}`);
check("سباق إلغاء مزدوج: واحد 409 بالضبط", conflictCount === 1, `409×${conflictCount}`);
const gC = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
const activeC = (gC.body?.workHours || []).filter((w) => testUsers.some((u) => u.id === w.userId) && (w.date || "").startsWith(DATE) && w.status !== "cancelled" && w.status !== "rejected");
check("بعد السباق: 12 نشطاً فقط (لا انعكاس مزدوج)", activeC.length === 12, `نشط=${activeC.length}`);
check("الملخص بعد السباق = 12.0 سا", gC.body?.summary?.totals?.totalHours === 12, `الساعات=${gC.body?.summary?.totals?.totalHours}`);

// ═══ 6) الإلغاء لا ينشئ أي قيد مالي ═══
const finAfterCancels = await ledger();
check("الدفتر المالي لم يتغير بعد الإلغاءات (Δ=0)",
  finBefore && finAfterCancels && finBefore.income === finAfterCancels.income && finBefore.expense === finAfterCancels.expense,
  `قبل=${JSON.stringify(finBefore)} بعد=${JSON.stringify(finAfterCancels)}`);

// ═══ 7) حماية الأجر المدفوع (paidWageGuard) ═══
console.log("\n▶️ 7) حماية الأجر المدفوع — إلغاء سجل داخل فترة مسدَّدة");
const guardUser = testUsers[0];
const guardRec = createdIds.find((x) => x.userId === guardUser.id && ![
  victim.id, concurrencyVictim.id].includes(x.id));
// راتب العامل الأول عن يوم الاختبار فقط (فترة ضيقة — لا تمس بيانات حقيقية)
const w1 = await api(cookie, `/api/wages?from=${DATE}&to=${DATE}`, { headers: clubHeader });
const wRow = (w1.body?.workers || []).find((x) => x.userId === guardUser.id);
const remaining = wRow?.remaining ?? 0;
check("المتبقي المحسوب ليوم الاختبار > 0", remaining > 0, `متبقي=${remaining}`);
let guardTested = false;
if (remaining > 0) {
  const pay = await api(cookie, "/api/wages", {
    method: "POST", headers: clubHeader,
    body: JSON.stringify({
      userId: guardUser.id, from: DATE, to: DATE, amount: remaining,
      method: "cash", source: "workhours-test", idempotencyKey: `cancel-test-${DATE}-${Date.now()}`,
    }),
  });
  check("تسديد أجر يوم الاختبار نجح", pay.status === 201, `status=${pay.status} ${JSON.stringify(pay.body?.error || "")}`);
  if (pay.status === 201) {
    const blocked = await api(cookie, `/api/workhours/${guardRec.id}`, {
      method: "PATCH", headers: clubHeader,
      body: JSON.stringify({ status: "cancelled", reason: "محاولة إلغاء سجل مدفوع" }),
    });
    check("إلغاء سجل داخل فترة مسدَّدة → 409", blocked.status === 409, `status=${blocked.status}`);
    check("الاستجابة تحمل paidWageGuard", Boolean(blocked.body?.paidWageGuard), JSON.stringify(blocked.body?.error || "").slice(0, 90));
    const gG = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
    check("السجل المدفوع ما زال نشطاً في الملخص (لم يُلغى صمتاً)",
      (gG.body?.summary?.perUser || []).find((x) => x.userId === guardUser.id)?.totalHours === dist[0],
      `ساعات=${(gG.body?.summary?.perUser || []).find((x) => x.userId === guardUser.id)?.totalHours}`);

    // ═══ 8) المسار الرقابي: إلغاء التسديد أولاً ثم الإلغاء ينجح ═══
    console.log("\n▶️ 8) المسار الرقابي: إلغاء التسديد (Void) ثم إلغاء السجل");
    const voidRes = await api(cookie, `/api/wages/${pay.body.wagePaymentId}`, {
      method: "DELETE", headers: clubHeader,
      body: JSON.stringify({ reason: "اختبار المسار الرقابي — عكس التسديد ثم إلغاء الساعة" }),
    });
    check("إلغاء التسديد نجح", voidRes.status === 200, `status=${voidRes.status}`);
    const unblocked = await api(cookie, `/api/workhours/${guardRec.id}`, {
      method: "PATCH", headers: clubHeader,
      body: JSON.stringify({ status: "cancelled", reason: "إلغاء بعد عكس التسديد" }),
    });
    check("بعد عكس التسديد: الإلغاء ينجح", unblocked.status === 200, `status=${unblocked.status}`);
    guardTested = true;
  }
}
if (!guardTested) console.log("   ⚠️ تخطّي اختبار الحماية (لا متبقٍ للتسديد في يوم الاختبار)");

// ═══ 9) الحالة النهائية والتنظيف ═══
console.log("\n▶️ 9) التنظيف النهائي");
const finEnd = await ledger();
check("بعد عكس التسديد: الدفتر النشط يعود كما كان (Δ=0)",
  finBefore && finEnd && finBefore.income === finEnd.income && finBefore.expense === finEnd.expense,
  `قبل=${JSON.stringify(finBefore)} بعد=${JSON.stringify(finEnd)}`);
const remainEnd = await cleanTestDate();
check("تنظيف يوم الاختبار بعد الانتهاء", remainEnd === 0, `متبقي نشط=${remainEnd}`);

console.log("\n" + "═".repeat(60));
console.log(`النتيجة: ${pass} ناجح / ${fail} فاشل`);
results.forEach((r) => console.log(r));
console.log("═".repeat(60));
process.exit(fail > 0 ? 1 : 0);
