import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * DELETE /api/pool-closures/[id]
 * يلغي إغلاقاً (مثلاً أُدخل بالخطأ). يحذف الإغلاق وكل تعويضاته التي لم تُستخدم بعد.
 * التعويضات التي أصبحت status="used" تبقى محفوظة تاريخياً ولا تُحذف.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    const closure = await db.poolClosure.findFirst({ where: { id, ...clubFilter } });
    if (!closure) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    // احذف فقط التعويضات غير المستخدمة، أبقِ المستخدَمة كسجل تاريخي واقطع ربطها بالإغلاق
    await db.compensation.deleteMany({
      where: { closureId: id, status: { in: ["pending", "scheduled", "partial", "expired"] } },
    });
    await db.compensation.updateMany({
      where: { closureId: id, status: "used" },
      data: { note: "تم إلغاء سجل الإغلاق الأصلي، هذا السجل محفوظ للأرشيف" },
    });

    // ★ سجل تدقيق: حذف الإغلاق
    await db.compensationHistory.create({
      data: {
        clubId: closure.clubId,
        closureId: closure.id,
        action: "deleted",
        description: `حذف إغلاق ${closure.date.toLocaleDateString("ar")} (${closure.reason})`,
        oldValue: JSON.stringify({ closureId: id, reason: closure.reason, date: closure.date }),
        userId: currentUser.id,
      },
    });

    await db.poolClosure.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE pool-closures/[id]:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
