import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getAuditLogs } from "@/lib/audit";

/**
 * GET /api/audit-logs
 * SuperAdmin: سجل التدقيق الكامل (كل النوادي)
 * Admin: سجل التدقيق لناديه فقط
 *
 * Query: ?action=login&userId=xxx&limit=100&offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "superadmin" && currentUser.role !== "admin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || undefined;
    const userId = url.searchParams.get("userId") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Admin يرى فقط سجل ناديه؛ superadmin يرى الكل
    const clubId = currentUser.role === "superadmin" ? undefined : currentUser.clubId!;

    const logs = await getAuditLogs({
      clubId,
      userId,
      action,
      limit,
      offset,
    });

    return NextResponse.json({ logs, count: logs.length });
  } catch (e) {
    console.error("GET /api/audit-logs error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
