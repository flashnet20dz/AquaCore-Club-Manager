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

// 🛡️ إصلاح «Unable to start a transaction in the given time» على SQLite (Desktop):
// journal_mode=delete يجعل القراءات الطويلة (مزامنة المنخرطين، لوحة المالية)
// تحجب الكاتب فجوع BEGIN لمعاملة التسجيل → P2028. WAL يفصل القراء عن الكاتب
// (قارئ واحد+كاتب متزامنين) — يُحفظ في ملف القاعدة فلا يحتاج إعادة، وidempotent.
// PostgreSQL (الويب) غير متأثر — الفحص يعزل البيئتين.
if ((process.env.DATABASE_URL || '').startsWith('file:')) {
  void db
    .$queryRawUnsafe<unknown[]>('PRAGMA journal_mode=WAL')
    .then((m) => {
      const mode = Array.isArray(m) && m[0] && typeof m[0] === 'object' ? String((m[0] as Record<string, unknown>).journal_mode) : '؟';
      console.log('[db] sqlite journal_mode=' + mode);
      return db.$queryRawUnsafe('PRAGMA busy_timeout=8000');
    })
    .catch((e) => console.warn('[db] sqlite WAL setup skipped:', e instanceof Error ? e.message.slice(0, 120) : e));
}

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
