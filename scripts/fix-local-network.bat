@echo off
chcp 65001 >nul
echo ======================================================
echo   تفعيل الاتصال المحلي لمنظومة AquaCore Club Manager
echo ======================================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] جاري طلب صلاحيات المسؤول (Administrator)...
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

echo [+] تم الحصول على صلاحيات المسؤول.
echo.
echo 1. فتح المنفذ 3000 في جدار حماية ويندوز (Windows Firewall)...
netsh advfirewall firewall delete rule name="AquaCore Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="AquaCore Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul

echo 2. ضبط شبكة الواي فاي كشبكة خاصة موثوقة (Private Network)...
powershell -Command "Get-NetConnectionProfile | Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Ethernet*' -or $_.InterfaceAlias -like '*Wireless*' } | Set-NetConnectionProfile -NetworkCategory Private" >nul 2>&1

echo.
echo ======================================================
echo   [✓] تم بنجاح! يمكنك الآن الدخول من هاتفك عبر الرابط:
powershell -Command "$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object -ExpandProperty IPAddress -First 1); Write-Host ('   http://' + $ip + ':3000') -ForegroundColor Green"
echo ======================================================
echo.
pause
