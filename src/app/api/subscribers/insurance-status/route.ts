import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/subscribers/insurance-status
 *
 * يعيد معرّفات كل المنخرطين المؤمَّنين (لديهم دفعة تأمين) — بلا أي حد عددي.
 *
 * ★ سبب وجود هذا المسار: كانت اللوحة تبني حالة التأمين من /api/payments
 *   الذي يرجع آخر 100 دفعة فقط (take: 100) — فبعد تأمين أكثر من 100 منخرط
 *   كان الباقون يظهرون "غير مؤمنين" بعد تحديث الصفحة رغم تأمينهم فعلياً.
 *   هنا نرجع المعرّفات فقط (حمولة خفيفة) لكل النادي دون take.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["admin", "assistant", "superadmin"].includes(user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubFilter = user.role === "superadmin" ? {} : { clubId: user.clubId! };

    const rows = await db.payment.findMany({
      where: { category: "insurance", subscriberId: { not: null }, ...clubFilter },
      select: { subscriberId: true },
    });

    // إزالة التكرار (منخرط قد يكون له أكثر من دفعة تأمين تاريخياً)
    const insuredIds = [...new Set(rows.map((r) => r.subscriberId).filter((x): x is string => Boolean(x)))];

    return NextResponse.json({ insuredIds, count: insuredIds.length });
  } catch (e) {
    console.error("GET insurance-status:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
