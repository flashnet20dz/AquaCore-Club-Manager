import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const users = await db.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true, pending: true, clubId: true } })
console.log(JSON.stringify(users, null, 1))
await db.$disconnect()
