/**
 * seed-workhours-repro.ts — بيئة إعادة إنتاج سيناريو «تسجيل 4 حصص»
 * نادي + admin@rcs.dz مرتبط بالنادي + عامل حارس (Abdelkrim, 400دج/س)
 * + 4 حصص صباحية 09-10/10-11/11-12/12-13 (عامة — بلا dayOfWeek)
 * Run: bunx tsx scripts/seed-workhours-repro.ts
 */
import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  // نادي
  let club = await db.club.findFirst({ where: { email: "test@rcs.dz" } });
  if (!club) {
    club = await db.club.create({
      data: {
        name: "نادي الاختبار",
        city: "الجزائر",
        managerName: "مدير الاختبار",
        phone: "0550112233",
        email: "test@rcs.dz",
        status: "active",
      },
    });
    console.log("✓ Club:", club.id);
  } else console.log("• Club exists:", club.id);

  // مدير مرتبط بالنادي
  const adminEmail = "admin@rcs.dz";
  const hash = await bcrypt.hash("admin123", 10);
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { clubId: club.id, role: "admin", active: true, pending: false, passwordHash: hash },
    create: { email: adminEmail, name: "مدير النادي", passwordHash: hash, role: "admin", clubId: club.id },
  });
  console.log("✓ Admin:", admin.id, "clubId:", admin.clubId);

  // حارس المسبح Abdelkrim
  const guardEmail = "abdelkrim@rcs.dz";
  const guard = await db.user.upsert({
    where: { email: guardEmail },
    update: { clubId: club.id, role: "lifeguard", active: true, pending: false },
    create: { email: guardEmail, name: "Abdelkrim", passwordHash: hash, role: "lifeguard", clubId: club.id },
  });
  console.log("✓ Guard user:", guard.id);

  const emp = await db.employee.upsert({
    where: { clubId_nationalId: { clubId: club.id, nationalId: "TEST-NI-001" } },
    update: { hourRate: 400, status: "ACTIVE", userId: guard.id },
    create: {
      clubId: club.id, userId: guard.id, firstName: "عبدالكريم", lastName: "الحارس",
      position: "guard", hourRate: 400, status: "ACTIVE", nationalId: "TEST-NI-001",
    },
  });
  console.log("✓ Employee (400 دج/س):", emp.id);

  // الحصص الأربع الصباحية (عامة — بلا dayOfWeek)
  const defs = [
    { name: "صباحي_1", startTime: "09:00", endTime: "10:00", sortOrder: 1 },
    { name: "صباحي_2", startTime: "10:00", endTime: "11:00", sortOrder: 2 },
    { name: "صباحي_3", startTime: "11:00", endTime: "12:00", sortOrder: 3 },
    { name: "صباحي_4", startTime: "12:00", endTime: "13:00", sortOrder: 4 },
  ];
  for (const d of defs) {
    const existing = await db.swimmingTimeSlot.findFirst({ where: { clubId: club.id, name: d.name } });
    if (existing) {
      await db.swimmingTimeSlot.update({ where: { id: existing.id }, data: { ...d, active: true, dayOfWeek: null } });
      console.log("• Slot updated:", d.name);
    } else {
      await db.swimmingTimeSlot.create({ data: { clubId: club.id, ...d, maxCapacity: 30, dayOfWeek: null } });
      console.log("✓ Slot created:", d.name);
    }
  }

  // إعدادات داعمة: سعر الساعة الافتراضي + أيام الاستغلال (كل الأيام)
  const settings = [
    { key: "workHourRate", value: "400" },
    { key: "poolOperatingDays", value: JSON.stringify(["sat", "sun", "mon", "tue", "wed", "thu", "fri"]) },
  ];
  for (const s of settings) {
    const ex = await db.setting.findFirst({ where: { clubId: club.id, key: s.key } });
    if (ex) await db.setting.update({ where: { id: ex.id }, data: { value: s.value } });
    else await db.setting.create({ data: { clubId: club.id, ...s } });
  }
  console.log("✓ Settings (workHourRate=400, operatingDays=all)");
  console.log("\n🎉 بيئة إعادة الإنتاج جاهزة");
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => db.$disconnect());
