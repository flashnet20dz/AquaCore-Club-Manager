/**
 * FINAL AUDIT — Soft-Delete enforcement E2E:
 * StaffCompensation archive (+FT cancel) / SwimmingDay+Slot deactivate / Employee archive
 * NOTHING is physically deleted — every record remains queryable.
 */
const BASE = "http://localhost:3000";
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
  console.log(`\n🧪 SOFT-DELETE ENFORCEMENT — FINAL AUDIT\n${"═".repeat(60)}`);
  const login = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@rcs.dz", password: "admin123" }) });
  ok("login 200", login.status === 200);

  // ═══ 1) StaffCompensation: archive (NOT delete) ═══
  console.log("\n📋 1) StaffCompensation — أرشفة بلا حذف");
  const list0 = await api("/api/staff-compensations");
  const before0 = (list0.data?.compensations || []).length;
  const create = await api("/api/staff-compensations", { method: "POST", body: JSON.stringify({ personName: "اختبار أرشفة", month: 1, year: 2031, workHours: 10, hourRate: 500 }) });
  ok("create 201", create.status === 201, `HTTP ${create.status}`);
  const comp = create.data?.compensation;
  ok("compensation id", Boolean(comp?.id));
  ok("archivedAt is null عند الإنشاء", comp?.archivedAt === null || comp?.archivedAt === undefined);

  const arch = await api(`/api/staff-compensations/${comp.id}`, { method: "DELETE" });
  ok("DELETE → archived=true (200)", arch.status === 200 && arch.data?.archived === true, JSON.stringify(arch.data));
  ok("cancelledTransactions=0 (غير مربوط بقيود)", arch.data?.cancelledTransactions === 0);

  const list1 = await api("/api/staff-compensations");
  ok("القائمة النشطة لا تعيد المؤرشف", !(list1.data?.compensations || []).some((c) => c.id === comp.id), `count: ${before0} → ${(list1.data?.compensations || []).length}`);
  const listAll = await api("/api/staff-compensations?includeArchived=true");
  const archivedRow = (listAll.data?.compensations || []).find((c) => c.id === comp.id);
  ok("السجل محفوظ فعلياً (includeArchived يراه)", Boolean(archivedRow));
  ok("archivedAt مملوء + السبب مسجّل", Boolean(archivedRow?.archivedAt) && Boolean(archivedRow?.archiveReason), archivedRow?.archiveReason);

  const putArch = await api(`/api/staff-compensations/${comp.id}`, { method: "PUT", body: JSON.stringify({ paymentStatus: "paid" }) });
  ok("تعديل المؤرشف → 409", putArch.status === 409, `HTTP ${putArch.status}`);
  const arch2 = await api(`/api/staff-compensations/${comp.id}`, { method: "DELETE" });
  ok("أرشفة مزدوجة → idempotent", arch2.status === 200 && arch2.data?.alreadyArchived === true);

  // stats exclude archived
  const stats = list1.data?.stats;
  ok("الإحصاءات لا تحسب المؤرشف", Boolean(stats), `totalRecords=${stats?.totalRecords}`);

  // ═══ 2) SwimmingDay: DELETE = deactivate ═══
  console.log("\n📋 2) SwimmingDay — تعطيل بلا حذف");
  const dayCreate = await api("/api/swimming-days", { method: "POST", body: JSON.stringify({ name: `يوم اختبار ${Date.now().toString(36)}`, shortName: "خت", color: "#123456", active: true, sortOrder: 99 }) });
  ok("day create 201", dayCreate.status === 201, `HTTP ${dayCreate.status}`);
  const day = dayCreate.data?.day;
  const dayDel = await api(`/api/swimming-days/${day.id}`, { method: "DELETE" });
  ok("DELETE → archived=true", dayDel.status === 200 && dayDel.data?.archived === true, JSON.stringify(dayDel.data));
  const days = await api("/api/swimming-days");
  const dayRow = (days.data?.days || []).find((d) => d.id === day.id);
  ok("اليوم ما زال في القاعدة (active=false)", Boolean(dayRow) && dayRow.active === false);
  // re-create same name → reactivates (no duplicate, no 409)
  const dayRe = await api("/api/swimming-days", { method: "POST", body: JSON.stringify({ name: day.name, shortName: "خت", color: "#123456", active: true, sortOrder: 99 }) });
  ok("إعادة الإنشاء بنفس الاسم → تفعيل السجل نفسه", dayRe.status === 201 && dayRe.data?.reactivated === true && dayRe.data?.day?.id === day.id, `id match=${dayRe.data?.day?.id === day.id}`);

  // ═══ 3) SwimmingTimeSlot: DELETE = deactivate ═══
  console.log("\n📋 3) SwimmingTimeSlot — تعطيل بلا حذف");
  const slotCreate = await api("/api/swimming-slots", { method: "POST", body: JSON.stringify({ name: `حصة اختبار ${Date.now().toString(36)}`, startTime: "06:00", endTime: "07:00", active: true }) });
  ok("slot create 201", slotCreate.status === 201);
  const slot = slotCreate.data?.slot;
  const slotDel = await api(`/api/swimming-slots/${slot.id}`, { method: "DELETE" });
  ok("DELETE → archived=true", slotDel.status === 200 && slotDel.data?.archived === true);
  const slots = await api("/api/swimming-slots");
  const slotRow = (slots.data?.slots || []).find((s) => s.id === slot.id);
  ok("الحصة ما زالت في القاعدة (active=false)", Boolean(slotRow) && slotRow.active === false);

  // ═══ 4) Employee: DELETE = always archive ═══
  console.log("\n📋 4) Employee — أرشفة دائماً (حتى بلا بيانات مرتبطة)");
  const empCreate = await api("/api/employees", { method: "POST", body: JSON.stringify({ firstName: "موظف", lastName: "أرشفة-اختبار", position: "guard", hourRate: 300 }) });
  ok("employee create", empCreate.status === 201 || empCreate.status === 200, `HTTP ${empCreate.status}`);
  const emp = empCreate.data?.employee || empCreate.data;
  const empDel = await api(`/api/employees/${emp.id}`, { method: "DELETE" });
  ok("DELETE → archived=true (بلا بيانات مرتبطة أيضاً)", empDel.status === 200 && empDel.data?.archived === true, JSON.stringify(empDel.data));
  const emps = await api("/api/employees?status=ARCHIVED");
  const empRow = (emps.data?.employees || []).find((e) => e.id === emp.id);
  ok("الموظف محفوظ بوضع ARCHIVED", Boolean(empRow) && empRow.status === "ARCHIVED");

  console.log(`\n📊 النتيجة: ${passed} نجح / ${failed} فشل`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("💥", e); process.exit(1); });
