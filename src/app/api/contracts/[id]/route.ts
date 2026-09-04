import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { substituteVariables, formatDateYMD, type ContractVariables } from "@/lib/contract-variables";

/**
 * /api/contracts/[id] (المرحلة 5 — §4/§24/§26/§35)
 * ─────────────────────────────────────────────
 * GET     — عرض عقد
 * PATCH   — إجراءات:
 *   { action: "terminate", reason }  → إنهاء ناعم (terminated + من/متى/لماذا)
 *   { action: "cancel", reason }     → إلغاء مسودة (cancelled)
 *   { action: "activate" }           → تفعيل مسودة (draft → active)
 *   { action: "renew", newEndDate }  → تجديد (نسخة جديدة — المنطق القديم محفوظ)
 *   default: تعديل حقول مضبوطة
 * DELETE  — حذف فعلي للمسودات فقط؛ غير ذلك 409 (الإنهاء/الإلغاء الناعم إلزامي §26)
 */

const CONTRACT_TYPES = ["HOURLY", "MONTHLY", "TEMPORARY", "FIXED_TERM", "OTHER"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;

    const contract = await db.employmentContract.findFirst({
      where: { id, clubId: user.clubId },
      include: { employee: true, template: true },
    });
    if (!contract) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    return NextResponse.json({ contract });
  } catch (e) {
    console.error("GET contract:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

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
    const clubId = user.clubId!;

    const original = await db.employmentContract.findFirst({ where: { id, clubId } });
    if (!original) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    // ═══ إنهاء العقد (§24) — ناعم مع سبب إلزامي ═══
    if (body.action === "terminate") {
      const reason = String(body.reason || "").trim();
      if (reason.length < 3) {
        return NextResponse.json({ error: "سبب الإنهاء إلزامي (3 أحرف على الأقل)" }, { status: 400 });
      }
      if (["terminated", "cancelled", "expired", "renewed"].includes(original.status)) {
        return NextResponse.json({ error: `لا يمكن إنهاء عقد حالته ${original.status}` }, { status: 409 });
      }
      const contract = await db.employmentContract.update({
        where: { id },
        data: {
          status: "terminated",
          terminatedAt: new Date(),
          terminatedById: user.id,
          terminatedReason: reason,
        },
        include: { employee: true },
      });
      await db.auditLog.create({
        data: {
          clubId, userId: user.id, action: "contract_terminate",
          entityType: "EmploymentContract", entityId: id,
          description: `إنهاء عقد ${original.contractNumber} — السبب: ${reason}`,
          metadata: JSON.stringify({ oldValue: { status: original.status }, newValue: { status: "terminated" }, reason }),
        },
      }).catch(() => undefined);
      return NextResponse.json({ contract });
    }

    // ═══ إلغاء مسودة ═══
    if (body.action === "cancel") {
      const reason = String(body.reason || "").trim();
      if (original.status !== "draft") {
        return NextResponse.json({ error: "الإلغاء للمسودات فقط — استخدم الإنهاء للعقود النشطة" }, { status: 409 });
      }
      if (reason.length < 3) {
        return NextResponse.json({ error: "سبب الإلغاء إلزامي (3 أحرف على الأقل)" }, { status: 400 });
      }
      const contract = await db.employmentContract.update({
        where: { id },
        data: { status: "cancelled", terminatedAt: new Date(), terminatedById: user.id, terminatedReason: reason },
        include: { employee: true },
      });
      await db.auditLog.create({
        data: {
          clubId, userId: user.id, action: "contract_cancel",
          entityType: "EmploymentContract", entityId: id,
          description: `إلغاء مسودة عقد ${original.contractNumber} — السبب: ${reason}`,
          metadata: JSON.stringify({ oldValue: { status: original.status }, newValue: { status: "cancelled" }, reason }),
        },
      }).catch(() => undefined);
      return NextResponse.json({ contract });
    }

    // ═══ تفعيل مسودة ═══
    if (body.action === "activate") {
      if (original.status !== "draft") {
        return NextResponse.json({ error: "التفعيل للمسودات فقط" }, { status: 409 });
      }
      const contract = await db.employmentContract.update({
        where: { id },
        data: { status: "active" },
        include: { employee: true },
      });
      await db.auditLog.create({
        data: {
          clubId, userId: user.id, action: "contract_activate",
          entityType: "EmploymentContract", entityId: id,
          description: `تفعيل عقد ${original.contractNumber}`,
          metadata: JSON.stringify({ oldValue: { status: "draft" }, newValue: { status: "active" } }),
        },
      }).catch(() => undefined);
      return NextResponse.json({ contract });
    }

    // ═══ التجديد — نسخة جديدة (المنطق الأصلي محفوظ + أنواع جديدة) ═══
    if (body.action === "renew") {
      const newEndDate = body.newEndDate ? new Date(body.newEndDate) : null;
      const year = new Date().getFullYear();
      const count = await db.employmentContract.count({ where: { clubId } });
      const newContractNumber = `CTR-${year}-${String(count + 1).padStart(3, "0")}`;

      // Update original status to 'renewed'
      await db.employmentContract.update({
        where: { id },
        data: { status: "renewed" },
      });

      // Re-render content with new dates
      const settings = await db.setting.findMany({ where: { clubId } });
      const settingsMap: Record<string, string> = {};
      settings.forEach((s) => { settingsMap[s.key] = s.value; });

      const employee = await db.employee.findFirst({ where: { id: original.employeeId } });
      if (!employee) return NextResponse.json({ error: "العامل غير موجود" }, { status: 404 });

      const sd = new Date();
      const rate = body.hourRate !== undefined ? Math.max(0, Math.round(Number(body.hourRate) || 0)) : original.hourRate;
      const vars: ContractVariables = {
        club_name: settingsMap.clubName || "النادي",
        club_branch: settingsMap.branchName || "",
        worker_name: `${employee.lastName} ${employee.firstName}`.trim(),
        birth_date: formatDateYMD(employee.birthDate),
        birth_place: employee.birthPlace || "—",
        address: employee.address || "—",
        phone: employee.phone || "—",
        national_id: employee.nationalId || "—",
        position: original.position,
        contract_number: newContractNumber,
        start_date: formatDateYMD(sd),
        end_date: formatDateYMD(newEndDate),
        hour_rate: rate,
        work_schedule: original.workSchedule || "—",
        club_president: settingsMap.clubPresident || "—",
        association_president: settingsMap.associationPresident || "—",
        today: formatDateYMD(new Date()),
      };

      // Get template content
      const template = original.templateId
        ? await db.contractTemplate.findFirst({ where: { id: original.templateId, clubId } })
        : null;
      const templateContent = template?.content || original.content;
      const renderedContent = substituteVariables(templateContent, vars);

      const renewed = await db.employmentContract.create({
        data: {
          clubId,
          employeeId: original.employeeId,
          templateId: original.templateId,
          contractNumber: newContractNumber,
          position: original.position,
          startDate: sd,
          endDate: newEndDate,
          hourRate: rate,
          workSchedule: original.workSchedule,
          contractType: original.contractType,
          title: original.title,
          weeklyHours: original.weeklyHours,
          content: renderedContent,
          status: "active",
          version: original.version + 1,
          notes: body.notes || `تجديد العقد ${original.contractNumber}`,
          createdBy: user.id,
        },
        include: { employee: true },
      });

      await db.auditLog.create({
        data: {
          clubId, userId: user.id, action: "contract_renew",
          entityType: "EmploymentContract", entityId: renewed.id,
          description: `تجديد عقد ${original.contractNumber} → ${newContractNumber}`,
          metadata: JSON.stringify({
            oldValue: { contractNumber: original.contractNumber, endDate: original.endDate?.toISOString() ?? null },
            newValue: { contractNumber: newContractNumber, endDate: newEndDate?.toISOString() ?? null, hourRate: rate },
          }),
        },
      }).catch(() => undefined);

      return NextResponse.json({ contract: renewed });
    }

    // ═══ تعديل حقول مضبوطة ═══
    const updateData: Record<string, unknown> = {};
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.hourRate !== undefined) updateData.hourRate = Math.max(0, Math.round(Number(body.hourRate) || 0));
    if (body.workSchedule !== undefined) updateData.workSchedule = body.workSchedule;
    if (body.title !== undefined) updateData.title = body.title ? String(body.title).trim() : null;
    if (body.weeklyHours !== undefined) updateData.weeklyHours = body.weeklyHours ? Math.max(0, Math.round(Number(body.weeklyHours))) : null;
    if (body.contractType && (CONTRACT_TYPES as readonly string[]).includes(body.contractType)) {
      updateData.contractType = body.contractType;
    }
    if (body.status === "draft" || body.status === "active") {
      // انتقال يدوي مقصود بين draft/active فقط — terminated/cancelled عبر الإجراءات
      if (["draft", "active"].includes(original.status)) updateData.status = body.status;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.content !== undefined) updateData.content = body.content;

    const contract = await db.employmentContract.update({
      where: { id, clubId },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        clubId, userId: user.id, action: "contract_update",
        entityType: "EmploymentContract", entityId: id,
        description: `تعديل عقد ${original.contractNumber}`,
        metadata: JSON.stringify({
          oldValue: {
            hourRate: original.hourRate, endDate: original.endDate?.toISOString() ?? null,
            contractType: original.contractType, title: original.title,
          },
          newValue: {
            hourRate: contract.hourRate, endDate: contract.endDate?.toISOString() ?? null,
            contractType: contract.contractType, title: contract.title,
          },
        }),
      },
    }).catch(() => undefined);

    return NextResponse.json({ contract });
  } catch (e) {
    console.error("PATCH contract:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
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
    const clubId = user.clubId!;
    const { id } = await params;

    const existing = await db.employmentContract.findFirst({ where: { id, clubId } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    // ★ المرحلة 5 (§26): لا تحذف العقود — المسودة بلا سجل تاريخي فقط يمكن حذفها؛
    //   العقد النشط/المنتهي يُنهى أو يُلغى ناعماً (PATCH terminate/cancel)
    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "لا يمكن حذف عقد غير مسودة — استخدم الإنهاء أو الإلغاء الناعم (التاريخ محفوظ)", requiresTerminate: true },
        { status: 409 }
      );
    }

    await db.employmentContract.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        clubId, userId: user.id, action: "contract_delete_draft",
        entityType: "EmploymentContract", entityId: id,
        description: `حذف مسودة عقد ${existing.contractNumber}`,
        metadata: JSON.stringify({ contractNumber: existing.contractNumber }),
      },
    }).catch(() => undefined);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE contract:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}
