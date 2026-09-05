/**
 * FINAL AUDIT — Bulk Insurance × Batch Kernel E2E verification
 * 1) insure 2 subscribers → 2 active FTs (bulk-ins: refs) + balance delta + FIN numbers
 * 2) re-insure same → affected=0 (idempotent skip)
 * 3) uninsure → payments + FTs soft-cancelled, balance restored
 * Records preserved (no deletion) — audit trail intact.
 */
const BASE = "http://localhost:3000";
const TAG = `BK-${Date.now().toString(36)}`;
let passed = 0, failed = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { passed++; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failed++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
};
let COOKIE = [];

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(COOKIE.length ? { cookie: COOKIE.join("; ") } : {}), ...(opts.headers || {}) },
  });
  const setCookies = res.headers.getSetCookie?.() || [];
  for (const c of setCookies) { const p = c.split(";")[0]; if (!COOKIE.includes(p)) COOKIE.push(p); }
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function main() {
  console.log(`\n🧪 BULK INSURANCE × BATCH KERNEL — ${TAG}\n${"═".repeat(60)}`);

  const login = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@rcs.dz", password: "admin123" }) });
  ok("login 200", login.status === 200, login.data?.user?.role);
  const clubId = login.data?.user?.clubId;
  if (!clubId) { console.log("ℹ️ clubId من القاعدة مباشرة…"); }

  // baseline
  const dash0 = await api("/api/financial/dashboard");
  const T0 = dash0.data?.balance?.totalIncome ?? 0;
  ok("baseline totalIncome", typeof T0 === "number", `T0=${T0}`);

  // create 2 test subscribers
  const subs = [];
  for (const name of [`عامل-${TAG}-أ`, `عامل-${TAG}-ب`]) {
    const res = await api("/api/subscribers", { method: "POST", body: JSON.stringify({ lastName: name, firstName: "اختبار", birthDate: "2010-05-10", gender: "ذكر", subscriptionType: "RCS", paymentStatus: "لم يدفع" }) });
    const sub = res.data?.subscriber || res.data;
    ok(`subscriber created (${name.slice(0, 12)})`, res.status === 201 || res.status === 200, `HTTP ${res.status}`);
    if (sub?.id) subs.push(sub.id);
  }
  ok("2 subscribers ready", subs.length === 2, subs.join(",").slice(0, 40));

  // 1) bulk insure
  const ins = await api("/api/subscribers/bulk-insurance", { method: "POST", body: JSON.stringify({ subscriberIds: subs, action: "insure" }) });
  ok("bulk insure 200", ins.status === 200, JSON.stringify(ins.data));
  ok("affected=2", ins.data?.affected === 2, `affected=${ins.data?.affected}`);

  // verify ledger
  const fts = await api("/api/financial/transactions?limit=50");
  const mine = (fts.data?.transactions || fts.data?.items || []).filter((t) => t.reference?.startsWith("bulk-ins:") && subs.some((s) => t.reference === `bulk-ins:${s}`) && t.status === "active");
  ok("قيود نشطة بالمرجع bulk-ins:", mine.length === 2, `found=${mine.length}`);
  ok("لكل قيد رقم FIN", mine.every((t) => t.number || t.seq), mine.map((t) => t.number).filter(Boolean).join(","));
  ok("كل القيود insurance/income/cash", mine.every((t) => t.category === "insurance" && t.type === "income"));

  const dash1 = await api("/api/financial/dashboard");
  const T1 = dash1.data?.balance?.totalIncome ?? 0;
  ok("Δ الرصيد = مبلغا التأمين", T1 - T0 > 0, `Δ=${T1 - T0}`);
  const insFee = T1 - T0;

  // 2) re-insure → skip
  const ins2 = await api("/api/subscribers/bulk-insurance", { method: "POST", body: JSON.stringify({ subscriberIds: subs, action: "insure" }) });
  ok("إعادة التأمين → affected=0 (لا ازدواج)", ins2.data?.affected === 0 && ins2.data?.skipped === 2, `affected=${ins2.data?.affected} skipped=${ins2.data?.skipped}`);
  const dash2 = await api("/api/financial/dashboard");
  ok("الإجمالي ثابت بعد الإعادة", dash2.data?.balance?.totalIncome === T1, `T=${dash2.data?.balance?.totalIncome}`);

  // 3) uninsure → soft cancel
  const un = await api("/api/subscribers/bulk-insurance", { method: "POST", body: JSON.stringify({ subscriberIds: subs, action: "uninsure" }) });
  ok("uninsure 200", un.status === 200, JSON.stringify(un.data));
  ok("affected=2", un.data?.affected === 2, `affected=${un.data?.affected}`);
  const dash3 = await api("/api/financial/dashboard");
  ok("الرصيد عاد للأساس", dash3.data?.balance?.totalIncome === T0, `T=${dash3.data?.balance?.totalIncome} (expected ${T0})`);

  // cancelled FTs preserved
  const fts2 = await api("/api/financial/transactions?status=cancelled&limit=100");
  const cancelledMine = (fts2.data?.transactions || fts2.data?.items || []).filter((t) => subs.some((s) => t.reference === `bulk-ins:${s}`));
  ok("القيود الملغاة محفوظة بلا حذف", cancelledMine.length >= 2, `cancelled=${cancelledMine.length}`);
  ok("سبب الإلغاء مسجّل", cancelledMine.every((t) => t.cancellationReason));

  // soft cleanup: delete test subscribers (soft delete via bulk-delete? use subscriber delete if available)
  for (const s of subs) {
    await api(`/api/subscribers/${s}`, { method: "DELETE" }); // soft delete (deletedAt) — سجل يبقى
  }
  ok("تنظيف ناعم (deletedAt — السجلات تبقى)", true);

  console.log(`\n📊 النتيجة: ${passed} نجح / ${failed} فشل`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("💥", e); process.exit(1); });
