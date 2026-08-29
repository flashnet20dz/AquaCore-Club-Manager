/**
 * generate-sqlite-schema.js — يولّد prisma/schema.sqlite.prisma من schema.prisma
 * ═══════════════════════════════════════════════════════════════
 *
 * يقوم بـ:
 *   1. قراءة prisma/schema.prisma (PostgreSQL)
 *   2. تغيير provider إلى "sqlite"
 *   3. إزالة directUrl (غير مدعوم في SQLite)
 *   4. كتابة النتيجة إلى prisma/schema.sqlite.prisma
 *
 * شغّل هذا السكربت كلما حدّدت schema.prisma لتحديث نسخة SQLite.
 *
 * الاستخدام: node scripts/generate-sqlite-schema.js
 */

const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.join(__dirname, "..", "prisma", "schema.prisma");
const SQLITE_SCHEMA_PATH = path.join(__dirname, "..", "prisma", "schema.sqlite.prisma");

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  AquaCore — Generate SQLite Schema from PostgreSQL      ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

try {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error("❌ prisma/schema.prisma not found!");
    process.exit(1);
  }

  let content = fs.readFileSync(SCHEMA_PATH, "utf8");

  // 1) تغيير provider من postgresql إلى sqlite
  content = content.replace(
    /provider\s*=\s*"postgresql"/g,
    'provider = "sqlite"'
  );

  // 2) إزالة directUrl (غير مدعوم في SQLite)
  content = content.replace(
    /\s*directUrl\s*=\s*env\([^)]+\)\s*\n/g,
    "\n"
  );

  // 3) تحديث التعليق التمهيدي
  const header = `// Prisma schema for AquaCore Club Manager — SQLite (Desktop/Electron offline)
// Auto-generated from schema.prisma by scripts/generate-sqlite-schema.js — DO NOT EDIT MANUALLY
// For web (Vercel + Postgres), use schema.prisma
`;

  // استبدال أول تعليق تمهيدي
  content = content.replace(
    /^\/\/.*$/m,
    "// Prisma schema for AquaCore Club Manager — SQLite (Desktop/Electron offline)"
  );
  // إضافة أسطر الهيدر بعد أول تعليق
  const lines = content.split("\n");
  lines[0] = "// Prisma schema for AquaCore Club Manager — SQLite (Desktop/Electron offline)";
  lines.splice(1, 0,
    "// Auto-generated from schema.prisma by scripts/generate-sqlite-schema.js — DO NOT EDIT MANUALLY",
    "// For web (Vercel + Postgres), use schema.prisma"
  );
  content = lines.join("\n");

  fs.writeFileSync(SQLITE_SCHEMA_PATH, content, "utf8");

  console.log(`✅ Generated: prisma/schema.sqlite.prisma (${content.length} bytes)`);
  console.log(`   Source: prisma/schema.prisma (${fs.statSync(SCHEMA_PATH).size} bytes)\n`);
  console.log("══════════════════════════════════════════════════════════");
  console.log("  ✓ SQLite schema ready for desktop builds.");
  console.log("══════════════════════════════════════════════════════════\n");
} catch (err) {
  console.error("\n❌ Generation failed:", err.message);
  process.exit(1);
}
