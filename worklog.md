---
Task ID: reports-center-rebuild
Agent: main
Task: إعادة بناء قسم التصدير إلى مركز تقارير احترافي + إصلاح خطأ مصمم البطاقات + نقل إعدادات الترويسة الموحدة إلى الإعدادات

Work Log:
- شخّص خطأ "Application error" في cards-designer: missing import `Pencil` + missing prop `handleDoubleClick` على `CardCanvasScaler` + `fileInputRef?.click()` على cards-panel
- أنشأ `src/components/unified-report-header.tsx` — مكوّن موحّد واحد `UnifiedReportHeader` + دالة `unifiedReportHeaderHTML` لتوليد HTML للتصدير
- أنشأ `src/components/unified-header-settings.tsx` — محرر inline للترويسة (معلومات النادي + عناصر + معلومات التقرير + تنسيق + معاينة مباشرة)
- أضاف تبويب "📄 الترويسة الموحدة" إلى `settings-panel.tsx` يضم `UnifiedHeaderSettings`
- أزال `EnteteEditor` modal من `export-panel.tsx` وأعاد تصميمه كمركز تقارير ReportsCenter + تصدير سريع QuickExports
- أنشأ `src/components/reports/index.tsx` — 15 تقرير مستقل + ReportViewer + REPORT_REGISTRY
- ربط `page.tsx`: تبويب export يعرض ExportPanel، وعند الضغط على تقرير يفتح ReportViewer كصفحة مستقلة
- أصلح أخطاء TS الموجودة مسبقاً (fetchTypes → fetchDays/fetchSlots)
- تحقق: `npx tsc --noEmit` + `npx next build` → نجاح كامل (42 صفحة، 0 أخطاء)

Stage Summary:
- ✅ مصمم البطاقات يعمل (إصلاح Pencil + handleDoubleClick)
- ✅ الترويسة الموحدة: مكوّن واحد `UnifiedReportHeader` يُستخدم في كل التقارير
- ✅ إعدادات الترويسة منقولة إلى: الإعدادات → إعدادات النادي → الترويسة الموحدة
- ✅ معاينة مباشرة للترويسة أثناء التحرير
- ✅ 15 تقرير مستقل، كل واحد بصفحة كاملة: ترويسة موحدة + إحصائيات + فلاتر + جدول + ترقيم صفحات + بحث + ترتيب + تصدير PDF/Word/Excel/طباعة
- ✅ مكونات مشتركة (ReportToolbar, ReportStatCard, ReportTable, FilterChips, ReportShell) — لا تكرار كود
- ✅ Build ناجح

التقارير المنفذة (15):
1. قائمة المنخرطين (فلترة جنس/نوع/حالة + 4 إحصائيات)
2. قائمة التأمين (مؤمنون/غير مؤمنين)
3. حقوق دخول المركب (≥ 1300 دج + ساري)
4. قائمة التجديدات (اليوم/أسبوع/شهر/الكل)
5. سجل الحضور (اليوم/أسبوع/شهر/الكل)
6. التقرير المالي (اشتراكات/تأمين/مركب/إيرادات/مصاريف/رصيد)
7. الاشتراكات المنتهية (منتهية/7 أيام/30 يوم)
8. تقرير الغياب (أيام الغياب + آخر حضور + نسبة الحضور)
9. الفئات العمرية (4 فئات بحد 13 سنة)
10. أنواع الاشتراك (عادي/OPOW/DJS/FCS/RCS/POLICE/MJ)
11. أيام السباحة
12. أوقات السباحة
13. فصائل الدم
14. الأعمار
15. المدربين

Files created:
- src/components/unified-report-header.tsx
- src/components/unified-header-settings.tsx
- src/components/reports/index.tsx

Files modified:
- src/components/cards-designer.tsx (إصلاح Pencil import + handleDoubleClick prop)
- src/components/cards-panel.tsx (إصلاح fileInputRef.current?.click())
- src/components/export-panel.tsx (إعادة هيكلة كاملة → ReportsCenter + QuickExports)
- src/components/settings-panel.tsx (إضافة تبويب الترويسة الموحدة + إصلاح fetchTypes)
- src/app/page.tsx (openReportId state + ReportViewer + handleTabChange)

---
Task ID: contracts-feature
Agent: main
Task: إضافة واجهة "عقود العمال" الكاملة (DB + APIs + UI)

Work Log:
- أضاف 3 جداول Prisma: Employee, EmploymentContract, ContractTemplate (مع علاقات للنادي والمستخدمين)
- أضاف العلاقة العكسية على Club و User
- أنشأ ملف `src/lib/contract-variables.ts` — محرك استبدال الحقول الديناميكية (17 متغيراً: club_name, worker_name, birth_date, position, contract_number, start_date, end_date, hour_rate, today, إلخ)
- أنشأ APIs كاملة:
  - `/api/contract-templates` — GET (auto-seeds 6 قوالب افتراضية) + POST + PATCH + DELETE
  - `/api/employees` — GET + POST + PATCH + DELETE
  - `/api/contracts` — GET (archive) + POST (إنشاء مع توليد رقم عقد تلقائي CTR-YYYY-NNN + استبدال الحقول تلقائياً)
  - `/api/contracts/[id]` — GET + PATCH (يدعم action: renew لتجديد العقد) + DELETE
- أنشأ `src/components/contracts-panel.tsx` بـ 4 تبويبات:
  1. قائمة العمال (CRUD + جدول كامل)
  2. أرشيف العقود (عرض/طباعة/Word/تجديد/حذف)
  3. قوالب العقود (CRUD + محرر مع معاينة مباشرة + مساعد الحقول)
  4. إنشاء عقد (اختيار عامل + قالب + معاينة مباشرة + توليد وحفظ)
- ربط تبويب "عقود العمال" في page.tsx (desktop + mobile nav + dynamic title)
- جميع العقود تستخدم `UnifiedReportHeader` — نفس ترويسة التقارير
- 6 قوالب افتراضية: حارس سباحة، مدرب، إداري، عامل صيانة، منظفة، موسمي
- Build ناجح: 45 صفحة، 6 APIs جديدة، 0 أخطاء

