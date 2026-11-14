/**
 * ═══════════════════════════════════════════════════════════════
 *  test-photo-api.ts — التحقق الآلي من تحصين مسار الخادم
 *  POST / GET / DELETE /api/subscribers/[id]/photo
 * ═══════════════════════════════════════════════════════════════
 *
 *  يفحص بدقة المعايير 10 إلى 14:
 *  1. فحص الدور: admin و assistant و superadmin مسموح لهم، والأدوار الأخرى 403.
 *  2. فحص بادئة الحمولة: cropped و thumbnail و original تبدأ بـ data:image/ وإلا 400.
 *  3. فحص الحجم الأقصى: cropped > 400KB و thumbnail > 100KB و original > 10MB ترجع 413.
 *  4. فحص عزل النادي (Club Isolation): المنخرط في نادٍ آخر يرجع 403، وغير الموجود 404.
 *  5. التحقق من الحفظ السليم: إنشاء SubscriberPhoto وتحديث photoPath = db://... والتسجيل في AuditLog.
 *  6. فحص GET (?size=... و ?raw=1) وحذف DELETE مع تنظيف photoPath.
 */

import { NextRequest } from "next/server";
import { POST, GET, DELETE } from "../src/app/api/subscribers/[id]/photo/route";
import { db } from "../src/lib/db";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

// إنشاء سلسلة base64 data URL بحجم محدد تقريباً
function createDummyDataUrl(mime: string, targetBytes: number): string {
  const base64Length = Math.ceil((targetBytes * 4) / 3);
  const dummyData = "A".repeat(base64Length);
  return `data:${mime};base64,${dummyData}`;
}

