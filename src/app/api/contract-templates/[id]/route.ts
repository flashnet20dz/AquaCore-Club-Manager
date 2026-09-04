import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const template = await db.contractTemplate.update({
      where: { id, clubId: user.clubId! },
      data: body,
    });
    return NextResponse.json({ template });
  } catch (e) {
    console.error("PATCH contract-template:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    await db.contractTemplate.delete({ where: { id, clubId: user.clubId! } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE contract-template:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
