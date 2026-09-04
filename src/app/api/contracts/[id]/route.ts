import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { substituteVariables, formatDateYMD, type ContractVariables } from "@/lib/contract-variables";

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

    // If renewing: create a new version
    if (body.action === "renew") {
      const original = await db.employmentContract.findFirst({ where: { id, clubId } });
      if (!original) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

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
      const rate = original.hourRate;
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
          content: renderedContent,
          status: "active",
          version: original.version + 1,
          notes: body.notes || `تجديد العقد ${original.contractNumber}`,
          createdBy: user.id,
        },
        include: { employee: true },
      });

      return NextResponse.json({ contract: renewed });
    }

    // Default: update fields
    const updateData: any = {};
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.hourRate !== undefined) updateData.hourRate = body.hourRate;
    if (body.workSchedule !== undefined) updateData.workSchedule = body.workSchedule;
    if (body.status) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // If content was edited directly, re-render with the new content
    if (body.content !== undefined) {
      updateData.content = body.content;
    }

    const contract = await db.employmentContract.update({
      where: { id, clubId },
      data: updateData,
    });
    return NextResponse.json({ contract });
  } catch (e) {
    console.error("PATCH contract:", e);
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
    await db.employmentContract.delete({ where: { id, clubId: user.clubId! } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE contract:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
