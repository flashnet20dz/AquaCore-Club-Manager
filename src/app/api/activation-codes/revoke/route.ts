import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * POST /api/activation-codes/revoke
 * SuperAdmin: يلغي كوداً (حتى لو مستخدم) لمنع استخدامه مستقبلاً.
 * Body: { codeId: string, reason?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { codeId, reason } = body;

    if (!codeId) {
      return NextResponse.json({ error: "codeId مطلوب" }, { status: 400 });
    }

    const code = await db.activationCode.findUnique({
      where: { id: codeId },
      include: { club: { select: { name: true } } },
    });

    if (!code) {
      return NextResponse.json({ error: "الكود غير موجود" }, { status: 404 });
    }

    if (code.status === "revoked") {
      return NextResponse.json({ error: "الكود ملغى مسبقاً" }, { status: 400 });
    }

    await db.activationCode.update({
      where: { id: codeId },
      data: {
        status: "revoked",
        revokedAt: new Date(),
        revokedReason: reason || "إلغاء يدوي من السوبر أدمن",
      },
    });

    return NextResponse.json({
      success: true,
      message: `تم إلغاء الكود ${code.code.substring(0, 14)}...`,
      revoked: {
        codeId,
        previousStatus: code.status,
        club: code.club?.name || null,
      },
    });
  } catch (e) {
    console.error("Revoke code error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
