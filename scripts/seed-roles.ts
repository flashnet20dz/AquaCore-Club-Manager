import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding users with new roles...");

  const users = [
    { email: "admin@rcs.dz", name: "المدير العام", password: "admin123", role: "admin", phone: "0550000000" },
    { email: "assistant@rcs.dz", name: "المساعد الإداري", password: "assistant123", role: "assistant", phone: "0660000000" },
    { email: "coach@rcs.dz", name: "حارس السباحة الرئيسي", password: "coach123", role: "lifeguard", phone: "0770000000" },
    { email: "observer@rcs.dz", name: "المراقب", password: "observer123", role: "observer", phone: "0560000000" },
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
  const lifeguard = await db.user.findUnique({ where: { email: "coach@rcs.dz" } });
  if (lifeguard) {
    const existingWh = await db.workHours.count();
    if (existingWh === 0) {
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

  console.log("\n✅ Seed complete!");
  console.log("\n📋 Login credentials:");
  console.log("  👑 admin@rcs.dz / admin123 (مدير)");
  console.log("  💼 assistant@rcs.dz / assistant123 (مساعد إداري)");
  console.log("  🏊 coach@rcs.dz / coach123 (حارس سباحة)");
  console.log("  👁️ observer@rcs.dz / observer123 (مراقب)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
