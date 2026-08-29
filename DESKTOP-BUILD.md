# 🖥️ دليل بناء النسخة المكتبية (Windows Setup.exe)

## ⚠️ المشكلة التي تم حلها

كان التطبيق يفشل عند التنصيب بخطأ:
```
Error: Cannot find module 'prisma/client/default'
```

**السبب:** النسخة المكتبية تستخدم قاعدة بيانات **SQLite** محلية، لكن البناء كان يولّد Prisma Client لـ **PostgreSQL** فقط، وملف الـ query engine binary لم يكن يُستخرج من أرشيف asar.

**الحل المطبّق:** نظام تلقائي يبدّل الـ schema بين PostgreSQL (للويب) و SQLite (للمكتب) أثناء البناء، ويحدد مسار الـ binary engine بشكل صحيح.

---

## 📋 المتطلبات

- **Node.js** 18+ و **npm**
- **Windows** (لبناء setup.exe) أو **Linux** (لبناء portable)
- مساحة قرص ~2GB للمؤقتات

---

## 🚀 طريقة البناء على Windows

### الطريقة السريعة (ملف دفعي)
```bat
:: انقر مرتين على:
build-setup.bat
```
أو من موجه الأوامر:
```bat
build-setup.bat
```

### الطريقة اليدوية (خطوة بخطوة)
```bat
:: 1. تثبيت الحزم
npm install

:: 2. تحضير Prisma لـ SQLite
npm run desktop:prepare

:: 3. بناء Next.js
npm run build

:: 4. بناء Setup.exe
npx electron-builder --win nsis

:: 5. استعادة Prisma لـ PostgreSQL (مهم للتطوير الويب)
npm run desktop:restore
```

---

## 🐧 طريقة البناء على Linux

```bash
chmod +x build-setup.sh
./build-setup.sh
```

---

## 📁 الملفات الناتجة

بعد البناء الناجح، ستجد في مجلد `dist/`:

| الملف | الوصف |
|-------|-------|
| `AquaCore Club Manager Setup 1.0.0.exe` | منصب NSIS (مثبّت Windows) |
| `win-unpacked/AquaCore Club Manager.exe` | نسخة محمولة (بدون تثبيت) |

---

## 🔧 كيف يعمل النظام

### تدفق البناء:
```
schema.prisma (PostgreSQL)
       ↓
  desktop:prepare
       ↓
schema.prisma (SQLite مؤقتاً)
       ↓
  prisma generate → Prisma Client (SQLite)
       ↓
  next build → .next/standalone/
       ↓
  electron-builder → Setup.exe
       ↓
  desktop:restore
       ↓
schema.prisma (PostgreSQL مُستعاد)
```

### عند تشغيل التطبيق:
1. `electron/main.js` يبحث عن ملف الـ engine binary (`query_engine-*.dll.node`) في `app.asar.unpacked/`
2. يضبط `PRISMA_QUERY_ENGINE_BINARY` لمسار الـ binary
3. يضبط `DATABASE_URL=file:/path/to/app-data/aquacore.db` (SQLite)
4. يبدأ خادم Next.js standalone محلياً
5. التطبيق يعمل أوفلاين 100%

---

## 🆕 تجديد SQLite Schema

إذا عدّلت `prisma/schema.prisma` (أضفت نموذجاً جديداً)، حدّث نسخة SQLite:

```bash
node scripts/generate-sqlite-schema.js
```

هذا يولّد `prisma/schema.sqlite.prisma` تلقائياً من `schema.prisma`.

---

## ❗ مشاكل شائعة

### "Cannot find module '@prisma/client'"
**السبب:** `npm install` لم يكتمل أو `postinstall` فشل.
**الحل:** شغّل `npm install` ثم `npx prisma@6.11.1 generate` يدوياً.

### "Prisma Client was generated for PostgreSQL, but DATABASE_URL is SQLite"
**السبب:** نسيت تشغيل `desktop:prepare` قبل البناء.
**الحل:** شغّل `npm run desktop:prepare` ثم أعد البناء.

### الـ binary engine غير موجود بعد التنصيب
**السبب:** `asarUnpack` في `electron-builder.yml` لا يغطي المسار.
**الحل:** تأكد أن `electron-builder.yml` يحتوي:
```yaml
asarUnpack:
  - "node_modules/@prisma/**/*"
  - "node_modules/.prisma/**/*"
  - "node_modules/@prisma/engines/**/*"
  - "**/*.node"
```

### البناء يفشل بسبب `next build`
**السبب:** قد يكون هناك خطأ TypeScript.
**الحل:** الـ `next.config.ts` مضبوط على `ignoreBuildErrors: true`، لكن تأكد أن الكود صالح.

---

## 📞 للدعم

إذا استمرت المشاكل، افتح terminal وشغّل:
```bat
npm run desktop:prepare
npm run build
npm run desktop:restore
```
وراجع مخرجات كل خطوة.
