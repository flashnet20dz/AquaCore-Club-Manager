import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { postLedgerEntry, deleteLedgerByReferencesTx } from "@/lib/financial-posting";

/**
 * خريطة فئات لوحة الأعباء (دفتر Payment التشغيلي) ← فئات الدفتر المالي
 * (FinancialTransaction) — كل دفعة تُرحَّل تلقائياً لدفتر واحد للحقيقة.
 */
const LEDGER_MAP: Record<string, { type: "income" | "expense"; category: string; label: string }> = {
  subscription: { type: "income", category: "subscription", label: "تسجيل اشتراك" },
  insurance: { type: "income", category: "insurance", label: "تأمين منخرط" },
  compound: { type: "income", category: "compound", label: "حقوق المركب" },
  other: { type: "income", category: "other_income", label: "مدخول آخر" },
  salary: { type: "expense", category: "wages", label: "أجر عامل" },
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const userId = url.searchParams.get("userId");

    const clubFilter = user.role === "superadmin" ? {} : { clubId: user.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (category) where.category = category;
    if (userId) where.userId = userId;

    const payments = await db.payment.findMany({
      where,
      include: {
        subscriber: { select: { id: true, fileNumber: true, lastName: true, firstName: true } },
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    const allPayments = await db.payment.findMany({ where: clubFilter });
    const totals = {
      compound: allPayments.filter((p) => p.category === "compound").reduce((s, p) => s + p.amount, 0),
      insurance: allPayments.filter((p) => p.category === "insurance").reduce((s, p) => s + p.amount, 0),
      salary: allPayments.filter((p) => p.category === "salary").reduce((s, p) => s + p.amount, 0),
      subscription: allPayments.filter((p) => p.category === "subscription").reduce((s, p) => s + p.amount, 0),
      other: allPayments.filter((p) => p.category === "other").reduce((s, p) => s + p.amount, 0),
      total: allPayments.reduce((s, p) => s + p.amount, 0),
    };

    return NextResponse.json({ payments, totals });
  } catch (e) {
    console.error("GET payments:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { category, amount, method, note, subscriberId, userId, receiptNumber } = body;

    if (!category || !amount) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const validCategories = ["subscription", "insurance", "compound", "salary", "other"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "فئة غير صالحة" }, { status: 400 });
    }

    const amountNum = parseInt(amount);
    // للرواتب: اسم العامل (جهة الصرف) للتقرير المحاسبي
    const worker = userId ? await db.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;

    // ★ ذرّية: دفعة تشغيلية + ترحيل تلقائي للدفتر المالي (مصدر واحد للحقيقة)
    const payment = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          clubId: user.clubId!,
          category,
          amount: amountNum,
          method: method || "cash",
          note: note || null,
          subscriberId: subscriberId || null,
          userId: userId || null,
          receiptNumber: receiptNumber || null,
        },
        include: {
          subscriber: { select: { id: true, fileNumber: true, lastName: true, firstName: true } },
          user: { select: { id: true, name: true, role: true } },
        },
      });

      const mapEntry = LEDGER_MAP[category];
      if (mapEntry) {
        await postLedgerEntry(tx, {
          clubId: user.clubId!,
          type: mapEntry.type,
          category: mapEntry.category,
          amount: amountNum,
          paymentMethod: method || "cash",
          payeeName:
            category === "salary"
              ? (worker?.name || payment.user?.name || null)
              : (payment.subscriber ? `${payment.subscriber.lastName} ${payment.subscriber.firstName}` : null),
          payeeId: category === "salary" ? (userId || null) : null,
          subscriberId: subscriberId || null,
          reference: `payment:${payment.id}`,
          note: `${mapEntry.label} — تسديد تشغيلي تلقائي${note ? ` • ${note}` : ""}`,
          createdById: user.id,
        });
      }

      return payment;
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (e) {
    console.error("POST payment:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // سبب الإلغاء (يُرسل من نافذة الإلغاء — إلزامي للتوثيق المحاسبي)
    const body = await req.json().catch(() => ({}));
    const reason = (body?.reason || "").trim();
    if (reason.length < 3) {
      return NextResponse.json({ error: "سبب الإلغاء إلزامي (3 أحرف على الأقل)" }, { status: 400 });
    }

    const existing = await db.payment.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    // Verify the payment belongs to the user's club (superadmin bypasses)
    if (user.role !== "superadmin" && existing.clubId !== user.clubId) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    // ★ ذرّية: حذف الدفعة + القيد المرحّل المرتبط بها في الدفتر المالي + سجل التدقيق
    await db.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id } });
      const refs = [`payment:${id}`];
      if (existing.subscriberId) refs.push(`bulk-ins:${existing.subscriberId}`, `bulk-comp:${existing.subscriberId}`);
      await deleteLedgerByReferencesTx(tx, existing.clubId, refs);
      await tx.auditLog.create({
        data: {
          clubId: existing.clubId,
          userId: user.id,
          action: "payment_void",
          entityType: "Payment",
          entityId: existing.id,
          description: `إلغاء دفعة ${existing.amount} دج (${existing.category})${existing.user?.name ? ` للعامل ${existing.user.name}` : ""} — السبب: ${reason}`,
          metadata: JSON.stringify({ amount: existing.amount, category: existing.category, method: existing.method, reason }),
        },
      }).catch(() => undefined);
    });

    return NextResponse.json({ success: true, message: "تم إلغاء الدفعة وحذف قيدها المالي إن وجد" });
  } catch (e) {
    console.error("DELETE payment:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
