@echo off
chcp 65001 >nul
title نادي RCS — Build Setup.exe
color 0B

echo.
echo  ╔═══════════════════════════════════════════════════════╗
echo  ║                                                       ║
echo  ║     بناء Setup.exe — نادي RCS                         ║
echo  ║     Build Windows Installer                           ║
echo  ║                                                       ║
echo  ╚═══════════════════════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ Node.js غير مثبت
    echo  ثبّت Node.js من: https://nodejs.org
    pause
    exit /b 1
)

:: Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ npm غير مثبت
    pause
    exit /b 1
)

echo  ✅ Node.js متوفر
echo  ✅ npm متوفر
echo.

:: Install dependencies if needed
if not exist "node_modules" (
    echo  📦 تثبيت الحزم...
    call npm install
)

:: Generate Prisma client
echo  🔧 توليد Prisma client...
call npx prisma generate

:: Build Next.js
echo  🏗️  بناء Next.js...
call npm run build
if %errorlevel% neq 0 (
    echo  ❌ فشل بناء Next.js
    pause
    exit /b 1
)

:: Compile Electron TypeScript files
echo  ⚡ تجميع ملفات Electron...
call npx tsc electron/main.ts --outDir electron --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --lib es2020
call npx tsc electron/preload.ts --outDir electron --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --lib es2020

:: Build Windows installer with electron-builder
echo  📦 بناء Setup.exe...
call npx electron-builder --win nsis
if %errorlevel% neq 0 (
    echo  ❌ فشل بناء electron-builder
    echo  جرّب: npx electron-builder --win portable
    pause
    exit /b 1
)

echo.
echo  ╔═══════════════════════════════════════════════════════╗
echo  ║                                                       ║
echo  ║          ✅  تم البناء بنجاح!  ✅                      ║
echo  ║                                                       ║
echo  ║  📁 الملفات الناتجة في: dist\                         ║
echo  ║                                                       ║
echo  ║  Setup.exe:                                           ║
echo  ║     dist\RCS Club Setup 1.0.0.exe                     ║
echo  ║                                                       ║
echo  ║  Portable:                                            ║
echo  ║     dist\win-unpacked\RCS Club.exe                    ║
echo  ║                                                       ║
echo  ╚═══════════════════════════════════════════════════════╝
echo.

:: Open dist folder
explorer dist

pause
