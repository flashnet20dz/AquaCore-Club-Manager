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
    const [subscribers, attendances, renewals, payments] = await Promise.all([
      db.subscriber.findMany({ where: clubFilter, orderBy: { createdAt: "asc" } }),
      db.attendance.findMany({ where: clubFilter, take: 1000, orderBy: { date: "desc" } }),
      db.renewal.findMany({ where: clubFilter, orderBy: { createdAt: "desc" } }),
      db.payment.findMany({ where: clubFilter, orderBy: { date: "desc" } }),
    ]);

    // Revenue evolution (last 6 months)
    const months: { label: string; revenue: number; subscribers: number }[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const next = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const monthSubs = subscribers.filter((s) => {
        const cd = new Date(s.createdAt);
        return cd >= d && cd < next;
      });
      const monthRens = renewals.filter((r) => {
        const rd = new Date(r.renewalDate);
        return rd >= d && rd < next;
      });
      const revenue = monthRens.reduce((sum, r) => sum + r.amount, 0);
      months.push({
        label: d.toLocaleDateString("ar-DZ", { month: "short" }),
        revenue,
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

    // Revenue by subscription type — ديناميكي
    const revenueByType = dbSubTypes.map((t) => {
      const subs = computed.filter((s) => s.subscriptionType === t.code && s.totalAmount !== null);
      return {
        name: t.name === t.code ? t.name : `${t.name} (${t.code})`,
        revenue: subs.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0),
      };
    }).filter((d) => d.revenue > 0);

    return NextResponse.json({
      revenueEvolution: months,
      attendanceTrend,
      ageGroups,
      subTypeData,
      payStatusData,
      revenueByType,
      totals: {
        subscribers: subscribers.length,
        revenue: computed.reduce((s, x) => s + (x.totalAmount ?? 0), 0),
        attendance: attendances.length,
        renewals: renewals.length,
      },
    });
  } catch (e) {
    console.error("Analytics:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
