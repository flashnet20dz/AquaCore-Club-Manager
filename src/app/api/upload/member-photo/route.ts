import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { uploadMemberPhoto, isCloudinaryConfigured } from "@/lib/cloudinary";
import { db } from "@/lib/db";

/**
 * POST /api/upload/member-photo
 * رفع صورة منخرط إلى Cloudinary + حفظ الرابط في DB
 *
 * Body: FormData { file: File, subscriberId: string }
 * Response: { success, publicId, secureUrl }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: "Cloudinary غير مهيّأ — راجع متغيرات البيئة" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subscriberId = formData.get("subscriberId") as string | null;

    if (!file || !subscriberId) {
      return NextResponse.json({ error: "الملف ومعرّف المنخرط مطلوبان" }, { status: 400 });
    }

    // تحقق أن المنخرط ينتمي لنادي المستخدم
    if (currentUser.role !== "superadmin") {
      const sub = await db.subscriber.findUnique({ where: { id: subscriberId }, select: { clubId: true } });
      if (!sub || sub.clubId !== currentUser.clubId) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
    }

    // ارفع إلى Cloudinary
    const result = await uploadMemberPhoto(file, subscriberId);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "فشل الرفع" }, { status: 400 });
    }

    // احفظ في قاعدة البيانات
    const existing = await db.subscriberPhoto.findUnique({ where: { subscriberId } });

    if (existing) {
      // استبدال: احذف الصورة القديمة من Cloudinary إن وُجدت
      if (existing.cloudinaryPublicId && existing.cloudinaryPublicId !== result.publicId) {
        const { deleteImage } = await import("@/lib/cloudinary");
        await deleteImage(existing.cloudinaryPublicId);
      }

      await db.subscriberPhoto.update({
        where: { subscriberId },
        data: {
          original: result.secureUrl!,
          cropped: result.secureUrl!,
          thumbnail: result.secureUrl!,
          cloudinaryPublicId: result.publicId,
          cloudinaryUrl: result.secureUrl,
        },
      });
    } else {
      await db.subscriberPhoto.create({
        data: {
          subscriberId,
          original: result.secureUrl!,
          cropped: result.secureUrl!,
          thumbnail: result.secureUrl!,
          faceDetected: true,
          cloudinaryPublicId: result.publicId,
          cloudinaryUrl: result.secureUrl,
        },
      });
    }

    // حدّث photoPath على المنخرط
    await db.subscriber.update({
      where: { id: subscriberId },
      data: { photoPath: result.secureUrl },
    });

    return NextResponse.json({
      success: true,
      publicId: result.publicId,
      secureUrl: result.secureUrl,
      width: result.width,
      height: result.height,
    });
  } catch (e) {
    console.error("Upload member photo error:", e);
    return NextResponse.json({ error: "خطأ داخلي في الخادم" }, { status: 500 });
  }
}
