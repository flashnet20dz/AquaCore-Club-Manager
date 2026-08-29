/**
 * desktop-restore.js — يستعيد schema.prisma الأصلي (PostgreSQL) بعد البناء المكتيبي
 * ═══════════════════════════════════════════════════════════════
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SCHEMA_PATH = path.join(__dirname, "..", "prisma", "schema.prisma");
const SCHEMA_BAK = path.join(__dirname, "..", "prisma", "schema.prisma.web.bak");

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  AquaCore — Desktop Build Restore                         ║");
console.log("║  Switching Prisma schema: SQLite → PostgreSQL            ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

try {
  if (!fs.existsSync(SCHEMA_BAK)) {
    console.log("ℹ️  No backup found (schema.prisma.web.bak) — nothing to restore.");
    console.log("    This is fine if prepare was never run or already restored.\n");
    process.exit(0);
  }

  // استعادة الـ schema الأصلي
  fs.copyFileSync(SCHEMA_BAK, SCHEMA_PATH);
  fs.unlinkSync(SCHEMA_BAK);
  console.log("✅ Restored schema.prisma (PostgreSQL)");
  console.log("✅ Removed backup file\n");

  // إعادة توليد Prisma Client لـ PostgreSQL (للتطوير المحلي)
  console.log("🔧 Regenerating Prisma Client for PostgreSQL...");
  try {
    execSync("npx prisma@6.11.1 generate", { stdio: "inherit", cwd: path.join(__dirname, "..") });
    console.log("✅ Prisma Client regenerated (PostgreSQL)\n");
  } catch {
    console.log("⚠️  Could not regenerate (DATABASE_URL not set?) — skipped.");
    console.log("    Run `npm run db:generate` manually when needed.\n");
  }

  console.log("══════════════════════════════════════════════════════════");
  console.log("  ✓ Schema restored. Web development ready.");
  console.log("══════════════════════════════════════════════════════════\n");
} catch (err) {
  console.error("\n❌ Restore failed:", err.message);
  process.exit(1);
}
