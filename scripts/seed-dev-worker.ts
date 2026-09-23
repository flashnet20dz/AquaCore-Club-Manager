import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const clubId = "dev-club-1";
  const bcrypt = (await import("bcryptjs")).default;
  // 🔒 كلمة سر عشوائية تُطبع مرة واحدة — لا كلمات سر ثابتة في الكود
  const crypto = (await import("crypto")).default ?? (await import("crypto"));
  const password = crypto.randomBytes(12).toString("base64url");
  const hash = await bcrypt.hash(password, 10);
  const worker = await db.user.upsert({
    where: { email: "karim@test.dz" },
    update: { clubId },
    create: { email: "karim@test.dz", name: "كريم بن عيسى", passwordHash: hash, role: "worker", active: true, pending: false, clubId },
  });
  const empExists = await db.employee.findFirst({ where: { clubId, userId: worker.id } });
  if (!empExists) {
    await db.employee.create({ data: { clubId, userId: worker.id, hourRate: 500, position: "منقذ", firstName: "كريم", lastName: "بن عيسى", hireDate: new Date() } as any });
  } else {
    await db.employee.update({ where: { id: empExists.id }, data: { hourRate: 500 } });
  }
  // 40 ساعة معتمدة هذا الشهر (5 أيام × 8 ساعات) — wall-clock UTC
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  let created = 0;
  for (let d = 1; d <= 5 && created < 5; d++) {
    const day = new Date(Date.UTC(y, m, d, 9, 0, 0));
    const exists = await db.workHours.findFirst({ where: { clubId, userId: worker.id, date: day } });
    if (exists) continue;
    await db.workHours.create({
      data: {
        clubId, userId: worker.id, date: day,
        startTime: new Date(Date.UTC(y, m, d, 9, 0, 0)),
        endTime: new Date(Date.UTC(y, m, d, 17, 0, 0)),
        status: "approved",
      } as any,
    });
    created++;
  }
  console.log("worker seeded:", worker.id, "workdays created:", created, "كلمة السر المؤقتة:", password);
}
main().finally(() => db.$disconnect());
