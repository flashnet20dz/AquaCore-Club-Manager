import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const result = await prisma.$queryRaw`SELECT 1 as test`;
  console.log("✓ Connection OK:", JSON.stringify(result));
} catch (e) {
  console.log("✗ Error:", e.message);
} finally {
  await prisma.$disconnect();
}
