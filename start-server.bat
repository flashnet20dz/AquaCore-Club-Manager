@echo off
chcp 65001 >nul
title نادي RCS — خادم محلي
color 0A

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║     نادي RCS — منظومة إدارة الاشتراكات          ║
echo  ║     النادي الهاوي متعدد الرياضات                 ║
echo  ║     الرائد - سعيدة | فرع السباحة                 ║
echo  ╚═══════════════════════════════════════════════════╝
echo.

:: التحقق من تثبيت Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [خطأ] لم يتم العثور على Node.js
    echo  يرجى تثبيت Node.js من: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: التحقق من تثبيت الحزم
if not exist "node_modules" (
    echo  [تثبيت] جاري تثبيت الحزم المطلوبة...
    call npm install
    echo.
)

:: تشغيل قاعدة البيانات
echo  [قاعدة البيانات] تهيئة...
call npx prisma db push
echo.

:: تشغيل البذور (إنشاء المستخدمين الافتراضيين)
echo  [المستخدمون] إنشاء الحسابات الافتراضية...
call npx tsx scripts/seed-roles.ts
echo.

:: الحصول على عنوان IP
echo  ═══════════════════════════════════════════════════
echo  خادم RCS يعمل الآن!
echo.
echo  على الكمبيوتر:    http://localhost:3000
echo  على الهاتف (WiFi):

:: عرض عناوين IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1 delims= " %%b in ("%%a") do (
        echo                     http://%%b:3000
    )
)
echo  ═══════════════════════════════════════════════════
echo.
echo  الحسابات الافتراضية:
echo    المدير:    admin@rcs.dz  /  admin123
echo    المدرب:    coach@rcs.dz  /  coach123
echo.
echo  اضغط Ctrl+C لإيقاف الخادم
echo  ═══════════════════════════════════════════════════
echo.

:: تشغيل الخادم على كل عناوين IP
call npm run start
