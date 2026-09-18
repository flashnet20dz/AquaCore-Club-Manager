/**
 * workhours-bulk-test.mjs — اختبار إصلاح «تعذر بدء المعاملة في الوقت المحدد»
 * ═══════════════════════════════════════════════════════════════════════
 * السيناريو المُبلَّغ عنه: حارس مسبح + 09/06/2026 + 4 حصص (09-10/10-11/11-12/12-13)
 * - 4 حصص → 4 سجلات + 4 ساعات + 1600 دج (400/ساعة)
 * - إعادة إرسال نفس الحصص → صفر تكرار + استجابة duplicate واضحة
 * - طلبان متزامنان (نقر مزدوج) → لا 8 سجلات
 * - لا FinancialTransaction تُنشأ عند تسجيل الساعات (الدفتر ثابت Δ=0)
 * - أوقات الحائط تبقى 09:00-10:00 … (لا تحويل UTC يغير العرض)
 *
 * Usage: node scripts/workhours-bulk-test.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "admin@rcs.dz";
const PASSWORD = process.env.TEST_PASSWORD || "admin123";

let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; results.push(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// تسجيل الدخول عبر نظام الجلسات المخصص (/api/auth/login → كوكي rcs-session)
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

console.log(`\n🧪 WORKHOURS BULK — اختبار معاملة التسجيل المتعدد (${BASE})\n`);

const cookie = await login();
const me = await api(cookie, "/api/auth/me");
check("تسجيل الدخول", me.status === 200 && me.body?.user, `role=${me.body?.user?.role} clubId=${me.body?.user?.clubId ? "نعم" : "لا"}`);
const clubId = me.body?.user?.clubId;
if (!clubId) { console.log("⚠️ لا نادي للمستخدم — لا يمكن إكمال الاختبار العميق هنا (حساب superadmin بلا نادي)"); }
const clubHeader = clubId ? { "x-club-id": clubId } : {};

// ─── تجهيز: موظف/عامل + حصص المسبح ───
const slotsRes = await api(cookie, "/api/swimming-slots", { headers: clubHeader });
const slots = Array.isArray(slotsRes.body)
  ? slotsRes.body
  : Array.isArray(slotsRes.body?.slots) ? slotsRes.body.slots : [];
check("قراءة حصص المسبح", slots.length >= 4, `عدد الحصص=${slots.length}`);

// اختر 4 حصص صباحية 09-10/10-11/11-12/12-13 إن وجدت وإلا أول 4
const wanted = ["09:00", "10:00", "11:00", "12:00"];
const morning4 = wanted
  .map((t) => slots.find((s) => (s.startTime || "").startsWith(t) && !s.dayOfWeek))
  .filter(Boolean);
const fourSlots = (morning4.length >= 4 ? morning4 : slots.slice(0, 4)).slice(0, 4);
check("توفر 4 حصص للاختبار", fourSlots.length === 4, fourSlots.map((s) => `${s.startTime}-${s.endTime}`).join(" | "));

// العامل: مستخدم lifeguard إن وجد وإلا admin نفسه
const usersRes = await api(cookie, "/api/users", { headers: clubHeader });
const users = Array.isArray(usersRes.body) ? usersRes.body : usersRes.body?.users || [];
const guard = users.find((u) => /guard|lifeguard|حارس/i.test(u.position || "")) || users[0];
check("توفر عامل للاختبار", Boolean(guard), `${guard?.name || "؟"}`);

// تنظيف: احذف سجلات اختبار سابقة لنفس العامل/التاريخ (أي حالة)
const DATE = "2026-06-09";

// ─── قياس الدفتر المالي قبل (يجب ألا يتغير نهائياً) ───
let finBefore = null;
const finRes = await api(cookie, "/api/financial/dashboard?period=year", { headers: clubHeader });
if (finRes.status === 200) {
  finBefore = { income: finRes.body?.balance?.totalIncome, expense: finRes.body?.balance?.totalExpense };
}

// ─── مساعد: تنظيف يوم العامل التجريبي (إلغاء ناعم ثم حذف المسودات) ───
async function cleanDay() {
  const list = await api(cookie, `/api/workhours?month=${DATE.slice(0, 7)}`, { headers: clubHeader });
  const rows = (Array.isArray(list.body) ? list.body : list.body?.workHours || [])
    .filter((w) => w.userId === guard.id && (w.date || "").startsWith(DATE));
  for (const w of rows) {
    if (w.status !== "cancelled" && w.status !== "draft") {
      await api(cookie, `/api/workhours/${w.id}`, {
        method: "PATCH", headers: clubHeader,
        body: JSON.stringify({ status: "cancelled", reason: "تنظيف اختبار" }),
      });
    }
    await api(cookie, `/api/workhours/${w.id}`, { method: "DELETE", headers: clubHeader });
  }
  const after = await api(cookie, `/api/workhours?month=${DATE.slice(0, 7)}`, { headers: clubHeader });
  return (Array.isArray(after.body) ? after.body : after.body?.workHours || [])
    .filter((w) => w.userId === guard.id && (w.date || "").startsWith(DATE) && !["cancelled", "rejected"].includes(w.status)).length;
}

// ═══ 1) التسجيل الأساسي: 4 حصص (على يوم نظيف — قابل للتكرار) ═══
console.log("\n▶️ 1) تسجيل 4 حصص (السيناريو المُبلَّغ)");
const remain0 = await cleanDay();
check("تنظيف اليوم قبل الاختبار", remain0 === 0, `متبقي نشط=${remain0}`);
const t0 = Date.now();
const r1 = await api(cookie, "/api/workhours/bulk", {
  method: "POST", headers: clubHeader,
  body: JSON.stringify({ userId: guard.id, date: DATE, slotIds: fourSlots.map((s) => s.id) }),
});
const d1ms = Date.now() - t0;
check("HTTP نجاح (201/200)", r1.status === 201 || r1.status === 200, `status=${r1.status} في ${d1ms}ms`);
check("لا خطأ معاملة P2028", !(r1.body?.error || "").includes("transaction"), r1.body?.error || "clean");
check("created = 4", r1.body?.created === 4, `created=${r1.body?.created}`);
check("totalHours = 4", Number(r1.body?.totalHours) === 4, `totalHours=${r1.body?.totalHours}`);
const created1 = r1.body?.records || [];

// التحقق من سجلات الشهر (4 ساعات + المبلغ المستحق 1600 عند سعر 400)
const monthRes = await api(cookie, `/api/workhours?month=${DATE.slice(0, 7)}`, { headers: clubHeader });
const whs = Array.isArray(monthRes.body) ? monthRes.body : monthRes.body?.workHours || [];
const mine = whs.filter((w) => w.userId === guard.id && (w.date || "").startsWith(DATE) && !["cancelled", "rejected"].includes(w.status));
check("السجلات في الشهر = 4 لنفس العامل/اليوم", mine.length === 4, `وجد ${mine.length}`);
// الأوقات الحرفية wall-clock
const starts = mine.map((w) => String(w.startTime).slice(11, 16)).sort();
check("أوقات البداية 09/10/11/12 (بلا انزياح UTC)", ["09:00", "10:00", "11:00", "12:00"].every((t) => starts.includes(t)), starts.join(","));
const totalH = mine.reduce((s, w) => s + ((new Date(w.endTime) - new Date(w.startTime)) / 3_600_000 - (w.breakMinutes || 0) / 60), 0);
check("مجموع الساعات = 4", Math.abs(totalH - 4) < 0.01, `${totalH.toFixed(2)}`);
const snapshot = mine.map((w) => w.rateSnapshot ?? w.user?.hourlyRate ?? null).filter((x) => x != null);
if (snapshot.length === 4) {
  const payable = snapshot[0] * 4;
  console.log(`  ℹ️ سعر اللقطة=${snapshot[0]} دج/ساعة → المستحق ${payable} دج ${payable === 1600 ? "(يطابق 1600 المبلغ المُبلَّغ)" : "(يختلف عن 1600 — سعر النادي الفعلي ليس 400)"}`);
}

// ═══ 2) إعادة الإرسال المزدوجة: نفس الحصص الأربع ═══
console.log("\n▶️ 2) إعادة إرسال نفس الحصص (منع التكرار)");
const r2 = await api(cookie, "/api/workhours/bulk", {
  method: "POST", headers: clubHeader,
  body: JSON.stringify({ userId: guard.id, date: DATE, slotIds: fourSlots.map((s) => s.id) }),
});
check("استجابة نجاح (لا 500)", r2.status < 500, `status=${r2.status}`);
check("created = 0 (لا ازدواج)", r2.body?.created === 0, `created=${r2.body?.created}`);
check("skipped = 4 برسالة duplicate", Array.isArray(r2.body?.skipped) && r2.body.skipped.length === 4, JSON.stringify(r2.body?.skipped || []).slice(0, 120));

const monthRes2 = await api(cookie, `/api/workhours?month=${DATE.slice(0, 7)}`, { headers: clubHeader });
const whs2 = Array.isArray(monthRes2.body) ? monthRes2.body : monthRes2.body?.workHours || [];
const mine2 = whs2.filter((w) => w.userId === guard.id && (w.date || "").startsWith(DATE) && !["cancelled", "rejected"].includes(w.status));
check("ما زالت 4 سجلات فقط (لا 8)", mine2.length === 4, `وجد ${mine2.length}`);

// ═══ 3) نقر مزدوج متزامن — طلبان في نفس اللحظة (على يوم نظيف) ═══
console.log("\n▶️ 3) طلبان متزامنان (سباق النقر المزدوج)");
const remainAfterClean = await cleanDay();
check("تنظيف اليوم قبل السباق", remainAfterClean === 0, `متبقي نشط=${remainAfterClean}`);
const [raceA, raceB] = await Promise.all([
  api(cookie, "/api/workhours/bulk", {
    method: "POST", headers: clubHeader,
    body: JSON.stringify({ userId: guard.id, date: DATE, slotIds: fourSlots.map((s) => s.id) }),
  }),
  api(cookie, "/api/workhours/bulk", {
    method: "POST", headers: clubHeader,
    body: JSON.stringify({ userId: guard.id, date: DATE, slotIds: fourSlots.map((s) => s.id) }),
  }),
]);
const raceCreated = (raceA.body?.created || 0) + (raceB.body?.created || 0);
const raceErr = [raceA, raceB].map((r) => r.body?.error || "").filter((e) => e.includes("transaction"));
check("لا P2028 في الطلبين المتزامنين", raceErr.length === 0, raceErr[0] || "clean");
const monthRes3 = await api(cookie, `/api/workhours?month=${DATE.slice(0, 7)}`, { headers: clubHeader });
const whs3 = Array.isArray(monthRes3.body) ? monthRes3.body : monthRes3.body?.workHours || [];
const mine3 = whs3.filter((w) => w.userId === guard.id && (w.date || "").startsWith(DATE) && !["cancelled", "rejected"].includes(w.status));
check("السباق أنتج 4 سجلات بالضبط (لا 8)", mine3.length === 4, `الطلبان أُنشئ=${raceCreated} / في القاعدة=${mine3.length}`);
const oneSucceeded = (raceA.body?.created === 4 && raceB.body?.created === 0) || (raceB.body?.created === 4 && raceA.body?.created === 0);
check("واحد نجح والآخر تجاهل/فشل نظيف", oneSucceeded || raceCreated === 4, `A=${raceA.body?.created}/sk=${(raceA.body?.skipped || []).length} B=${raceB.body?.created}/sk=${(raceB.body?.skipped || []).length}`);

// ═══ 4) الدفتر المالي ثابت: تسجيل ساعات ≠ قيد مالي ═══
console.log("\n▶️ 4) لا قيد مالي عند تسجيل الساعات");
if (finBefore) {
  const finRes2 = await api(cookie, "/api/financial/dashboard?period=year", { headers: clubHeader });
  const finAfter = { income: finRes2.body?.balance?.totalIncome, expense: finRes2.body?.balance?.totalExpense };
  check("Δ الدخل = 0", finBefore.income === finAfter.income, `${finBefore.income} → ${finAfter.income}`);
  check("Δ المصاريف = 0", finBefore.expense === finAfter.expense, `${finBefore.expense} → ${finAfter.expense}`);
} else {
  console.log("  ⏭️ تخطي (لا وصول للوحة المالية بهذا الحساب)");
}

// ═══ تنظيف نهائي: أزل سجلات اليوم التجريبي ═══
let cleaned = 0;
for (const w of mine3) {
  const del = await api(cookie, `/api/workhours/${w.id}`, { method: "DELETE", headers: clubHeader });
  if (del.status < 300) cleaned++;
}

console.log("\n" + "═".repeat(60));
console.log(`📊 النتيجة: ${pass} نجح / ${fail} فشل`);
console.log(results.join("\n"));
console.log(`🧹 تنظيف: حُذف ${cleaned} سجل اختبار`);
process.exit(fail > 0 ? 1 : 0);
