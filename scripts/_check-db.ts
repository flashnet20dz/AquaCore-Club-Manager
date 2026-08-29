import { db } from "../src/lib/db";
async function main() {
  const users = await db.user.findMany({ select: { email: true, name: true, role: true, active: true, pending: true } });
  console.log("👥 Users in DB:", users.length);
  users.forEach(u => console.log(`   - ${u.email} | ${u.role} | active=${u.active} | pending=${u.pending} | ${u.name}`));
  const clubs = await db.club.count();
  console.log("\n🏢 Clubs:", clubs);
  const settings = await db.setting.count();
  console.log("⚙️  Settings:", settings);
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>db.$disconnect());
