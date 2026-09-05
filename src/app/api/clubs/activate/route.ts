import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  verifyCode,
  generateHardwareFingerprint,
  computeExpiryDate,
  PLANS,
} from "@/lib/activation-codes";
import { computeGracePeriod } from "@/lib/subscription-state";
import { auditLogWithRequest } from "@/lib/audit";
import crypto from "crypto";

/**
 * POST /api/clubs/activate
 * يفعّل كود اشتراك لنادي.
 *
 * Workflow (Hybrid):
 *   1. التحقق المحلي من توقيع الكود (HMAC) — يعمل أوفلاين
 *   2. التسجيل في DB المركزي — يمنع إعادة الاستخدام
 *   3. ربط الكود بالجهاز (hardware fingerprint)
 *   4. إنشاء/تمديد ClubSubscription
 *
 * Body: { code: string }
 *
 * ملاحظة أمنية: لو نفس الكود استُخدم على جهازين مختلفين،
 * الطلب الثاني سيرفض لأن status سيكون "used".
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح — يجب تسجيل الدخول كإدارة نادٍ" }, { status: 403 });
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "الكود مطلوب" }, { status: 400 });
    }

    // ════ الخطوة 1: التحقق المحلي من التوقيع (HMAC) ════
    // هذا يعمل بدون أي استعلام DB — رياضيات صرفة
    const verification = verifyCode(code);
    if (!verification.valid || !verification.plan || !verification.durationDays) {
      return NextResponse.json({
        error: verification.error || "كود غير صالح",
        verified: false,
      }, { status: 400 });
    }

    const planDef = PLANS[verification.plan];
    const now = new Date();

    // ════ الخطوة 2: البحث في DB ومنع إعادة الاستخدام ════
    const codeHash = crypto.createHash("sha256").update(code.toUpperCase().replace(/\s+/g, "")).digest("hex");
    const existingCode = await db.activationCode.findUnique({
      where: { codeHash },
      include: { club: { select: { id: true, name: true } } },
    });

    if (!existingCode) {
      // الكود توقيعه صحيح لكنه غير مسجّل في DB
      // (هذا يحدث فقط إذا وُلّد بسكربت خارجي أو قُدّم مزيّف نادر)
      return NextResponse.json({
        error: "هذا الكود غير مسجّل في النظام. تواصل مع الإدارة.",
        verified: true, // التوقيع صحيح لكن DB لا يعرفه
      }, { status: 404 });
    }

    if (existingCode.status === "revoked") {
      return NextResponse.json({
        error: "هذا الكود مُلغى من الإدارة. تواصل مع الدعم.",
      }, { status: 403 });
    }

    if (existingCode.status === "used") {
      // تحقق: هل هو مستخدم على نفس النادي؟ (إعادة تفعيل مسموحة)
      if (existingCode.clubId === currentUser.clubId) {
        return NextResponse.json({
          success: true,
          message: "هذا الكود مُفعّل مسبقاً على ناديك.",
          alreadyActivated: true,
          expiresAt: existingCode.expiresAt,
        });
      }
      // مستخدم على نادٍ آخر → رفض
      return NextResponse.json({
        error: `هذا الكود مستخدم بالفعل على نادٍ آخر (${existingCode.club?.name || "غير معروف"}). لا يمكن تفعيله على نادٍ ثانٍ.`,
        hint: "كل كود مخصص لنادٍ واحد فقط. اطلب كوداً جديداً من الإدارة.",
      }, { status: 409 });
    }

    // ★ حالة غير متوقعة (status ليس unused/used/revoked)
    if (existingCode.status !== "unused") {
      return NextResponse.json({
        error: `حالة الكود غير معروفة: "${existingCode.status}". تواصل مع الدعم.`,
      }, { status: 400 });
    }

    // ════ الخطوة 3: بصمة الجهاز ════
    // ملاحظة: في الوضع السحابي، بصمة الجهاز تُؤخذ من الـ client وتُرسل.
    // هنا نولّد واحدة افتراضية (في الإنتاج، يرسلها الـ client).
    const hardwareFingerprint = body.hardwareFingerprint || generateHardwareFingerprint();

    // تحقق: هل النادي مرتبط بجهاز مختلف؟ (منع النسخ)
    const club = await db.club.findUnique({
      where: { id: currentUser.clubId },
      include: {
        subscriptions: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!club) {
      return NextResponse.json({ error: "النادي غير موجود" }, { status: 404 });
    }

    // ★ فحص بصمة الجهاز:
    // - للمرة الأولى (first activation): لا يوجد fingerprint مسجّل → اقبل أي جهاز وسجّله
    // - للتجديد (renewal): النادي لديه اشتراك نشط بالفعل والمستخدم مسجّل كمشرف النادي
    //   → اقبل أي جهاز (المستخدم موثّق) وحدّث البصمة
    // - في كل الحالات: المستخدم مسجّل كمشرف النادي (clubId يطابق currentUser.clubId)
    //   لذلك لا حاجة لمنع التجديد على جهاز مختلف
    //
    // السلوك السابق كان يرفض التفعيل من جهاز مختلف حتى للتجديد، مما منع
    // النوادي من تجديد اشتراكها من جهاز/متصفح مختلف.

    // (تم إزالة فحص DEVICE_MISMATCH الصارم — المستخدم موثّق بالفعل كمشرف النادي)

    // ════ الخطوة 4: حساب تواريخ الاشتراك ════
    // لو يوجد اشتراك نشط، نمدّد من تاريخ انتهائه (لا نضيّع الأيام المتبقية)
    const activeSub = club.subscriptions[0];
    const baseDate = activeSub && activeSub.endDate > now
      ? new Date(activeSub.endDate)
      : now;
    const newEndDate = computeExpiryDate(baseDate, verification.durationDays);
    const newGraceEnd = computeGracePeriod(newEndDate);

    // ════ الخطوة 5: المعاملة — تسجيل التفعيل ════
    await db.$transaction(async (tx) => {
      // 5a. علّم الكود كمستخدم
      await tx.activationCode.update({
        where: { id: existingCode.id },
        data: {
          status: "used",
          clubId: currentUser.clubId,
          activatedAt: now,
          activatedById: currentUser.id,
          hardwareFingerprint,
          expiresAt: newEndDate,
        },
      });

      // 5b. ألغِ الاشتراك النشط القديم (إن وُجد)
      if (activeSub) {
        await tx.clubSubscription.update({
          where: { id: activeSub.id },
          data: { status: "renewed" },
        });
        await tx.subscriptionHistory.create({
          data: {
            subscriptionId: activeSub.id,
            action: "renewed",
            oldType: activeSub.type,
            newType: verification.plan,
            oldEndDate: activeSub.endDate,
            newEndDate,
            note: `تجديد بكود تفعيل: ${code.substring(0, 14)}...`,
          },
        });
      }

      // 5c. أنشئ اشتراكاً جديداً
      // (currentUser.clubId و verification.plan مضمّنان بحرس أعلى الدالة —
      //  TS يفقد الـ narrowing داخل callback المعاملة، لذا نستخدم !)
      const newSub = await tx.clubSubscription.create({
        data: {
          clubId: currentUser.clubId!,
          type: verification.plan!,
          startDate: now,
          endDate: newEndDate,
          status: "active",
          lastRenewalDate: now,
        },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: newSub.id,
          action: activeSub ? "created" : "created",
          newType: verification.plan,
          newEndDate,
          note: activeSub
            ? `تجديد/تمديد بكود تفعيل (${planDef.label})`
            : `أول تفعيل بكود تفعيل (${planDef.label})`,
        },
      });

      // 5d. حدّث حالة النادي (نشط + فترة سماح + بصمة الجهاز)
      await tx.club.update({
        where: { id: currentUser.clubId! },
        data: {
          status: "active",
          graceEndDate: newGraceEnd,
          hardwareFingerprint, // اربط بالجهاز (أول تفعيل)
        },
      });

      // 5e. سجّل نشاطاً
      await tx.activity.create({
        data: {
          clubId: currentUser.clubId!,
          type: "create",
          description: `تم تفعيل اشتراك ${planDef.label} (${verification.durationDays} يوم) بكود ${code.substring(0, 14)}... — ينتهي في ${newEndDate.toLocaleDateString("ar-DZ")}`,
        },
      });
    });

    const daysRemaining = Math.ceil((newEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // 🔒 سجّل التفعيل في سجل التدقيق
    await auditLogWithRequest(req, currentUser, {
      action: "activate",
      entityType: "activation_code",
      entityId: existingCode.id,
      description: `تفعيل كود اشتراك ${planDef.label} (${verification.durationDays} يوم) — ينتهي ${newEndDate.toLocaleDateString("ar-DZ")}`,
      metadata: {
        code: code.substring(0, 14) + "...",
        plan: verification.plan,
        durationDays: verification.durationDays,
        hardwareFingerprint,
      },
    });

    return NextResponse.json({
      success: true,
      message: `تم تفعيل اشتراك ${planDef.label} بنجاح! ينتهي في ${newEndDate.toLocaleDateString("ar-DZ")}`,
      activated: {
        plan: verification.plan,
        planLabel: planDef.label,
        durationDays: verification.durationDays,
        startDate: now,
        endDate: newEndDate,
        graceEndDate: newGraceEnd,
        daysRemaining,
        hardwareFingerprint,
      },
    });
  } catch (e) {
    console.error("Activation error:", e);
    return NextResponse.json({
      error: "فشل التفعيل",
      detail: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
