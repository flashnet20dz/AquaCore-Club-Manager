import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";
import { ensureSwimDefaults } from "../src/lib/feature-defaults";

const CLUB_NAME = "النادي الرياضي الهاوي متعدد الرياضات الرائد بلدية سعيدة";
const CLUB_EMAIL = "rcssaida@gmail.com";
const CLUB_PASSWORD = "rcs123";
const CITY = "سعيدة";
const COUNTRY = "الجزائر";
const PHONE = "0550000000";

async function main() {
  console.log("🚀 جاري إنشاء حساب نادي الرائد بلدية سعيدة...");

  // 1. التحقق إن كان النادي أو البريد موجوداً مسبقاً
  let club = await db.club.findUnique({
    where: { email: CLUB_EMAIL },
  });

  const now = new Date();
  const twoYearsLater = new Date(now);
  twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);

  if (!club) {
    club = await db.club.create({
      data: {
        name: CLUB_NAME,
        city: CITY,
        country: COUNTRY,
        managerName: "إدارة النادي",
        phone: PHONE,
        email: CLUB_EMAIL,
        status: "active",
        trialStartedAt: now,
        trialEndDate: twoYearsLater,
        graceEndDate: new Date(twoYearsLater.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`✓ تم إنشاء النادي: ${club.name} (ID: ${club.id})`);
  } else {
    club = await db.club.update({
      where: { id: club.id },
      data: {
        name: CLUB_NAME,
        status: "active",
        city: CITY,
        country: COUNTRY,
      },
    });
    console.log(`✓ تم تحديث بيانات النادي الموجود: ${club.name}`);
  }

  // 2. التحقق من اشتراك النادي أو إنشاؤه لضمان الوصول الكامل
  const activeSub = await db.clubSubscription.findFirst({
    where: { clubId: club.id, status: "active" },
  });

  if (!activeSub) {
    const sub = await db.clubSubscription.create({
      data: {
        clubId: club.id,
        type: "yearly",
        status: "active",
        startDate: now,
        endDate: twoYearsLater,
        lastRenewalDate: now,
      },
    });
    await db.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        action: "created",
        newType: "yearly",
        newEndDate: twoYearsLater,
        note: "تفعيل اشتراك سنوي أولي للنادي",
      },
    });
    console.log(`✓ تم إنشاء اشتراك سارٍ حتى: ${twoYearsLater.toISOString().slice(0, 10)}`);
  } else {
    console.log(`✓ يوجد اشتراك سارٍ مسبقاً حتى: ${activeSub.endDate.toISOString().slice(0, 10)}`);
  }

  // 3. إنشاء أو تحديث مستخدم الإدارة (Admin)
  const passwordHash = await bcrypt.hash(CLUB_PASSWORD, 10);
  const existingUser = await db.user.findUnique({
    where: { email: CLUB_EMAIL },
  });

  let user;
  if (!existingUser) {
    user = await db.user.create({
      data: {
        clubId: club.id,
        email: CLUB_EMAIL,
        name: CLUB_NAME,
        passwordHash,
        role: "admin",
        phone: PHONE,
        active: true,
        pending: false,
      },
    });
    console.log(`✓ تم إنشاء مستخدم المدير بنجاح: ${user.email} (الدور: admin)`);
  } else {
    user = await db.user.update({
      where: { id: existingUser.id },
      data: {
        clubId: club.id,
        name: CLUB_NAME,
        passwordHash,
        role: "admin",
        active: true,
        pending: false,
      },
    });
    console.log(`✓ تم تحديث كلمة المرور وصلاحيات المستخدم: ${user.email}`);
  }

  // 4. تسجيل طلب النادي كمقبول
  await db.clubRequest.upsert({
    where: { id: `req_${club.id}` },
    update: { status: "approved" },
    create: {
      id: `req_${club.id}`,
      clubId: club.id,
      status: "approved",
      reviewedAt: now,
    },
  }).catch(() => {});

  // 5. بذر أيام السباحة والتوقيتات الافتراضية
  const swimResult = await ensureSwimDefaults(db, club.id);
  console.log(`✓ بذر جدول المسبح: ${swimResult.days} أيام و ${swimResult.slots} توقيتات`);

  // 6. بذر أنواع الاشتراكات الأساسية
  const existingTypesCount = await db.subscriptionType.count({
    where: { clubId: club.id },
  });

  if (existingTypesCount === 0) {
    const defaultTypes = [
      { name: "اشتراك عادي", code: "RCS", color: "#0d9488", subscriptionFee: 1500, insuranceFee: 500, compoundRights: 1000, durationDays: 30, numberingGroup: "RCS", sortOrder: 0 },
      { name: "اشتراك تنافسي", code: "COMP", color: "#dc2626", subscriptionFee: 2500, insuranceFee: 500, compoundRights: 1000, durationDays: 30, numberingGroup: "RCS", sortOrder: 1 },
      { name: "درس خاص", code: "PRIV", color: "#7c3aed", subscriptionFee: 4000, insuranceFee: 0, compoundRights: 0, durationDays: 30, requiresInsurance: false, requiresCompoundFee: false, numberingGroup: "X", sortOrder: 2 },
      { name: "اشتراك مجاني (معفى)", code: "FREE", color: "#64748b", subscriptionFee: 0, insuranceFee: 0, compoundRights: 0, durationDays: 30, freeSubscription: true, requiresInsurance: false, requiresCompoundFee: false, numberingGroup: "M", sortOrder: 3 },
    ];
    for (const t of defaultTypes) {
      await db.subscriptionType.create({
        data: { clubId: club.id, ...t },
      });
    }
    console.log("✓ تم بذر أنواع الاشتراكات الأساسية للنادي (RCS, COMP, PRIV, FREE)");
  }

  // 7. بذر إعدادات النادي الأساسية
  const defaultSettings = [
    { key: "clubName", value: CLUB_NAME },
    { key: "clubPhone", value: PHONE },
    { key: "clubAddress", value: "سعيدة - الجزائر" },
    { key: "currency", value: "دج" },
    { key: "lateFee", value: "0" },
    { key: "whatsappEnabled", value: "true" },
    { key: "absenceAlertWeeks", value: "3" },
    { key: "expiryAlertDays", value: "7" },
    { key: "workHourRate", value: "200" },
  ];

  for (const s of defaultSettings) {
    await db.setting.upsert({
      where: { clubId_key: { clubId: club.id, key: s.key } },
      update: { value: s.value },
      create: { clubId: club.id, key: s.key, value: s.value },
    });
  }
  console.log("✓ تم ضبط إعدادات النادي الافتراضية");

  console.log("\n========================================================");
  console.log("🎉 تم إنشاء وتفعيل حساب النادي بنجاح تام!");
  console.log(`اسم النادي: ${CLUB_NAME}`);
  console.log(`البريد الإلكتروني: ${CLUB_EMAIL}`);
  console.log(`كلمة المرور: ${CLUB_PASSWORD}`);
  console.log(`المدينة: ${CITY} | الدولة: ${COUNTRY}`);
  console.log(`حالة النادي: active (مفعل بالكامل مع اشتراك سنتين)`);
  console.log("========================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ خطأ أثناء إنشاء النادي:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
