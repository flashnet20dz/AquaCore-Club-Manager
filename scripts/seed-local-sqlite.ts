import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

const FIRST_NAMES_M = [
  "محمد الأمين", "ياسين صلاح الدين", "فؤاد عبد القادر", "أحمد", "يوسف", "عبد الرحمن",
  "إبراهيم", "خالد", "عمر", "علي", "بلال", "حمزة", "زياد", "آدم", "مصعب",
  "أنس", "إياد", "وليد", "رضا", "حسن", "حسين", "طه", "صهيب", "معاذ",
];

const FIRST_NAMES_F = [
  "فاطمة", "سارة", "مريم", "خديجة", "عائشة", "نور الهدى", "هاجر", "أسماء",
  "زينب", "رقية", "أمينة", "ليلى", "ريان", "جنات", "إيمان", "رحمة",
];

const LAST_NAMES = [
  "بورقعة", "براهمي", "زيدان", "علي", "بوزيد", "حمداني", "مرابط", "بن عيسى",
  "شريف", "قاسمي", "بلقاسم", "عمراني", "حملاوي", "زروقي", "صحراوي",
  "تاج الدين", "بشير", "موساوي", "لعمارة", "حداد", "بوضياف", "مهداوي", "قرين",
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const SWIMMING_DAYS = ["الأحد والأربعاء", "الاثنين والخميس", "الثلاثاء والجمعة", "السبت فقط"];
const TIME_SLOTS = ["09:00-10:00", "10:00-11:00", "17:00-18:00", "18:00-19:00", "19:00-20:00"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🌊 تهيئة بيانات نادي RCS في قاعدة بيانات SQLite المحلية...");

  // 1. إنشاء أو جلب النادي الرئيسي
  let club = await db.club.findFirst();
  if (!club) {
    club = await db.club.create({
      data: {
        name: "النادي الهاوي متعدد الرياضات - الرائد سعيدة",
        city: "سعيدة",
        country: "الجزائر",
        managerName: "المدير العام",
        phone: "0550000000",
        email: "rcs@club.dz",
        status: "active",
      },
    });
    console.log("  ✓ تم إنشاء النادي الافتراضي:", club.name);
  } else {
    console.log("  • النادي موجود:", club.name);
  }

  // 2. الحساب الموثوق يُدار عبر متغيرات البيئة — لا بيانات دخول في الكود
  // 🔒 SECURITY: ADMIN_EMAIL + ADMIN_PASSWORD (غير مرفوعة إلى GitHub)
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await db.user.upsert({
      where: { email: adminEmail },
      update: {
        clubId: club.id,
        role: "admin",
        active: true,
        pending: false,
        name: process.env.ADMIN_NAME || "المدير العام",
      },
      create: {
        email: adminEmail,
        name: process.env.ADMIN_NAME || "المدير العام",
        passwordHash: hash,
        role: "admin",
        phone: "0550000000",
        clubId: club.id,
        active: true,
        pending: false,
      },
    });
    console.log(`  ✓ حساب المدير الموثوق: ${adminEmail}`);
  } else {
    console.log("  ⚠️ اضبط ADMIN_EMAIL و ADMIN_PASSWORD في .env لإنشاء حساب المدير الموثوق");
  }

  // حسابات أدوار تجريبية للتطوير فقط — لا تُنشأ إلا بـ SEED_DEMO_USERS=true
  // وكلمات السر تُولَّد عشوائياً (لا تُطبع كلمات سر ثابتة في الكود)
  if (process.env.SEED_DEMO_USERS === "true") {
    const crypto = await import("crypto");
    const demoUsers = [
      { email: "assistant@example.com", name: "المساعد الإداري", role: "assistant", phone: "0660000000" },
      { email: "coach@example.com", name: "حارس السباحة الرئيسي", role: "lifeguard", phone: "0770000000" },
      { email: "observer@example.com", name: "المراقب", role: "observer", phone: "0560000000" },
    ];
    for (const u of demoUsers) {
      const pw = crypto.randomBytes(12).toString("base64url");
      const hash = await bcrypt.hash(pw, 10);
      await db.user.upsert({
        where: { email: u.email },
        update: { clubId: club.id, role: u.role, active: true, name: u.name },
        create: {
          email: u.email,
          name: u.name,
          passwordHash: hash,
          role: u.role,
          phone: u.phone,
          clubId: club.id,
          active: true,
        },
      });
      console.log(`  ✓ حساب تجريبي: ${u.email} (كلمة السر: ${pw} — للتطوير فقط)`);
    }
  }

  // 3. إنشاء الإعدادات الأساسية
  const settings = [
    { key: "clubName", value: "النادي الهاوي متعدد الرياضات - الرائد سعيدة - فرع السباحة" },
    { key: "clubPhone", value: "0550000000" },
    { key: "clubAddress", value: "المسبح نصف أولمبي، سعيدة - الجزائر" },
    { key: "currency", value: "دج" },
    { key: "lateFee", value: "0" },
    { key: "whatsappEnabled", value: "true" },
    { key: "whatsappTemplate", value: "مرحباً {name}، اشتراكك في نادي RCS ينتهي في {date}. يرجى التجديد. شكراً." },
  ];

  for (const s of settings) {
    await db.setting.upsert({
      where: { clubId_key: { clubId: club.id, key: s.key } },
      update: { value: s.value },
      create: { clubId: club.id, key: s.key, value: s.value },
    });
  }
  console.log("  ✓ تم إعداد إعدادات النادي");

  // 4. إنشاء أنواع الاشتراكات
  const subTypes = [
    { code: "/", name: "عادي", fee: 2500, ins: 500, comp: 1000, color: "#0d9488", group: "RCS" },
    { code: "OPOW", name: "OPOW", fee: 2000, ins: 500, comp: 1000, color: "#3b82f6", group: "OPOW" },
    { code: "DJS", name: "DJS", fee: 2000, ins: 500, comp: 1000, color: "#8b5cf6", group: "DJS" },
    { code: "FCS", name: "FCS", fee: 2000, ins: 500, comp: 1000, color: "#f59e0b", group: "FCS" },
    { code: "RCS", name: "RCS", fee: 1500, ins: 500, comp: 1000, color: "#10b981", group: "RCS" },
    { code: "POLICE", name: "POLICE", fee: 2000, ins: 500, comp: 1000, color: "#ef4444", group: "POLICE" },
  ];

  for (const st of subTypes) {
    const existing = await db.subscriptionType.findFirst({
      where: { clubId: club.id, code: st.code },
    });
    if (!existing) {
      await db.subscriptionType.create({
        data: {
          clubId: club.id,
          code: st.code,
          name: st.name,
          color: st.color,
          subscriptionFee: st.fee,
          insuranceFee: st.ins,
          compoundRights: st.comp,
          durationDays: 30,
          numberingGroup: st.group,
        },
      });
    }
  }
  console.log("  ✓ تم إعداد أنواع الاشتراكات");

  // 5. إضافة منخرطين تجريبيين
  await db.attendance.deleteMany({ where: { clubId: club.id } });
  await db.subscriber.deleteMany({ where: { clubId: club.id } });
  console.log("  🌱 جاري إضافة 30 منخرطاً تجريبياً...");
  const statuses = ["مدفوع", "مدفوع", "مدفوع", "لم يدفع", "تأمين فقط", "معفى"];
    const typeCodes = ["/", "OPOW", "DJS", "FCS", "RCS", "POLICE"];

    for (let i = 1; i <= 30; i++) {
      const isMale = Math.random() < 0.6;
      const firstName = isMale ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
      const lastName = pick(LAST_NAMES);
      const fileNumber = `RCS ${String(i).padStart(3, "0")}`;
      const status = pick(statuses);
      const type = pick(typeCodes);
      const birthYear = 2005 + Math.floor(Math.random() * 14); // 2005 - 2019
      const birthDate = new Date(birthYear, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
      const now = new Date();
      const lastPayment = status === "لم يدفع" ? null : new Date(now.getTime() - Math.floor(Math.random() * 20) * 86400000);

      const sub = await db.subscriber.create({
        data: {
          clubId: club.id,
          fileNumber,
          firstName,
          lastName,
          birthDate,
          gender: isMale ? "ذكر" : "أنثى",
          bloodType: pick(BLOOD_TYPES),
          subscriptionType: type,
          paymentStatus: status,
          lastPaymentDate: lastPayment,
          swimmingDays: pick(SWIMMING_DAYS),
          timeSlot: pick(TIME_SLOTS),
          phone: `055${String(Math.floor(1000000 + Math.random() * 9000000))}`,
        },
      });

      // إضافة حضور تجريبي
      if (status === "مدفوع") {
        await db.attendance.create({
          data: {
            clubId: club.id,
            subscriberId: sub.id,
            date: new Date(),
            checkInTime: new Date(),
            method: "manual",
          },
        });
      }
    }
    console.log("  ✓ تم إنشاء 30 منخرطاً مع سجلات الحضور");

  console.log("\n==================================================");
  console.log("🎉 اكتملت تهيئة قاعدة البيانات المحلية بنجاح!");
  if (process.env.ADMIN_EMAIL) {
    console.log(`حساب المدير الموثوق: ${process.env.ADMIN_EMAIL} (كلمة السر من ADMIN_PASSWORD في .env)`);
  } else {
    console.log("⚠️ لم يُضبط ADMIN_EMAIL — لا يوجد حساب مدير");
  }
  console.log("==================================================\n");
}

main()
  .catch((e) => {
    console.error("خطأ أثناء التهيئة:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
