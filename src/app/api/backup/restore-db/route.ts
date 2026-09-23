import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { restoreSqliteBuffer, restoreJsonData } from "@/lib/backup-restore";

export const dynamic = "force-dynamic";

// ═════════════════════════════════════════════════════════════════════════════
// استعادة ملف قاعدة البيانات المباشر (.db / .sqlite) مع كشف ذكي وتلقائي للمحتوى
// ═════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح لك باستعادة قاعدة البيانات" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as "merge" | "replace") || "replace";

    if (!file) {
      return NextResponse.json({ error: "يرجى اختيار ملف للنسخة الاحتياطية (.db أو .json)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 4) {
      return NextResponse.json({ error: "الملف المرفوع فارغ أو تالف" }, { status: 400 });
    }

    // 1. فحص ترويسة ملف SQLite الرسمية (SQLite format 3\0)
    const SQLITE_HEADER = Buffer.from("SQLite format 3\0");
    const isSqlite = buffer.length >= 16 && buffer.subarray(0, 16).equals(SQLITE_HEADER);

    if (isSqlite) {
      // استعادة مباشرة لملف قاعدة بيانات SQLite
      return await restoreSqliteBuffer(buffer, file.name, user);
    }

    // 2. الكشف الذكي: إذا كان الملف نصياً بصيغة JSON (حتى لو كان اسمه ينتهي بـ .db)
    const firstNonWhitespace = buffer.toString("utf8", 0, Math.min(buffer.length, 100)).trim();
    if (firstNonWhitespace.startsWith("{") || firstNonWhitespace.startsWith("[")) {
      try {
        const jsonString = buffer.toString("utf8");
        const parsedJson = JSON.parse(jsonString);
        return await restoreJsonData(parsedJson, user.clubId!, mode);
      } catch (jsonErr: any) {
        return NextResponse.json(
          { error: `الملف يبدو كنسخة JSON مهيكلة لكن حدث خطأ أثناء فك تشفيره: ${jsonErr?.message || ""}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "صيغة الملف غير مدعومة. يرجى التأكد من رفع ملف قاعدة بيانات SQLite صالح (.db) أو ملف نسخة احتياطية مهيكل (.json).",
      },
      { status: 400 }
    );
  } catch (e: any) {
    console.error("[restore-db] Database restore error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "فشلت استعادة ملف قاعدة البيانات" },
      { status: 500 }
    );
  }
}

