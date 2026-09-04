import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    const day = await db.swimmingDay.update({ where: { id }, data: body });
    return NextResponse.json({ day });
  } catch (e) { return NextResponse.json({ error: "Internal" }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;
    await db.swimmingDay.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: "Internal" }, { status: 500 }); }
}
