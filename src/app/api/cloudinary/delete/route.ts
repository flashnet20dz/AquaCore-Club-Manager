import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { deleteImage, isCloudinaryConfigured } from "@/lib/cloudinary";
import { db } from "@/lib/db";

/**
 * POST /api/cloudinary/delete
 * حذف صورة من Cloudinary
 * Body: { publicId: string }
 *
 * يمكن أيضاً حذف صورة منخرط: { subscriberId: string }
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

    const body = await req.json();
    const { publicId, subscriberId } = body;

    let targetPublicId = publicId;

    // إذا طُلب حذف صورة منخرط
    if (!targetPublicId && subscriberId) {
      const photo = await db.subscriberPhoto.findUnique({
        where: { subscriberId },
        select: { cloudinaryPublicId: true },
      });
      if (!photo?.cloudinaryPublicId) {
        return NextResponse.json({ error: "لا توجد صورة على Cloudinary لهذا المنخرط" }, { status: 404 });
      }
      targetPublicId = photo.cloudinaryPublicId;
    }

    if (!targetPublicId) {
      return NextResponse.json({ error: "publicId أو subscriberId مطلوب" }, { status: 400 });
    }

    const result = await deleteImage(targetPublicId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // امسح المرجع من DB إن كان لمنخرط
    if (subscriberId) {
      await db.subscriberPhoto.update({
        where: { subscriberId },
        data: { cloudinaryPublicId: null, cloudinaryUrl: null },
      });
      await db.subscriber.update({
        where: { id: subscriberId },
        data: { photoPath: null, photoThumb: null },
      });
    }

    return NextResponse.json({ success: true, message: "تم حذف الصورة من Cloudinary" });
  } catch (e) {
    console.error("Cloudinary delete error:", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}
