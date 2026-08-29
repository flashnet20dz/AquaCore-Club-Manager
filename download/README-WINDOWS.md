# 🖥️ نادي RCS — Windows Desktop Setup.exe

## 📦 الملفات الجاهزة

تم بناء التطبيق بنجاح مع الملفات التالية:

### 1️⃣ تطبيق Windows كامل (Portable)
**المسار:** `dist/win-unpacked/RCS Club.exe`
**الحجم:** 236 MB
**النوع:** تطبيق Windows تنفيذي (x64)
**الاستخدام:** شغّله مباشرة بدون تثبيت

### 2️⃣ حزمة NSIS Installer المضغوطة
**المسار:** `dist/rcs-club-desktop-1.0.0-x64.nsis.7z`
**الحجم:** 37 MB
**النوع:** ملف NSIS 7z (يحتاج electron-builder على Windows لإنشاء Setup.exe)

### 3️⃣ حزمة ZIP المحمولة
**المسار:** `dist/RCS-Club-1.0.0-Portable.zip`
**الحجم:** 439 MB
**النوع:** ZIP مضغوط — فك الضغط وشغّل

### 4️⃣ سكربت تثبيت Windows
**المسار:** `dist/Setup.bat`
**النوع:** سكربت Windows Batch
**الاستخدام:** انسخه بجانب مجلد `win-unpacked` وشغّله

---

## 🚀 الطريقة الأسرع للحصول على Setup.exe

### الخيار 1: استخدم ملف Setup.bat (موصى به)

1. انسخ مجلد `dist` كاملاً إلى جهاز Windows
2. شغّل `Setup.bat` كمسؤول (Right-click → Run as administrator)
3. سيقوم بـ:
   - ✅ نسخ الملفات إلى `%LOCALAPPDATA%\RCS Club`
   - ✅ إنشاء اختصار على سطح المكتب
   - ✅ إنشاء اختصار في قائمة Start
   - ✅ إنشاء أداة إزالة (Uninstall.bat)
   - ✅ إضافة التطبيق إلى Add/Remove Programs
   - ✅ تشغيل التطبيق تلقائياً

### الخيار 2: البناء على جهاز Windows (للحصول على Setup.exe حقيقي)

انسخ المشروع كاملاً إلى جهاز Windows وشغّل:

```cmd
# 1. تثبيت الحزم
npm install

# 2. بناء Setup.exe
build-setup.bat

# أو يدوياً:
npx prisma generate
npm run build
npx tsc electron/main.ts --outDir electron --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --lib es2020
npx tsc electron/preload.ts --outDir electron --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --lib es2020
npx electron-builder --win nsis
```

**الناتج:** `dist/RCS Club Setup 1.0.0.exe`

---

## ✅ الميزات المتوفرة

### التطبيق
- ✅ يعمل بدون Node.js
- ✅ يعمل بدون npm
- ✅ يعمل بدون متصفح
- ✅ يعمل بدون إنترنت (SQLite محلي)
- ✅ نافذة مستقلة بملء الشاشة
- ✅ حفظ حجم وموقع النافذة

### الأمان
- ✅ `contextIsolation: true`
- ✅ `nodeIntegration: false`
- ✅ `sandbox: true`
- ✅ IPC آمن

### قاعدة البيانات
- ✅ SQLite محلي في `%APPDATA%\RCS Club\`
- ✅ نسخ احتياطي تلقائي
- ✅ استعادة النسخ الاحتياطية
- ✅ تصدير/استيراد قاعدة البيانات

### الإعدادات
- ✅ مسار حفظ الملفات
- ✅ الطابعة الافتراضية
- ✅ التشغيل مع Windows
- ✅ النسخ الاحتياطي التلقائي

---

## 📋 مواصفات التطبيق

| المعيار | القيمة |
|---|---|
| **الاسم** | RCS Club |
| **الإصدار** | 1.0.0 |
| **النوع** | Electron Desktop App |
| **المنصة** | Windows 10/11 (x64) |
| **الحجم (مضغوط)** | 37 MB (NSIS) / 439 MB (ZIP) |
| **الحجم (غير مضغوط)** | 236 MB |
| **قاعدة البيانات** | SQLite (محلي) |
| **الـ Framework** | Electron 43 + Next.js 16 |
| **الـ UI** | React 19 + Tailwind CSS |

---

## 🔧 استكشاف الأخطاء

### التطبيق لا يفتح
1. تأكد أن Windows 10 أو أحدث
2. شغّل كمسؤول
3. تحقق من مضاد الفيروسات (قد يحجب التطبيقات غير الموقّعة)

### قاعدة البيانات لا تعمل
- المسار: `%APPDATA%\RCS Club\rcs-club.db`
- للنسخ الاحتياطي: `%APPDATA%\RCS Club\backups\`

### الطباعة لا تعمل
- الإعدادات → سطح المكتب → الطباعة → فعّل "طباعة الخلفيات"

---

## 📞 الدعم

للدعم الفني أو الإبلاغ عن مشاكل:
- راجع ملف `worklog.md` لسجل التطوير
- تحقق من console بأدوات المطور (F12)
