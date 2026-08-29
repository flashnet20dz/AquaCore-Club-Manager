# 🖥️ AquaCore Club Manager — دليل النسخة المكتبية التقني

> **الإصدار:** 1.0.0 | **آخر تحديث:** يوليو 2026
>
> هذا الدليل يشرح معمارية النسخة المكتبية (Electron + Windows)،
> حلول المشاكل التقنية، وكيفية بناء Setup.exe الاحترافي.

---

## 📑 جدول المحتويات

1. [نظرة معمارية](#1-نظرة-معمارية)
2. [نظام التشغيل الهجين (Offline + Online)](#2-نظام-التشغيل-الهجين)
3. [نظام Prisma المزدوج](#3-نظام-prisma-المزدوج)
4. [حل مشكلة "Cannot find module prisma/client/default"](#4-حل-المشكلة-الجذرية)
5. [سير عمل البناء](#5-سير-عمل-البناء)
6. [ملفات الإعداد](#6-ملفات-الإعداد)
7. [النشر والتحديثات التلقائية](#7-النشر-والتحديثات)
8. [استكشاف الأخطاء](#8-استكشاف-الأخطاء)

---

## 1. نظرة معمارية

```
┌─────────────────────────────────────────────────────────────┐
│                    AquaCore Club Manager                      │
│                   (Electron Desktop App)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Electron     │    │  Next.js      │    │  Prisma      │  │
│  │  Main Process │───▶│  Standalone   │───▶│  Client      │  │
│  │  (main.js)    │    │  Server       │    │  (SQLite)    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                     │          │
│         │                   │                     ▼          │
│         │                   │              ┌───────────┐    │
│         │                   │              │  SQLite   │    │
│         │                   │              │  (.db)    │    │
│         │                   │              └───────────┘    │
│         │                   │                                │
│         ▼                   ▼                                │
│  ┌──────────────────────────────────┐                        │
│  │  Sync Engine (sync-engine.js)    │                        │
│  │  مزامنة مع السحابة عند الاتصال   │                        │
│  └──────────────────────────────────┘                        │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
          ▼
   ┌─────────────────┐
   │  Vercel Cloud    │
   │  (PostgreSQL)    │
   │  aladine-pool-   │
   │  manager.vercel  │
   └─────────────────┘
```

### المكونات الرئيسية:

| المكوّن | الملف | الوظيفة |
|---------|-------|---------|
| **Electron Main** | `electron/main.js` | نقطة الدخول، إدارة النوافذ، بدء الخادم المحلي |
| **Next.js Standalone** | `.next/standalone/server.js` | خادم Next.js مُحسَّن للإنتاج |
| **Prisma Client** | `node_modules/.prisma/client/` | ORM لقاعدة البيانات |
| **Sync Engine** | `electron/sync-engine.js` | مزامنة البيانات مع السحابة |
| **License Manager** | `electron/license.js` | إدارة أكواد التفعيل محلياً |
| **SQLite DB** | `%APPDATA%/AquaCore/aquacore.db` | قاعدة بيانات محلية أوفلاين |

---

## 2. نظام التشغيل الهجين

التطبيق يعمل بطريقتين تلقائياً:

### الوضع الأوفلاين (Offline)
```
المستخدم → Electron → localhost:3872 → Next.js → SQLite
```
- لا يحتاج إنترنت
- كل البيانات محلية
- مناسب للنوادي في مناطق ضعيفة الشبكة

### الوضع السحابي (Online fallback)
```
المستخدم → Electron → https://aladine-pool-manager.vercel.app → PostgreSQL
```
- يُستخدم عند فشل بدء الخادم المحلي
- يضمن عمل التطبيق حتى لو تعطل SQLite

### منطق الاختيار (في `main.js`):
```javascript
async function startApp() {
  const localStarted = await startLocalServer(); // يحاول SQLite
  if (localStarted) {
    loadURL("http://localhost:3872");  // ✅ أوفلاين
  } else {
    loadURL(CLOUD_URL);  // 🌐 سحابي
  }
}
```

---

## 3. نظام Prisma المزدوج

### المشكلة
- نسخة الويب تستخدم **PostgreSQL** (Neon)
- النسخة المكتبية تستخدم **SQLite** (ملف محلي)
- لكن `prisma generate` يولّد Client لنوع واحد فقط

### الحل: ملفا Schema

```
prisma/
├── schema.prisma          ← PostgreSQL (للويب/Vercel)
├── schema.sqlite.prisma   ← SQLite (للمكتب/Electron)
└── schema.prisma.web.bak  ← نسخة احتياطية مؤقتة أثناء البناء
```

#### `schema.prisma` (PostgreSQL):
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

#### `schema.sqlite.prisma` (SQLite):
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")  // file:/path/to/aquacore.db
}
```

### توليد SQLite Schema تلقائياً

عند تعديل `schema.prisma`، حدّث نسخة SQLite:

```bash
node scripts/generate-sqlite-schema.js
```

السكربت يقرأ `schema.prisma`، يغيّر `provider` إلى `sqlite`، يزيل `directUrl`، ويكتب النتيجة إلى `schema.sqlite.prisma`.

---

## 4. حل المشكلة الجذرية

### الخطأ الأصلي:
```
Error: Cannot find module 'prisma/client/default'
Require stack:
- app.asar\@prisma\client\default.js
- app.asar\electron\sync-engine.js
- app.asar\electron\main.js
```

### الأسباب الجذرية (3 مشاكل):

#### المشكلة 1: Schema خاطئ
**السبب:** البناء استخدم `schema.prisma` (PostgreSQL) لكن التطبيق يشغّل SQLite.
**الحل:** `scripts/desktop-prepare.js` يبدّل الـ schema قبل البناء.

#### المشكلة 2: Engine Binary محبوس في asar
**السبب:** ملف `query_engine-windows.dll.node` (binary) لا يمكن تشغيله من داخل أرشيف `app.asar` المضغوط.
**الحل:** `asarUnpack` في `electron-builder.yml` يستخرجه إلى `app.asar.unpacked/`.

#### المشكلة 3: Prisma لا يجد الـ Engine
**السبب:** حتى بعد الاستخراج، Prisma يبحث في مسار افتراضي لا يطابق مسار Electron.
**الحل:** `setupPrismaEngine()` في `main.js` يحدد `PRISMA_QUERY_ENGINE_BINARY` يدوياً.

### كود الحل في `main.js`:

```javascript
// يُنفّذ قبل أي require("@prisma/client")
(function setupPrismaEngine() {
  const candidates = [
    path.join(__dirname, "..", "node_modules", ".prisma", "client"),
    path.join(__dirname, "..", ".next", "standalone", "node_modules", ".prisma", "client"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      const engineFile = fs.readdirSync(dir).find(f =>
        f.startsWith("query_engine-") && f.endsWith(".node")
      );
      if (engineFile) {
        process.env.PRISMA_QUERY_ENGINE_BINARY = path.join(dir, engineFile);
        break;
      }
    }
  }
})();
```

---

## 5. سير عمل البناء

### تدفق البناء الكامل:

```
┌─────────────────────────────────────────────────────────┐
│  1. npm install                                          │
│     └─▶ تثبيت الحزم + postinstall (prisma generate)     │
├─────────────────────────────────────────────────────────┤
│  2. npm run desktop:prepare                             │
│     ├─▶ نسخ schema.prisma → schema.prisma.web.bak       │
│     ├─▶ استبدال schema.prisma بنسخة SQLite              │
│     └─▶ prisma@6.11.1 generate (SQLite Client)          │
├─────────────────────────────────────────────────────────┤
│  3. npm run build                                       │
│     └─▶ prisma generate + next build (standalone)       │
│        النتيجة: .next/standalone/ + .next/static/        │
├─────────────────────────────────────────────────────────┤
│  4. npx electron-builder --win nsis                     │
│     ├─▶ تجميع electron/ + .next/ + node_modules/         │
│     ├─▶ asar: ضغط الكود في app.asar                     │
│     ├─▶ asarUnpack: استخراج @prisma/engines و *.node     │
│     └─▶ NSIS: إنشاء Setup.exe                            │
├─────────────────────────────────────────────────────────┤
│  5. npm run desktop:restore                             │
│     ├─▶ استعادة schema.prisma (PostgreSQL)              │
│     ├─▶ حذف schema.prisma.web.bak                       │
│     └─▶ prisma@6.11.1 generate (PostgreSQL Client)      │
└─────────────────────────────────────────────────────────┘
```

### الأوامر:

| الأمر | الوظيفة |
|-------|---------|
| `npm run desktop:prepare` | تبديل schema → SQLite + توليد Client |
| `npm run desktop:restore` | استعادة schema → PostgreSQL + توليد Client |
| `npm run electron:build` | بناء كامل (prepare → build → electron-builder → restore) |
| `npm run desktop:build` | نفس `electron:build` (اسم بديل) |
| `node scripts/generate-sqlite-schema.js` | تجديد schema.sqlite.prisma من schema.prisma |

### البناء بنقرة واحدة:

#### على Windows:
```bat
:: انقر مرتين على:
build-setup.bat
```

#### على Linux:
```bash
./build-setup.sh
```

---

## 6. ملفات الإعداد

### `electron-builder.yml`

```yaml
appId: com.aquacore.clubmanager
productName: "AquaCore Club Manager"
asar: true

# استخراج الـ binaries من asar
asarUnpack:
  - "node_modules/@prisma/**/*"
  - "node_modules/.prisma/**/*"
  - "node_modules/@prisma/engines/**/*"
  - "**/*.dll.node"
  - "**/*.node"

# الملفات المضمّنة
files:
  - "electron/*.js"
  - "electron/*.html"
  - ".next/standalone/**/*"
  - ".next/static/**/*"
  - "public/**/*"
  - "prisma/schema.prisma"
  - "prisma/schema.sqlite.prisma"
  - "node_modules/@prisma/**/*"
  - "node_modules/.prisma/**/*"
  - "node_modules/@prisma/engines/**/*"
  - "package.json"
  - "next.config.ts"

# إعدادات Windows
win:
  target: nsis
  icon: "public/images/icon.ico"

nsis:
  oneClick: false
  perMachine: true
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: "AquaCore Club Manager"
```

### هيكل `app.asar` الناتج:

```
app.asar/
├── electron/
│   ├── main.js
│   ├── preload.js
│   ├── sync-engine.js
│   ├── license.js
│   └── activation.html
├── .next/
│   ├── standalone/
│   │   ├── server.js
│   │   └── node_modules/
│   └── static/
│       └── (CSS, JS chunks, fonts)
├── public/
│   └── (images, icons, manifest.json)
├── prisma/
│   ├── schema.prisma
│   └── schema.sqlite.prisma
├── node_modules/
│   ├── @prisma/
│   └── .prisma/
└── package.json

app.asar.unpacked/  ← الملفات المستخرجة (binaries)
└── node_modules/
    ├── @prisma/
    │   └── engines/
    │       └── query_engine-windows.dll.node
    └── .prisma/
        └── client/
            └── query_engine-windows.dll.node
```

---

## 7. النشر والتحديثات

### مسار قاعدة البيانات المحلية:

```
Windows:  %APPDATA%\AquaCore Club Manager\aquacore.db
Linux:    ~/.config/AquaCore Club Manager/aquacore.db
macOS:    ~/Library/Application Support/AquaCore Club Manager/aquacore.db
```

### المزامنة مع السحابة:

عند توفر الإنترنت، `sync-engine.js` يقوم بـ:
1. **Push:** إرسال التغييرات المحلية المعلّقة (outbox) للسحابة
2. **Pull:** جلب آخر التحديثات من السحابة
3. كل 5 دقائق تلقائياً، أو عند عودة الاتصال

### أكواد التفعيل (Offline):

النسخة المكتبية تتحقق من أكواد التفعيل **محلياً** عبر HMAC-SHA256:
- لا تحتاج إنترنت للتفعيل
- الكود مرتبط ببصمة الجهاز (hardware fingerprint)
- عند المزامنة، تُبلِّغ السحابة بالكود المُستخدم

---

## 8. استكشاف الأخطاء

### ❌ "Cannot find module 'prisma/client/default'"

**السبب:** الـ engine binary لم يُستخرج من asar.
**الحل:**
```bash
# تحقق من electron-builder.yml يحتوي:
asarUnpack:
  - "node_modules/@prisma/**/*"
  - "node_modules/.prisma/**/*"

# أعد البناء:
npm run desktop:prepare
npm run build
npx electron-builder --win nsis
npm run desktop:restore
```

### ❌ "Prisma Client was generated for PostgreSQL, but DATABASE_URL is SQLite"

**السبب:** نسيت `desktop:prepare`.
**الحل:**
```bash
npm run desktop:prepare  # يبدّل schema ويولّد SQLite Client
npm run build
```

### ❌ "Error: SQLite database file cannot be opened"

**السبب:** مسار DB غير صالح أو صلاحيات كتابة مفقودة.
**الحل:** تحقق من `%APPDATA%\AquaCore Club Manager\` قابل للكتابة.

### ❌ البناء يفشل مع "npx prisma generate" (Prisma 7)

**السبب:** `npx` يسحب أحدث إصدار (7.x) غير المتوافق.
**الحل:** استخدم الإصدار 6.11.1 صراحةً:
```bash
npx prisma@6.11.1 generate
```
(السكربتات المضمّنة تستخدم هذا الإصدار تلقائياً.)

### ❌ "electron-builder failed" على Windows

**السبب:** قد يكون NSIS غير مثبت أو صلاحيات ناقصة.
**الحل:**
```bat
:: شغّل موجه الأوامر كمدير
:: ثم:
npx electron-builder --win nsis
```

### ❌ التطبيق يفتح ثم يغلق فوراً

**السبب:** غالباً خطأ في `main.js` قبل تحميل النافذة.
**التشخيص:**
```bash
# شغّل من terminal لرؤية السجلات:
"C:\Program Files\AquaCore Club Manager\AquaCore Club Manager.exe"
```

---

## 📊 ملخص الملفات

| الملف | الوظيفة |
|-------|---------|
| `scripts/generate-sqlite-schema.js` | يولّد `schema.sqlite.prisma` من `schema.prisma` |
| `scripts/desktop-prepare.js` | يبدّل schema → SQLite + يولّد Client |
| `scripts/desktop-restore.js` | يستعيد schema → PostgreSQL |
| `build-setup.bat` | منصب Windows بنقرة واحدة |
| `build-setup.sh` | منصب Linux بنقرة واحدة |
| `electron-builder.yml` | إعداد تعبئة Electron |
| `electron/main.js` | نقطة الدخول + إعداد Prisma engine |
| `electron/sync-engine.js` | مزامنة مع السحابة |
| `electron/license.js` | التحقق من أكواد التفعيل أوفلاين |
| `DESKTOP-BUILD.md` | دليل بناء سريع |
| `DESKTOP-TECHNICAL.md` | هذا الدليل التقني |

---

## ✅ قائمة التحقق قبل الإصدار

- [ ] `npm install` اكتمل بدون أخطاء
- [ ] `node scripts/generate-sqlite-schema.js` حدّث نسخة SQLite
- [ ] `npm run desktop:prepare` نجح
- [ ] `npm run build` نجح (Next.js standalone)
- [ ] `npx electron-builder --win nsis` نجح
- [ ] `npm run desktop:restore` استعاد schema
- [ ] Setup.exe منشئ في `dist/`
- [ ] اختبار التنصيب على Windows نظيف
- [ ] التطبيق يفتح بدون أخطاء Prisma
- [ ] قاعدة البيانات تُنشأ في `%APPDATA%`
- [ ] المزامنة تعمل عند توفر الإنترنت

---

## 📞 الدعم

للحصول على المساعدة:
1. راجع [استكشاف الأخطاء](#8-استكشاف-الأخطاء)
2. شغّل التطبيق من terminal لرؤية السجلات
3. تحقق من ملف `aquacore.log` في `%APPDATA%\AquaCore Club Manager\`

---

**© 2026 AquaCore Club Manager**
