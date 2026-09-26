# ═══════════════════════════════════════════════════════════
# AquaCore Club Manager — Android Build Script (PowerShell)
# يولّد حزمة APK وحزمة Google Play (.aab)
# ═══════════════════════════════════════════════════════════

param(
    [string]$Mode = "release" # "release" or "debug"
)

$ErrorActionPreference = "Stop"

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AquaCore — بناء تطبيق الأندرويد لـ Google Play            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 1. نسخ أصول الويب
Write-Host "📦 1. نسخ أصول الواجهة إلى مشروع الأندرويد..." -ForegroundColor Yellow
npx cap copy android

# 2. التحقق من مسار Android
if (-not (Test-Path "android")) {
    Write-Host "❌ مجلد android غير موجود! جاري إضافته..." -ForegroundColor Red
    npx cap add android
}

# 3. نسخ الأيقونات
Write-Host "🎨 2. فحص الأيقونات وشاشة البداية..." -ForegroundColor Yellow
foreach ($density in @('mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi')) {
    $src = "android-resources/mipmap-$density"
    $dest = "android/app/src/main/res/mipmap-$density"
    if (Test-Path $src) {
        Copy-Item -Path "$src/*" -Destination $dest -Force -ErrorAction SilentlyContinue
    }
}
if (Test-Path "android-resources/splash.png") {
    Copy-Item -Path "android-resources/splash.png" -Destination "android/app/src/main/res/drawable/splash.png" -Force -ErrorAction SilentlyContinue
}

# 4. بناء المشروع باستخدام Gradle
Push-Location android

try {
    Write-Host "⚙️ 3. جاري تجميع تطبيق الأندرويد عبر Gradle..." -ForegroundColor Yellow
    if ($Mode -eq "release") {
        Write-Host "  -> بناء حزمة APK (assembleRelease)..."
        ./gradlew assembleRelease --no-daemon -x lintVitalRelease
        Write-Host "  -> بناء حزمة Google Play (.aab) (bundleRelease)..."
        ./gradlew bundleRelease --no-daemon -x lintVitalRelease
    } else {
        Write-Host "  -> بناء حزمة Debug APK (assembleDebug)..."
        ./gradlew assembleDebug --no-daemon
    }
} finally {
    Pop-Location
}

# 5. عرض النتيجة
$apkOut = "android/app/build/outputs/apk/release/app-release.apk"
$aabOut = "android/app/build/outputs/bundle/release/app-release.aab"
$debugApk = "android/app/build/outputs/apk/debug/app-debug.apk"

New-Item -ItemType Directory -Force -Path "output" | Out-Null

Write-Host ""
Write-Host "✅ تم الانتهاء بنجاح!" -ForegroundColor Green

if (Test-Path $apkOut) {
    Copy-Item -Path $apkOut -Destination "output/AquaCore-Club-Manager.apk" -Force
    Write-Host "📱 ملف APK المباشر: output/AquaCore-Club-Manager.apk" -ForegroundColor Cyan
} elseif (Test-Path $debugApk) {
    Copy-Item -Path $debugApk -Destination "output/AquaCore-Club-Manager-debug.apk" -Force
    Write-Host "📱 ملف Debug APK: output/AquaCore-Club-Manager-debug.apk" -ForegroundColor Cyan
}

if (Test-Path $aabOut) {
    Copy-Item -Path $aabOut -Destination "output/AquaCore-Club-Manager.aab" -Force
    Write-Host "⭐ حزمة Google Play (.aab): output/AquaCore-Club-Manager.aab" -ForegroundColor Green
    Write-Host "  (ارفع هذا الملف مباشرة إلى Google Play Console)" -ForegroundColor DarkGray
}
