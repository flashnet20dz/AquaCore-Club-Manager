import { NextResponse } from "next/server";
import { getCurrentUser, destroySession, SESSION_COOKIE } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    await destroySession(token);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Logout error:", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}

export async function GET() {
  // Allow GET for easy browser navigation to /api/auth/logout
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    await destroySession(token);
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  } catch (e) {
    console.error("Logout error:", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}

export { getCurrentUser };
