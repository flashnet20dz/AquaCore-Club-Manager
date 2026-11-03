import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const db = new PrismaClient()
const u = await db.user.findUnique({ where: { email: 'admin@rcs.dz' } })
for (const p of ['admin123', 'admin', 'password', 'rcs123']) {
  const ok = await bcrypt.compare(p, u.passwordHash)
  if (ok) console.log('MATCH:', p)
}
console.log('hash prefix:', u.passwordHash.slice(0, 7))
await db.$disconnect()
