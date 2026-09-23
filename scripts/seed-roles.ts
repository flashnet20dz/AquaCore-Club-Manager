import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding users with new roles...");

  const users = [
    { email: "admin@example.com", name: "المدير العام", password: "********", role: "admin", phone: "0550000000" },
    { email: "assistant@example.com", name: "المساعد الإداري", password: "********", role: "assistant", phone: "0660000000" },
    { email: "coach@example.com", name: "حارس السباحة الرئيسي", password: "********", role: "lifeguard", phone: "0770000000" },
    { email: "observer@example.com", name: "المراقب", password: "********", role: "observer", phone: "0560000000" },
  ];

  for (const u of users) {
    const existing = await db.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash: hash,
          role: u.role,
          phone: u.phone,
        },
      });
      console.log(`  ✓ ${u.email} / ${u.password} (${u.role})`);
    } else {
      // Update role if exists
      await db.user.update({
        where: { email: u.email },
        data: { role: u.role },
      });
      console.log(`  • ${u.email} (updated role to ${u.role})`);
    }
  }

  // Seed some work hours for the lifeguard
  const lifeguard = await db.user.findUnique({ where: { email: "coach@example.com" } });
  if (lifeguard) {
    const existingWh = await db.workHours.count();
    if (existingWh === 0) {
      // WorkHours is club-scoped (clubId required)
      const clubId = (await db.club.findFirst())?.id ?? "";
      const today = new Date();
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        const start = new Date(date);
        start.setHours(9, 0, 0);
        const end = new Date(date);
        end.setHours(11, 0, 0);
        await db.workHours.create({
          data: {
            clubId,
            userId: lifeguard.id,
            date,
            startTime: start,
            endTime: end,
            status: d < 5 ? "approved" : "pending",
            note: d === 0 ? "حصة الصباح" : null,
            approvedAt: d < 5 ? new Date() : null,
          },
        });
      }
      console.log("  ✓ 7 work hours entries");
    }
  }

  // Ensure default club has an active subscription
  const club = await db.club.findFirst();
  if (club) {
    const activeSub = await db.clubSubscription.findFirst({
      where: { clubId: club.id, status: "active" },
    });
    if (!activeSub) {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setFullYear(endDate.getFullYear() + 2);
      await db.clubSubscription.create({
        data: {
          clubId: club.id,
          type: "yearly",
          status: "active",
          startDate: now,
          endDate,
          lastRenewalDate: now,
        },
      });
      console.log("  ✓ Created 2-year active club subscription");
    }
  }

  console.log("\n✅ Seed complete!");
  console.log("\n📋 Login credentials:");
  console.log("  👑 admin@example.com / ******** (مدير)");
  console.log("  💼 assistant@example.com / ******** (مساعد إداري)");
  console.log("  🏊 coach@example.com / ******** (حارس سباحة)");
  console.log("  👁️ observer@example.com / ******** (مراقب)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
