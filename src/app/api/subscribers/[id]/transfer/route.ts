import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";
import { transferSubscriberService } from "@/lib/multi-pool";

/**
 * POST /api/subscribers/[id]/transfer
 * نقل منخرط من مسبح إلى مسبح آخر داخل النادي نفسه عبر transferSubscriberService
 * Body: { sourcePoolId, targetPoolId, keepFileNumber: boolean, customFileNumber?: string, reason?: string }
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
    const clubId = currentUser.clubId;
    const { id: subscriberId } = await params;

    const body = await req.json();
    const { sourcePoolId, targetPoolId, keepFileNumber, customFileNumber, reason } = body;

    if (!sourcePoolId || !targetPoolId) {
      return NextResponse.json({ error: "المسبح الحالي والمسبح الجديد مطلوبان" }, { status: 400 });
    }
    if (sourcePoolId === targetPoolId) {
      return NextResponse.json({ error: "لا يمكن النقل إلى نفس المسبح الحالي" }, { status: 400 });
    }

    const transferResult = await transferSubscriberService({
      clubId,
      subscriberId,
      sourcePoolId,
      targetPoolId,
      keepFileNumber: Boolean(keepFileNumber),
      customFileNumber: customFileNumber || null,
      transferredById: currentUser.id,
      reason: reason || "نقل إداري بين المسابح",
    });

    await auditLogWithRequest(req, currentUser, {
      action: "transfer",
      entityType: "Subscriber",
      entityId: subscriberId,
      description: `نقل المنخرط بين المسابح: من ${sourcePoolId} إلى ${targetPoolId} برقم الملف ${transferResult.newFileNumber}`,
    });

    return NextResponse.json({
      message: "تم نقل المنخرط بنجاح",
      transfer: transferResult.transferLog,
      enrollment: transferResult.targetEnrollment,
      card: transferResult.newCard,
      oldFileNumber: transferResult.oldFileNumber,
      newFileNumber: transferResult.newFileNumber,
    });
  } catch (error: any) {
    console.error("POST /api/subscribers/[id]/transfer error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
