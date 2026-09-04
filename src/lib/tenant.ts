/**
 * Helper: get current user's clubId for tenant isolation.
 * Returns null for SuperAdmin (can access all clubs).
 * Throws if user is not authenticated.
 */
import { getCurrentUser } from "@/lib/session";

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
