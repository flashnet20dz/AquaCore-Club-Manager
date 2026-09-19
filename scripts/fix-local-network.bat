@echo off
chcp 65001 >nul
title تفعيل الاتصال من الهاتف - AquaCore Club Manager
echo ======================================================
echo   تفعيل الاتصال المحلي بالهاتف لمنظومة AquaCore Club Manager
echo ======================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] يرجى تشغيل الملف كمسؤول (Run as administrator)
    echo     انقر بالزر الأيمن على هذا الملف واختر:
    echo     "Exécuter en tant qu'administrateur" / "Run as administrator"
    echo.
    powershell -Command "Start-Process '%~0' -Verb RunAs" 2>nul
    pause
    exit /b
)

echo [+] تم التحقق من صلاحيات المسؤول بنجاح!
echo.
echo [1/3] فتح المنفذ 3000 في جدار حماية ويندوز (نسخة المتصفح npm start)...
netsh advfirewall firewall delete rule name="AquaCore Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="AquaCore Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul
echo       ✓ تم فتح المنفذ 3000 بنجاح.

echo.
echo [2/3] فتح المنفذ 3872 في جدار حماية ويندوز (نسخة سطح المكتب Electron - بدون إنترنت)...
netsh advfirewall firewall delete rule name="AquaCore Port 3872" >nul 2>&1
netsh advfirewall firewall add rule name="AquaCore Port 3872" dir=in action=allow protocol=TCP localport=3872 profile=any >nul
echo       ✓ تم فتح المنفذ 3872 بنجاح.

echo.
echo [3/3] ضبط شبكة الواي فاي كشبكة موثوقة (Private)...
powershell -Command "Get-NetConnectionProfile | Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Ethernet*' } | Set-NetConnectionProfile -NetworkCategory Private" >nul 2>&1
echo       ✓ تم ضبط الشبكة بنجاح.

echo.
echo ======================================================
echo   [✓] جاهز تماماً! افتح التطبيق من هاتفك عبر أحد العنوانين:
powershell -Command "$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object -ExpandProperty IPAddress -First 1); Write-Host ('   نسخة سطح المكتب (بدون إنترنت): http://' + $ip + ':3872') -ForegroundColor Green; Write-Host ('   نسخة npm start في المتصفح:   http://' + $ip + ':3000') -ForegroundColor Cyan"
echo ======================================================
echo.
echo   ملاحظة مهمة للهاتف:
echo   - إذا ظهرت رسالة «شبكة الواي فاي بلا إنترنت، هل تبقى متصلاً؟» اختر «البقاء متصلاً».
echo   - يُفضّل إيقاف بيانات الهاتف المحمولة (4G) أثناء استخدام الوضع المحلي.
echo.
pause
