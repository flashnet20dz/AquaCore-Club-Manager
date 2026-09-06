/**
 * stress-bulk-under-load.mjs — إعادة إنتاج ظرف المستخدم الحقيقي:
 * تسجيل 4 حصص بينما الواجهة تعمل (مزامنة منخرطين متواصلة + لوحة مالية)
 * هذه القراءات الطويلة هي ما كان يجلع BEGIN يفشل (P2028) قبل الإصلاح.
 */
const BASE = "http://localhost:3000";
const EMAIL = "admin@rcs.dz", PASSWORD = "admin123";

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  return sc.map((c) => c.split(";")[0]).find((c) => c.startsWith("rcs-session="));
}
const api = async (cookie, path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { "Content-Type": "application/json", Cookie: cookie, ...(opts.headers || {}) } });
  let body = null; try { body = await res.json(); } catch {}
  return { status: res.status, body };
};

const cookie = await login();
const me = await api(cookie, "/api/auth/me");
const clubId = me.body?.user?.clubId;
const H = { "x-club-id": clubId };
const slotsRes = await api(cookie, "/api/swimming-slots", { headers: H });
const slots = (Array.isArray(slotsRes.body) ? slotsRes.body : slotsRes.body?.slots || [])
  .filter((s) => ["09:00", "10:00", "11:00", "12:00"].some((t) => (s.startTime || "").startsWith(t))).slice(0, 4);
const usersRes = await api(cookie, "/api/users", { headers: H });
const users = Array.isArray(usersRes.body) ? usersRes.body : usersRes.body?.users || [];
const guard = users[0];
const DATE = "2026-06-10"; // يوم مختلف عن اختبار السيناريو الأساسي

// تنظيف اليوم
const cleanList = await api(cookie, `/api/workhours?month=2026-06`, { headers: H });
for (const w of (cleanList.body?.workHours || []).filter((w) => w.userId === guard.id && (w.date || "").startsWith(DATE))) {
  if (!["cancelled", "draft"].includes(w.status)) {
    await api(cookie, `/api/workhours/${w.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "cancelled", reason: "تنظيف اختبار الحمل" }) });
  }
  await api(cookie, `/api/workhours/${w.id}`, { method: "DELETE", headers: H });
}

console.log("\n🔥 اختبار الحمل: 6 تسجيلات متتالية بينما قراءات ثقيلة متزامنة تعمل\n");

// ─── حمل خلفي: قراءات متزامنة مستمرة (محاكاة الواجهة الحقيقية) ───
let stopLoad = false;
let readOps = 0;
const loadWorkers = [1, 2, 3].map((w) => (async () => {
  while (!stopLoad) {
    await Promise.all([
      api(cookie, "/api/financial/dashboard?period=year", { headers: H }).catch(() => {}),
      api(cookie, "/api/workhours?month=2026-06", { headers: H }).catch(() => {}),
      api(cookie, "/api/subscribers?since=0", { headers: H }).catch(() => {}),
      api(cookie, "/api/stats", { headers: H }).catch(() => {}),
    ]);
    readOps += 4;
  }
})());

const results = [];
for (let i = 0; i < 6; i++) {
  const t0 = Date.now();
  const r = await api(cookie, "/api/workhours/bulk", {
    method: "POST", headers: H,
    body: JSON.stringify({ userId: guard.id, date: DATE, slotIds: slots.map((s) => s.id) }),
  });
  const ms = Date.now() - t0;
  const err = r.body?.error || "";
  const isDup = r.status === 200 && r.body?.created === 0;
  const ok = (r.status === 201 && r.body?.created === 4) || isDup;
  results.push({ i, ok, ms, status: r.status, created: r.body?.created, err: err.slice(0, 80) });
  console.log(`  #${i + 1} ${ok ? "✅" : "❌"} status=${r.status} created=${r.body?.created} ${ms}ms ${err ? "err=" + err.slice(0, 60) : ""}`);
}
stopLoad = true;
await Promise.allSettled(loadWorkers);

const fails = results.filter((r) => !r.ok);
const p2028 = fails.filter((r) => /transaction/i.test(r.err));
const fin = await api(cookie, "/api/financial/dashboard?period=year", { headers: H });
console.log(`\n📊 عمليات قراءة خلفية: ${readOps}`);
console.log(`📊 تسجيلات ناجحة: ${6 - fails.length}/6 | أخطاء P2028: ${p2028.length}`);
console.log(`📊 الدفتر المالي: income=${fin.body?.balance?.totalIncome} expense=${fin.body?.balance?.totalExpense} (يجب 0/0 لنادي الاختبار)`);
console.log(fails.length === 0 ? "\n✅ لا فشل تحت الحمل — الإصلاح يعمل" : `\n❌ ${fails.length} فشل تحت الحمل`);

// تنظيف يوم الحمل
const cl = await api(cookie, `/api/workhours?month=2026-06`, { headers: H });
let cleaned = 0;
for (const w of (cl.body?.workHours || []).filter((w) => w.userId === guard.id && (w.date || "").startsWith(DATE))) {
  if (!["cancelled", "draft"].includes(w.status)) {
    await api(cookie, `/api/workhours/${w.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "cancelled", reason: "تنظيف اختبار الحمل" }) });
    cleaned++;
  }
}
console.log(`🧹 تنظيف: أُلغى ${cleaned} سجل`);
process.exit(fails.length > 0 ? 1 : 0);
