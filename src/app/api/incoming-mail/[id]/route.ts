import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/roles";

/**
 * GET /api/incoming-mail/[id]
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasPermission(user.role, "incomingMail")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const { id } = await params;
    const mail = await db.incomingMail.findFirst({
      where: { id, clubId: user.clubId },
    });

    if (!mail) {
      return NextResponse.json({ error: "سجل الوارد غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ mail });
  } catch (error) {
    console.error("Error in GET /api/incoming-mail/[id]:", error);
    return NextResponse.json({ error: "فشل في جلب تفاصيل الوارد" }, { status: 500 });
  }
}

/**
 * PATCH /api/incoming-mail/[id]
 * تحديث بيانات أو حالة الوارد
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasPermission(user.role, "incomingMail")) {
      return NextResponse.json({ error: "غير مصرح لك بالتعديل" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await db.incomingMail.findFirst({
      where: { id, clubId: user.clubId },
    });

    if (!existing) {
      return NextResponse.json({ error: "سجل الوارد غير موجود" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.receivedDate) updateData.receivedDate = new Date(body.receivedDate);
    if (body.letterNumber !== undefined) updateData.letterNumber = body.letterNumber;
    if (body.letterDate) updateData.letterDate = new Date(body.letterDate);
    if (body.sender !== undefined) updateData.sender = body.sender;
    if (body.senderType !== undefined) updateData.senderType = body.senderType;
    if (body.subject !== undefined) updateData.subject = body.subject;
    if (body.documentType !== undefined) updateData.documentType = body.documentType;
    if (body.urgency !== undefined) updateData.urgency = body.urgency;
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo;
    if (body.deliveryMethod !== undefined) updateData.deliveryMethod = body.deliveryMethod;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.attachmentUrl !== undefined) updateData.attachmentUrl = body.attachmentUrl;
    if (body.attachmentName !== undefined) updateData.attachmentName = body.attachmentName;

    // معالجة دورة حياة الحالة
    if (body.status !== undefined && body.status !== existing.status) {
      updateData.status = body.status;
      if (body.status === "referred") {
        updateData.referralDate = body.referralDate ? new Date(body.referralDate) : new Date();
      } else if (body.status === "completed") {
        updateData.processedDate = body.processedDate ? new Date(body.processedDate) : new Date();
      }
    }

    const updated = await db.incomingMail.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ mail: updated, success: true });
  } catch (error) {
    console.error("Error in PATCH /api/incoming-mail/[id]:", error);
    return NextResponse.json({ error: "فشل في تحديث الوارد" }, { status: 500 });
  }
}

/**
 * DELETE /api/incoming-mail/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !["admin", "superadmin"].includes(user.role)) {
      return NextResponse.json({ error: "غير مصرح لك بحذف هذا السجل" }, { status: 403 });
    }

    const { id } = await params;
    await db.incomingMail.deleteMany({
      where: { id, clubId: user.clubId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/incoming-mail/[id]:", error);
    return NextResponse.json({ error: "فشل في حذف سجل الوارد" }, { status: 500 });
  }
}
