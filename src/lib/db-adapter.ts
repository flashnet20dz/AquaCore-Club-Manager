/**
 * Database Adapter — طبقة تجريد قاعدة البيانات
 * ─────────────────────────────────────────────────
 * هذه الطبقة تختار قاعدة البيانات الصحيحة حسب البيئة:
 *
 * 1. الويب (Vercel):
 *    - يستخدم PostgreSQL عبر Neon
 *    - DATABASE_URL = postgresql://...
 *
 * 2. Desktop (Electron — Offline):
 *    - يستخدم SQLite محلياً
 *    - DATABASE_URL = file:/path/to/app-data/rcs-club.db
 *
 * لا يُغيّر منطق Prisma — فقط يختار الـ datasource المناسب.
 */

import { PrismaClient } from "@prisma/client";

// كشف البيئة
const isElectron =
  typeof window !== "undefined" &&
  typeof (window as any).electronAPI !== "undefined";

const isServer =
  typeof window === "undefined" &&
  typeof process !== "undefined" &&
  process.versions &&
  !process.versions.node;

// في Electron renderer، نستخدم IPC بدلاً من Prisma مباشرة
declare global {
  // eslint-disable-next-line no-var
  var __dbAdapter: DatabaseAdapter | undefined;
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Database Adapter — يوفر واجهة موحدة للوصول للبيانات
 * في الويب: Prisma + PostgreSQL
 * في Desktop: Prisma + SQLite (أو IPC bridge)
 */
export interface DatabaseAdapter {
  /** بيئة التشغيل الحالية */
  environment: "web" | "desktop" | "desktop-online";
  /** نوع قاعدة البيانات */
  databaseType: "postgresql" | "sqlite";
  /** هل نحن offline */
  isOffline: boolean;
  /** مسار قاعدة البيانات (للـ SQLite فقط) */
  databasePath?: string;
  /** Prisma client (للاستخدام المباشر في الـ API routes) */
  prisma?: PrismaClient;
}

/**
 * الحصول على الـ adapter المناسب للبيئة الحالية
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  if (globalThis.__dbAdapter) return globalThis.__dbAdapter;

  // في Electron renderer (browser) — لا يوجد Prisma مباشرة
  if (isElectron) {
    const adapter: DatabaseAdapter = {
      environment: "desktop",
      databaseType: "sqlite",
      isOffline: true,
    };
    globalThis.__dbAdapter = adapter;
    return adapter;
  }

  // في Server (Next.js API routes) — استخدم Prisma
  // الـ DATABASE_URL تحدد نوع قاعدة البيانات
  const dbUrl = process.env.DATABASE_URL || "";

  if (dbUrl.startsWith("file:")) {
    // SQLite — Desktop mode
    const adapter: DatabaseAdapter = {
      environment: "desktop",
      databaseType: "sqlite",
      isOffline: true,
      databasePath: dbUrl.replace("file:", ""),
      prisma: global.prisma || new PrismaClient(),
    };
    if (!global.prisma) global.prisma = adapter.prisma;
    globalThis.__dbAdapter = adapter;
    return adapter;
  }

  // PostgreSQL — Web mode (default)
  const adapter: DatabaseAdapter = {
    environment: "web",
    databaseType: "postgresql",
    isOffline: false,
    prisma: global.prisma || new PrismaClient(),
  };
  if (!global.prisma) global.prisma = adapter.prisma;
  globalThis.__dbAdapter = adapter;
  return adapter;
}

/**
 * الحصول على Prisma client مباشرة
 * (يستخدم في الـ API routes على الويب والـ Desktop)
 */
export function getPrismaClient(): PrismaClient {
  const adapter = getDatabaseAdapter();
  if (!adapter.prisma) {
    throw new Error("Prisma client not available in this environment");
  }
  return adapter.prisma;
}

/**
 * هل نحن في وضع Desktop (Electron)؟
 */
export function isDesktopMode(): boolean {
  return getDatabaseAdapter().environment === "desktop";
}

/**
 * هل نحن offline؟
 */
export function isOfflineMode(): boolean {
  return getDatabaseAdapter().isOffline;
}

/**
 * الحصول على معلومات البيئة للعرض في الواجهة
 */
export function getEnvironmentInfo() {
  const adapter = getDatabaseAdapter();
  return {
    environment: adapter.environment,
    databaseType: adapter.databaseType,
    isOffline: adapter.isOffline,
    databasePath: adapter.databasePath,
    isElectron,
  };
}
