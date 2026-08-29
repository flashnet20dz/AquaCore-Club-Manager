# Task ID: 2 — Agent: member-portal-builder

## Task
بوابة المنخرط /member/[token] — بطاقة رقمية عمومية (بدون auth) + API توليد روابط موقّعة HMAC.

## Work Log
- قرأ worklog.md + schema.prisma (Subscriber/Attendance/Club/Setting/SubscriptionType) + lib/db,lib/session,lib/rcs,lib/rate-limit + عيّنة API (api/subscribers/route.ts) + layout.tsx (dir=rtl مؤكد، ThemeProvider).
- ثبّت `qrcode@1.5.4` + `@types/qrcode@1.5.6` (كان مفقوداً؛ qrcode.react الموجود للعميل فقط).
- أنشأ `src/lib/portal-token.ts`: توكن HMAC-SHA256 محدَّد (deterministic، بدون timestamp حسب تعليمات GET idempotent): payload = subscriberId، sig = أول 32 hex من HMAC، token = base64url(payload)+"."+base64url(sig). التحقق بـ timingSafeEqual. بدون انتهاء صلاحية (موثّق: يدوّر فقط عند تغيير MEMBER_PORTAL_SECRET).
- أنشأ `src/app/api/member-portal/route.ts`: POST (body {subscriberId}) + GET (?subscriberId=) — كلاهما 401 بلا جلسة، rate limit 30/د/IP (نمط login)، عزل clubId (superadmin يرى الكل)، findFirst مع deletedAt: null، 404 إن لموجد. يُعيد { url: "/member/<token>", token, subscriber: {id,name,fileNumber} }.
- أنشأ `src/app/member/[token]/page.tsx` (Server Component، params Promise حسب Next 16): تحقق التوكن → صفحة "رابط غير صالح أو منتهي" أنيقة؛ جلب المنخرط (مع club.name) + Settings clubName/clubPhone + آخر 12 حضوراً (date desc) + إعدادات نوع الاشتراك من DB (durationDays صحيح) ثم computeSubscriberFieldsDynamic/computeSubscriberFields من lib/rcs (إعادة استخدام، لا تكرار). QR على الخادم عبر QRCode.toDataURL(verificationUrl) حيث origin من headers() (host + x-forwarded-proto، fallback http://localhost:3000). بطاقة موبايل-أولاً rounded-3xl، ترويسة متدرجة teal→emerald، شارة حالة بألوان RENEWAL_STATUS_COLORS المستوردة، أيام متبقية، سجل حضور بتنسيق ar-DZ، تذييل tel: للتجديد. لا بيانات حساسة (لا مبالغ/دفعات/هاتف منخرط).
- تحقق: esbuild للملفات الثلاثة ✓، eslint للملفات الثلاثة = 0 أخطاء/0 تحذيرات ✓، tsc --noEmit: 0 أخطاء في ملفاتي (المشروع فيه 128 خطأ موروثاً في ملفات أخرى لا علاقة بها) ✓، اختبار roundtrip توكن في /home/z/tmp-portal-test ثم حذفه (7/7 PASS) ✓، QR toDataURL يعمل ✓.
- ملاحظة بيئية: خادم dev كان متوقفاً أثناء الفحص (لا مستمع على 3000؛ Caddy على 81 يُعيد 502) — لم أشغّله التزاماً بالتعليمات؛ hot reload سيصدر الملفات عند إعادة التشغيل.

## Stage Summary
- الملفات المنشأة (فقط، لم يُعدَّل أي ملف موجود):
  - src/lib/portal-token.ts (88 سطراً)
  - src/app/api/member-portal/route.ts (143 سطراً)
  - src/app/member/[token]/page.tsx (425 سطراً)
- API: POST /api/member-portal {subscriberId} → 200 {url,token,subscriber{id,name,fileNumber}} | 401 | 400 | 404 | 429 ; GET ?subscriberId= نفس العقد (idempotent لأن التوكن محدد).
- قرار: التوكن دائم ومحدَّد (payload=subscriberId فقط) — الرابط يتغير فقط عند تدوير MEMBER_PORTAL_SECRET.
- الألوان: "✅ ساري"=emerald، "⚠️ قريب الانتهاء"=amber، "⛔ منتهي - يتطلب تجديد"=rose، "🔒 مجمدة"=slate (من RENEWAL_STATUS_COLORS)، ""=fallback slate "لا يوجد اشتراك مدفوع".
- QR: حزمة qrcode على الخادم، تشفّر عنوان الصفحة الحالي المبني من headers().
