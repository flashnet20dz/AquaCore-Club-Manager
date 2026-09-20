/**
 * postinstall.js — اختيار Prisma Schema حسب بيئة التشغيل
 * ─────────────────────────────────────────────────────────
 * إذا كان DATABASE_URL يبدأ بـ "file:" → SQLite (محلي/ديسكتوب)
 * إذا كان DATABASE_URL يبدأ بـ "postgresql" → PostgreSQL (Vercel/Neon)
 */

const { execSync } = require('child_process');
const url = process.env.DATABASE_URL || '';

let schema;
if (url.startsWith('file:') || url === '') {
  // بيئة محلية (SQLite)
  schema = 'prisma/schema.sqlite.prisma';
  console.log('[postinstall] 🗃️  SQLite local mode → using', schema);
} else {
  // بيئة إنتاج (PostgreSQL / Neon)
  schema = 'prisma/schema.prisma';
  console.log('[postinstall] 🐘 PostgreSQL production mode → using', schema);
}

try {
  execSync(`npx prisma generate --schema ${schema}`, { stdio: 'inherit' });
} catch (err) {
  console.error('[postinstall] prisma generate failed:', err.message);
  process.exit(1);
}