async function runApiVerification() {
  console.log("==================================================");
  console.log("🧪 TESTING PHOTO API ROUTE HARDENING (CRITERIA 10-14)");
  console.log("==================================================\n");

  const timestamp = Date.now();
  const clubAId = `club-test-a-${timestamp}`;
  const clubBId = `club-test-b-${timestamp}`;

  const adminToken = `token-admin-${timestamp}`;
  const assistantToken = `token-assistant-${timestamp}`;
  const lifeguardToken = `token-lifeguard-${timestamp}`;
  const superadminToken = `token-superadmin-${timestamp}`;

  try {
    // ─── 0. إعداد أندية ومستخدمين وجلسات اختبار ───
    await db.club.createMany({
      data: [
        {
          id: clubAId,
          name: `Club A ${timestamp}`,
          city: "سعيدة",
          managerName: "مسؤول A",
          phone: "0550000001",
          email: `cluba-${timestamp}@test.dz`,
          status: "active",
        },
        {
          id: clubBId,
          name: `Club B ${timestamp}`,
          city: "وهران",
          managerName: "مسؤول B",
          phone: "0550000002",
          email: `clubb-${timestamp}@test.dz`,
          status: "active",
        },
      ],
    });

    const subA = await db.subscriber.create({
      data: {
        id: `sub-a-${timestamp}`,
        clubId: clubAId,
        fileNumber: `RCS-${timestamp}`,
        firstName: "أحمد",
        lastName: "بن علي",
        subscriptionType: "RCS",
        gender: "M",
        birthDate: new Date("2000-01-01"),
        paymentStatus: "paid",
      },
    });

    const subB = await db.subscriber.create({
      data: {
        id: `sub-b-${timestamp}`,
        clubId: clubBId,
        fileNumber: `B-${timestamp}`,
        firstName: "سمير",
        lastName: "قاسمي",
        subscriptionType: "RCS",
        gender: "M",
        birthDate: new Date("1995-05-05"),
        paymentStatus: "paid",
      },
    });

    // إنشاء مستخدمين وجلسات
    const users = [
      { id: `u-admin-${timestamp}`, role: "admin", clubId: clubAId, token: adminToken },
      { id: `u-asst-${timestamp}`, role: "assistant", clubId: clubAId, token: assistantToken },
      { id: `u-life-${timestamp}`, role: "lifeguard", clubId: clubAId, token: lifeguardToken },
      { id: `u-super-${timestamp}`, role: "superadmin", clubId: null, token: superadminToken },
    ];

    for (const u of users) {
      await db.user.create({
        data: {
          id: u.id,
          name: `User ${u.role}`,
          email: `${u.id}@test.com`,
          passwordHash: "dummy",
          role: u.role,
          clubId: u.clubId,
          active: true,
        },
      });

      await db.session.create({
        data: {
          id: u.token,
          userId: u.id,
          data: JSON.stringify({
            id: u.id,
            email: `${u.id}@test.com`,
            name: `User ${u.role}`,
            role: u.role,
            clubId: u.clubId,
          }),
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
    }

    // دوال مساعدة لإنشاء طلبات
    const makeRequest = (
      method: string,
      path: string,
      body?: any,
      sessionCookie?: string
    ) => {
      const headers = new Headers();
      if (body) headers.set("Content-Type", "application/json");
      if (sessionCookie) headers.set("Cookie", `rcs-session=${sessionCookie}`);

      return new NextRequest(`http://localhost:3000${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    };

    // ─── 1. فحص مصادقة المستخدم (Unauthenticated) ───
    console.log("--- 1. Authentication Check ---");
    {
      const req = makeRequest("POST", `/api/subscribers/${subA.id}/photo`, {
        cropped: createDummyDataUrl("image/jpeg", 5000),
        thumbnail: createDummyDataUrl("image/jpeg", 2000),
      });
      const res = await POST(req, { params: Promise.resolve({ id: subA.id }) });
      assert(res.status === 401, "POST without session returns 401");
    }

    // ─── 2. فحص الأدوار (Role-based access control) ───
    console.log("\n--- 2. Role-Based Access Control ---");
    {
      // lifeguard: غير مصرح له
      const reqLife = makeRequest(
        "POST",
        `/api/subscribers/${subA.id}/photo`,
        {
          cropped: createDummyDataUrl("image/jpeg", 5000),
          thumbnail: createDummyDataUrl("image/jpeg", 2000),
        },
        lifeguardToken
      );
      const resLife = await POST(reqLife, { params: Promise.resolve({ id: subA.id }) });
      assert(resLife.status === 403, "POST with lifeguard role returns 403 Forbidden");

      // assistant: مصرح له (سيفشل فقط إن وُجد خطأ في البيانات)
      const reqAsst = makeRequest(
        "POST",
        `/api/subscribers/${subA.id}/photo`,
        {}, // جسم فارغ لفحص الوصول قبل 400
        assistantToken
      );
      const resAsst = await POST(reqAsst, { params: Promise.resolve({ id: subA.id }) });
      assert(resAsst.status === 400, "Assistant role passes authorization check and reaches validation (status 400)");
    }

    // ─── 3. فحص عزل النادي (Multi-Tenant Club Isolation) ───
    console.log("\n--- 3. Multi-Tenant Club Isolation ---");
    {
      // مدير النادي A يحاول تعديل منخرط في النادي B
      const reqCross = makeRequest(
        "POST",
        `/api/subscribers/${subB.id}/photo`,
        {
          cropped: createDummyDataUrl("image/jpeg", 5000),
          thumbnail: createDummyDataUrl("image/jpeg", 2000),
        },
        adminToken
      );
      const resCross = await POST(reqCross, { params: Promise.resolve({ id: subB.id }) });
      assert(resCross.status === 403, "Cross-club modification by admin returns 403");

      // منخرط غير موجود
      const reqNonExist = makeRequest(
        "POST",
        `/api/subscribers/non-existent-sub/photo`,
        {
          cropped: createDummyDataUrl("image/jpeg", 5000),
          thumbnail: createDummyDataUrl("image/jpeg", 2000),
        },
        adminToken
      );
      const resNonExist = await POST(reqNonExist, { params: Promise.resolve({ id: "non-existent-sub" }) });
      assert(resNonExist.status === 404, "Non-existent subscriber returns 404 Not Found");
    }

    // ─── 4. فحص صيغة وبادئة الحمولة (Payload Prefix Validation) ───
    console.log("\n--- 4. Payload Prefix Validation ---");
    {
      // بدون cropped أو thumbnail
      const reqMissing = makeRequest(
        "POST",
        `/api/subscribers/${subA.id}/photo`,
        { original: "data:image/jpeg;base64,AAAA" },
        adminToken
      );
      const resMissing = await POST(reqMissing, { params: Promise.resolve({ id: subA.id }) });
      assert(resMissing.status === 400, "Missing cropped or thumbnail returns 400");

      // cropped ليست data:image/
      const reqInvalidPrefix = makeRequest(
        "POST",
        `/api/subscribers/${subA.id}/photo`,
        {
          cropped: "http://malicious-site.com/photo.jpg",
          thumbnail: createDummyDataUrl("image/jpeg", 2000),
        },
        adminToken
      );
      const resInvalidPrefix = await POST(reqInvalidPrefix, { params: Promise.resolve({ id: subA.id }) });
      assert(resInvalidPrefix.status === 400, "Invalid cropped prefix returns 400");

      // thumbnail ليست data:image/
      const reqInvalidThumb = makeRequest(
        "POST",
        `/api/subscribers/${subA.id}/photo`,
        {
          cropped: createDummyDataUrl("image/jpeg", 5000),
          thumbnail: "data:text/html;base64,PHNjcmlwdD4=",
        },
        adminToken
      );
      const resInvalidThumb = await POST(reqInvalidThumb, { params: Promise.resolve({ id: subA.id }) });
      assert(resInvalidThumb.status === 400, "Non-image thumbnail returns 400");
    }

    // ─── 5. فحص حدود الحجم الأقصى (Payload Size Limits 413) ───
    console.log("\n--- 5. Payload Size Limits (413) ---");
    {
      // cropped أكبر من 400KB (مثلاً 500KB)
      const reqLargeCropped = makeRequest(
        "POST",
        `/api/subscribers/${subA.id}/photo`,
        {
          cropped: createDummyDataUrl("image/jpeg", 450 * 1024),
          thumbnail: createDummyDataUrl("image/jpeg", 50 * 1024),
        },
        adminToken
      );
      const resLargeCropped = await POST(reqLargeCropped, { params: Promise.resolve({ id: subA.id }) });
      assert(resLargeCropped.status === 413, "Cropped > 400KB returns 413 Payload Too Large");

      // thumbnail أكبر من 100KB (مثلاً 120KB)
      const reqLargeThumb = makeRequest(
        "POST",
        `/api/subscribers/${subA.id}/photo`,
        {
          cropped: createDummyDataUrl("image/jpeg", 150 * 1024),
          thumbnail: createDummyDataUrl("image/jpeg", 120 * 1024),
        },
        adminToken
      );
      const resLargeThumb = await POST(reqLargeThumb, { params: Promise.resolve({ id: subA.id }) });
      assert(resLargeThumb.status === 413, "Thumbnail > 100KB returns 413 Payload Too Large");

      // original أكبر من 10MB (مثلاً 11MB)
      const reqLargeOrig = makeRequest(
        "POST",
        `/api/subscribers/${subA.id}/photo`,
        {
          original: createDummyDataUrl("image/jpeg", 11 * 1024 * 1024),
          cropped: createDummyDataUrl("image/jpeg", 150 * 1024),
          thumbnail: createDummyDataUrl("image/jpeg", 50 * 1024),
        },
        adminToken
      );
      const resLargeOrig = await POST(reqLargeOrig, { params: Promise.resolve({ id: subA.id }) });
      assert(resLargeOrig.status === 413, "Original > 10MB returns 413 Payload Too Large");
    }

    // ─── 6. الرفع الناجح وتحديث قاعدة البيانات وسجل التدقيق ───
    console.log("\n--- 6. Successful Upload & Persistence ---");
    {
      const validOriginal = createDummyDataUrl("image/jpeg", 200 * 1024);
      const validCropped = createDummyDataUrl("image/jpeg", 80 * 1024);
      const validThumbnail = createDummyDataUrl("image/jpeg", 20 * 1024);

      const reqValid = makeRequest(
        "POST",
        `/api/subscribers/${subA.id}/photo`,
        {
          original: validOriginal,
          cropped: validCropped,
          thumbnail: validThumbnail,
          faceDetected: true,
        },
        adminToken
      );
      const resValid = await POST(reqValid, { params: Promise.resolve({ id: subA.id }) });
      assert(resValid.status === 200, "Valid photo upload returns 200 OK");

      const resJson = await resValid.json();
      assert(resJson.success === true, "Response has success: true");
      assert(resJson.photo.faceDetected === true, "Response has faceDetected: true");

      // التحقق من قاعدة البيانات
      const photoDb = await db.subscriberPhoto.findUnique({
        where: { subscriberId: subA.id },
      });
      assert(Boolean(photoDb), "SubscriberPhoto record was created in database");
      assert(photoDb?.faceDetected === true, "SubscriberPhoto has faceDetected: true");
      assert(photoDb?.cropped === validCropped, "SubscriberPhoto cropped matches");

      const subDb = await db.subscriber.findUnique({
        where: { id: subA.id },
      });
      assert(subDb?.photoPath === `db://${subA.id}`, "Subscriber.photoPath updated to db://<id>");
      assert(subDb?.photoThumb === `db://${subA.id}?size=thumbnail`, "Subscriber.photoThumb updated");

      // التحقق من سجل التدقيق AuditLog
      const auditEntry = await db.auditLog.findFirst({
        where: {
          entityType: "subscriber_photo",
          entityId: subA.id,
          action: "update",
        },
      });
      assert(Boolean(auditEntry), "AuditLog entry created for subscriber photo update");
    }

    // ─── 7. قراءة الصورة GET ───
    console.log("\n--- 7. GET Photo (Data URL & Raw Buffer) ---");
    {
      // GET JSON cropped
      const reqGet = makeRequest("GET", `/api/subscribers/${subA.id}/photo?size=cropped`);
      const resGet = await GET(reqGet, { params: Promise.resolve({ id: subA.id }) });
      assert(resGet.status === 200, "GET photo cropped returns 200");
      const jsonGet = await resGet.json();
      assert(Boolean(jsonGet.photo), "GET photo returns photo data URL");

      // GET raw image
      const reqRaw = makeRequest("GET", `/api/subscribers/${subA.id}/photo?raw=1`);
      const resRaw = await GET(reqRaw, { params: Promise.resolve({ id: subA.id }) });
      assert(resRaw.status === 200, "GET raw image returns 200");
      assert(resRaw.headers.get("Content-Type") === "image/jpeg", "GET raw has Content-Type: image/jpeg");
    }

    // ─── 8. حذف الصورة DELETE ───
    console.log("\n--- 8. DELETE Photo ---");
    {
      const reqDel = makeRequest("DELETE", `/api/subscribers/${subA.id}/photo`, null, adminToken);
      const resDel = await DELETE(reqDel, { params: Promise.resolve({ id: subA.id }) });
      assert(resDel.status === 200, "DELETE photo returns 200 OK");

      const photoAfter = await db.subscriberPhoto.findUnique({
        where: { subscriberId: subA.id },
      });
      assert(photoAfter === null, "SubscriberPhoto was deleted from DB");

      const subAfter = await db.subscriber.findUnique({
        where: { id: subA.id },
      });
      assert(subAfter?.photoPath === null, "Subscriber.photoPath set to null");
      assert(subAfter?.photoThumb === null, "Subscriber.photoThumb set to null");
    }

    console.log("\n==================================================");
    console.log("🎉 ALL API HARDENING TESTS (CRITERIA 10-14) PASSED!");
    console.log("==================================================");
  } finally {
    // تنظيف بيانات الاختبار
    await db.subscriberPhoto.deleteMany({
      where: { subscriberId: { in: [`sub-a-${timestamp}`, `sub-b-${timestamp}`] } },
    });
    await db.auditLog.deleteMany({
      where: { entityId: { in: [`sub-a-${timestamp}`, `sub-b-${timestamp}`] } },
    });
    await db.subscriber.deleteMany({
      where: { id: { in: [`sub-a-${timestamp}`, `sub-b-${timestamp}`] } },
    });
    await db.session.deleteMany({
      where: {
        id: { in: [adminToken, assistantToken, lifeguardToken, superadminToken] },
      },
    });
    await db.user.deleteMany({
      where: {
        id: {
          in: [
            `u-admin-${timestamp}`,
            `u-asst-${timestamp}`,
            `u-life-${timestamp}`,
            `u-super-${timestamp}`,
          ],
        },
      },
    });
    await db.club.deleteMany({
      where: { id: { in: [clubAId, clubBId] } },
    });
  }
}

runApiVerification().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
