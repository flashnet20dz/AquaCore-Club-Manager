@echo off
chcp 65001 >nul
title AquaCore - بناء تطبيق الأندرويد

echo ========================================================
echo  AquaCore Club Manager — بناء حزم Google Play و APK
echo ========================================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0build-android.ps1"

echo.
pause
