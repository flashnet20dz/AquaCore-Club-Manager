#!/bin/bash
# start-server.sh — تشغيل خادم RCS على لينكس/ماك
echo ""
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║     نادي RCS — منظومة إدارة الاشتراكات          ║"
echo "  ║     النادي الهاوي متعدد الرياضات                 ║"
echo "  ║     الرائد - سعيدة | فرع السباحة                 ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "  [خطأ] لم يتم العثور على Node.js"
    echo "  يرجى تثبيت Node.js من: https://nodejs.org"
    exit 1
fi

# Check node_modules
if [ ! -d "node_modules" ]; then
    echo "  [تثبيت] جاري تثبيت الحزم المطلوبة..."
    npm install
fi

# Database
echo "  [قاعدة البيانات] تهيئة..."
npx prisma db push

# Seed
echo "  [المستخدمون] إنشاء الحسابات الافتراضية..."
npx tsx scripts/seed-roles.ts

# Get IP
echo "  ═══════════════════════════════════════════════════"
echo "  خادم RCS يعمل الآن!"
echo ""
echo "  على الكمبيوتر:    http://localhost:3000"
echo "  على الهاتف (WiFi):"
IP_ADDRESSES=$(hostname -I 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}')
for IP in $IP_ADDRESSES; do
    echo "                     http://$IP:3000"
done
echo "  ═══════════════════════════════════════════════════"
echo ""
echo "  الحسابات الافتراضية:"
echo "    المدير:    admin@rcs.dz  /  admin123"
echo "    المدرب:    coach@rcs.dz  /  coach123"
echo ""
echo "  اضغط Ctrl+C لإيقاف الخادم"
echo "  ═══════════════════════════════════════════════════"
echo ""

# Start server
npm run start
