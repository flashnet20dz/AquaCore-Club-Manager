# 📱 تطبيق AquaCore Club Manager — Android

## تحميل APK

### الطريقة 1: من GitHub Actions (موصى بها)

1. اذهب إلى: **https://github.com/flashnet20dz/aladine-pool-manager/actions**
2. اختر آخر بناء ناجح (✅ Build Android APK)
3. مرّر لأسفل لقسم **Artifacts**
4. حمّل **AquaCore-APK.zip**
5. فك الضغط → ستجد `AquaCore-Club-Manager.apk`
6. انقل الـ APK لهاتفك وثبّته

### الطريقة 2: PWA (بدون تحميل)

افتح على هاتفك: **https://aladine-pool-manager.vercel.app**
ثم: Chrome → ⋮ → "إضافة إلى الشاشحة الرئيسية"

---

## ميزات التطبيق

- ✅ لوحة تحكم بإحصائيات مباشرة
- ✅ إدارة المنخرطين + صور شخصية بالكاميرا
- ✅ الحضور بكود QR
- ✅ التجديدات والإشعارات
- ✅ ساعات العمل والتأمين
- ✅ إدارة المستخدمين والصلاحيات
- ✅ يعمل أوفلاين (PWA) + أونلاين

---

## بناء محلي (للمطورين)

```bash
# تثبيت الحزم
npm install

# إضافة منصة Android
npx cap add android

# بناء APK
cd android && ./gradlew assembleDebug

# النتيجة:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## التحديثات

التطبيق يستخدم **Live URL Mode** — يحمّل من:
`https://aladine-pool-manager.vercel.app`

لذلك كل تحديث للموقع يظهر فوراً في التطبيق بدون إعادة بناء APK.

---

© 2026 AquaCore Club Manager
