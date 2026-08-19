import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { normalizePaymentStatus, isExemptStatus } from "@/lib/rcs";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const subscriberId = url.searchParams.get("subscriberId");

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (subscriberId) where.subscriberId = subscriberId;

    const renewals = await db.renewal.findMany({
      where,
      include: { subscriber: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ renewals });
  } catch (e) {
    console.error("GET renewals:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// ═══ Helper: parse a manual date string (YYYY/MM/DD or YYYY-MM-DD) ═══
// Returns Date | null.
function parseManualDate(value: string): Date | null {
  if (!value) return null;
  const normalized = value.trim().replace(/[-.]/g, "/");
  const m = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  if (y < 1900 || y > 2100) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { subscriberId, months, amount, paymentStatus, note, renewalDate: renewalDateInput } = body;

    // ★ EXEMPT renewals don't require an amount (amount = 0)
    // Normalize the status first to detect exempt
    const normalizedStatus = normalizePaymentStatus(paymentStatus) || "مدفوع";
    const exempt = isExemptStatus(normalizedStatus);

    if (!subscriberId || (!exempt && !amount && amount !== 0)) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const sub = await db.subscriber.findFirst({ where: { id: subscriberId, ...clubFilter } });
    if (!sub) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });

    // ═══ تاريخ التجديد ═══
    // ★ إذا قُدم تاريخ تجديد خاص (manual YYYY/MM/DD) — استخدمه
    // خلاف ذلك استخدم تاريخ اليوم
    let renewalDate: Date;
    if (renewalDateInput && typeof renewalDateInput === "string" && renewalDateInput.trim()) {
      const parsed = parseManualDate(renewalDateInput);
      if (!parsed) {
        return NextResponse.json({
          error: "تاريخ التجديد غير صالح — استخدم الصيغة YYYY/MM/DD",
        }, { status: 400 });
      }
      renewalDate = parsed;
    } else {
      renewalDate = new Date();
    }

    const expiryDate = new Date(renewalDate);
    expiryDate.setDate(expiryDate.getDate() + (months || 1) * 30);

    // ★ EXEMPT renewal: amount = 0, no financial claim
    const finalAmount = exempt ? 0 : (amount || 0);

    const renewal = await db.renewal.create({
      data: {
        clubId: sub.clubId,
        subscriberId,
        renewalDate,
        expiryDate,
        months: months || 1,
        amount: finalAmount,
        paymentStatus: normalizedStatus,
        note: exempt
          ? (note || "تجديد معفى — بدون مطالبة مالية")
          : (note || null),
      },
      include: { subscriber: true },
    });

    // Update subscriber's last payment & status
    // ★ For EXEMPT: keep lastPaymentDate as-is (no payment happened),
    //    but update paymentStatus to "معفى" so the subscriber is marked exempt.
    await db.subscriber.update({
      where: { id: subscriberId },
      data: {
        lastPaymentDate: exempt ? sub.lastPaymentDate : renewalDate,
        paymentStatus: normalizedStatus,
      },
    });

    await db.activity.create({
      data: {
        clubId: sub.clubId,
        subscriberId,
        type: "renewal",
        description: exempt
          ? `تم تجديد اشتراك ${sub.lastName} ${sub.firstName} — معفى (بدون مطالبة مالية)`
          : `تم تجديد اشتراك ${sub.lastName} ${sub.firstName} لمدة ${months || 1} شهر بمبلغ ${finalAmount} دج بتاريخ ${renewalDate.toISOString().split("T")[0]}`,
      },
    });

    return NextResponse.json({ renewal }, { status: 201 });
  } catch (e) {
    console.error("POST renewals error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
