import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { startTrial } from "@/lib/subscription-state";

/**
 * PATCH /api/clubs/[id] — SuperAdmin: update club status
 * Body: { status: "active"|"disabled"|"suspended"|"expired" }
 * Body: { action: "approve"|"reject" }
 * Body: { name, city, country, managerName, phone, email } — edit club info
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Approve club — التجربة المجانية بدأت أصلاً عند التسجيل، هنا فقط
    // نفعّل حالة النادي. لو (لأي سبب) ما كانت التجربة مضبوطة من قبل
    // (نوادٍ قديمة قبل هذا التعديل)، نبدأها الآن كحل احتياطي.
    if (body.action === "approve") {
      const now = new Date();
      const existingClub = await db.club.findUnique({ where: { id } });
      const needsTrialFallback = !existingClub?.trialStartedAt && !existingClub?.subscriptionEndDate;
      const trial = needsTrialFallback ? startTrial(now, 7) : null;

      const club = await db.club.update({
        where: { id },
        data: {
          status: "active",
          ...(trial ? { trialStartedAt: trial.trialStartedAt, trialEndDate: trial.trialEndDate } : {}),
        },
      });

      await db.activity.create({
        data: {
          clubId: club.id,
          type: "create",
          description: trial
            ? `تمت الموافقة على النادي — بدأت فترة تجربة مجانية لمدة 7 أيام (تنتهي في ${trial.trialEndDate.toLocaleDateString("ar-DZ")})`
            : `تمت الموافقة على النادي`,
        },
      }).catch(() => {/* تجاهل إن لم يُنشأ */});

      // Update request status
      await db.clubRequest.updateMany({
        where: { clubId: club.id, status: "pending" },
        data: { status: "approved", reviewedBy: currentUser.id, reviewedAt: now },
      });

      return NextResponse.json({
        success: true,
        club,
        trial: club.trialEndDate ? {
          startedAt: club.trialStartedAt,
          endDate: club.trialEndDate,
        } : null,
      });
    }

    // Reject club
    if (body.action === "reject") {
      await db.club.update({ where: { id }, data: { status: "disabled" } });
      await db.clubRequest.updateMany({
        where: { clubId: id, status: "pending" },
        data: { status: "rejected", reviewedBy: currentUser.id, reviewedAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    // Update club status
    if (body.status) {
      const club = await db.club.update({ where: { id }, data: { status: body.status } });
      return NextResponse.json({ success: true, club });
    }

    // Edit club info
    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.city) updateData.city = body.city;
    if (body.country) updateData.country = body.country;
    if (body.managerName) updateData.managerName = body.managerName;
    if (body.phone) updateData.phone = body.phone;
    if (body.email) updateData.email = body.email.toLowerCase().trim();

    if (Object.keys(updateData).length > 0) {
      const club = await db.club.update({ where: { id }, data: updateData });
      return NextResponse.json({ success: true, club });
    }

    return NextResponse.json({ error: "لا توجد بيانات للتحديث" }, { status: 400 });
  } catch (e) {
    console.error("PATCH club:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/**
 * DELETE /api/clubs/[id] — SuperAdmin: delete club
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    await db.club.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE club:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
