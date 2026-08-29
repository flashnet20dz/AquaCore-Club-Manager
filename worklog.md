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
