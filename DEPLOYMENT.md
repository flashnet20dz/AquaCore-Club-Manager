# 🚀 دليل نشر نادي RCS على Vercel + Supabase

## 📋 المتطلبات
- حساب GitHub (مجاني): https://github.com
- حساب Vercel (مجاني): https://vercel.com
- حساب Supabase (مجاني): https://supabase.com

---

## 🗄️ الخطوة 1: إنشاء قاعدة بيانات Supabase

1. اذهب إلى https://supabase.com واضغط "Start your project"
2. سجّل الدخول بحساب GitHub
3. اضغط "New Project" واملأ:
   - **Name**: `rcs-club`
   - **Database Password**: اختر كلمة مرور قوية واحفظها
   - **Region**: Frankfurt (الأقرب للجزائر)
   - **Plan**: Free
4. اضغط "Create new project" وانتظر 2-3 دقائق

### نسخ رابط الاتصال:
1. في لوحة تحكم Supabase، اذهب إلى **Settings** (الترس)
2. اختر **Database**
3. في قسم "Connection string"، اختر **URI**
4. انسخ الرابط (سيكون مثل):
   ```
   postgresql://postgres.[ref]:[password]@aws-0-frankfurt.pooler.supabase.com:6543/postgres
   ```
5. لاحظ أيضاً **Connection string (direct)**:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-frankfurt.pooler.supabase.com:5432/postgres
   ```

---

## 📦 الخطوة 2: رفع الكود إلى GitHub

### إذا لم يكن لديك Git مثبت:
```bash
# على Ubuntu/Debian
sudo apt install git

# على Mac (مع Homebrew)
brew install git

# على Windows: حمّل من https://git-scm.com
```

### تهيئة Git ورفع الكود:
```bash
# 1. اذهب لمجلد المشروع
cd /path/to/my-project

# 2. تهيئة Git
git init

# 3. إضافة جميع الملفات
git add .

# 4. أول commit
git commit -m "RCS Club - منظومة إدارة الاشتراكات v6"

# 5. تغيير الفرع الافتراضي
git branch -M main

# 6. اذهب إلى GitHub.com وأنشئ مستودع جديد (بدون README):
#    - اسم المستودع: rcs-club
#    - خاص (Private) أو عام (Public)
#    - لا تختر أي خيارات إضافية

# 7. اربط المستودع (استبدل USERNAME بحسابك)
git remote add origin https://github.com/USERNAME/rcs-club.git

# 8. ارفع الكود
git push -u origin main
```

---

## ▲ الخطوة 3: النشر على Vercel

1. اذهب إلى https://vercel.com واضغط "Sign Up" / "Log In"
2. اختر "Continue with GitHub"
3. اضغط "New Project"
4. ابحث عن مستودع `rcs-club` واضغط "Import"
5. في صفحة الإعدادات:

### Configure Project:
- **Framework Preset**: Next.js (سيُكتشف تلقائياً)
- **Root Directory**: `./` (افتراضي)
- **Build Command**: `bun run build` أو `npm run build`
- **Install Command**: `bun install` أو `npm install`

### Environment Variables (مهم جداً):
اضغط "Environment Variables" وأضف:

| Name | Value |
|------|-------|
| `DATABASE_URL` | `postgresql://postgres.[ref]:[password]@aws-0-frankfurt.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | `postgresql://postgres.[ref]:[password]@aws-0-frankfurt.pooler.supabase.com:5432/postgres` |
| `NEXTAUTH_SECRET` | مفتاح عشوائي 32 حرف (استخدم: `openssl rand -base64 32`) |

6. اضغط "Deploy" وانتظر 3-5 دقائق
7. 🎉 سيظهر رابط موقعك: `https://rcs-club-xxx.vercel.app`

---

## 🗃️ الخطوة 4: تهيئة قاعدة البيانات

### الطريقة 1: عبر Vercel CLI (موصى بها)

```bash
# 1. ثبّت Vercel CLI
npm install -g vercel

# 2. سجّل الدخول
vercel login

# 3. اربط المشروع
cd /path/to/my-project
vercel link

# 4. نفّذ أوامر Prisma على قاعدة بيانات الإنتاج
vercel env pull .env.local
npx prisma db push

# 5. شغّل الـ seed لإنشاء المستخدمين الافتراضيين
npx tsx scripts/seed-roles.ts
```

### الطريقة 2: عبر Supabase SQL Editor

1. في لوحة Supabase، اذهب إلى **SQL Editor**
2. انسخ محتوى ملف `prisma/migrations/init.sql` (إذا أنشأناه)
3. اضغط "Run"

### الطريقة 3: سكريبت محلي

```bash
# في ملف .env.local، ضع DATABASE_URL من Supabase
# ثم شغّل محلياً:
npx prisma db push
npx tsx scripts/seed-roles.ts
npx tsx scripts/seed.ts  # بيانات تجريبية (اختياري)
```

---

## ⏰ الخطوة 5: تفعيل المهام المجدولة (Cron Jobs)

ملف `vercel.json` يحتوي على إعداد تلقائي لـ cron job:
- يشتغل كل يوم الساعة 8:00 صباحاً
- يتحقق من الاشتراكات المنتهية/قريبة الانتهاء
- يُنشئ إشعارات للمدير

**لا حاجة لأي إعداد إضافي** — Vercel سيُفعّلها تلقائياً في خطة Hobby (المجانية).

---

## 🔐 الخطوة 6: تغيير كلمات المرور الافتراضية

بعد أول تسجيل دخول:
1. سجّل الدخول كـ admin: `admin@rcs.dz / admin123`
2. اذهب إلى تبويب "المستخدمون"
3. عدّل كلمة مرور كل حساب افتراضي
4. أنشئ حسابات للموظفين الفعليين

---

## ✅ التحقق من النشر

1. افتح رابط موقعك على Vercel
2. سجّل الدخول بـ `admin@rcs.dz / admin123`
3. تحقق من:
   - ✅ تظهر لوحة التحكم
   - ✅ يمكن إضافة منخرط جديد
   - ✅ يمكن تسجيل الحضور
   - ✅ يمكن تصدير القوائم
   - ✅ الإشعارات تعمل

---

## 🆘 استكشاف الأخطاء

### خطأ "Database connection failed"
- تأكد من `DATABASE_URL` و `DIRECT_URL` صحيحان في Vercel
- تأكد من أن كلمة مرور Supabase صحيحة

### خطأ "Prisma Client not generated"
- أضف `postinstall` script في `package.json`:
  ```json
  "scripts": {
    "postinstall": "prisma generate"
  }
  ```

### خطأ "401 Unauthorized" بعد النشر
- تأكد من أن `NEXTAUTH_SECRET` مضبوط في Vercel
- امسح cookies المتصفح وأعد المحاولة

### التطبيق بطيء
- في Supabase، فعّل "Connection Pooling"
- استخدم `pgbouncer=true` في `DATABASE_URL`

---

## 💡 نصائح مهمة

1. **النسخ الاحتياطي**: استخدم تبويب "النسخ الاحتياطي" أسبوعياً
2. **الأمان**: غيّر جميع كلمات المرور الافتراضية فوراً
3. **المراقبة**: تابع استهلاك Supabase (500MB مجاناً)
4. **التحديثات**: عند تحديث الكود، ارفعه إلى GitHub وسيُنشر تلقائياً

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. تحقق من logs في Vercel Dashboard
2. تحقق من logs في Supabase Dashboard
3. راجع هذا الدليل مرة أخرى

**موفق! 🎉**
