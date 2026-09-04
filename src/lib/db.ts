/**
 * Prisma client — يستخدم Database Adapter
 * ──────────────────────────────────────────
 * يختار تلقائياً:
 * - PostgreSQL على الويب (Vercel + Neon)
 * - SQLite على Desktop (Electron offline)
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma client — يستخدم DATABASE_URL من البيئة
// في الويب: postgresql://... (Neon)
// في Desktop: file:/path/to/rcs-club.db (SQLite)
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * هل نحن في وضع Desktop (SQLite)؟
 */
export function isDesktopMode(): boolean {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('file:');
}

/**
 * هل نحن في وضع Web (PostgreSQL)؟
 */
export function isWebMode(): boolean {
  return !isDesktopMode();
}

/**
 * الحصول على معلومات البيئة للعرض
 */
export function getDatabaseInfo() {
  const url = process.env.DATABASE_URL || '';
  return {
    isDesktop: isDesktopMode(),
    isWeb: isWebMode(),
    type: url.startsWith('file:') ? 'SQLite' : 'PostgreSQL',
    location: url.startsWith('file:') ? url.replace('file:', '') : 'Neon Cloud',
  };
}
