import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import ZAI from "z-ai-web-dev-sdk";

/**
 * POST /api/ai/insights
 * المساعد الذكي — يحلل مؤشرات النادي ويعيد توصيات عملية بالعربية.
 * يعمل بالكامل في الخادم (z-ai-web-dev-sdk ممنوع في العميل).
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const rl = rateLimit(`ai-insights:${getClientIp(req)}`, { max: 5, windowMs: 60 * 1000, lockoutMs: 60 * 1000 });
    if (rl.blocked) {
      return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة ثم أعد المحاولة" }, { status: 429 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const clubId = currentUser.clubId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 86400000;

    // ─── جمع المؤشرات (خفيفة وكافية) ───
    const [totalSubs, paidSubs, unpaidSubs] = await Promise.all([
      db.subscriber.count({ where: { ...clubFilter, deletedAt: null } }),
      db.subscriber.count({ where: { ...clubFilter, deletedAt: null, paymentStatus: "مدفوع" } }),
      db.subscriber.count({ where: { ...clubFilter, deletedAt: null, paymentStatus: "لم يدفع" } }),
    ]);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const [monthRev, prevRev] = await Promise.all([
      db.payment.aggregate({ where: { ...(clubId ? { clubId } : {}), status: { not: "cancelled" }, date: { gte: monthStart } }, _sum: { amount: true } }),
      db.payment.aggregate({ where: { ...(clubId ? { clubId } : {}), status: { not: "cancelled" }, date: { gte: prevMonthStart, lt: monthStart } }, _sum: { amount: true } }),
    ]);

    const weekAgo = new Date(today.getTime() - 7 * dayMs);
    const twoWeeksAgo = new Date(today.getTime() - 14 * dayMs);
    const [attThisWeek, attPrevWeek] = await Promise.all([
      db.attendance.count({ where: { ...(clubId ? { clubId } : {}), date: { gte: weekAgo } } }),
      db.attendance.count({ where: { ...(clubId ? { clubId } : {}), date: { gte: twoWeeksAgo, lt: weekAgo } } }),
    ]);

    // منخرطون غائبون ≥21 يوماً
    const since120 = new Date(today.getTime() - 120 * dayMs);
    const lastAtt = await db.attendance.groupBy({
      by: ["subscriberId"],
      where: { ...(clubId ? { clubId } : {}), date: { gte: since120 } },
      _max: { date: true },
    });
    const lastAttMap = new Map(lastAtt.map((r) => [r.subscriberId, r._max.date]));
    const activeSubs = await db.subscriber.findMany({
      where: { ...clubFilter, deletedAt: null },
      select: { id: true },
    });
    let churnCount = 0;
    for (const s of activeSubs) {
      const last = lastAttMap.get(s.id);
      const days = last ? Math.floor((today.getTime() - new Date(last).getTime()) / dayMs) : 999;
      if (days >= 21) churnCount++;
    }

    // أكثر نوع اشتراك
    const byType = await db.subscriber.groupBy({
      by: ["subscriptionType"],
      where: { ...clubFilter, deletedAt: null },
      _count: { _all: true },
      orderBy: { _count: { subscriptionType: "desc" } },
      take: 1,
    });

    const metrics = {
      إجمالي_المنخرطين: totalSubs,
      مدفوعون: paidSubs,
      غير_مدفوعين: unpaidSubs,
      إيراد_هذا_الشهر_دج: monthRev._sum.amount || 0,
      إيراد_الشهر_الماضي_دج: prevRev._sum.amount || 0,
      حضور_هذا_الأسبوع: attThisWeek,
      حضور_الأسبوع_الماضي: attPrevWeek,
      منخرطون_غائبون_21يوم_أو_أكثر: churnCount,
      أكثر_نوع_اشتراك: byType[0]?.subscriptionType || "—",
      أكثر_نوع_عدد: byType[0]?._count._all || 0,
    };

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            "أنت مدير نجاح عملاء خبير في إدارة نوادي السباحة بالجزائر. تحلل مؤشرات النادي وتقدم نصائح عملية مختصرة بالعربية الفصحى المبسطة. أسلوبك: مباشر، ودود، بلا مقدمات، بلا عناوين كبيرة. اكتب: سطران للملخص، ثم 3 توصيات مرقمة قابلة للتنفيذ اليوم، كل توصية سطر واحد محدد. لا تتجاوز 130 كلمة. الأرقام بالدينار الجزائري (دج).",
        },
        {
          role: "user",
          content: `مؤشرات النادي هذا الأسبوع:\n${JSON.stringify(metrics, null, 2)}\n\nقدم التحليل والتوصيات.`,
        },
      ],
      thinking: { type: "disabled" },
    });

    const insights = completion.choices[0]?.message?.content;
    if (!insights || !insights.trim()) {
      return NextResponse.json({ error: "لم يصل رد من المحلل — أعد المحاولة" }, { status: 502 });
    }

    return NextResponse.json({ insights, metrics });
  } catch (e) {
    console.error("POST ai/insights:", e);
    return NextResponse.json({ error: "تعذر التحليل حالياً — أعد المحاولة لاحقاً" }, { status: 500 });
  }
}
