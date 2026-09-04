/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — Cloudinary Integration
 * ═══════════════════════════════════════════════════════════════
 *
 *  تكامل احترافي مع Cloudinary لرفع/حذف/استبدال الصور.
 *  يستخدم متغيرات البيئة فقط — لا مفاتيح في الكود.
 *
 *  المتغيرات المطلوبة:
 *    CLOUDINARY_CLOUD_NAME
 *    CLOUDINARY_API_KEY
 *    CLOUDINARY_API_SECRET
 *
 *  المجلدات:
 *    clubs/     — شعارات النوادي
 *    members/   — صور المنخرطين
 *    coaches/   — صور المدربين
 *    logos/     — شعارات عامة
 *    documents/ — وثائق
 *    cards/     — بطاقات الانخراط
 */

import { v2 as cloudinary } from "cloudinary";

// ═══════════════════════════════════════════════════════════════
//  التهيئة — تتم مرة واحدة عند الاستيراد
// ═══════════════════════════════════════════════════════════════
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

// ═══════════════════════════════════════════════════════════════
//  الأنواع
// ═══════════════════════════════════════════════════════════════
export type CloudinaryFolder =
  | "clubs"
  | "members"
  | "coaches"
  | "logos"
  | "documents"
  | "cards";

export interface UploadResult {
  success: boolean;
  publicId?: string;
  secureUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
//  التحقق من نوع وحجم الملف
// ═══════════════════════════════════════════════════════════════
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File | Buffer, filename?: string): { valid: boolean; error?: string } {
  // فحص الحجم
  const size = file instanceof File ? file.size : (file as Buffer).length;
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `حجم الملف يتجاوز 5MB (الحجم الحالي: ${(size / 1024 / 1024).toFixed(1)}MB)` };
  }

  // فحص النوع (لـ File فقط — Buffer لا يحتوي على MIME)
  if (file instanceof File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: `نوع الملف غير مسموح: ${file.type}. المسموح: JPG, PNG, WEBP` };
    }
  }

  // فحص الامتداد (إن وُجد اسم الملف)
  if (filename) {
    const ext = "." + (filename.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { valid: false, error: `امتداد غير مسموح: ${ext}` };
    }
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
//  توليد معرّف فريد للملف
// ═══════════════════════════════════════════════════════════════
function generatePublicId(folder: CloudinaryFolder, prefix = ""): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${folder}/${prefix}${timestamp}-${random}`;
}

// ═══════════════════════════════════════════════════════════════
//  1) uploadImage — رفع صورة عامة
// ═══════════════════════════════════════════════════════════════
export async function uploadImage(
  file: File | Buffer | string,
  folder: CloudinaryFolder,
  options?: { publicId?: string; transformation?: string; prefix?: string }
): Promise<UploadResult> {
  try {
    // تحقق من التهيئة
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return { success: false, error: "Cloudinary غير مهيّأ — متغيرات البيئة ناقصة" };
    }

    // تحويل File إلى Buffer
    let buffer: Buffer;
    let filename: string | undefined;

    if (file instanceof File) {
      filename = file.name;
      const validation = validateImageFile(file, filename);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (typeof file === "string") {
      // data URL أو مسار ملف
      if (file.startsWith("data:")) {
        const base64 = file.split(",")[1];
        buffer = Buffer.from(base64, "base64");
      } else {
        return { success: false, error: "نوع الإدخال غير مدعوم" };
      }
    } else {
      // Buffer
      buffer = file;
    }

    const publicId = options?.publicId || generatePublicId(folder, options?.prefix || "");

    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${buffer.toString("base64")}`,
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        overwrite: true,
        // تحويلات افتراضية: ضغط + تحسين
        transformation: options?.transformation
          ? [{ raw_transformation: options.transformation }]
          : [{ quality: "auto:best" }, { fetch_format: "auto" }],
      }
    );

    return {
      success: true,
      publicId: result.public_id,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (e) {
    console.error("[Cloudinary] upload error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "فشل رفع الصورة",
    };
  }
}

