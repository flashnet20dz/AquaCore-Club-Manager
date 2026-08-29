import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// 🔒 القائمة البيضاء الوحيدة للنماذج القابلة للمزامنة — كلها تحمل clubId.
// أي نموذج آخر (users, clubs, settings...) يُرفض فوراً — الكود القديم كان
// يقبل أي نموذج عبر (db as any)[modelName] فيسمح بكتابة أي جدول في النظام.
const SYNC_MODELS = new Set(["payment", "renewal", "attendance", "subscriber"]);

// موديلات "معاملات" — append-only، لا يوجد تعارض ممكن، فقط "أضِف إذا غير موجود"
const APPEND_ONLY_MODELS = new Set(["payment", "renewal", "attendance"]);

// موديلات "وصفية" — تُحل بالتعارض عبر updatedAt (آخر تعديل يفوز)
// وتدعم الحذف الناعم (deletedAt موجود على subscriber فقط)
const METADATA_MODELS = new Set(["subscriber"]);

interface SyncChange {
  modelName: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  payload: Record<string, any>;
}

/**
 * POST /api/sync/push
 * يستقبل دفعة تغييرات من فرع أوفلاين (Electron) ويطبّقها على قاعدة البيانات السحابية.
 * المصادقة: header X-Club-Api-Key يطابق Club.syncApiKey.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("X-Club-Api-Key");
    if (!apiKey) {
      return NextResponse.json({ error: "مفتاح المزامنة مفقود" }, { status: 401 });
    }

    const club = await db.club.findUnique({ where: { syncApiKey: apiKey } });
    if (!club) {
      return NextResponse.json({ error: "مفتاح المزامنة غير صالح" }, { status: 401 });
    }

    const body = await req.json();
    const changes: SyncChange[] = body.changes || [];

    let applied = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const change of changes) {
      try {
        const { modelName, recordId, operation, payload } = change;

        // 1) 🔒 نموذج مسموح فقط — ما عداها يُرفض صراحةً (وليس تجاهلاً صامتاً)
        if (!SYNC_MODELS.has(modelName)) {
          skipped++;
          errors.push(`${modelName}/${recordId}: نموذج غير مسموح بمزامنته`);
          continue;
        }

        // 2) 🔒 عملية صالحة فقط
        if (operation !== "create" && operation !== "update" && operation !== "delete") {
          skipped++;
          errors.push(`${modelName}/${recordId}: عملية غير معروفة`);
          continue;
        }

        // 3) 🔒 فحص الشكل
        if (!recordId || typeof recordId !== "string" || !payload || typeof payload !== "object") {
          skipped++;
          continue;
        }

        const model = (db as any)[modelName];

        // 4) 🔒 عزل صارم بين النوادي: السجل إما داخل هذا النادي أو غير موجود أصلاً.
        // الكود القديم كان يحدّث بأي id مجرد — فيسمح بمس سجلات نوادٍ أخرى.
        const owned = await model.findFirst({
          where: { id: recordId, clubId: club.id },
          select: { id: true },
        });

        if (!owned && operation !== "create") {
          skipped++;
          errors.push(`${modelName}/${recordId}: السجل غير موجود في ناديك`);
          continue;
        }
        if (owned && operation === "create") {
          skipped++; // موجود بالفعل — سلوك idempotent
          continue;
        }

        // 5) 🔒 فرض النادي دائماً — مهما أرسل العميل في الـ payload
        const data = { ...payload, clubId: club.id };

        if (operation === "delete") {
          // الحذف الناعم مدعوم على subscriber فقط (النماذج الأخرى لا تملك deletedAt —
          // الكود القديم كان يحاول الحذف على الجميع ويفشل بصمت مع عدّه "مُطبّقاً"!)
          if (!METADATA_MODELS.has(modelName)) {
            skipped++;
            errors.push(`${modelName}/${recordId}: الحذف غير مدعوم على هذا النموذج`);
            continue;
          }
          await model.update({
            where: { id: recordId },
            data: { deletedAt: new Date() },
          });
          applied++;
          continue;
        }

        if (APPEND_ONLY_MODELS.has(modelName)) {
          await model.upsert({
            where: { id: recordId },
            create: data,
            update: {},
          });
          applied++;
        } else if (METADATA_MODELS.has(modelName)) {
          const existing = await model.findFirst({
            where: { id: recordId, clubId: club.id },
            select: { updatedAt: true },
          });
          if (!existing || new Date(payload.updatedAt) > new Date(existing.updatedAt)) {
            await model.upsert({
              where: { id: recordId },
              create: data,
              update: data,
            });
            applied++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
          errors.push(`${modelName}: نموذج مُدرج في القائمة البيضاء دون تصنيف`);
        }
      } catch (err: any) {
        errors.push(`${change.modelName}/${change.recordId}: ${err?.message || "خطأ غير معروف"}`);
      }
    }

    return NextResponse.json({ applied, skipped, errors, serverTime: new Date().toISOString() });
  } catch (e) {
    console.error("POST /api/sync/push:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
