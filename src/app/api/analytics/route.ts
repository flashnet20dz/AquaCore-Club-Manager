import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeSubscriberFields } from "@/lib/rcs";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const [subscribers, attendances, renewals, ledgerIncome, ledgerTotalAgg] = await Promise.all([
      db.subscriber.findMany({ where: clubFilter, orderBy: { createdAt: "asc" } }),
      db.attendance.findMany({ where: clubFilter, take: 1000, orderBy: { date: "desc" } }),
      db.renewal.findMany({ where: clubFilter, orderBy: { createdAt: "desc" } }),
      // ★ المرحلة 3: المال من دفتر FinancialTransaction حصراً (النشط فقط) —
      // نفس مصدر المركز المالي ولوحة التحكم والتقارير. لا حساب من Renewal/Payment/Subscriber.
      db.financialTransaction.findMany({
        where: { ...clubFilter, status: "active", type: "income", date: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) } },
        select: { amount: true, date: true, subscriberId: true },
      }),
      db.financialTransaction.aggregate({ where: { ...clubFilter, status: "active", type: "income" }, _sum: { amount: true } }),
    ]);

    // Revenue evolution (last 6 months) — الإيراد من الدفتر (المرحلة 3)
    const today = new Date();
    const revBuckets = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const bd = new Date(today.getFullYear(), today.getMonth() - i, 1);
      revBuckets.set(`${bd.getFullYear()}-${bd.getMonth()}`, 0);
    }
    for (const t of ledgerIncome) {
      const td = new Date(t.date);
      const bk = `${td.getFullYear()}-${td.getMonth()}`;
      if (revBuckets.has(bk)) revBuckets.set(bk, (revBuckets.get(bk) || 0) + t.amount);
    }
    const months: { label: string; revenue: number; subscribers: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const next = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const monthSubs = subscribers.filter((s) => {
        const cd = new Date(s.createdAt);
        return cd >= d && cd < next;
      });
      months.push({
        label: d.toLocaleDateString("ar-DZ", { month: "short" }),
        revenue: revBuckets.get(`${d.getFullYear()}-${d.getMonth()}`) || 0,
        subscribers: monthSubs.length,
      });
    }

    // Attendance trend (last 14 days)
    const attendanceTrend: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const count = attendances.filter((a) => {
        const ad = new Date(a.date);
        return ad >= d && ad < next;
      }).length;
      attendanceTrend.push({
        date: d.toLocaleDateString("ar-DZ", { day: "numeric", month: "numeric" }),
        count,
      });
    }

    // Age distribution — 4 official categories (strict 13 cutoff by gender)
    const computed = subscribers.map((s) => ({ ...s, ...computeSubscriberFields(s) }));
    const ageGroups = [
      { label: "ذكور <13", count: computed.filter((s) => s.gender === "ذكر" && s.age < 13).length, color: "#0ea5e9" },
      { label: "إناث <13", count: computed.filter((s) => s.gender === "أنثى" && s.age < 13).length, color: "#ec4899" },
      { label: "ذكور 13+", count: computed.filter((s) => s.gender === "ذكر" && s.age >= 13).length, color: "#6366f1" },
      { label: "إناث 13+", count: computed.filter((s) => s.gender === "أنثى" && s.age >= 13).length, color: "#a855f7" },
    ];

    // Subscription type distribution — ديناميكي من قاعدة البيانات
    const dbSubTypes = await db.subscriptionType.findMany({
      where: { clubId: currentUser.clubId!, active: true },
      select: { code: true, name: true },
      orderBy: { sortOrder: "asc" },
    });
    const subTypeData = dbSubTypes.map((t) => ({
      name: t.name === t.code ? t.name : `${t.name} (${t.code})`,
      value: subscribers.filter((s) => s.subscriptionType === t.code).length,
    }));

    // Payment status distribution
    const payStatuses = ["مدفوع", "لم يدفع", "تأمين فقط", "اشتراك 300"];
    const payStatusData = payStatuses.map((p) => ({
      name: p,
      value: subscribers.filter((s) => s.paymentStatus === p).length,
      color: p === "مدفوع" ? "#10b981" : p === "لم يدفع" ? "#ef4444" : p === "تأمين فقط" ? "#0ea5e9" : "#f59e0b",
    }));

    // Revenue by subscription type — ★ من الدفتر عبر subscriberId (المرحلة 3):
    // قيود الدخل النشطة تُجمع حسب نوع اشتراك المنخرط المرتبط بها،
    // والقيود اليدوية بلا منخرط تذهب إلى «مداخل أخرى». صفر حساب من Subscriber.
    const revSubIds = [...new Set(ledgerIncome.map((t) => t.subscriberId).filter((x): x is string => Boolean(x)))];
    const revSubTypes = revSubIds.length
      ? await db.subscriber.findMany({ where: { id: { in: revSubIds } }, select: { id: true, subscriptionType: true } })
      : [];
    const revTypeById = new Map(revSubTypes.map((r) => [r.id, r.subscriptionType]));
    const typeAgg = new Map<string, number>();
    for (const t of ledgerIncome) {
      const code = t.subscriberId ? revTypeById.get(t.subscriberId) : undefined;
      const conf = code ? dbSubTypes.find((x) => x.code === code) : undefined;
      const label = conf ? (conf.name === conf.code ? conf.name : `${conf.name} (${conf.code})`) : "مداخل أخرى";
      typeAgg.set(label, (typeAgg.get(label) || 0) + t.amount);
    }
    const revenueByType = Array.from(typeAgg.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .filter((d) => d.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      revenueEvolution: months,
      attendanceTrend,
      ageGroups,
      subTypeData,
      payStatusData,
      revenueByType,
      totals: {
        subscribers: subscribers.length,
        // ★ إجمالي الإيرادات من الدفتر (كل العمر، النشط) — نفس رقم المركز المالي
        revenue: ledgerTotalAgg._sum.amount || 0,
        attendance: attendances.length,
        renewals: renewals.length,
      },
    });
  } catch (e) {
    console.error("Analytics:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
