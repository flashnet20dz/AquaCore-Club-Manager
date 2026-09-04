#!/usr/bin/env node
/**
 * financial-audit-test.mjs — اختبار تدقيق إجمالي المداخيل (URGENT FIX — FINANCIAL TOTAL INCOME AUDIT)
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * السيناريو المطلوب (§9-§10) + سلامة المصدر الواحد:
 *   1-2   الأساس: totalIncome من الدفتر + اتساق خرائط الفئات مع الإجمالي
 *   3     إنشاء دخل 1500 + 500 + 1500 → الإجمالي +3500 بالضبط
 *   4     فترة بلا عمليات → مداخيل الفترة = 0 لكن إجمالي المداخيل يبقى +3500
 *   5     إلغاء 1500 → الإجمالي يصبح +2000 والقيد الملغى محفوظ (بلا حذف)
 *   6     الإصلاح الذاتي: تخريب كاش FinancialBalance → الـAPI يقرأ الدفتر ويصلح الكاش
 *   7     تنظيف ناعم (إلغاء القيود المتبقية) → Δ=0 مقابل الأساس
 *
 * الاستخدام: node scripts/financial-audit-test.mjs [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";
const COOKIE_JAR = [];
const REF_TAG = `TEST-FIN-${Date.now().toString(36)}`;
const { PrismaClient } = await import("@prisma/client").then((m) => m.default ?? m);
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

const mapSum = (m) => Object.values(m || {}).reduce((s, v) => s + (v || 0), 0);

async function main() {
  console.log(`\n🧪 FINANCIAL TOTAL INCOME AUDIT TEST — ${REF_TAG}\n${"═".repeat(64)}`);

  // ═══ 0) دخول المدير ═══
  console.log("\n📋 0) تسجيل الدخول");
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@rcs.dz", password: "admin123" }),
  });
  ok("login 200", login.status === 200, `role=${login.data?.user?.role}`);
  if (login.status !== 200) throw new Error("لا يمكن المتابعة بلا دخول");
  const adminId = login.data.user.id;
  const adminUser = await prisma.user.findUnique({ where: { id: adminId }, select: { clubId: true } });
  const clubId = adminUser?.clubId;
  ok("clubId موجود", Boolean(clubId), clubId || "");

  // ═══ 1) الأساس من الدفتر ═══
  console.log("\n📋 1) الأساس — إجمالي المداخيل من الدفتر");
  const base1 = await api("/api/financial/dashboard?period=month");
  ok("dashboard 200", base1.status === 200);
  const T0 = base1.data?.balance?.totalIncome ?? 0;
  const E0 = base1.data?.balance?.totalExpense ?? 0;
  ok("balance.totalIncome رقم", Number.isFinite(T0), `T0=${T0}`);
  ok("الخرائط من الدفتر: مجموع incomeByCategory = totalIncome",
    mapSum(base1.data?.balance?.incomeByCategory) === T0,
    `${mapSum(base1.data?.balance?.incomeByCategory)} = ${T0}`);
  ok("الخرائط من الدفتر: مجموع expenseByCategory = totalExpense",
    mapSum(base1.data?.balance?.expenseByCategory) === E0,
    `${mapSum(base1.data?.balance?.expenseByCategory)} = ${E0}`);

  // ═══ 2) السيناريو: دخل 1500 + 500 + 1500 ═══
  console.log("\n📋 2) إنشاء قيود دخل 1500 / 500 / 1500 (§9)");
  let seq = 0;
  const mk = (amount) => api("/api/financial/transactions", {
    method: "POST",
    body: JSON.stringify({
      type: "income", category: "other_income", amount,
      paymentMethod: "cash", payeeName: REF_TAG, reference: `${REF_TAG}-${++seq}`,
      note: "اختبار تدقيق إجمالي المداخيل",
    }),
  });
  const t1 = await mk(1500);
  const t2 = await mk(500);
  const t3 = await mk(1500);
  ok("قيد 1500 (أول) 201", t1.status === 201 && t1.data?.transaction?.amount === 1500, `id=${t1.data?.transaction?.id}`);
  ok("قيد 500 201", t2.status === 201 && t2.data?.transaction?.amount === 500, `id=${t2.data?.transaction?.id}`);
  ok("قيد 1500 (ثاني) 201", t3.status === 201 && t3.data?.transaction?.amount === 1500, `id=${t3.data?.transaction?.id}`);
  const toCancelLater = t3.data?.transaction?.id; // الـ1500 الثاني — سيُلغى
  const leftoverIds = [t1.data?.transaction?.id, t2.data?.transaction?.id].filter(Boolean);

  const after3 = await api("/api/financial/dashboard?period=month");
  const T3 = after3.data?.balance?.totalIncome ?? 0;
  ok("إجمالي المداخيل +3500 بالضبط", T3 - T0 === 3500, `Δ=${T3 - T0}`);
  ok("الخرائط ما زالت متسقة بعد الإضافة", mapSum(after3.data?.balance?.incomeByCategory) === T3);
  ok("الرصيد التاريخي حُدّث +3500", (after3.data?.balance?.balance ?? 0) - ((T0 - E0)) === 3500);

  // ═══ 2b) منع التكرار: نفس المرجع = قيد واحد بلا ازدواج (idempotency) ═══
  console.log("\n📋 2b) إعادة نفس المرجع — منع الازدواج");
  const dup = await api("/api/financial/transactions", {
    method: "POST",
    body: JSON.stringify({
      type: "income", category: "other_income", amount: 1500,
      paymentMethod: "cash", payeeName: REF_TAG, reference: `${REF_TAG}-1`,
      note: "اختبار منع التكرار بنفس المرجع",
    }),
  });
  ok("نفس المرجع → duplicate=true دون قيد جديد", dup.status === 200 && dup.data?.duplicate === true);
  const afterDup = await api("/api/financial/dashboard?period=month");
  ok("الإجمالي لم يتغير بعد المحاولة المزدوجة", (afterDup.data?.balance?.totalIncome ?? 0) === T3,
    `totalIncome=${afterDup.data?.balance?.totalIncome}`);

  // ═══ 3) فترة فارغة: مداخيل الفترة = 0 والإجمالي يبقى ═══
  console.log("\n📋 3) فترة بلا عمليات (2030) — مداخيل الفترة=0 / الإجمالي ثابت (§9)");
  const empty = await api("/api/financial/dashboard?period=custom&from=2030-01-01&to=2030-01-02");
  ok("period.income = 0", (empty.data?.period?.income ?? -1) === 0, `period.income=${empty.data?.period?.income}`);
  ok("period.expense = 0", (empty.data?.period?.expense ?? -1) === 0);
  ok("إجمالي المداخيل لم يتأثر (+3500)", (empty.data?.balance?.totalIncome ?? 0) === T3,
    `totalIncome=${empty.data?.balance?.totalIncome}`);
  ok("الرصيد التاريخي لم يتأثر", (empty.data?.balance?.balance ?? 0) === after3.data?.balance?.balance);

  // ═══ 4) إلغاء 1500 → الإجمالي 2000 والقيد محفوظ (§10) ═══
  console.log("\n📋 4) إلغاء قيد 1500 — إجمالي +2000 / الملغى محفوظ (§10)");
  const cancel = await api(`/api/financial/transactions/${toCancelLater}`, {
    method: "DELETE",
    body: JSON.stringify({ reason: "اختبار تدقيق — إلغاء 1500" }),
  });
  ok("إلغاء 200", cancel.status === 200);
  const afterCancel = await api("/api/financial/dashboard?period=month");
  const T4 = afterCancel.data?.balance?.totalIncome ?? 0;
  ok("إجمالي المداخيل +2000 بالضبط", T4 - T0 === 2000, `Δ=${T4 - T0}`);
  ok("الخرائط متسقة بعد الإلغاء", mapSum(afterCancel.data?.balance?.incomeByCategory) === T4);
  const cancelledRow = await prisma.financialTransaction.findUnique({ where: { id: toCancelLater } });
  ok("القيد الملغى محفوظ بلا حذف", Boolean(cancelledRow) && cancelledRow.status === "cancelled",
    `status=${cancelledRow?.status}`);

  // ═══ 5) الإصلاح الذاتي للكاش (تدقيق FIN #7) ═══
  console.log("\n📋 5) تخريب الكاش → الـAPI يقرأ الدفتر ويصلح FinancialBalance ذاتياً");
  await prisma.financialBalance.update({
    where: { clubId },
    data: {
      totalIncome: 999999,
      incomeByCategory: JSON.stringify({ stale: 12345 }),
    },
  });
  const healed = await api("/api/financial/dashboard?period=month");
  ok("الاستجابة من الدفتر لا من الكاش المتخرب", (healed.data?.balance?.totalIncome ?? 0) === T4,
    `totalIncome=${healed.data?.balance?.totalIncome} (الكاش كان 999999)`);
  ok("خرائط الاستجابة من الدفتر", mapSum(healed.data?.balance?.incomeByCategory) === T4,
    `stale فئة الكاش اختفت: ${healed.data?.balance?.incomeByCategory?.stale === undefined}`);
  ok("integrity يعلن التطابق بعد الإصلاح", healed.data?.integrity?.matches === true,
    `diff=${healed.data?.integrity?.diff}`);
  const repaired = await prisma.financialBalance.findUnique({ where: { clubId } });
  ok("صف FinancialBalance أُصلح فعلياً في القاعدة",
    repaired?.totalIncome === T4 && mapSum(JSON.parse(repaired?.incomeByCategory || "{}")) === T4,
    `cache.totalIncome=${repaired?.totalIncome}`);

  // ═══ 6) تنظيف ناعم — إلغاء المتبقي → Δ=0 ═══
  console.log("\n📋 6) تنظيف القيود المتبقية (إلغاء ناعم فقط)");
  for (const id of leftoverIds) {
    const r = await api(`/api/financial/transactions/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ reason: "تنظيف اختبار تدقيق المداخيل" }),
    });
    ok(`إلغاء قيد التنظيف ${id.slice(-6)} 200`, r.status === 200);
  }
  const finalDash = await api("/api/financial/dashboard?period=month");
  ok("العودة إلى الأساس Δ=0", (finalDash.data?.balance?.totalIncome ?? 0) === T0,
    `final=${finalDash.data?.balance?.totalIncome} / T0=${T0}`);
  ok("الخرائط النهائية متسقة", mapSum(finalDash.data?.balance?.incomeByCategory) === (finalDash.data?.balance?.totalIncome ?? 0));
  const keptCancelled = await prisma.financialTransaction.count({
    where: { reference: { startsWith: REF_TAG }, status: "cancelled" },
  });
  ok("آثار الاختبار الثلاثة محفوظة كملغاة (قابلة للتدقيق)", keptCancelled === 3, `ملغاة=${keptCancelled}`);

  // ═══ الخلاصة ═══
  console.log(`\n${"═".repeat(64)}`);
  console.log(`📊 النتيجة: ${passed} نجح / ${failed} فشل`);
  if (failures.length) { console.log("❌ الإخفاقات:", failures.join(" | ")); process.exitCode = 1; }
  else console.log("✅ كل فحوص تدقيق إجمالي المداخيل ناجحة");
}

main()
  .catch((e) => { console.error("💥", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
