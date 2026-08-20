import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { verifyCode, PLANS } from "@/lib/activation-codes";
import crypto from "crypto";

/**
 * POST /api/activation-codes/verify
 * SuperAdmin: يتحقق من صحة كود تفعيل ويعرض حالته الكاملة.
 *
 * Body: { code: string }
 * Returns:
 *   { valid: boolean, plan?, durationDays?, status?, club?, activatedAt?, expiresAt?, error? }
 *
 * يستخدم هذا الـ endpoint لـ:
 *   - التحقق من التوقيع (HMAC)
 *   - معرفة ما إذا كان الكود مسجّلاً في DB
 *   - معرفة حالة الكود (unused/used/revoked)
 *   - معرفة النادي الذي استخدمه (إن كان مستخدماً)
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح — هذه العملية للسوبر أدمن فقط" }, { status: 403 });
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({
        valid: false,
        error: "الكود مطلوب",
      }, { status: 400 });
    }

    // ════ الخطوة 1: التحقق المحلي من التوقيع (HMAC) ════
    const verification = verifyCode(code);
    if (!verification.valid) {
      return NextResponse.json({
        valid: false,
        verified: false,
        error: verification.error || "كود غير صالح",
        code: code.toUpperCase(),
      });
    }

    const planDef = verification.plan ? PLANS[verification.plan] : null;

    // ════ الخطوة 2: البحث في DB ════
    const codeHash = crypto.createHash("sha256").update(code.toUpperCase().replace(/\s+/g, "")).digest("hex");
    const dbCode = await db.activationCode.findUnique({
      where: { codeHash },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            managerName: true,
            email: true,
          },
        },
        batch: {
          select: { id: true, batchNo: true, name: true },
        },
      },
    });

    if (!dbCode) {
      // التوقيع صحيح لكن الكود غير مسجّل في DB
      return NextResponse.json({
        valid: true,
        verified: true,
        inDatabase: false,
        plan: verification.plan,
        planLabel: planDef?.label,
        durationDays: verification.durationDays,
        error: "الكود صالح رياضياً (التوقيع صحيح) لكنه غير مسجّل في قاعدة البيانات.",
        code: code.toUpperCase(),
      });
    }

    // ════ الخطوة 3: إرجاع التفاصيل الكاملة ════
    const statusLabels: Record<string, string> = {
      unused: "غير مستخدم (متاح للتفعيل)",
      used: "مستخدم (مفعّل)",
      revoked: "ملغى من الإدارة",
    };

    return NextResponse.json({
      valid: true,
      verified: true,
      inDatabase: true,
      code: code.toUpperCase(),
      plan: verification.plan,
      planLabel: planDef?.label,
      durationDays: verification.durationDays,
      status: dbCode.status,
      statusLabel: statusLabels[dbCode.status] || dbCode.status,
      club: dbCode.club ? {
        id: dbCode.club.id,
        name: dbCode.club.name,
        manager: dbCode.club.managerName,
        email: dbCode.club.email,
      } : null,
      batch: dbCode.batch ? {
        id: dbCode.batch.id,
        batchNo: dbCode.batch.batchNo,
        name: dbCode.batch.name,
      } : null,
      activatedAt: dbCode.activatedAt,
      expiresAt: dbCode.expiresAt,
      canBeActivated: dbCode.status === "unused",
      message: dbCode.status === "unused"
        ? "✓ الكود صالح ومتاح للتفعيل على أي نادٍ"
        : dbCode.status === "used"
        ? `الكود مُفعّل على نادي "${dbCode.club?.name || "غير معروف"}" — لا يمكن إعادة استخدامه على نادٍ آخر`
        : "✗ الكود ملغى من الإدارة — لا يمكن تفعيله",
    });
  } catch (e) {
    console.error("Verify activation code error:", e);
    return NextResponse.json({
      valid: false,
      error: "فشل التحقق: " + (e instanceof Error ? e.message : "خطأ غير متوقع"),
    }, { status: 500 });
  }
}