// ═══════════════════════════════════════════════════════════════
//  2) uploadMemberPhoto — رفع صورة منخرط
// ═══════════════════════════════════════════════════════════════
export async function uploadMemberPhoto(
  file: File | Buffer | string,
  subscriberId: string
): Promise<UploadResult> {
  return uploadImage(file, "members", {
    prefix: `sub-${subscriberId}-`,
    transformation: "w_600,h_600,c_fill,g_face,q_auto:best",
  });
}

// ═══════════════════════════════════════════════════════════════
//  3) uploadClubLogo — رفع شعار نادي
// ═══════════════════════════════════════════════════════════════
export async function uploadClubLogo(
  file: File | Buffer | string,
  clubId: string
): Promise<UploadResult> {
  return uploadImage(file, "clubs", {
    prefix: `club-${clubId}-`,
    transformation: "w_400,h_400,c_pad,b_white,q_auto:best",
  });
}

// ═══════════════════════════════════════════════════════════════
//  4) uploadCoachPhoto — رفع صورة مدرب
// ═══════════════════════════════════════════════════════════════
export async function uploadCoachPhoto(
  file: File | Buffer | string,
  coachId: string
): Promise<UploadResult> {
  return uploadImage(file, "coaches", {
    prefix: `coach-${coachId}-`,
    transformation: "w_400,h_400,c_fill,g_face,q_auto:best",
  });
}

// ═══════════════════════════════════════════════════════════════
//  5) uploadCardImage — رفع صورة بطاقة
// ═══════════════════════════════════════════════════════════════
export async function uploadCardImage(
  file: File | Buffer | string,
  cardId: string
): Promise<UploadResult> {
  return uploadImage(file, "cards", {
    prefix: `card-${cardId}-`,
    transformation: "w_1024,h_638,c_fill,q_auto:best",
  });
}

// ═══════════════════════════════════════════════════════════════
//  6) deleteImage — حذف صورة من Cloudinary
// ═══════════════════════════════════════════════════════════════
export async function deleteImage(publicId: string): Promise<DeleteResult> {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return { success: false, error: "Cloudinary غير مهيّأ" };
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    if (result.result === "ok" || result.result === "not found") {
      return { success: true };
    }

    return { success: false, error: `نتيجة غير متوقعة: ${result.result}` };
  } catch (e) {
    console.error("[Cloudinary] delete error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "فشل حذف الصورة",
    };
  }
}

// ═══════════════════════════════════════════════════════════════
//  7) replaceImage — استبدال صورة (حذف القديمة + رفع الجديدة)
// ═══════════════════════════════════════════════════════════════
export async function replaceImage(
  oldPublicId: string | null,
  newFile: File | Buffer | string,
  folder: CloudinaryFolder,
  options?: { prefix?: string; transformation?: string }
): Promise<UploadResult> {
  try {
    // 1) ارفع الصورة الجديدة أولاً (لتجنب فقدان الصورة إذا فشل الحذف)
    const uploadResult = await uploadImage(newFile, folder, options);

    if (!uploadResult.success) {
      return uploadResult;
    }

    // 2) احذف الصورة القديمة (best-effort — لا نفشل إذا لم تُحذف)
    if (oldPublicId) {
      const deleteResult = await deleteImage(oldPublicId);
      if (!deleteResult.success) {
        console.warn(`[Cloudinary] فشل حذف الصورة القديمة (${oldPublicId}):`, deleteResult.error);
        // لا نرجع خطأ — الصورة الجديدة رُفعت بنجاح
      }
    }

    return uploadResult;
  } catch (e) {
    console.error("[Cloudinary] replace error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "فشل استبدال الصورة",
    };
  }
}

// ═══════════════════════════════════════════════════════════════
//  8) getOptimizedUrl — توليد رابط محسّن للعرض
// ═══════════════════════════════════════════════════════════════
export function getOptimizedUrl(
  publicId: string,
  options?: { width?: number; height?: number; crop?: string; quality?: string }
): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "g70oqded";
  const w = options?.width || 400;
  const h = options?.height || 400;
  const crop = options?.crop || "fill";
  const quality = options?.quality || "auto:best";

  return `https://res.cloudinary.com/${cloudName}/image/upload/c_${crop},g_face,w_${w},h_${h},q_${quality}/${publicId}`;
}

// ═══════════════════════════════════════════════════════════════
//  9) isConfigured — تحقق من التهيئة
// ═══════════════════════════════════════════════════════════════
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}
