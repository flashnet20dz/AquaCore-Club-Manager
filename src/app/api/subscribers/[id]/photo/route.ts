import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/subscribers/[id]/photo
 * يرجع الصورة الشخصية للمنخرط (thumbnail افتراضياً، أو cropped، أو original)
 * Query: ?size=thumbnail|cropped|original (افتراضي: cropped)
 *
 * يستخدم redirect للصورة كـ data URL، أو JSON بالـ base64.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const size = (url.searchParams.get("size") || "cropped") as "thumbnail" | "cropped" | "original";

    const photo = await db.subscriberPhoto.findUnique({
      where: { subscriberId: id },
      select: { thumbnail: true, cropped: true, original: true, faceDetected: true },
    });

    if (!photo) {
      return NextResponse.json({ error: "لا توجد صورة" }, { status: 404 });
    }

    const dataUrl = photo[size] || photo.cropped;

    // إذا طُلب كصورة مباشرة (?raw=1) → اعرضها كـ image/jpeg
    if (url.searchParams.get("raw") === "1") {
      const base64 = dataUrl.split(",")[1];
      const buffer = Buffer.from(base64, "base64");
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    return NextResponse.json({
      photo: dataUrl,
      faceDetected: photo.faceDetected,
      size,
    });
  } catch (e) {
    console.error("GET photo error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/subscribers/[id]/photo
 * رفع/تحديث الصورة الشخصية
 * Body: { original, cropped, thumbnail, faceDetected }
 * (كلها data URLs من معالجة client-side)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { original, cropped, thumbnail, faceDetected = false } = body;

    if (!cropped || !thumbnail) {
      return NextResponse.json({ error: "الصورة المقطوعة والمصغّرة مطلوبتان" }, { status: 400 });
    }

    // تحقق أن المنخرط ينتمي لنادي المستخدم (superadmin يتجاوز)
    if (currentUser.role !== "superadmin") {
      const sub = await db.subscriber.findUnique({ where: { id }, select: { clubId: true } });
      if (!sub || sub.clubId !== currentUser.clubId) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
    }

    // upsert الصورة (احذف القديمة إن وُجدت)
    const existing = await db.subscriberPhoto.findUnique({ where: { subscriberId: id } });
    let photo;
    if (existing) {
      photo = await db.subscriberPhoto.update({
        where: { subscriberId: id },
        data: { original, cropped, thumbnail, faceDetected },
      });
    } else {
      photo = await db.subscriberPhoto.create({
        data: { subscriberId: id, original, cropped, thumbnail, faceDetected },
      });
    }

    // حدّث photoPath على المنخرط (مسار منطقي)
    await db.subscriber.update({
      where: { id },
      data: { photoPath: `db://${id}`, photoThumb: `db://${id}?size=thumbnail` },
    });

    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "subscriber_photo",
      entityId: id,
      description: `تحديث صورة المنخرط ${id}${faceDetected ? " (تم اكتشاف وجه)" : ""}`,
      metadata: { faceDetected },
    });

    return NextResponse.json({ success: true, photo: { id: photo.id, faceDetected: photo.faceDetected } });
  } catch (e) {
    console.error("POST photo error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/subscribers/[id]/photo
 * حذف الصورة الشخصية
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    if (currentUser.role !== "superadmin") {
      const sub = await db.subscriber.findUnique({ where: { id }, select: { clubId: true } });
      if (!sub || sub.clubId !== currentUser.clubId) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
    }

    await db.subscriberPhoto.deleteMany({ where: { subscriberId: id } });
    await db.subscriber.update({
      where: { id },
      data: { photoPath: null, photoThumb: null },
    });

    await auditLogWithRequest(req, currentUser, {
      action: "delete",
      entityType: "subscriber_photo",
      entityId: id,
      description: `حذف صورة المنخرط ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE photo error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
