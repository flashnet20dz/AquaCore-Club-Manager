/**
 * workhours-delete-test.mjs — اختبار انحدار «حذف سجل ساعات العمل عند الخطأ»
 * ═══════════════════════════════════════════════════════════════════════════
 * الميزة المطلوبة (بلاغ: أضف ميزة حذف سجل ساعات العمل في حالة الخطأ):
 *   - سجل معتمد سُجّل بالخطأ يمكن حذفه نهائياً للمدير مع سبب إلزامي
 *   - الحذف يُسقط السجل من جميع الإجماليات فوراً (الساعات والأجور)
 *   - لقطة كاملة للسجل المحذوف تبقى في سجل التدقيق (AuditLog)
 *
 * يغطي أيضاً:
 *   - السبب إلزامي (بدون سبب → 400، سبب قصير → 400)
 *   - الحذف المزدوج: حذف محذوف → 404 (لا انهيار)
 *   - حماية الأجر المدفوع (paidWageGuard): سجل داخل فترة تسديد نشطة لا يُحذف
 *     إلا بعد عكس التسديد عبر المسار الرقابي (DELETE /api/wages/[id])
 *   - الحذف لا ينشئ أي قيد مالي (Δ الدفتر = 0)
 *   - سجل التدقيق يحمل action=work_hour_delete + اللقطة (المبلغ/السبب/الحالة)
 *
 * Usage: node scripts/workhours-delete-test.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "admin@rcs.dz";
const PASSWORD = process.env.TEST_PASSWORD || "admin123";

// يوم اختبار معزول — بعيد عن بيانات المستخدم الحقيقية
const DATE = process.env.TEST_DATE || "2026-09-16";
const MONTH = DATE.slice(0, 7);

let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; results.push(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}

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

console.log(`\n🧪 WORKHOURS DELETE — اختبار ميزة الحذف عند الخطأ (${BASE})\n`);

const cookie = await login();
const me = await api(cookie, "/api/auth/me");
check("تسجيل الدخول", me.status === 200 && me.body?.user, `role=${me.body?.user?.role}`);
const clubId = me.body?.user?.clubId;
if (!clubId) { console.error("⚠️ لا نادي للمستخدم — لا يمكن إكمال الاختبار"); process.exit(1); }
const clubHeader = { "x-club-id": clubId };

const usersRes = await api(cookie, "/api/users", { headers: clubHeader });
const users = (Array.isArray(usersRes.body) ? usersRes.body : usersRes.body?.users || [])
  .filter((u) => u.id && u.name);
const worker = users[0];
check("توفر عامل للاختبار", Boolean(worker), worker?.name || "");

async function ledger() {
  const r = await api(cookie, "/api/financial/dashboard?period=year", { headers: clubHeader });
  if (r.status !== 200) return null;
  return { income: r.body?.balance?.totalIncome, expense: r.body?.balance?.totalExpense };
}
const finBefore = await ledger();

/** تنظيف يوم الاختبار: عكس تسديدات نشطة + حذف نهائي لكل سجلات اليوم (الميزة الجديدة) */
async function cleanTestDate() {
  const wagesRes = await api(cookie, `/api/wages?from=${DATE}&to=${DATE}`, { headers: clubHeader });
  for (const w of wagesRes.body?.workers || []) {
    for (const p of w.payments || []) {
      if (!p.legacy && p.status !== "cancelled") {
        await api(cookie, `/api/wages/${p.id}`, {
          method: "DELETE", headers: clubHeader,
          body: JSON.stringify({ reason: "تنظيف بيئة الاختبار" }),
        });
      }
    }
  }
  const list = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
  const rows = (list.body?.workHours || [])
    .filter((w) => (w.date || "").startsWith(DATE));
  for (const w of rows) {
    await api(cookie, `/api/workhours/${w.id}`, {
      method: "DELETE", headers: clubHeader,
      body: JSON.stringify({ reason: "تنظيف بيئة الاختبار" }),
    });
  }
  const after = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
  return (after.body?.workHours || [])
    .filter((w) => (w.date || "").startsWith(DATE) && w.status !== "cancelled" && w.status !== "rejected").length;
}

console.log("\n▶️ 0) تنظيف يوم الاختبار");
const remain0 = await cleanTestDate();
check("اليوم نظيف قبل الاختبار", remain0 === 0, `متبقي نشط=${remain0}`);

