import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { uploadCoachPhoto, isCloudinaryConfigured } from "@/lib/cloudinary";

/**
 * POST /api/upload/coach-photo
 * رفع صورة مدرب إلى Cloudinary
 * Body: FormData { file: File, coachId: string }
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
    const coachId = formData.get("coachId") as string;

    if (!file || !coachId) {
      return NextResponse.json({ error: "الملف ومعرّف المدرب مطلوبان" }, { status: 400 });
    }

    const result = await uploadCoachPhoto(file, coachId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      publicId: result.publicId,
      secureUrl: result.secureUrl,
    });
  } catch (e) {
    console.error("Upload coach photo error:", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}
