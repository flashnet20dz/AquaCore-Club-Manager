import path from "path";

/**
 * ★ استخراج مسار ملف قاعدة بيانات SQLite الفعلي من متغير البيئة DATABASE_URL
 * بدلاً من مسار ثابت خاطئ (prisma/dev.db) — وهذا كان سبب فشل تصدير قاعدة البيانات.
 *
 * يدعم الصيغ:
 *  - file:/absolute/path/custom.db  (مسار مطلق — كما في خادم التطوير المحلي)
 *  - file:custom.db                 (نسبي إلى مجلد prisma — عرف Prisma)
 *  - file:./custom.db?connection_limit=10 (مع معاملات استعلام)
 *
 * يعيد null عندما تكون قاعدة البيانات ليست SQLite (مثل PostgreSQL على Vercel).
 */
export function resolveSqliteDbPath(): string | null {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("file:")) return null;

  let raw = url.slice("file:".length);

  // إزالة معاملات الاستعلام إن وجدت
  const q = raw.indexOf("?");
  if (q >= 0) raw = raw.slice(0, q);

  raw = raw.trim();
  if (!raw) return null;

  try {
    raw = decodeURIComponent(raw);
  } catch {
    // تجاهل: ترميز غير صالح — نستخدم القيمة كما هي
  }

  if (path.isAbsolute(raw)) return path.normalize(raw);

  // عرف Prisma: المسارات النسبية تُحل بالنسبة لمجلد ملف الـ schema (prisma/)
  return path.normalize(path.join(process.cwd(), "prisma", raw));
}

/** هل محرك قاعدة البيانات على هذا الخادم هو SQLite؟ */
export function isSqliteEngine(): boolean {
  return resolveSqliteDbPath() !== null;
}
