import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import fs from "fs";
import path from "path";

// ═════════════════════════════════════════════════════════════════════════════
// استعادة ملف قاعدة البيانات المباشر (.db / .sqlite) لقطة طبق الأصل 100%
// ═════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح لك باستعادة قاعدة البيانات" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "يرجى اختيار ملف قاعدة بيانات (.db)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // التحقق من ترويسة ملف SQLite الرسمية (16 بايت الأولى)
    const SQLITE_HEADER = Buffer.from("SQLite format 3\0");
    if (buffer.length < 100 || !buffer.subarray(0, 16).equals(SQLITE_HEADER)) {
      return NextResponse.json(
        { error: "الملف المرفوع ليس ملف قاعدة بيانات SQLite صالحاً (.db)" },
        { status: 400 }
      );
    }

    const prismaDir = path.join(process.cwd(), "prisma");
    const dbPath = path.join(prismaDir, "dev.db");
    const walPath = path.join(prismaDir, "dev.db-wal");
    const shmPath = path.join(prismaDir, "dev.db-shm");

    // 1. تفريغ الـ WAL الحالي إن وجد
    try {
      await db.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch {}

    // 2. إنشاء نسخة احتياطية من الملف الحالي كإجراء أمان قبل الاستبدال
    if (fs.existsSync(dbPath)) {
      const backupFilename = `dev.db.before-restore-${Date.now()}.bak`;
      fs.copyFileSync(dbPath, path.join(prismaDir, backupFilename));
    }

    // 3. كتابة ملف قاعدة البيانات الجديد المستعاد
    fs.writeFileSync(dbPath, buffer);

    // 4. حذف ملفات WAL و SHM القديمة لضمان قراءة الملف المستعاد نظيفاً 100%
    if (fs.existsSync(walPath)) {
      try { fs.unlinkSync(walPath); } catch {}
    }
    if (fs.existsSync(shmPath)) {
      try { fs.unlinkSync(shmPath); } catch {}
    }

    return NextResponse.json({
      success: true,
      size: buffer.length,
      filename: file.name,
      message: "تمت استعادة قاعدة البيانات (.db) بنجاح 100%. سيتم تحديث الصفحة فوراً.",
    });
  } catch (e) {
    console.error("Database restore error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "فشلت استعادة ملف قاعدة البيانات" },
      { status: 500 }
    );
  }
}
