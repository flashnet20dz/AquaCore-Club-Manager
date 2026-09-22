/**
 * Helper: get current user's clubId for tenant isolation.
 * Returns null for SuperAdmin (can access all clubs).
 * Throws if user is not authenticated.
 */
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function getClubId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (user.role === "superadmin") return null; // SuperAdmin sees all
  return user.clubId || null;
}

export async function requireClubId(): Promise<string> {
  const clubId = await getClubId();
  if (!clubId) throw new Error("No club context");
  return clubId;
}

/**
 * 🔑 حل سياق النادي للكتابة/القراءة — يُصلح «فشل الحفظ» لحساب superadmin:
 * مدير المنصة (superadmin) ليس له clubId في جلسته، ومع ذلك يدير النادي الوحيد/الأول.
 * الترتيب: clubId صريح من الطلب (لـ superadmin فقط) → clubId الجلسة → أول نادٍ نشط → أول نادٍ.
 * نفس النمط المعتمد في next-file-number و import.
 */
export async function resolveTargetClubId(
  user: { role: string; clubId?: string | null },
  requested?: unknown,
): Promise<string | null> {
  if (user.role !== "superadmin") return user.clubId || null;
  if (typeof requested === "string" && requested.trim()) return requested.trim();
  const active = await db.club.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (active?.id) return active.id;
  const anyClub = await db.club.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return anyClub?.id || null;
}
