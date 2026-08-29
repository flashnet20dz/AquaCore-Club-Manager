import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();

    // التحقق من أن النوع ينتمي لنادي المستخدم
    const existing = await db.subscriptionType.findFirst({
      where: { id, clubId: user.clubId! },
    });
    if (!existing) {
      return NextResponse.json({ error: "النوع غير موجود" }, { status: 404 });
    }

    // إزالة الحقول التي لا يجب تحديثها
    const { id: _id, clubId: _clubId, createdAt: _createdAt, updatedAt: _updatedAt, ...updateData } = body;

    const type = await db.subscriptionType.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ type });
  } catch (e) {
    console.error("PATCH subscription-types:", e);
    const errMsg = e instanceof Error ? e.message : "Internal";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;

    // التحقق من أن النوع ينتمي لنادي المستخدم
    const existing = await db.subscriptionType.findFirst({
      where: { id, clubId: user.clubId! },
    });
    if (!existing) {
      return NextResponse.json({ error: "النوع غير موجود" }, { status: 404 });
    }

    await db.subscriptionType.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE subscription-types:", e);
    const errMsg = e instanceof Error ? e.message : "Internal";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
