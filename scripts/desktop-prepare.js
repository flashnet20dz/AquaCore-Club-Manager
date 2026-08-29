/**
 * desktop-prepare.js — يحضّر المشروع لبناء النسخة المكتبية (Electron)
 * ═══════════════════════════════════════════════════════════════
 *
 * يقوم بـ:
 *   1. نسخ احتياطي لـ prisma/schema.prisma (PostgreSQL) ← schema.prisma.web.bak
 *   2. استبدال prisma/schema.prisma بنسخة SQLite (schema.sqlite.prisma)
 *   3. تشغيل prisma generate لتوليد Prisma Client لـ SQLite
 *
 * هذا ضروري لأن النسخة المكتبية تستخدم SQLite محلياً (file:)،
 * بينما نسخة الويب تستخدم PostgreSQL (Neon).
 *
 * بعد البناء، شغّل `npm run desktop:restore` لاستعادة schema الأصلي.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SCHEMA_PATH = path.join(__dirname, "..", "prisma", "schema.prisma");
const SCHEMA_BAK = path.join(__dirname, "..", "prisma", "schema.prisma.web.bak");
const SQLITE_SCHEMA = path.join(__dirname, "..", "prisma", "schema.sqlite.prisma");

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  AquaCore — Desktop Build Preparation                    ║");
console.log("║  Switching Prisma schema: PostgreSQL → SQLite            ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

try {
  // 1) تحقق من وجود schema.sqlite.prisma
  if (!fs.existsSync(SQLITE_SCHEMA)) {
    console.error("❌ prisma/schema.sqlite.prisma not found!");
    console.error("   Run this first: node scripts/generate-sqlite-schema.js");
    process.exit(1);
  }

  // 2) نسخة احتياطية للـ schema الأصلي (PostgreSQL)
  // 🔑 لا تكتشف فوق نسخة احتياطية موجودة (تتجنب فقدان النسخة الأصلية)
  if (fs.existsSync(SCHEMA_PATH) && !fs.existsSync(SCHEMA_BAK)) {
    fs.copyFileSync(SCHEMA_PATH, SCHEMA_BAK);
    console.log("✅ Backed up schema.prisma → schema.prisma.web.bak");
  } else if (fs.existsSync(SCHEMA_BAK)) {
    console.log("ℹ️  Backup already exists (schema.prisma.web.bak) — keeping it");
  }

  // 3) استبدال بنسخة SQLite
  fs.copyFileSync(SQLITE_SCHEMA, SCHEMA_PATH);
  console.log("✅ Replaced schema.prisma with SQLite version");

  // 4) توليد Prisma Client لـ SQLite (استخدم نفس إصدار package.json: 6.11.1)
  console.log("\n🔧 Generating Prisma Client for SQLite...");
  execSync("npx prisma@6.11.1 generate", { stdio: "inherit", cwd: path.join(__dirname, "..") });
  console.log("✅ Prisma Client generated (SQLite)\n");

  // 5) 🔑 نسخ الـ Prisma Client المولّد إلى electron/prisma-client/
  // هذا يضمن أن الـ client يكون بجانب ملفات Electron ويُعبَّأ دائماً في asar.
  // المشكلة السابقة: node_modules/.prisma (مجلد مخفي) لا يُعبَّأ بشكل موثوق.
  const generatedDir = path.join(__dirname, "..", "node_modules", ".prisma", "client");
  const targetDir = path.join(__dirname, "..", "electron", "prisma-client");

  if (!fs.existsSync(generatedDir)) {
    console.error("❌ Generated Prisma Client not found at:", generatedDir);
    console.error("   prisma generate may have failed silently.");
    process.exit(1);
  }

  // تنظيف المجلد الهدف أولاً
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  // نسخ كل الملفات (بما فيها الـ query engine binary)
  function copyDir(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  copyDir(generatedDir, targetDir);

  const fileCount = fs.readdirSync(targetDir).length;
  console.log(`✅ Copied Prisma Client → electron/prisma-client/ (${fileCount} files)`);

  // تحقق من وجود الـ engine binary
  // ملاحظة: على Linux يبدأ الاسم بـ "libquery_engine-"، على Windows بـ "query_engine-"
  const engineFile = fs.readdirSync(targetDir).find(f =>
    (f.startsWith("query_engine-") || f.startsWith("libquery_engine-")) &&
    (f.endsWith(".node") || f.endsWith(".dll.node") || f.endsWith(".so.node"))
  );
  if (engineFile) {
    console.log(`✅ Query engine binary: ${engineFile}`);
  } else {
    console.log("⚠️  Query engine binary not found — Prisma may fail at runtime.");
    console.log("    (On Windows, build on Windows for the correct .dll.node binary)");
  }
  console.log("");

  console.log("══════════════════════════════════════════════════════════");
  console.log("  Ready for desktop build. Run: npm run electron:build");
  console.log("  After build, restore: npm run desktop:restore");
  console.log("══════════════════════════════════════════════════════════\n");
} catch (err) {
  console.error("\n❌ Preparation failed:", err.message);
  // حاول استعادة الـ schema الأصلي عند الفشل
  if (fs.existsSync(SCHEMA_BAK)) {
    fs.copyFileSync(SCHEMA_BAK, SCHEMA_PATH);
    console.error("⚠️  Restored original schema.prisma");
  }
  process.exit(1);
}
