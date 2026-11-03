import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { restoreSqliteBuffer, restoreJsonData } from "@/lib/backup-restore";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const AUTO_BACKUP_SETTING_KEY = "autoBackupConfig";
const DEFAULT_BACKUP_DIR = path.join(process.cwd(), "backups");

// ═════════════════════════════════════════════════════════════════════════════
// POST: استعادة مباشرة لنسخة احتياطية متوفرة محلياً على السيرفر بدون إعادة رفع
// ═════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const filename = body.filename as string;
    const mode = (body.mode as "replace" | "merge") || "replace";

    if (!filename) {
      return NextResponse.json({ error: "يرجى تحديد اسم ملف النسخة الاحتياطية" }, { status: 400 });
    }

    // قراءة مسار مجلد النسخ من الإعدادات
    const setting = await db.setting.findUnique({
      where: { clubId_key: { clubId: user.clubId!, key: AUTO_BACKUP_SETTING_KEY } },
    });

    let destination = "backups";
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (parsed.destination) destination = parsed.destination;
      } catch {}
    }

    const targetDir = destination && destination !== "backups" ? destination : DEFAULT_BACKUP_DIR;
    const safeFilename = path.basename(filename);
    const filePath = path.join(targetDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `الملف ${safeFilename} غير موجود في السيرفر` }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 4) {
      return NextResponse.json({ error: "ملف النسخة الاحتياطية فارغ أو تالف" }, { status: 400 });
    }

    // 1. فحص هل هو ملف SQLite أصلي (.db)
    const SQLITE_HEADER = Buffer.from("SQLite format 3\0");
    const isSqlite = buffer.length >= 16 && buffer.subarray(0, 16).equals(SQLITE_HEADER);

    if (isSqlite) {
      return await restoreSqliteBuffer(buffer, safeFilename, user);
    }

    // 2. فحص كـ JSON
    try {
      const text = buffer.toString("utf8");
      const parsed = JSON.parse(text);
      return await restoreJsonData(parsed, user.clubId!, mode);
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: `تعذر فك محتوى الملف: ${parseErr?.message || "صيغة غير صالحة"}` },
        { status: 400 }
      );
    }
  } catch (e: any) {
    console.error("[restore-local] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "فشلت استعادة النسخة الاحتياطية المحلية" },
      { status: 500 }
    );
  }
}
