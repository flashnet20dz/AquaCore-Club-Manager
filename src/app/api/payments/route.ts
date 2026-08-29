import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

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

    const payment = await db.payment.create({
      data: {
        clubId: user.clubId!,
        category,
        amount: parseInt(amount),
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

    // Verify the payment belongs to the user's club (superadmin bypasses)
    if (user.role !== "superadmin") {
      const existing = await db.payment.findFirst({ where: { id, clubId: user.clubId! } });
      if (!existing) {
        return NextResponse.json({ error: "غير موجود" }, { status: 404 });
      }
    }

    await db.payment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE payment:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
