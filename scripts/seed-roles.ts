import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  if (process.env.SEED_ROLES !== "true") {
    console.log("ℹ️ تم تعطيل إنشاء الحسابات الافتراضية لمنع الثغرات الأمنية.");
    return;
  }

  const users: any[] = [];

  // Seed some work hours for the lifeguard
  const lifeguard = await db.user.findFirst({ where: { role: "lifeguard" } });
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
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
