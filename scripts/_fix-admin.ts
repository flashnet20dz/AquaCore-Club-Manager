import { db } from "../src/lib/db";
async function main() {
  const updated = await db.user.update({
    where: { email: "admin@rcs.dz" },
    data: { role: "superadmin" },
    select: { email: true, name: true, role: true, clubId: true },
  });
  console.log("✅ Updated admin:", JSON.stringify(updated, null, 2));
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>db.$disconnect());
