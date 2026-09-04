import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clubId: user.clubId,
        clubName: user.clubName,
      },
    });
  } catch (e) {
    console.error("Me error:", e);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
