import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { uploadClubLogo, isCloudinaryConfigured } from "@/lib/cloudinary";
import { db } from "@/lib/db";

/**
 * POST /api/upload/club-logo
 * رفع شعار نادي إلى Cloudinary
 * Body: FormData { file: File, clubId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: "Cloudinary غير مهيّأ" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clubId = (formData.get("clubId") as string) || currentUser.clubId;

    if (!file || !clubId) {
      return NextResponse.json({ error: "الملف ومعرّف النادي مطلوبان" }, { status: 400 });
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
