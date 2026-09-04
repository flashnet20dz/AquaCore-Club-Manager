import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateExpiryDate } from "@/lib/rcs";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/subscribers/alerts
 * Returns:
 *  - expiringSoon: subscribers whose subscription expires within N days (default 7)
 *  - absent3Weeks: subscribers who haven't attended in 3 weeks
 *  - expired: subscribers whose subscription has expired
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const subscribers = await db.subscriber.findMany({
      where: { ...clubFilter, paymentStatus: { not: "لم يدفع" } },
      include: {
        attendances: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const expiringSoon: Array<{
      id: string;
      fileNumber: string;
      lastName: string;
      firstName: string;
      phone: string | null;
      expiryDate: Date | null;
      daysLeft: number;
    }> = [];
    const expired: Array<{
      id: string;
      fileNumber: string;
      lastName: string;
      firstName: string;
      phone: string | null;
      expiryDate: Date | null;
      daysOver: number;
    }> = [];
    const absent3Weeks: Array<{
      id: string;
      fileNumber: string;
      lastName: string;
      firstName: string;
      phone: string | null;
      lastVisit: Date | null;
      weeksAbsent: number;
    }> = [];

    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

    for (const sub of subscribers) {
      const expiry = calculateExpiryDate(sub.lastPaymentDate);
      if (expiry) {
        const diffMs = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          expired.push({
            id: sub.id,
            fileNumber: sub.fileNumber,
            lastName: sub.lastName,
            firstName: sub.firstName,
            phone: sub.phone,
            expiryDate: expiry,
            daysOver: Math.abs(diffDays),
          });
        } else if (diffDays <= 7) {
          expiringSoon.push({
            id: sub.id,
            fileNumber: sub.fileNumber,
            lastName: sub.lastName,
            firstName: sub.firstName,
            phone: sub.phone,
            expiryDate: expiry,
            daysLeft: diffDays,
          });
        }
      }

      // Check absence: if last attendance was >3 weeks ago (or never attended)
      const lastAtt = sub.attendances[0]?.date;
      if (!lastAtt || new Date(lastAtt) < threeWeeksAgo) {
        const weeks = lastAtt
          ? Math.floor((now.getTime() - new Date(lastAtt).getTime()) / (7 * 24 * 60 * 60 * 1000))
          : 99;
        absent3Weeks.push({
          id: sub.id,
          fileNumber: sub.fileNumber,
          lastName: sub.lastName,
          firstName: sub.firstName,
          phone: sub.phone,
          lastVisit: lastAtt,
          weeksAbsent: weeks,
        });
      }
    }

    return NextResponse.json({
      expiringSoon,
      expired,
      absent3Weeks,
      counts: {
        expiringSoon: expiringSoon.length,
        expired: expired.length,
        absent3Weeks: absent3Weeks.length,
      },
    });
  } catch (e) {
    console.error("GET alerts:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
