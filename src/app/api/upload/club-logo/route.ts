import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { uploadClubLogo, isCloudinaryConfigured } from "@/lib/cloudinary";
import { db } from "@/lib/db";

/**
 * POST /api/upload/club-logo
 * رفع شعار نادي — Cloudinary عند توفره، وإلا تخزين محلي Data URL في قاعدة البيانات
 * Body: FormData { file: File, clubId: string }
 */

const LOCAL_LOGO_MAX_BYTES = 300 * 1024; // 300KB حد التخزين المحلي
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clubId = (formData.get("clubId") as string) || currentUser.clubId;

    if (!file || !clubId) {
      return NextResponse.json({ error: "الملف ومعرّف النادي مطلوبان" }, { status: 400 });
    }

    const mime = file.type || "image/png";
    if (!ALLOWED_MIME.includes(mime)) {
      return NextResponse.json({ error: "صيغة غير مدعومة — استخدم PNG أو JPG أو SVG" }, { status: 400 });
    }

    // ═══ وضع بلا Cloudinary: تخزين محلي كـ Data URL ═══
    if (!isCloudinaryConfigured()) {
      if (file.size > LOCAL_LOGO_MAX_BYTES) {
        return NextResponse.json(
          { error: "الشعار كبير — الحد 300KB في التخزين المحلي. اضغطه أو ارفع نسخة أصغر." },
          { status: 400 }
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      await db.setting.upsert({
        where: { clubId_key: { clubId, key: "headerLogo" } },
        update: { value: dataUrl },
        create: { clubId, key: "headerLogo", value: dataUrl },
      });
      return NextResponse.json({ success: true, secureUrl: dataUrl, storage: "local" });
    }

    const result = await uploadClubLogo(file, clubId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // احفظ الشعار في إعدادات النادي
    await db.setting.upsert({
      where: { clubId_key: { clubId, key: "headerLogo" } },
      update: { value: result.secureUrl! },
      create: { clubId, key: "headerLogo", value: result.secureUrl! },
    });

    return NextResponse.json({
      success: true,
      publicId: result.publicId,
      secureUrl: result.secureUrl,
    });
  } catch (e) {
    console.error("Upload club logo error:", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}
