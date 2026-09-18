/**
 * recover-admin.mjs — استعادة الحد الأدنى بعد إعادة تهيئة بيئة العمل (الملف المحلي DB مفقود)
 * ─────────────────────────────────────────────────────────────────────────────
 * ينشئ: نادياً نشطاً (تجربة 15 يوم) + حساب المدير admin@rcs.dz / admin123
 * + الإعدادات الأساسية (اسم النادي، العملة دج، سعر الساعة 400).
 * لا يمس أي بيانات موجودة (idempotent — يتخطى الموجود).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const CLUB_EMAIL = "admin@rcs.dz";
const ADMIN_PASSWORD = process.env.RECOVER_PASSWORD || "admin123";
const TRIAL_DAYS = 15;

async function main() {
  console.log("🔧 استعادة النادي وحساب المدير...");

  // 1) النادي
  let club = await db.club.findFirst({ where: { email: CLUB_EMAIL } });
  if (!club) club = await db.club.findFirst();
  if (!club) {
    const trialStartedAt = new Date();
    const trialEndDate = new Date(Date.now() + TRIAL_DAYS * 86400000);
    club = await db.club.create({
      data: {
        name: "النادي الهاوي متعدد الرياضات",
        city: "سعيدة",
        country: "الجزائر",
        managerName: "المدير العام",
        phone: "0550000000",
        email: CLUB_EMAIL,
        status: "active",
        trialStartedAt,
        trialEndDate,
      },
    });
    console.log(`  ✓ نادي جديد: ${club.name} (${club.id}) — تجربة ${TRIAL_DAYS} يوم`);
  } else {
    console.log(`  • النادي موجود مسبقاً: ${club.name}`);
  }

  // 2) حساب المدير
  const existingAdmin = await db.user.findUnique({ where: { email: CLUB_EMAIL } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.user.create({
      data: {
        email: CLUB_EMAIL,
        name: "المدير العام",
        passwordHash,
        role: "admin",
        phone: "0550000000",
        clubId: club.id,
        active: true,
        pending: false,
      },
    });
    console.log(`  ✓ مدير: ${CLUB_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    await db.user.update({
      where: { email: CLUB_EMAIL },
      data: { active: true, pending: false, clubId: club.id, role: "admin" },
    });
    console.log(`  • حساب المدير موجود — فُعّل وربط بالنادي (كلمة السر لم تُمس)`);
  }

  // 3) الإعدادات الأساسية
  const settings = [
    { key: "clubName", value: club.name },
    { key: "clubPhone", value: "0550000000" },
    { key: "clubAddress", value: "سعيدة، الجزائر" },
    { key: "currency", value: "دج" },
    { key: "lateFee", value: "0" },
    { key: "workHourRate", value: "400" },
  ];
  for (const s of settings) {
    const exists = await db.setting.findUnique({
      where: { clubId_key: { clubId: club.id, key: s.key } },
    });
    if (!exists) {
      await db.setting.create({ data: { ...s, clubId: club.id } });
      console.log(`  ✓ إعداد: ${s.key} = ${s.value}`);
    }
  }

  console.log("\n✅ اكتملت الاستعادة");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
