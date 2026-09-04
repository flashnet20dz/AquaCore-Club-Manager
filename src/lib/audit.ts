/**
 * ═══════════════════════════════════════════════════════════════
 *  Audit Logger — تسجيل الأفعال الحساسة للمراجعة الأمنية
 * ═══════════════════════════════════════════════════════════════
 *
 *  يسجّل: login/logout، create/update/delete، activate/revoke،
 *  عمليات الأكواد، تغييرات الإعدادات، إلخ.
 *
 *  لا يرمي أخطاء (best-effort) — لا يكسر التدفق الرئيسي.
 */

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/roles";
import type { NextRequest } from "next/server";

export interface AuditEntry {
  userId?: string | null;
  clubId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * يسجّل فعلاً في سجل التدقيق.
 * Best-effort: لا ترمي أخطاء (يفشل بصمت).
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId || null,
        clubId: entry.clubId || null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId || null,
        description: entry.description,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    });
  } catch (e) {
    // فشل صامت — لا نكسر التدفق الرئيسي
    console.error("[auditLog] failed (ignored):", e instanceof Error ? e.message : e);
  }
}

/**
 * يسجّل فعلاً مع المستخدم الحالي + IP من الطلب.
 */
export async function auditLogWithRequest(
  req: NextRequest | Request,
  user: SessionUser | null,
  entry: Omit<AuditEntry, "userId" | "clubId" | "ipAddress" | "userAgent">
): Promise<void> {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0].trim() : (req.headers.get("x-real-ip") || null);
  const userAgent = req.headers.get("user-agent") || null;

  await auditLog({
    ...entry,
    userId: user?.id || null,
    clubId: user?.clubId || null,
    ipAddress,
    userAgent,
  });
}

/**
 * يسترجع سجل التدقيق (للسوبر أدمن).
 */
export async function getAuditLogs(options: {
  clubId?: string;
  userId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};
  if (options.clubId) where.clubId = options.clubId;
  if (options.userId) where.userId = options.userId;
  if (options.action) where.action = options.action;

  return db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(500, options.limit || 100),
    skip: options.offset || 0,
  });
}
