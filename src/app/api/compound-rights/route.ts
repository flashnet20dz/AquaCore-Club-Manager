import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  fetchCompoundList,
  getCompoundPeriod,
  loadClubLogos,
  formatDateDMY,
} from "@/lib/compound-list";

/**
 * GET /api/compound-rights?year=2026&month=8
 *
 * قائمة المنخرطين الذين دفعوا حقوق المركب خلال الشهر المحدد.
 * ★ الفترة الرسمية للنادي (مطابقة للوثيقة الرسمية):
 *   الشهر المحدد "أغسطس 2026" ← الفترة من 29/07/2026 إلى غاية 28/08/2026
 *
 * المصادر (مدمجة دون تكرار):
 * - تسجيل جديد: Subscriber.lastPaymentDate ضمن الفترة + نوع اشتراك مؤهل (1300/1500)
 * - تجديد: Renewal.renewalDate ضمن الفترة + مبلغ 1300/1500
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));
    const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));

    // superadmin: يستخدم clubId من query أو كل النوادي
    const clubId = currentUser.role === "superadmin"
      ? (url.searchParams.get("clubId") || undefined)
      : currentUser.clubId;

    // ★ مصدر واحد للحقيقة: نفس المنطق المستعمل في التصدير تماماً
    const result = await fetchCompoundList(clubId, year, month);

    // بيانات الترويسة الرسمية (شعارات النادي) + الفترة منسّقة للعرض
    const logos = await loadClubLogos(currentUser.clubId);
    const { start, end } = getCompoundPeriod(year, month);

    return NextResponse.json({
      ...result,
      periodLabel: {
        from: formatDateDMY(start),
        to: formatDateDMY(end),
      },
      enteteLogos: logos,
    });
  } catch (e) {
    console.error("GET compound-rights error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
