import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

// الحد الأقصى للأحجام (بايت)
const MAX_CROPPED_BYTES = 400 * 1024;    // 400 KB
const MAX_THUMBNAIL_BYTES = 100 * 1024;  // 100 KB
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024; // 10 MB

// الأدوار المخوّلة برفع وحذف صور المنخرطين
const ALLOWED_ROLES = ["admin", "assistant", "superadmin"];

/**
 * حساب حجم البيانات الثنائية التقريبي لسلسلة data URL (base64)
 */
function getDataUrlByteSize(dataUrl: string): number {
  const base64Index = dataUrl.indexOf(",");
  if (base64Index === -1) return Buffer.byteLength(dataUrl, "utf8");
  const base64String = dataUrl.slice(base64Index + 1);
  const padding = base64String.endsWith("==") ? 2 : base64String.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64String.length * 3) / 4) - padding);
}

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
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (!currentUser.clubId && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح (يجب تسجيل الدخول)" }, { status: 401 });
    }

    // 1. فحص الدور: admin و assistant و superadmin فقط
    if (!currentUser.role || !ALLOWED_ROLES.includes(currentUser.role)) {
      return NextResponse.json({ error: "غير مصرح لك بتعديل أو رفع صور المنخرطين" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { original, cropped, thumbnail, faceDetected = false } = body;

    // 2. فحص وجود الحقول الإلزامية
    if (!cropped || !thumbnail) {
      return NextResponse.json({ error: "الصورة المقطوعة (cropped) والمصغّرة (thumbnail) مطلوبتان" }, { status: 400 });
    }

    // 3. فحص البادئة: يجب أن تبدأ بـ data:image/
    if (typeof cropped !== "string" || !cropped.startsWith("data:image/")) {
      return NextResponse.json({ error: "الصورة المقطوعة يجب أن تكون سلسلة base64 تبدأ بـ data:image/" }, { status: 400 });
    }
    if (typeof thumbnail !== "string" || !thumbnail.startsWith("data:image/")) {
      return NextResponse.json({ error: "الصورة المصغّرة يجب أن تكون سلسلة base64 تبدأ بـ data:image/" }, { status: 400 });
    }
    if (original && (typeof original !== "string" || !original.startsWith("data:image/"))) {
      return NextResponse.json({ error: "الصورة الأصلية يجب أن تكون سلسلة base64 تبدأ بـ data:image/" }, { status: 400 });
    }

    // 4. فحص حدود الحجم
    const croppedSize = getDataUrlByteSize(cropped);
    if (croppedSize > MAX_CROPPED_BYTES) {
      return NextResponse.json(
        { error: `حجم الصورة المقطوعة (${(croppedSize / 1024).toFixed(0)}KB) يتجاوز الحد الأقصى المسموح (400KB)` },
        { status: 413 }
      );
    }

    const thumbSize = getDataUrlByteSize(thumbnail);
    if (thumbSize > MAX_THUMBNAIL_BYTES) {
      return NextResponse.json(
        { error: `حجم الصورة المصغّرة (${(thumbSize / 1024).toFixed(0)}KB) يتجاوز الحد الأقصى المسموح (100KB)` },
        { status: 413 }
      );
    }

    if (original) {
      const origSize = getDataUrlByteSize(original);
      if (origSize > MAX_ORIGINAL_BYTES) {
        return NextResponse.json(
          { error: `حجم الصورة الأصلية (${(origSize / (1024 * 1024)).toFixed(1)}MB) يتجاوز الحد الأقصى المسموح (10MB)` },
          { status: 413 }
        );
      }
    }

    // 5. تحقق أن المنخرط موجود وينتمي لنادي المستخدم (superadmin يتجاوز عزل النادي)
    const sub = await db.subscriber.findUnique({
      where: { id },
      select: { id: true, clubId: true },
    });

    if (!sub) {
      return NextResponse.json({ error: "المنخرط غير موجود" }, { status: 404 });
    }

    if (currentUser.role !== "superadmin" && sub.clubId !== currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح — المنخرط تابع لنادٍ آخر" }, { status: 403 });
    }

    // 6. حفظ الصورة في جدول SubscriberPhoto (upsert)
    const existing = await db.subscriberPhoto.findUnique({ where: { subscriberId: id } });
    let photo;
    if (existing) {
      photo = await db.subscriberPhoto.update({
        where: { subscriberId: id },
        data: {
          original: original || existing.original || cropped,
          cropped,
          thumbnail,
          faceDetected: Boolean(faceDetected),
        },
      });
    } else {
      photo = await db.subscriberPhoto.create({
        data: {
          subscriberId: id,
          original: original || cropped,
          cropped,
          thumbnail,
          faceDetected: Boolean(faceDetected),
        },
      });
    }

    // 7. تحديث photoPath على المنخرط (مسار منطقي)
    await db.subscriber.update({
      where: { id },
      data: {
        photoPath: `db://${id}`,
        photoThumb: `db://${id}?size=thumbnail`,
      },
    });

    // 8. تسجيل في AuditLog
    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "subscriber_photo",
      entityId: id,
      description: `تحديث صورة المنخرط ${id}${faceDetected ? " (تم اكتشاف وجه)" : ""}`,
      metadata: { faceDetected: Boolean(faceDetected) },
    });

    return NextResponse.json({
      success: true,
      photo: { id: photo.id, faceDetected: photo.faceDetected },
    });
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
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (!currentUser.clubId && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح (يجب تسجيل الدخول)" }, { status: 401 });
    }

    if (!currentUser.role || !ALLOWED_ROLES.includes(currentUser.role)) {
      return NextResponse.json({ error: "غير مصرح لك بحذف صور المنخرطين" }, { status: 403 });
    }

    const { id } = await params;

    const sub = await db.subscriber.findUnique({
      where: { id },
      select: { id: true, clubId: true },
    });

    if (!sub) {
      return NextResponse.json({ error: "المنخرط غير موجود" }, { status: 404 });
    }

    if (currentUser.role !== "superadmin" && sub.clubId !== currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح — المنخرط تابع لنادٍ آخر" }, { status: 403 });
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
