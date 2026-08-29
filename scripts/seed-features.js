/**
 * seed-features.js — يُنشئ الميزات الافتراضية في جدول FeatureFlag
 * شغّل: node scripts/seed-features.js
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const FEATURES = [
  // ─── Modules أساسية ───
  { key: "dashboard", name: "لوحة التحكم", category: "module", icon: "LayoutDashboard", sortOrder: 1 },
  { key: "subscribers", name: "المشتركون", category: "module", icon: "Users", sortOrder: 2 },
  { key: "registration", name: "التسجيل", category: "module", icon: "UserPlus", sortOrder: 3 },
  { key: "subscriptions", name: "الاشتراكات", category: "module", icon: "CreditCard", sortOrder: 4 },
  { key: "subscription_types", name: "أنواع الاشتراكات", category: "module", icon: "Tags", sortOrder: 5 },
  { key: "expenses", name: "المصاريف", category: "module", icon: "TrendingDown", sortOrder: 6 },
  { key: "revenue", name: "الإيرادات", category: "module", icon: "TrendingUp", sortOrder: 7 },
  { key: "cards", name: "البطاقات", category: "module", icon: "IdCard", sortOrder: 8 },
  { key: "card_designer", name: "مصمم البطاقات", category: "module", icon: "Palette", isPremium: true, sortOrder: 9 },
  { key: "qr_code", name: "QR Code", category: "module", icon: "QrCode", sortOrder: 10 },
  { key: "printing", name: "الطباعة", category: "module", icon: "Printer", sortOrder: 11 },
  { key: "reports", name: "التقارير", category: "module", icon: "FileText", sortOrder: 12 },
  { key: "statistics", name: "الإحصائيات", category: "module", icon: "BarChart3", isPremium: true, sortOrder: 13 },
  { key: "backup", name: "النسخ الاحتياطي", category: "module", icon: "DatabaseBackup", sortOrder: 14 },
  { key: "import", name: "الاستيراد", category: "module", icon: "Upload", sortOrder: 15 },
  { key: "export", name: "التصدير", category: "module", icon: "Download", sortOrder: 16 },
  { key: "compensation", name: "التعويض", category: "module", icon: "RefreshCw", sortOrder: 17 },
  { key: "club_settings", name: "إعدادات النادي", category: "module", icon: "Settings", sortOrder: 18 },
  { key: "users", name: "المستخدمون", category: "module", icon: "UserCog", sortOrder: 19 },
  { key: "permissions", name: "الصلاحيات", category: "module", icon: "Shield", sortOrder: 20 },
  { key: "phone_sync", name: "مزامنة الهاتف", category: "module", icon: "Smartphone", sortOrder: 21 },
  { key: "desktop_settings", name: "إعدادات سطح المكتب", category: "module", icon: "Monitor", platforms: "desktop", sortOrder: 22 },
  { key: "attendance", name: "الحضور", category: "module", icon: "ClipboardCheck", sortOrder: 23 },
  { key: "renewals", name: "التجديدات", category: "module", icon: "CalendarClock", sortOrder: 24 },
  { key: "waitlist", name: "قائمة الانتظار", category: "module", icon: "Clock", isBeta: true, sortOrder: 25 },
  { key: "employees", name: "الموظفون", category: "module", icon: "Briefcase", sortOrder: 26 },
  { key: "contracts", name: "العقود", category: "module", icon: "FileSignature", sortOrder: 27 },
  { key: "pool_closures", name: "إغلاقات المسبح", category: "module", icon: "CalendarOff", sortOrder: 28 },
  { key: "work_hours", name: "ساعات العمل", category: "module", icon: "Timer", sortOrder: 29 },
  { key: "payments", name: "المدفوعات", category: "module", icon: "Wallet", sortOrder: 30 },
  { key: "notifications", name: "الإشعارات", category: "module", icon: "Bell", sortOrder: 31 },

  // ─── Integrations ───
  { key: "whatsapp", name: "واتساب", category: "integration", icon: "MessageCircle", isPremium: true, sortOrder: 100 },
  { key: "sms", name: "SMS", category: "integration", icon: "MessageSquare", isPremium: true, sortOrder: 101 },
  { key: "api_access", name: "API", category: "integration", icon: "Code", isPremium: true, sortOrder: 102 },
  { key: "cloud_sync", name: "مزامنة سحابية", category: "integration", icon: "CloudUpload", sortOrder: 103 },
  { key: "logs", name: "السجلات", category: "integration", icon: "ScrollText", sortOrder: 104 },

  // ─── Features متقدمة ───
  { key: "offline_mode", name: "الوضع الأوفلاين", category: "feature", icon: "WifiOff", platforms: "desktop", sortOrder: 200 },
  { key: "auto_backup", name: "نسخ احتياطي تلقائي", category: "feature", icon: "SaveAll", isPremium: true, sortOrder: 201 },
  { key: "multi_branch", name: "متعدد الفروع", category: "feature", icon: "GitBranch", isPremium: true, plans: "professional,enterprise", sortOrder: 202 },
  { key: "accounting", name: "محاسبة", category: "feature", icon: "Calculator", isPremium: true, plans: "professional,enterprise", sortOrder: 203 },
  { key: "audit_trail", name: "سجل التدقيق", category: "feature", icon: "History", isPremium: true, sortOrder: 204 },
  { key: "custom_branding", name: "علامة تجارية مخصصة", category: "feature", icon: "Brush", isPremium: true, plans: "professional,enterprise", sortOrder: 205 },
];

async function main() {
  console.log("🌱 Seeding feature flags...");
  let created = 0, updated = 0;
  for (const f of FEATURES) {
    const data = {
      key: f.key,
      name: f.name,
      description: f.description || null,
      category: f.category || "module",
      enabled: f.enabled ?? true,
      visible: f.visible ?? true,
      readOnly: f.readOnly ?? false,
      allowEdit: f.allowEdit ?? true,
      allowDelete: f.allowDelete ?? true,
      allowPrint: f.allowPrint ?? true,
      allowExport: f.allowExport ?? true,
      isBeta: f.isBeta ?? false,
      isPremium: f.isPremium ?? false,
      minVersion: f.minVersion || "1.0.0",
      platforms: f.platforms || "all",
      countries: f.countries || null,
      plans: f.plans || null,
      icon: f.icon || null,
      sortOrder: f.sortOrder || 0,
    };
    const existing = await db.featureFlag.findUnique({ where: { key: f.key } });
    if (existing) {
      await db.featureFlag.update({ where: { key: f.key }, data });
      updated++;
    } else {
      await db.featureFlag.create({ data });
      created++;
    }
  }
  console.log(`✅ Created: ${created}, Updated: ${updated}, Total: ${FEATURES.length}`);

  // إنشاء DefaultClubConfig افتراضي إن لم يوجد
  const cfgCount = await db.defaultClubConfig.count();
  if (cfgCount === 0) {
    await db.defaultClubConfig.create({ data: {} });
    console.log("✅ Created default DefaultClubConfig");
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
