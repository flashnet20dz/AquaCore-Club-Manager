@echo off
chcp 65001 >nul
title نادي RCS — Setup Installer
color 0A

echo.
echo  ╔═══════════════════════════════════════════════════════╗
echo  ║                                                       ║
echo  ║          نادي RCS — منظومة الإدارة                   ║
echo  ║                                                       ║
echo  ║          RCS Club Management System                   ║
echo  ║          Version 1.0.0                                ║
echo  ║                                                       ║
echo  ╚═══════════════════════════════════════════════════════╝
echo.
echo  جاري تثبيت التطبيق...
echo  Installing application...
echo.

:: Check admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  ⚠️  يحتاج التثبيت إلى صلاحيات المسؤول
    echo  Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Installation directory
set "INSTALL_DIR=%LOCALAPPDATA%\RCS Club"
set "DESKTOP_LINK=%USERPROFILE%\Desktop\RCS Club.lnk"
set "STARTMENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\RCS Club"
set "STARTMENU_LINK=%STARTMENU_DIR%\RCS Club.lnk"

echo  📁 مجلد التثبيت: %INSTALL_DIR%
echo.

:: Create installation directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Extract files
echo  📦 جاري نسخ الملفات...
xcopy /E /I /Y /Q "win-unpacked\*" "%INSTALL_DIR%\" >nul 2>&1

:: Verify installation
if not exist "%INSTALL_DIR%\RCS Club.exe" (
    echo  ❌ فشل التثبيت — لم يتم نسخ الملفات بشكل صحيح
    echo  Installation failed — files were not copied correctly
    pause
    exit /b 1
)

:: Create Desktop shortcut
echo  🖥️  إنشاء اختصار سطح المكتب...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%DESKTOP_LINK%'); $sc.TargetPath = '%INSTALL_DIR%\RCS Club.exe'; $sc.WorkingDirectory = '%INSTALL_DIR%'; $sc.IconLocation = '%INSTALL_DIR%\RCS Club.exe,0'; $sc.Description = 'نادي RCS — منظومة إدارة الاشتراكات'; $sc.Save()"

:: Create Start Menu shortcut
echo  📋 إنشاء اختصار قائمة Start...
if not exist "%STARTMENU_DIR%" mkdir "%STARTMENU_DIR%"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%STARTMENU_LINK%'); $sc.TargetPath = '%INSTALL_DIR%\RCS Club.exe'; $sc.WorkingDirectory = '%INSTALL_DIR%'; $sc.IconLocation = '%INSTALL_DIR%\RCS Club.exe,0'; $sc.Description = 'نادي RCS — منظومة إدارة الاشتراكات'; $sc.Save()"

:: Create uninstaller
echo  🗑️  إنشاء أداة الإزالة...
(
    echo @echo off
    echo chcp 65001 ^>nul
    echo title نادي RCS — Uninstall
    echo color 0C
    echo echo.
    echo echo  جاري إزالة التطبيق...
    echo echo.
    echo taskkill /F /IM "RCS Club.exe" ^>nul 2^>^&1
    echo timeout /t 2 /nobreak ^>nul
    echo rmdir /S /Q "%INSTALL_DIR%"
    echo del /F /Q "%DESKTOP_LINK%" ^>nul 2^>^&1
    echo rmdir /S /Q "%STARTMENU_DIR%" ^>nul 2^>^&1
    echo echo.
    echo echo  ✅ تمت الإزالة بنجاح
    echo echo.
    echo pause
) > "%INSTALL_DIR%\Uninstall.bat"

:: Create registry entry for Add/Remove Programs
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\RCS Club" /v DisplayName /t REG_SZ /d "نادي RCS" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\RCS Club" /v DisplayVersion /t REG_SZ /d "1.0.0" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\RCS Club" /v Publisher /t REG_SZ /d "نادي RCS" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\RCS Club" /v InstallLocation /t REG_SZ /d "%INSTALL_DIR%" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\RCS Club" /v DisplayIcon /t REG_SZ /d "%INSTALL_DIR%\RCS Club.exe" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\RCS Club" /v UninstallString /t REG_SZ /d "%INSTALL_DIR%\Uninstall.bat" /f >nul

echo.
echo  ╔═══════════════════════════════════════════════════════╗
echo  ║                                                       ║
echo  ║          ✅  تم التثبيت بنجاح!  ✅                    ║
echo  ║                                                       ║
echo  ║  📁 مجلد التثبيت:                                    ║
echo  ║     %INSTALL_DIR%                                    ║
echo  ║                                                       ║
echo  ║  🖥️  اختصار سطح المكتب: ✅                            ║
echo  ║  📋 اختصار قائمة Start: ✅                            ║
echo  ║  🗑️  أداة الإزالة: ✅                                 ║
echo  ║                                                       ║
echo  ╚═══════════════════════════════════════════════════════╝
echo.
echo  اضغط أي مفتأ لفتح التطبيق...
pause >nul

:: Launch the app
start "" "%INSTALL_DIR%\RCS Club.exe"
