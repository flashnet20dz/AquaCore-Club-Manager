import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
async function main() {
  const clubId = "dev-club-1";
  await db.club.upsert({
    where: { id: clubId },
    update: {},
    create: {
      id: clubId,
      name: "النادي التجريبي — AquaCore",
      city: "سعيدة",
      country: "الجزائر",
      managerName: "المدير",
      phone: "0550000000",
      email: "club@test.dz",
      status: "active",
    } as any,
  });
  const hash = await bcrypt.hash("admin123", 10);
  const admin = await db.user.upsert({
    where: { email: "admin@rcs.dz" },
    update: { clubId, passwordHash: hash, active: true, pending: false },
    create: { email: "admin@rcs.dz", name: "المدير العام", passwordHash: hash, role: "admin", phone: "0550000000", active: true, pending: false, clubId },
  });
  // أنواع اشتراك واقعية (RCS)
  const types = [
    { code: "RCS", name: "RCS", subscriptionFee: 1500, insuranceFee: 500, compoundRights: 1000, durationDays: 365, givesMembershipNumber: true, requiresInsurance: true, requiresCompoundFee: true, renewableMonthly: false, freeSubscription: false, numberingGroup: "RCS", sortOrder: 1 },
    { code: "KIDS", name: "أطفال", subscriptionFee: 1000, insuranceFee: 500, compoundRights: 0, durationDays: 365, givesMembershipNumber: true, requiresInsurance: true, requiresCompoundFee: false, renewableMonthly: false, freeSubscription: false, numberingGroup: "RCS", sortOrder: 2 },
    { code: "VIS", name: "زائر", subscriptionFee: 300, insuranceFee: 0, compoundRights: 0, durationDays: 1, givesMembershipNumber: false, requiresInsurance: false, requiresCompoundFee: false, renewableMonthly: false, freeSubscription: false, numberingGroup: "VIS", sortOrder: 3 },
  ];
  for (const t of types) {
    await db.subscriptionType.upsert({ where: { clubId_code: { clubId, code: t.code } }, update: t, create: { clubId, ...t } as any });
  }
  console.log("seeded:", { clubId, admin: admin.email, types: types.length });
}
main().finally(() => db.$disconnect());
