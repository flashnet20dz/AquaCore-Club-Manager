import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { uploadCardImage, isCloudinaryConfigured } from "@/lib/cloudinary";

/**
 * POST /api/upload/card-image
 * رفع صورة بطاقة إلى Cloudinary
 * Body: FormData { file: File, cardId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: "Cloudinary غير مهيّأ" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const cardId = formData.get("cardId") as string;

    if (!file || !cardId) {
      return NextResponse.json({ error: "الملف ومعرّف البطاقة مطلوبان" }, { status: 400 });
    }

    const result = await uploadCardImage(file, cardId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      publicId: result.publicId,
      secureUrl: result.secureUrl,
    });
  } catch (e) {
    console.error("Upload card image error:", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}
