@echo off
chcp 65001 >nul
title AquaCore Club Manager — Build Setup.exe
color 0B

echo.
echo  ╔═══════════════════════════════════════════════════════╗
echo  ║                                                       ║
echo  ║     AquaCore Club Manager — Build Setup.exe           ║
echo  ║     Build Windows Installer                           ║
echo  ║                                                       ║
echo  ╚═══════════════════════════════════════════════════════╝
echo.

:: ═══ Check Node.js ═══
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ Node.js غير مثبت
    echo  ثبّت Node.js من: https://nodejs.org
    pause
    exit /b 1
)

:: ═══ Check npm ═══
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ npm غير مثبت
    pause
    exit /b 1
)

echo  ✅ Node.js متوفر
echo  ✅ npm متوفر
echo.

:: ═══ Step 1: Install dependencies if needed ═══
if not exist "node_modules" (
    echo  📦 Step 1: تثبيت الحزم...
    call npm install
    if %errorlevel% neq 0 (
        echo  ❌ فشل تثبيت الحزم
        pause
        exit /b 1
    )
)
echo  ✅ Step 1: الحزم جاهزة
echo.

:: ═══ Step 2: Switch to SQLite schema + generate Prisma client ═══
echo  🔧 Step 2: تحضير Prisma لـ SQLite (النسخة المكتبية)...
call npm run desktop:prepare
if %errorlevel% neq 0 (
    echo  ❌ فشل تحضير Prisma لـ SQLite
    echo  تأكد من وجود prisma\schema.sqlite.prisma
    pause
    exit /b 1
)
echo  ✅ Step 2: Prisma Client جاهز لـ SQLite
echo.

:: ═══ Step 3: Build Next.js (Standalone) ═══
echo  🏗️  Step 3: بناء Next.js...
call npm run build
if %errorlevel% neq 0 (
    echo  ❌ فشل بناء Next.js
    echo  استعادة الـ schema الأصلي...
    call npm run desktop:restore
    pause
    exit /b 1
)
echo  ✅ Step 3: بناء Next.js نجح
echo.

:: ═══ Step 4: Compile Electron TypeScript ═══
echo  ⚡ Step 4: تجميع ملفات Electron...
call npx tsc electron/main.ts --outDir electron --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --lib es2020
call npx tsc electron/preload.ts --outDir electron --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --lib es2020
echo  ✅ Step 4: ملفات Electron جاهزة
echo.

:: ═══ Step 5: Build Windows installer with electron-builder ═══
echo  📦 Step 5: بناء Setup.exe (NSIS)...
call npx electron-builder --win nsis
if %errorlevel% neq 0 (
    echo  ❌ فشل بناء electron-builder
    echo  جرّب: npx electron-builder --win portable
    echo  استعادة الـ schema الأصلي...
    call npm run desktop:restore
    pause
    exit /b 1
)
echo  ✅ Step 5: Setup.exe جاهز
echo.

:: ═══ Step 6: Restore PostgreSQL schema ═══
echo  🔄 Step 6: استعادة Prisma لـ PostgreSQL (للتطوير الويب)...
call npm run desktop:restore
echo  ✅ Step 6: تمت الاستعادة
echo.

echo.
echo  ╔═══════════════════════════════════════════════════════╗
echo  ║                                                       ║
echo  ║          ✅  تم البناء بنجاح!  ✅                      ║
echo  ║                                                       ║
echo  ║  📁 الملفات الناتجة في: dist\                         ║
echo  ║                                                       ║
echo  ║  Setup.exe:                                           ║
echo  ║     dist\AquaCore Club Manager Setup 1.0.0.exe        ║
echo  ║                                                       ║
echo  ║  Portable:                                            ║
echo  ║     dist\win-unpacked\AquaCore Club Manager.exe       ║
echo  ║                                                       ║
echo  ╚═══════════════════════════════════════════════════════╝
echo.

:: Open dist folder
explorer dist

pause
