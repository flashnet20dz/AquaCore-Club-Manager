import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const employees = await db.employee.findMany({
      where: { clubId: user.clubId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        contracts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ employees });
  } catch (e) {
    console.error("GET employees:", e);
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
    const employee = await db.employee.create({
      data: {
        ...body,
        clubId: user.clubId!,
      },
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (e) {
    console.error("POST employee:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
