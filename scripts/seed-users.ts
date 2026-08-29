import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding users & settings...");

  // Default admin
  const adminEmail = "admin@rcs.dz";
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hash = await bcrypt.hash("admin123", 10);
    await db.user.create({
      data: {
        email: adminEmail,
        name: "المدير العام",
        passwordHash: hash,
        role: "admin",
        phone: "0550000000",
      },
    });
    console.log(`  ✓ Admin: ${adminEmail} / admin123`);
  } else {
    console.log(`  • Admin already exists`);
  }

  // Default coach
  const coachEmail = "coach@rcs.dz";
  const existingCoach = await db.user.findUnique({ where: { email: coachEmail } });
  if (!existingCoach) {
    const hash = await bcrypt.hash("coach123", 10);
    await db.user.create({
      data: {
        email: coachEmail,
        name: "المدرب الرئيسي",
        passwordHash: hash,
        role: "coach",
        phone: "0660000000",
      },
    });
    console.log(`  ✓ Coach: ${coachEmail} / coach123`);
  } else {
    console.log(`  • Coach already exists`);
  }

  // Settings
  const settings = [
    { key: "clubName", value: "نادي RCS للسباحة" },
    { key: "clubPhone", value: "0550000000" },
    { key: "clubAddress", value: "الجزائر العاصمة" },
    { key: "lateFee", value: "0" },
    { key: "currency", value: "دج" },
    { key: "whatsappEnabled", value: "true" },
    { key: "whatsappTemplate", value: "مرحباً {name}، اشتراكك في نادي RCS ينتهي في {date}. يرجى التجديد. شكراً." },
  ];
  for (const s of settings) {
    const existing = await db.setting.findUnique({ where: { key: s.key } });
    if (!existing) {
      await db.setting.create({ data: s });
      console.log(`  ✓ Setting: ${s.key}`);
    }
  }

  // Seed some activities
  const subs = await db.subscriber.findMany({ take: 5 });
  if (subs.length > 0) {
    const existingActivities = await db.activity.count();
    if (existingActivities === 0) {
      const types = ["create", "payment", "attendance", "renewal"];
      for (let i = 0; i < 8; i++) {
        const sub = subs[i % subs.length];
        const type = types[i % types.length];
        const descriptions: Record<string, string> = {
          create: `تم تسجيل المنخرط ${sub.lastName} ${sub.firstName}`,
          payment: `تم تسجيل دفعة من ${sub.lastName} ${sub.firstName}`,
          attendance: `حضر ${sub.lastName} ${sub.firstName} حصة السباحة`,
          renewal: `تم تجديد اشتراك ${sub.lastName} ${sub.firstName}`,
        };
        await db.activity.create({
          data: {
            subscriberId: sub.id,
            type,
            description: descriptions[type],
            createdAt: new Date(Date.now() - i * 3600 * 1000 * 3),
          },
        });
      }
      console.log(`  ✓ 8 activities`);
    }
  }

  // Seed some past attendance
  const existingAtt = await db.attendance.count();
  if (existingAtt === 0 && subs.length > 0) {
    const today = new Date();
    for (let d = 0; d < 14; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      date.setHours(0, 0, 0, 0);
      // Random 10-25 attendees per day
      const count = Math.floor(Math.random() * 16) + 10;
      const shuffled = [...subs].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(count, subs.length); i++) {
        const sub = shuffled[i];
        const checkIn = new Date(date);
        checkIn.setHours(9 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
        const checkOut = new Date(checkIn);
        checkOut.setMinutes(checkOut.getMinutes() + 45 + Math.floor(Math.random() * 30));
        try {
          await db.attendance.create({
            data: {
              subscriberId: sub.id,
              date,
              checkInTime: checkIn,
              checkOutTime: checkOut,
              method: Math.random() < 0.6 ? "qr" : "manual",
            },
          });
        } catch {
          // Skip duplicates
        }
      }
    }
    console.log(`  ✓ Attendance seeded for 14 days`);
  }

  console.log("\n✅ Seed complete!");
  console.log("\n📋 Login credentials:");
  console.log("  Admin: admin@rcs.dz / admin123");
  console.log("  Coach: coach@rcs.dz / coach123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