Stage Summary:
- ✅ جدول قائمة العمال: اسم/منصب/هاتف/توظيف/عقود/حالة + إجراءات
- ✅ قوالب العقود: 6 جاهزة + إضافة/تعديل/حذف + معاينة + مساعد حقول {{}}
- ✅ إنشاء عقد: اختيار عامل+قالب → تعبئة تلقائية + معاينة مباشرة + حفظ في الأرشيف
- ✅ أرشيف العقود: رقم/عامل/منصب/مدة/نسخة/حالة + عرض/طباعة/Word/تجديد/حذف
- ✅ تجديد العقد: توليد عقد جديد بنفس البيانات + رقم جديد + رفع النسخة
- ✅ حقول ديناميكية 17: club_name, worker_name, birth_date, position, contract_number, start_date, end_date, hour_rate, today, إلخ
- ✅ UnifiedReportHeader مستخدمة في كل العقود (طباعة + Word)
- ✅ Multi-Tenant: كل بيانات معزولة بـ clubId
- ✅ Prisma Client مُولّد بنجاح + 0 أخطاء build

Files created:
- prisma/schema.prisma (3 جداول جديدة)
- src/lib/contract-variables.ts
- src/app/api/contract-templates/route.ts
- src/app/api/contract-templates/[id]/route.ts
- src/app/api/employees/route.ts
- src/app/api/employees/[id]/route.ts
- src/app/api/contracts/route.ts
- src/app/api/contracts/[id]/route.ts
- src/components/contracts-panel.tsx

Files modified:
- src/app/page.tsx (import ContractsPanel + تبويب جديد + mobile nav + dynamic title)
- .env (DIRECT_URL for prisma generate)

---
Task ID: 1
Agent: Main Agent (Z.ai Code)
Task: نقل مشروع AquaCore-Club-Manager كاملاً من GitHub إلى بيئة المعاينة (preview environment)

Work Log:
- استنساخ المستودع إلى /tmp وتحليل شامل (45 نموذج Prisma، 110 مسارات API، Next 16 + Electron + Capacitor)
- نقل المستودع كاملاً (بما فيه سجل git البالغ 81MB) إلى /home/z/my-project مع الحفاظ على مجلد skills البيئي
- توليد مخطط SQLite محدث عبر scripts/generate-sqlite-schema.js (كان قديماً: 30 نموذج من أصل 45) واستبدال schema.prisma به مع حفظ الأصل في schema.prisma.postgresql-original.bak
- إنشاء .env: DATABASE_URL=file:../db/custom.db + NEXTAUTH_SECRET و ACTIVATION_HMAC_SECRET عشوائيين (بدل الـ fallback المكتوبة في الكود)
- تثبيت 1168 حزمة عبر bun (مع ELECTRON_SKIP_BINARY_DOWNLOAD=1)
- prisma db push + كتابة scripts/seed-demo.ts: نادٍ نشط + 3 مستخدمين + 4 أنواع اشتراك + أيام/4 فترات + 42 منخرطاً + 30 دفعة + 527 سجل حضور (21 يوماً) + 36 معاملة مالية (رصيد 35,500 دج) + 3 انتظار + PIN كاشير 1234
- إصلاح خطأ تجميع رصيد في السكربت + تخفيف ضجيج prisma:query في db.ts (إزالة log query من وضع dev)
- تشغيل الخادم والتحقق بالمتصفح: تسجيل دخول admin@rcs.dz ✓، كل التبويبات الـ23 ✓، تسجيل حضور تفاعلي (POST 201) ✓، لوحة مالية مطابقة للبيانات ✓، تنبيهات تجديد (6) ✓، تجاوب موبايل 390px ✓، كونسول نظيف ✓

Stage Summary:
- المشروع يعمل كاملاً في المعاينة على المنفذ 3000 بقاعدة SQLite محلية
- تصحيح مهم لمراجعة سابقة: "خطأي الصياغة في export/route.ts و kiosk-mode.tsx" لم يكونا حقيقيين — أدات Bash تلتهم تسلسل [h] عند العرض (ثبت بفحص رموز الحروف). الأصل في git سليم
- الثغرات الحقيقية المؤكدة بأداة Read: POST /api/users يقبل role دون قائمة بيضاء (تصعيد صلاحيات)، مفاتيح Cloudinary في .env.example، بيانات أعضاء في download/
- تعديلات على كود المشروع: schema.prisma (sqlite)، .env جديد، db.ts (log)، sync.ts (حماية Array.isArray)، scripts/seed-demo.ts (جديد)
- الحسابات: admin@rcs.dz/admin123، coach@rcs.dz/coach123، guard@rcs.dz/coach123، PIN 1234

---
Task ID: sec-fixes-1
Agent: Z.ai Code (main)
Task: التحقق من قائمة 12 خطأ مُبلَّغة وكتابة الإصلاحات الأمنية الحرجة (1,2,3,4,5,13)