// ═══ 1) إنشاء 3 سجلات (ساعة لكل واحدة 09/10/11) ═══
console.log("\n▶️ 1) تسجيل 3 ساعات نشطة (ثلاث سجلات × 1 ساعة)");
const STARTS = ["09:00", "10:00", "11:00"];
const createdIds = [];
for (const st of STARTS) {
  const en = `${String(parseInt(st.split(":")[0], 10) + 1).padStart(2, "0")}:00`;
  const r = await api(cookie, "/api/workhours", {
    method: "POST", headers: clubHeader,
    body: JSON.stringify({
      date: DATE, startTime: st, endTime: en,
      targetUserId: worker.id, allowAfterContractEnd: true,
    }),
  });
  if (r.status === 201 && r.body?.workHour?.id) {
    createdIds.push({ id: r.body.workHour.id, rate: r.body.workHour.rateSnapshot ?? 0 });
  } else {
    console.log(`   ⚠️ إنشاء ${st}: ${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
  }
}
check("إنشاء 3 سجلات", createdIds.length === 3, `أُنشئ=${createdIds.length}/3`);

let g = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
const dayRows1 = (g.body?.workHours || []).filter((w) => (w.date || "").startsWith(DATE) && w.status !== "cancelled" && w.status !== "rejected");
const expectedWage = createdIds.reduce((s, x) => s + x.rate, 0);
check("الملخص قبل الحذف: 3.0 سا", g.body?.summary?.totals?.totalHours === 3, `الساعات=${g.body?.summary?.totals?.totalHours}`);
check(`الملخص قبل الحذف: ${expectedWage} دج (مجموع اللقطات)`, g.body?.summary?.totals?.totalWage === expectedWage, `الأجر=${g.body?.summary?.totals?.totalWage}`);
check("السجلات الثلاثة معتمدة (المدير يعتمد تلقائياً)", dayRows1.every((w) => w.status === "approved"), dayRows1.map((w) => w.status).join(","));

// ═══ 2) الحذف بدون سبب → 400 ═══
console.log("\n▶️ 2) السبب إلزامي");
const victim = createdIds[0];
const dNoReason = await api(cookie, `/api/workhours/${victim.id}`, {
  method: "DELETE", headers: clubHeader, body: JSON.stringify({}),
});
check("حذف بلا سبب → 400", dNoReason.status === 400, `status=${dNoReason.status} ${JSON.stringify(dNoReason.body?.error || "").slice(0, 90)}`);
const dShort = await api(cookie, `/api/workhours/${victim.id}`, {
  method: "DELETE", headers: clubHeader, body: JSON.stringify({ reason: "xx" }),
});
check("سبب قصير (<3 أحرف) → 400", dShort.status === 400, `status=${dShort.status}`);

// ═══ 3) الحذف بسبب صحيح → 200 + الإجماليات تنخفض فوراً ═══
console.log("\n▶️ 3) الحذف النهائي بسبب صحيح (المحور)");
const dOk = await api(cookie, `/api/workhours/${victim.id}`, {
  method: "DELETE", headers: clubHeader,
  body: JSON.stringify({ reason: "اختبار: خطأ في التسجيل — حصة مكررة" }),
});
check("الحذف نجح (200)", dOk.status === 200, `status=${dOk.status} ${JSON.stringify(dOk.body?.error || "").slice(0, 90)}`);
check("الاستجابة تحمل رسالة النجاح", Boolean(dOk.body?.message), (dOk.body?.message || "").slice(0, 70));

g = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
const victimGone = !(g.body?.workHours || []).some((w) => w.id === victim.id);
check("السجل المحذوف اختفى من القائمة (حذف فعلي)", victimGone);
check("الإجمالي انخفض إلى 2.0 سا", g.body?.summary?.totals?.totalHours === 2, `الساعات=${g.body?.summary?.totals?.totalHours}`);
check("الأجر انخفض بمقدار لقطة السجل المحذوف", g.body?.summary?.totals?.totalWage === expectedWage - victim.rate,
  `الأجر=${g.body?.summary?.totals?.totalWage} متوقع=${expectedWage - victim.rate}`);

// ═══ 4) الحذف المزدوج → 404 ═══
const dAgain = await api(cookie, `/api/workhours/${victim.id}`, {
  method: "DELETE", headers: clubHeader, body: JSON.stringify({ reason: "حذف مزدوج" }),
});
check("حذف سجل محذوف → 404", dAgain.status === 404, `status=${dAgain.status}`);

// ═══ 5) لقطة التدقيق: work_hour_delete + اللقطة الكاملة ═══
console.log("\n▶️ 5) سجل التدقيق يحفظ لقطة السجل المحذوف");
const aud = await api(cookie, `/api/audit-logs?action=work_hour_delete&limit=10`, { headers: clubHeader });
const audRows = aud.body?.logs || aud.body?.auditLogs || aud.body || [];
const snap = Array.isArray(audRows) ? audRows.find((x) => x.entityId === victim.id) : null;
check("يوجد قيد تدقيق work_hour_delete للسجل المحذوف", Boolean(snap), snap?.action || "");
let meta = {};
try { meta = JSON.parse(snap?.metadata || "{}"); } catch { /* بلا metadata */ }
check("اللقطة تحمل المبلغ (grossAmount)", meta.grossAmount === victim.rate, `gross=${meta.grossAmount} متوقع=${victim.rate}`);
check("اللقطة تحمل السبب", (meta.reason || "").includes("خطأ في التسجيل"), (meta.reason || "").slice(0, 60));
check("اللقطة تحمل الحالة الأصلية (approved)", meta.deletedFromStatus === "approved", `من=${meta.deletedFromStatus}`);

// ═══ 6) الحذف لا يحرّك الدفتر المالي ═══
const finAfterDelete = await ledger();
check("الدفتر المالي لم يتغير بعد الحذف (Δ=0)",
  finBefore && finAfterDelete && finBefore.income === finAfterDelete.income && finBefore.expense === finAfterDelete.expense,
  `قبل=${JSON.stringify(finBefore)} بعد=${JSON.stringify(finAfterDelete)}`);

// ═══ 7) حماية الأجر المدفوع: سجل داخل فترة مسدَّدة لا يُحذف ═══
console.log("\n▶️ 7) حماية الأجر المدفوع (paidWageGuard) على الحذف");
const guardRec = createdIds[1];
const w1 = await api(cookie, `/api/wages?from=${DATE}&to=${DATE}`, { headers: clubHeader });
const wRow = (w1.body?.workers || []).find((x) => x.userId === worker.id);
const remaining = wRow?.remaining ?? 0;
let guardTested = false;
if (remaining > 0) {
  const pay = await api(cookie, "/api/wages", {
    method: "POST", headers: clubHeader,
    body: JSON.stringify({
      userId: worker.id, from: DATE, to: DATE, amount: remaining,
      method: "cash", source: "delete-test", idempotencyKey: `delete-test-${DATE}-${Date.now()}`,
    }),
  });
  check("تسديد أجر يوم الاختبار نجح", pay.status === 201, `status=${pay.status}`);
  if (pay.status === 201) {
    const blocked = await api(cookie, `/api/workhours/${guardRec.id}`, {
      method: "DELETE", headers: clubHeader,
      body: JSON.stringify({ reason: "محاولة حذف سجل داخل فترة مسدَّدة" }),
    });
    check("حذف سجل مدفوع → 409", blocked.status === 409, `status=${blocked.status}`);
    check("الاستجابة تحمل paidWageGuard", Boolean(blocked.body?.paidWageGuard), JSON.stringify(blocked.body?.error || "").slice(0, 90));
    const gGuard = await api(cookie, `/api/workhours?month=${MONTH}`, { headers: clubHeader });
    check("السجل المدفوع ما زال في الإجمالي (لم يُحذف صمتاً)",
      (gGuard.body?.workHours || []).some((w) => w.id === guardRec.id));

    // ═══ 8) المسار الرقابي: عكس التسديد ثم الحذف ينجح ═══
    console.log("\n▶️ 8) المسار الرقابي: إلغاء التسديد (Void) ثم الحذف");
    const voidRes = await api(cookie, `/api/wages/${pay.body.wagePaymentId}`, {
      method: "DELETE", headers: clubHeader,
      body: JSON.stringify({ reason: "اختبار المسار الرقابي — عكس التسديد ثم حذف السجل الخاطئ" }),
    });
    check("إلغاء التسديد نجح", voidRes.status === 200, `status=${voidRes.status}`);
    const unblocked = await api(cookie, `/api/workhours/${guardRec.id}`, {
      method: "DELETE", headers: clubHeader,
      body: JSON.stringify({ reason: "حذف بعد عكس التسديد — سجل خاطئ" }),
    });
    check("بعد عكس التسديد: الحذف ينجح", unblocked.status === 200, `status=${unblocked.status}`);
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
