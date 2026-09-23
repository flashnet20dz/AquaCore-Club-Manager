/**
 * سكربت لمرة واحدة: تبديل حساب المدير إلى الحساب الموثوق
 * وحذف جميع الحسابات التجريبية/الافتراضية (@rcs.dz) من قاعدة البيانات المحلية.
 *
 * يقرأ بيانات الحساب الموثوق من متغيرات البيئة (.env):
 *   ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
 *
 * التشغيل:  bunx tsx scripts/set-owner-account.ts
 */
import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL و ADMIN_PASSWORD مطلوبان في .env");
  }

  console.log("🔄 تبديل حساب المدير...");

  // 1. إنشاء/تحديث الحساب الموثوق
  const club = await db.club.findFirst();
  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "admin",
      active: true,
      pending: false,
      name: process.env.ADMIN_NAME || "المدير العام",
      ...(club ? { clubId: club.id } : {}),
    },
    create: {
      email,
      name: process.env.ADMIN_NAME || "المدير العام",
      passwordHash,
      role: "admin",
      active: true,
      pending: false,
      phone: "0550000000",
      ...(club ? { clubId: club.id } : {}),
    },
  });
  console.log("✓ الحساب الموثوق جاهز:", email);

  // 2. حذف جميع الحسابات التجريبية/الافتراضية (نطاق rcs.dz)
  const demoUsers = await db.user.findMany({
    where: { email: { endsWith: "@rcs.dz" } },
    select: { id: true, email: true },
  });

  for (const u of demoUsers) {
    // تنظيف السجلات المرتبطة أولاً (بعض الجداول قد تحمل قيوداً قديمة)
    await db.workHours.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await db.session.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await db.notification.deleteMany({ where: { userId: u.id } }).catch(() => {});
    try {
      await db.user.delete({ where: { id: u.id } });
      console.log("✓ حُذف الحساب التجريبي:", u.email);
    } catch (e) {
      console.error(`✗ تعذر حذف ${u.email}:`, e instanceof Error ? e.message.split("\n")[0] : e);
    }
  }
  if (demoUsers.length === 0) console.log("• لا توجد حسابات تجريبية @rcs.dz");

  // 3. ملخص الحسابات المتبقية (بدون أي بيانات سرية)
  const remaining = await db.user.findMany({ select: { email: true, role: true, active: true } });
  console.log("\n📋 الحسابات النهائية في قاعدة البيانات المحلية:");
  for (const u of remaining) {
    console.log(`   ${u.active ? "✓" : "✗"} ${u.email} (${u.role})`);
  }
  console.log("\n✅ تم التبديل بنجاح!");
}

main()
  .catch((e) => {
    console.error("خطأ:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