Work Log:
- تحقق من البنود الـ12 ضد المستودع: 10 مؤكدة، البندان 1 و13 (خطأا الصياغة المزعومان) خداع بصري — عارض مخرجات Bash يلتهم تسلسل ]h[ (ثُبت بـ awk length=59/37 + esbuild exit=0)
- نسخ المستودع إلى /home/z/AquaCore-Club-Manager وكتابة 4 إصلاحات أمنية: قفل cron بـ CRON_SECRET (timing-safe)، إزالة باكدور admin123 (SEED_DEFAULT_ADMIN + كلمة سر عشوائية)، whitelist أدوار في POST /api/users، عزل sync/push (قائمة نماذج + فحص ملكية clubId + فرض clubId + حظر delete غير المدعوم)
- تنظيف .env.example: إزالة مفاتيح Cloudinary الحقيقية + توثيق CRON_SECRET/SEED_DEFAULT_ADMIN/ACTIVATION_HMAC_SECRET
- اكتشاف: تدفق activationCode في sync/push كان معطوباً أصلاً (payload ينقصه codeHash/batchId الإجباريان) — الرفض الصريح ليس تراجعاً
- توليد security-fixes.patch وتطبيقه أيضاً على نسخة المعاينة /home/z/my-project (استُبعد .env.example ثم أُصلح يدوياً)
- اختبارات حية ناجحة: cron مجهول=401، هجوم superadmin عبر POST users=400 "دور غير صالح"، إنشاء lifeguard سليم=201، كلمة سر ضعيفة=400، sync بلا مفتاح=401
- تحقق متصفح: دخول admin@rcs.dz ✓ لوحة التحكم بـ42 منخرطاً ✓ صفر أخطاء كونسول ✓

Stage Summary:
- الإصلاحات الأربعة مطبقة في النسختين: /home/z/my-project (المعاينة الحية) و/home/z/AquaCore-Club-Manager
- ملف الرقعة الجاهز لمستودع GitHub: /home/z/AquaCore-Club-Manager/security-fixes.patch (5 ملفات، +157/-25)
- متطلبات ما بعد التطبيق: ضبط CRON_SECRET في البيئة وترويسة x-cron-secret بجدولة Vercel، تدوير مفتاح Cloudinary المسرب، تغيير كلمات سر admin123 في أي نشر قائم
- المتبقي من القائمة (غير مُصلح): 6 سر HMAC في عميل التفعيل، 7 POS في localStorage، 8 انحراف مخطط SQLite، 9-10 كود ميت/تقسيم، 11 ربط durationDays بـ QR، 12 اختبارات

---
Task ID: 2
Agent: member-portal-builder
Task: بوابة المنخرط /member/[token]

Work Log:
- قرأ العمل السابق في worklog.md + المخطط (Subscriber/Attendance/Club/Setting/SubscriptionType) + lib/db,lib/session,lib/rcs,lib/rate-limit + عيّنة API conventions (api/subscribers) + layout.tsx (html dir=rtl مؤكد — الصفحة تصر داخل الجذر بلا افتراضات sidebar)
- ثبّت حزمة `qrcode` + `@types/qrcode` (كانت مفقودة — qrcode.react الموجودة تصلح للعميل فقط لا لتوليد DataURL على الخادم)
- أنشأ src/lib/portal-token.ts — توكن HMAC-SHA256 محدَّد (deterministic، الحمولة = subscriberId فقط دون timestamp، بناءً على طلب GET idempotent): token = base64url(subscriberId) + "." + base64url(أول 32 hex من HMAC)؛ التحقق بمقارنة زمنية ثابتة crypto.timingSafeEqual؛ بلا انتهاء صلاحية (موثّق في التعليق: الرابط يدوّر فقط عند تغيير MEMBER_PORTAL_SECRET، والأثر محدود لأن الصفحة قراءة-فقط بلا بيانات حساسة)
- أنشأ src/app/api/member-portal/route.ts — POST (body {subscriberId}) وGET (?subscriberId=) بنفس العقد: 401 بلا جلسة getCurrentUser، rate limit 30 طلب/دقيقة/IP (نفس نمط login: rateLimit+incrementRateLimit+getClientIp)، عزل clubId (superadmin يرى كل النوادي)، findFirst مع deletedAt: null → 404 "المنخرط غير موجود"؛ يُعيد { url: "/member/<token>", token, subscriber: { id, name (lastName firstName), fileNumber } }
- أنشأ src/app/member/[token]/page.tsx — Server Component (params Promise وفق Next 16: `const { token } = await params`)، عمومية بلا auth: توكن غير صالح → صفحة "رابط غير صالح أو منتهي" أنيقة بأسلوب النادي؛ منخرط محذوف/غير موجود → "هذا الرابط لم يعد صالحاً". جلب متوازٍ: إعدادات النادي (clubName/clubPhone مع fallback إلى Club.name/Club.phone) + آخر 12 حضوراً (date desc، checkInTime desc) + إعدادات نوع الاشتراك من قاعدة البيانات (لضبط durationDays) ثم حساب الحالة عبر computeSubscriberFieldsDynamic/computeSubscriberFields من @/lib/rcs (إعادة استخدام كاملة — لا تكرار منطق)
- QR على الخادم: QRCode.toDataURL(verificationUrl) — العنوان المطلق يُبنى من headers() (host + x-forwarded-proto مع fallback http://localhost:3000) ويشفر عنوان الصفحة نفسها للتحقق عند المسح
- تصميم بطاقة رقمية موبايل-أولاً (max-w-md، rounded-3xl): ترويسة متدرجة teal-600→emerald-500 باسم النادي، اسم المنخرط (اللقب الاسم)، شارة الحالة بألوان RENEWAL_STATUS_COLORS المستوردة من lib/rcs، رقم الملف، تاريخ الانتهاء + عدّاد "متبقي/انتهى منذ X يوماً"، رقاقات أيام/فترة السباحة، QR كبير، سجل آخر حضور بتنسيق ar-DZ (التاريخ + الوقت + طريقة: مسح QR/تسجيل يدوي) بحد ارتفاع مع تمرير، تذييل زر "تواصل للتجديد" برابط tel: لهاتف النادي. صفر بيانات حساسة (لا مبالغ، لا سجل دفعات، لا هاتف المنخرط)
- تحقق: esbuild للملفات الثلاثة ✓، eslint للملفات الثلاثة = 0 أخطاء/0 تحذيرات ✓، tsc --noEmit: صفر أخطاء في الملفات الجديدة (المشروع يحمل 128 خطأ TS موروثاً في ملفات أخرى غير متصلة) ✓، اختبار roundtrip للتوكِن خارج المستودع (mkdir /home/z/tmp-portal-test ثم حذفه): deterministic/roundtrip/tampered/garbage/empty/wrong-sig-len/url-safe كلها PASS ✓، اختبار توليد QR فعلي ✓
- ملاحظة بيئية: خادم dev كان متوقفاً أثناء الفحص (لا مستمع على 3000 وCaddy يُعيد 502) — لم يُشغَّل التزاماً بتعليمات المهمة؛ hot reload سيحمل الملفات عند إعادة التشغيل

Stage Summary:
- ملفات منشأة (لم يُعدَّل أي ملف موجود ولا page.tsx ولا مصمم البطاقات):
  - src/lib/portal-token.ts — 88 سطراً
  - src/app/api/member-portal/route.ts — 143 سطراً
  - src/app/member/[token]/page.tsx — 425 سطراً
- عقد API: POST /api/member-portal {subscriberId} → 200 {url, token, subscriber{id,name,fileNumber}} | 401 غير مصرح | 400 | 404 | 429؛ GET ?subscriberId= بنفس العقد (idempotent — الرابط نفسه دائماً لنفس المنخرط)
- قرار التوكن: دائم ومحدَّد (الحمولة = subscriberId فقط) — يدوّر فقط عند تغيير MEMBER_PORTAL_SECRET؛ الإنتاج يجب أن يضبط المتغير (موثّق في الترويسة)
- سلاسل حالات التجديد المكتشفة في lib/rcs.ts وتلوينها: "✅ ساري"=emerald، "⚠️ قريب الانتهاء"=amber، "⛔ منتهي - يتطلب تجديد"=rose، "🔒 مجمدة"=slate (كلها من RENEWAL_STATUS_COLORS)، والحالة الفارغة (لا تاريخ دفع) → fallback slate بنص "لا يوجد اشتراك مدفوع"
- QR: حزمة qrcode على الخادم (تُثبَّت)، تشفّر عنوان الصفحة الحالي المبني من headers()

---
Task ID: 3
Agent: gamification-builder
Task: نظام الإنجازات Gamification

Work Log:
- قراءة worklog.md + schema.prisma (Subscriber/Attendance/Setting) + db.ts + session.ts + نموذج analytics/route.ts + نمط rate-limit من auth/login
- أنشأ src/lib/achievements.ts — محرك حسابي نقي بلا أي استيراد DB: computeAchievements (يقبل Date[] أو {attendances}) يحسب total/currentStreak/longestStreak/monthlyTotal + المستوى + 8 أوسمة بـ progress وnext
- منطق الأسبوع: الاثنين→الأحد عبر startOfWeek (setDate لتجنب DST)؛ السلسلة الحالية تعود أسبوعاً بأسبوع وتتخطى الأسبوع الحالي غير المكتمل (لا يكسرها)؛ أطول سلسلة بمسح تصاعدي للمفاتيح الفريدة
- أنشأ src/app/api/achievements/route.ts — GET محمي بـ getCurrentUser (401) + rateLimit 60/دقيقة لكل IP (429 مع Retry-After) + عزل clubId بنمط analytics (superadmin={})
- الوضع العام: subscribers (deletedAt:null) + attendances آخر 6 أشهر فقط (select date) → leaderboard أفضل 10 (ترتيب: total→streak→monthly→الاسم)، myTop أفضل 3، distribution للمستويات الأربعة، stats (totalSubscribers/activeThisWeek/avgAttendance)، badgeCatalog (عدد فاتحي كل وسام + النسبة)
- وضع ?subscriberId=: تحقق ملكية المنخرط للنادي (findFirst بـ clubFilter + deletedAt:null) → إنجازاته الكاملة بكل الأوسمة مع progress (404 إن غير موجود)
- أنشأ src/components/achievements-panel.tsx — لوحة RTL كاملة: ترويسة + 3 بطاقات إحصائيات، منصة تتويج بذهبي/فضي/برونزي gradients (Trophy header، Flame للسلسلة، أيقونات الأوسمة المفتوحة)، جدول ترتيب max-h-96 overflow-y-auto بـ scrollbar مخصص + صفوف قابلة للنقر (Enter/Space) لجلب إنجازات المنخرط عبر ?subscriberId=، توزيع المستويات بأشرطة Progress بألوان كل مستوى (قلب -scale-x-100 للـ RTL)، كتالوج 8 أوسمة (مفتوح ملون / مقفل grayscale + progress نحو العتبة)
- Skeletons للتحميل، حالة خطأ بزر إعادة محاولة + sonner toast، حالة فارغة "لا توجد بيانات كافية بعد — سجل الحضور أولاً"، motion دخول متدرج خفيف، موبايل أولاً (grid-cols-1 → sm/lg)
- تحقق: bunx esbuild للملفات الثلاثة → نجاح كامل (0 أخطاء) + tsc --noEmit: صفر أخطاء في الملفات الجديدة (128 خطأ pre-existing في ملفات أخرى غير متعلقة)
- لم يُعدَّل أي ملف موجود — لا wiring في page.tsx (عمداً، حسب القيود: الربط يتولاها الوكيل الرئيسي عبر <AchievementsPanel />)

Stage Summary:
- Files created:
  - src/lib/achievements.ts (محرك نقي: مستويات + أوسمة + أسابيع اثنين→أحد)
  - src/app/api/achievements/route.ts (GET + rate limit + عزل نادي + وضع منخرط واحد)
  - src/components/achievements-panel.tsx (لوحة RTL: تتويج + ترتيب + توزيع + كتالوج)
- API contract:
  - GET /api/achievements → { leaderboard: [{subscriberId, name, fileNumber, total, monthlyTotal, currentStreak, level:{label,color}, badges:[{id,label,icon}]}] (أفضل 10), distribution: [{level, count, color}] ×4, stats: {totalSubscribers, activeThisWeek, avgAttendance}, myTop: (أفضل 3 بنفس بنية leaderboard), badgeCatalog: [{id, label, icon, description, threshold, unlockedCount, unlockRate}] }
  - GET /api/achievements?subscriberId=X → { subscriber: {id, name, fileNumber}, achievements: {total, currentStreak, longestStreak, monthlyTotal, level:{label,color}, badges:[{id,label,icon,description,unlocked,progress,next,value}]} }
  - أخطاء: 401 غير مصرح، 404 منخرط غير موجود، 429 تجاوز 60 طلب/دقيقة (Retry-After)
- Level thresholds: مبتدئ <10 (#64748b slate) • متوسط 10-24 (#0ea5e9 sky) • متقدم 25-49 (#8b5cf6 violet) • بطل 50+ (#f59e0b amber)
- Badge thresholds: أول حضور 1 • منتظم 10 • مثابر 25 • أسطورة المسبح 50 • نجم النادي 100 • سلسلة 5/10 أسابيع (أطول سلسلة) • شهر كامل 12 حضوراً بالشهر الحالي
- ملاحظة تكامل: أضف <AchievementsPanel /> إلى تبويب في page.tsx لعرض الميزة (لم يُنفذ التزاماً بقيود "لا تعديل ملفات موجودة")

---
Task ID: roadmap-wave-1
Agent: Z.ai Code (main) + وكيلان (member-portal-builder, gamification-builder)
Task: تنفيذ الموجة الأولى من خارطة الطريق الكاملة + مراجعة اقتراحات المستخدم الـ15

Work Log:
- جرد اقتراحات المستخدم الـ15: الموجود فعلاً (تحليلات أساسية، PWA، وضع ليلي، Ctrl+K، صور، مزامنة، Capacitor، rate-limit دخول، AuditLog سوبر-أدمن) مقابل الناقص
- Task-2 (وكيل): بوابة المنخرط — portal-token.ts (HMAC ثابت) + /api/member-portal + /member/[token] (بطاقة رقمية QR بخادم qrcode) — 7/7 اختبارات توكن
- Task-3 (وكيل): الإنجازات — achievements.ts (مستويات/شارات/سلاسل) + /api/achievements + achievements-panel.tsx (790 سطراً)
- إصلاح C4: qr-checkin + whatsapp/remind يستخدمان durationDays من getTypeConfig بدل 30 ثابتة
- لوحة 2.0: /api/dashboard-extras (تسرب 12 + حرارة 7×14 ذروة 51 + أفضل 5 + هدف 46,000 دج + جدول 7 أيام) + dashboard-extras.tsx
- إصلاح Prisma: إزالة amount:{not:null} (مرفوض على حقل غير nullable) من dashboard-extras وai/insights
- أتمتة WhatsApp: lib/whatsapp.ts (Meta Cloud API أو wa.me) + /api/whatsapp/send دفعات + رابط البوابة في الرسالة
- معالج إعداد أولي بـ4 خطوات يفحص /api/stats + /api/settings + /api/users
- إشعارات: action clearRead + تصفية بالأنواع في الجرس
- المساعد الذكي (z-ai-web-dev-sdk خادمياً): تحليل عربي حي بتوصيات — يعمل في المعاينة فقط (غير منقول للمستودع عمداً)
- إعادة تشغيل الخادم مرات عدة (يموت بين جلسات bash) — الاختبارات دمجت مع التشغيل في جلسة واحدة
- ربط page.tsx (3 ودجات) + زر البوابة في سجل المنخرط — بدون لمس card-designer إطلاقاً
- نقل 17 ملفاً لنسخة المستودع (استبعاد ai/insights) + package.json (qrcode) + .env.example — كلها esbuild ✓
- دفع features-wave-1 إلى GitHub (فوق security-hotfixes)

Stage Summary:
- 8 ميزات جديدة تعمل حياً في المعاينة (بوابة، إنجازات، لوحة 2.0، واتساب، onboarding، إشعارات، ذكاء، إصلاح QR)
- فرعا GitHub: security-hotfixes ثم features-wave-1 (شجرة: main → hotfixes → wave-1)
- متغيرات بيئة جديدة: MEMBER_PORTAL_SECRET، WHATSAPP_TOKEN/PHONE_NUMBER_ID (اختياري)، NEXT_PUBLIC_APP_URL
- من اقتراحات الـ15: بُني 1,2,3(قراءة),5,6,8,13 — موجود مسبقاً 11,12,14 — مؤجل 4(جزئي),7,9,10,15
---
Task ID: settings-sync-full
Agent: Z.ai Code (main)
Task: إصلاح «أيام السباحة فارغة في الإعدادات ← المنخرطون» + تحقيق «كل ميزة لها إعدادات متزامنة معها»

Work Log:
- التشخيص: أيام السباحة كانت تُبذر في seed-demo.ts فقط؛ تسجيل /api/clubs/register والبذر القياسي لا ينشئان شيئاً → جدول فارغ للنوادي الحقيقية
- src/lib/feature-defaults.ts: DEFAULT_SWIM_DAYS (7 أيام، السبت مغلق) + DEFAULT_SWIM_SLOTS (5) + ensureSwimDefaults(clubId, force?) بعلم Setting «swimDefaultsSeeded» يمنع إحياء حذف المدير المتعمد
- ربط البذر: GET /api/swimming-days + GET /api/swimming-slots (كسول) + POST /api/clubs/register (عند الإنشاء) + PUT /api/swimming-days (زر استعادة يدوي)
- src/hooks/use-swim-config.ts: كاش وحدة 30ث + نمط اشتراك (invalidateSwimConfig تُبلّغ المكونات المثبتة → إعادة جلب فوري بلا reload) + fallback لقوائم rcs.ts
- تحويل 3 مستهلكين من الثوابت إلى الديناميكي: subscriber-form (رقاقتا الأيام/التوقيت + الحقل المخصص)، waitlist-panel (Selectان + السعة)، compensations-panel (4 Selectات في 3 نوافذ: إغلاق/جدولة/جماعي) — بقيم مشتقة effectiveDays/effectiveSlot بدل useEffect+setState (توافق قواعد React)
- src/lib/feature-settings.ts: سجل 6 مجموعات/9 مفاتيح (memberPortalEnabled, gamificationEnabled, reminderRepeatDays=1, attendanceAbsenceWindowDays=21, waitlistDefaultCapacity=30, monthlyRevenueTarget, whatsappEnabled, whatsappTemplate) + getFeatureSettings مدمجة الافتراضيات
- /api/feature-settings GET/PUT: قبول مفاتيح السجل فقط (مفتاح دخيل = 400)، PUT للأمين فقط
- src/components/feature-settings-hub.tsx + تبويب «🧩 الميزات» في settings-panel: بطاقات لكل ميزة مع مفتاح/حقل + قسم «أين تُستخدم هذه الإعدادات؟» + حفظ المتغير فقط + تراجع
- ربط الاستهلاك الفعلي (لا إعدادات ميتة): member-portal 403 عند التعطيل، whatsapp/send 403 + يمنع رابط البوابة، achievements يرجع enabled:false (الفردي والعام) وachievements-panel بطاقة إيقاف أنيقة، waitlist يستخدم السعة من الإعداد، cron/notifications نافذة التذكير+الغياب لكل نادٍ (كاش featByClub)
- إصلاحات إضافية: إصلاح خطأ كونسول sync «localSubs.map is not a function» (Array.isArray دفاعي)، إصلاح useEffect patterns في settings-panel (setState داخل callbacks)
- اختبارات حية: مسح الجداول → GET يبذر 7+5، حذف متعمد لا يُعاد، PUT استعادة يعيد، تعطيل البوابة/واتساب/الإنجازات يُغيّر سلوك API فوراً (403/403/enabled:false)، تعديل اسم يوم من الإعدادات يظهر في نموذج المنخرط بلا reload، دورة إنجازات OFF→بطاقة إيقاف→ON→لوحة كاملة
- قاعدة البيانات الحية: gamificationEnabled=true، memberPortalEnabled=true، whatsappEnabled=true، waitlistDefaultCapacity=25 (بقايا اختبار — مقصودة كقيمة صالحة)

Stage Summary:
- «أيام السباحة فارغة» محسومة جذرياً: بذر تلقائي + استعادة يدوية + حالة فارغة بإرشاد
- «كل ميزة لها إعدادات متزامنة» = مركز الميزات الجديد: 6 بطاقات، كل مفتاح مستهلك فعلياً في كود الميزة وقت الطلب
- مزامنة الأيام/التوقيتات: قاعدة البيانات مصدر وحيد لكل النماذج (منخرط/انتظار/تعويضات) بتحديث فوري
- صفر أخطاء كونسول بعد إصلاح sync، lint نظيف على كل الملفات المعدلة (الأخطاء الباقية بالمستودع سابقة في ملفات لم تُمس: scripts, command-palette, contract-tab…)
- لم يُلمس card-designer-pro.tsx إطلاقاً

---
Task ID: bulk-insurance-fix
Agent: Z.ai Code (main)
Task: «في صفحة التأمين لا أستطيع تأمين مجموعة كبيرة أو عدد فوق 100 منخرط — أريد تأمين كل المنخرطين بالواحد أو بالمجموعة دون أي مشكل»

Work Log:
- التشخيص: handleBulkInsure كان يرسل طلب PATCH منفصلاً لكل منخرط بالتسلسل (100+ طلب متتالٍ = دقائق على Vercel + فشل صامت catch{} لأي طلب + واجهة تتجمد على spinner كامل الجدول)
- نقطة نهاية جديدة POST /api/subscribers/bulk-insurance: {subscriberIds[], action: insure|uninsure} — طلب واحد حتى 5000 منخرط (de-dup + تحقق أنواع)
- عزل multi-tenant: findFirst/clubFilter، الرسوم من SubscriptionType.insuranceFee لكل منخرط (افتراضي 500)، تخطي من في الحالة المطلوبة مسبقاً (skipped)، $transaction (createMany للدفعات + createMany للأنشطة بوصف الاسم)
- insurance-panel: handleBulkInsure(action) بطلب واحد + bulkLoading منفصل عن loading (الجدول لا يختفي) + زرا «تأمين المحدد/إلغاء تأمين المحدد» بحالة جارٍ + toast يذكر المتأثرين والمُتخطّين
- مربعات الاختيار صارت على كل الصفوف (حتى المؤمنين — يسمح بالإلغاء الجماعي) + مربع الرأس يحدد كل النتائج + زر «تحديد غير المؤمنين» (بدل «تحديد الكل» المضلل)
- إصلاح جانبي: فيض هيدر الموبايل 58px (شريط أزرار الهيدر) → flex-wrap justify-end max-w-[60%] sm:max-w-none → overflow=0
- حوادث بيئة: القاعدة أُفرغت مجدداً (إعادة seed-demo 42 منخرطاً) + /home/z/AquaCore-Club-Manager حُذف (استنساخ من جديد + unshallow)
- اختبار حي: تأمين 38 دفعة واحدة → toast «تم تأمين 38 منخرط» + مؤمن=42 ✓؛ إلغاء 5 جماعياً → 37/5 ✓؛ DB: 38 دفعة بملاحظة «تأمين (دفعات متعددة)» + 38 نشاطاً ✓؛ **اختبار الضغط: 120 منخرطاً مؤقتاً مؤمَّنون في طلب واحد خلال 34ms** ثم تنظيفهم (120 دفعة+نشاط+منخرط) ✓؛ موبايل 375 overflow=0 ✓؛ tsc+eslint نظيفة
- النشر: e369328 → main ✓؛ الإنتاج: /login=200 + bulk-insurance=403 (منشور وحارسه يعمل)

Stage Summary:
- التأمين الجماعي أصبح طلباً واحداً: 100 أو 1000 منخرط = ثوانٍ بلا فشل صامت، مع إحصاءات (affected/skipped) وإمكانية الإلغاء الجماعي أيضاً
- رسوم التأمين تُحتسب من نوع اشتراك كل منخرط (وليس 500 ثابتة) في المسار الجماعي
- e369328 على الإنتاج؛ المستنسخة أُعيد بناؤها عند آخر main

---
Task ID: compound-official-list
Agent: Z.ai Code (main)
Task: «في صفحة حقوق المركب التحميل لا يعمل بشكل جيد حسب الشهر المحدد — اريد تحميل القائمة حسب الشهر المحدد — القائمة تحتوي على اللقب والاسم والمبلغ الذي هو 1000 دج مثل ملف الوارد المرفق — اجعل العمل احترافي ومميز»

Work Log:
- حللت المرفق الرسمي «قائمة المنخرطين 2026-08.docx» (فك ضغط docx واستخراج النصوص): الترويسة الرسمية 4 أسطر + 3 شعارات، «الرقم: . . ./ن.ر.ه.ر.س + سعيدة في:»، عنوان «القائمة الاسمية للمنخرطين في النادي فرع السباحة»، فترة «من 29/07/2026 إلى غاية 28/08/2026» ← اكتشاف الجذر: دورة الشهر الرسمية للنادي 29←28 وليست الشهر الميلادي
- شخّصت 4 أسباب لخلل التحميل: (1) الشاشة شهر ميلادي بينما الورقة الرسمية 29←28 (2) التحميل عبر /api/export?type=compound بمنطق أهلية مختلف عن /api/compound-rights (3) زر «المحددين» لا يطبّق ids على التجديدات (4) PDF الخادم jsPDF بلا دعم عربي
- أنشأت src/lib/compound-format.ts (خالص للعميل): MONTH_NAMES، تفقيط، formatDateDMY (DD/MM/YYYY كالوثيقة)، formatAmountDZD (1000.00 دج)، OFFICIAL_HEADER_LINES، OFFICIAL_SIGNATURES (رئيس الجمعية/مدير ديوان المركب/رئيس الوحدة/رئيس الفرع/تأشيرة التأمين)
- أنشأت src/lib/compound-list.ts: getCompoundPeriod (29←28 مع لف السنة تلقائياً)، fetchCompoundList (نفس أهلية التسجيل الجديد + تجديدات 1300/1500 + dedup + فلتر ids على المصدرين معاً)، loadClubLogos (من إعداد enteteConfig مع fallback شعار النادي)
- أعدت كتابة /api/compound-rights لاستخدام المصدر الموحد وترجع periodLabel + enteteLogos
- أنشأت /api/compound-rights/export (word: وثيقة .doc مطابقة للرسمية بالإمضاءات المختارة، excel: أعمدة الرقم/اللقب/الاسم/المبلغ + المجموع + تفقيط)
- أعدت بناء compound-panel: عرض «الفترة الرسمية: من X إلى غاية Y»، مودال تحميل بالملخص (العدد/المجموع/بالأحرف) + إمضاءات + 3 صيغ، PDF رسمي A4 عمودي متعدد الصفحات (chunkRows مع توازن الصفحتين الأخيرتين + reserve للتذييل، ترقيم «صفحة X من Y»)
- حادثة 1: html2canvas أرسى oklch (Tailwind v4) → عزلت الأنماط في onclone؛ حادثة 2: إزالة الأنماط كلها أسقطت Cairo فتداخلت الكلمات؛ حادثة 3: قص رأسي بنص عربي عادي الوزن في خلايا html2canvas — ثبت بالمقارنة الحية (DOM سليم vs canvas مقصوص) أن العلة في html2canvas نفسه → استبدلته كلياً برسم SVG foreignObject (نفس محرك المتصفح) مع تحويل الشعارات إلى data URLs قبل التسلسل
- ثبت أيضاً أن «القص» الظاهر في فحوص pdftoppm/Chrome-fit-zoom مجرد artifact أخذ عينات — الصورة المضمنة في الـ PDF (pdfimages) حروف عربية كاملة مثالية
- أصلحت خللاً وظيفياً: أزرار صيغ مودال «تحميل المحددين» كانت تصدّر الشهر كاملاً → حالة exportScope (month/selected) مع ملخص يعكس نطاق التصدير
- تحقق حي: 3 منخرطين سبتمبر 2026 (فترة 29/08→28/09) PDF كامل 3000.00 دج + تفقيط «ثلاثة آلاف»، محددين (2) → ملف _محددين 2000.00 دج «ألفان»، Word 200 مع شعار، Excel 200 مع ids، tsc/eslint نظيفة، dev.log 200s بلا أخطاء
- النشر: 8e89727 → main (e369328..8e89727) → Vercel: login 200، compound-rights 403، export 401 (محمية ومنشورة)

Stage Summary:
- تحميل حقوق المركب = القائمة المعروضة حرفياً حسب الشهر المحدد، بوثيقة رسمية مطابقة للمرفق (الأعمدة الأربعة الرسمية فقط)
- دورة 29←28 موحدة: الشاشة والمطبوع والورق الرسمي بلا تناقض، والفترة معروضة صراحة في الواجهة
- PDF عربي مثالي عبر SVG foreignObject — درس تقني: html2canvas يشوّه baseline العربية؛ foreignObject = محرك المتصفح نفسه
- لم يُلمس card-designer-pro.tsx إطلاقاً

---
Task ID: insurance-100-fix-root-cause
Agent: Z.ai Code (main)
Task: «مزال المشكل في صفحة التأمين — كل المنخرطين معنيين بالتأمين الذين دفعوا حقوق التأمين والذين لم يدفعوا — المشكل أقوم بتأمين كل المنخرطين وعند تحديث الصفحة أجد 100 منخرط مؤمن فقط والباقي يلغى تأمينهم»

Work Log:
- شخّص الجذر الحقيقي (كان مختلفاً عن الإصلاح السابق):bulk-insurance سليم ويعمل مع مئات المنخرطين، لكن لوحة التأمين تبني خريطة «مؤمن/غير مؤمن» من /api/payments?category=insurance الذي فيه take:100 (آخر 100 دفعة فقط!) — فبعد تأمين +100 يظهر 100 مؤمن والباقي «غير مؤمن» بعد أي تحديث، رغم أن قاعدة البيانات سليمة
- أنشأت /api/subscribers/insurance-status: GET محمي (admin/assistant/superadmin) يرجع insuredIds = كل معرّفات من لديهم دفعة تأمين بلا أي take + إزالة تكرار (حمولة خفيفة: معرّفات فقط)
- حدّثت insurance-panel.tsx fetchInsuranceStatus لاستخدام النقطة الجديدة؛ /api/payments لم يُمس (لوحة الأعباء تستعمله لآخر الدفعات والحد 100 مناسب لها)
- تحقق حي بإعادة إنتاج سيناريو المستخدم بالضبط: أنشأت 120 منخرطاً مؤقتاً (TMP-*) → 162 إجمالي/37 مؤمن → «تحديد غير المؤمنين» (125) → تأمين المحدد → نجح في طلب واحد → **تحديث الصفحة ⟶ 162 مؤمن / 0 غير مؤمن** (قبل الإصلاح كان سيظهر 100/62) → نقطة النهاية 403 بلا جلسة → نظفت 120 مؤقتاً بالكامل (دفعات+أنشطة+منخرطون) والقاعدة رجعت 42
- lint + tsc نظيفة، dev.log 200s، النشر: 704c275 → main (8e89727..704c275) → Vercel: login 200 + insurance-status 403 (منشورة ومحمية)

Stage Summary:
- صفحة التأمين تعتمد الآن مصدر حالة مخصصاً بلا سقف عددي: تأمين كل المنخرطين مهما كان عددهم يبقى ثابتاً بعد التحديث
- «كل المنخرطين معنيون» (دفعوا أو لم يدفعوا) قائمة مفعّلة أصلًا: اللوحة تعرض كل المنخرطين والفلترة حرة
- درس: إصلاح bulk السابق كان صحيحاً تقنياً لكنه لم يمس مصدر القراءة (take:100) — دائماً تتبّع دورة كاملة: كتابة + قراءة + عرض
- لم يُلمس card-designer-pro.tsx إطلاقاً

---
Task ID: insurance-export-pin-fix
Agent: Z.ai Code (main)
Task: «تعديل التحميل في صفحة التأمين مثل صفحة حقوق المركب — word و pdf و excel — القائمة فيها اللقب والاسم وتاريخ الميلاد — التحميل حسب الحالة (غير مؤمن/مؤمن/إجمالي) — وفيها الإمضاءات (رئيس الجمعية/مدير ديوان المركب المتعدد الرياضات/رئيس الوحدة/رئيس الفرع/تأشيرة التأمين)» + «كود الكاشير السريع لا يعمل — فشل إنشاء كود الكاشير لأي مستخدم»

Work Log:
- كود الكاشير — تشخيص الجذر: handleSavePin في user-management.tsx كان يرسل {userId, pin} بدون action، فالمسار POST /api/cashier-pin يعامل الطلب كمحاولة «دخول PIN» (bcrypt-compare ضد الرموز الموجودة) وليس «إنشاء» — يفشل دائماً 401 «PIN غير صحيح» → توست «فشل إنشاء كود الكاشير»
- الإصلاح: إرسال {action:"create", pin, label:اسم المستخدم, role:دور المستخدم} + قراءة رسالة الخطأ من الخادم وعرضها بدل الرسالة العامة — تحقق حي: إنشاء PIN للمدير العام (6830) والمدرب يوسف (8167) من الواجهة ⟶ توست نجاح + صفّان في DB + دخول فعلي بـ 6830 من /pin نجح (200، دور admin)
- قائمة التأمين — مسار جديد /api/subscribers/insurance-export: format=word|excel|logos + status=all|insured|uninsured|selected + نفس فلاتر الشاشة (q بحث، month شهر الدفعة، birthFrom/birthTo مدى الميلاد) + sigs (افتراضي الخمسة) — المؤمَّنون من Payment.category=insurance بلا أي take (نفس مصدر insurance-status) — ترتيب برقم الملف
- الوثيقة بنمط حقوق المركب: الترويسة الرسمية 4 أسطر + الشعارات (enteteConfig) + «الرقم: . . ./ن.ر.ه.ر.س + سعيدة في» + عنوان حسب الحالة + الحالة/الفترة + جدول (الرقم/اللقب/الاسم/تاريخ الميلاد DD/MM/YYYY) + صف «عدد المنخرطين» + سطر العدد تحته + الإمضاءات (صفوف 3 أعمدة)
- insurance-panel: زر واحد «تحميل القائمة الرسمية» يفتح مودال — نطاق الحالة بعدّادات حية (إجمالي/مؤمن/غير مؤمن/المحددون عند وجود تحديد) + رقائق الإمضاءات الخمسة (محددة تلقائياً) + ملخص (العنوان/الحالة/العدد/الأعمدة) + 3 أزرار PDF/Word/Excel
- PDF العميل: نفس تقنية حقوق المركب — SVG foreignObject (نص عربي مثالي) بصفحات A4 (FIRST_CAP=26/PAGE_CAP=34/FOOTER_ROWS=10 لتوفير مساحة صفّي الإمضاءات) + ترقيم «صفحة X من Y — قائمة التأمين (الحالة)» + تحويل الشعارات إلى data URLs + إلغاء عبر exportRunRef
- حادثة بيئية: القاعدة أُفرغت مجدداً (إعادة seed-demo 42 منخرطاً) + dev server مات أثناء الاختبار (إعادة تشغيل) + مجلد الاستنساخ وملف التوكن حُذفا (استنساخ من جديد + حفظ التوكن في aquacore-deploy.env)
- تحقق حي: Word إجمالي 42 صفاً بعدد 42 والإمضاءات الخمسة ✓؛ Word غير مؤمن 34 بعنوان «القائمة الاسمية للمنخرطين غير المؤمَّنين — فرع السباحة» ✓؛ PDF صفحتان مرئيتان (ترويسة وشعار RCS + جدول عربي كامل + صفحة أخيرة بعدد 34 وصفّي إمضاءات 3+2) ✓؛ Excel مؤمن 8 صفوف بالأعمدة الأربعة والإمضاءات ✓؛ المودال موبايل 375px سليم ✓؛ eslint+tsc نظيفة على الملفات المعدلة
- النشر: fdced45 → main (704c275..fdced45) ✓

Stage Summary:
- صفحة التأمين أصبحت بنفس احترافية حقوق المركب: نطاق التحميل حسب الحالة، القائمة المعروضة = القائمة المصدَّرة (فلاتر مشتركة بين الشاشة والخادم)، وثيقة رسمية بإمضاءات النادي الخمسة
- جذر علة كود الكاشير: بروتوكول الطلب (action:create) لا رسائل خطأ — الدرس: عند مسارين لنفس نقطة النهاية (دخول/إنشاء) يجب أن يرسل العميل الفاصل بوضوح
- fdced45 على main؛ الملفات: insurance-panel.tsx + user-management.tsx + api/subscribers/insurance-export/route.ts (جديد)
- لم يُلمس card-designer-pro.tsx إطلاقاً
