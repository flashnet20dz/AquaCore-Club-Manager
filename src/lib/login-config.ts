// إعدادات واجهة الدخول الافتراضية (Aesthetic Aquatic & Modern Swimming Club)
export interface LoginCustomizerConfig {
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  themeStyle: string; // aquatic-luxury | ocean-blue | midnight-aurora | olympic-pool
  customBgUrl: string;
  waterRipples: boolean;
  floatingBadges: boolean;
  stickers: { text: string; icon: string; color: string }[];
  stats: { value: string; label: string }[];
  features: { title: string; desc: string; icon: string; color: string }[];
  marqueeItems: string[];
  announcement: string;
  announcementType: string; // info | alert | success
  loginTitle: string;
  loginSubtitle: string;
  allowOfflineMode: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_LOGIN_CONFIG: LoginCustomizerConfig = {
  heroTitle: "منظومة عصرية متكاملة",
  heroHighlight: "لإدارة نوادي السباحة",
  heroDescription: "منصة احترافية متطورة لإدارة الاشتراكات، الحضور بكود QR، تصميم وطباعة البطاقات، المحاسبة المالية، والإحصائيات اللحظية.",
  themeStyle: "aquatic-luxury",
  customBgUrl: "",
  waterRipples: true,
  floatingBadges: true,
  stickers: [
    { text: "حضور لحظي بالـ QR", icon: "QrCode", color: "lime" },
    { text: "جاهز 24/7", icon: "Zap", color: "magenta" },
  ],
  stats: [
    { value: "+1000", label: "منخرط مدار" },
    { value: "+12", label: "نادٍ رياضي" },
    { value: "24/7", label: "وصول مستمر" },
    { value: "100%", label: "آمن ومشفّر" },
  ],
  features: [
    {
      title: "إدارة المنخرطين",
      desc: "تسجيل، تجديد، وبحث عن المنخرطين مع توثيق الملفات الطبية والعقود",
      icon: "Users",
      color: "cyan",
    },
    {
      title: "تجديد الاشتراكات",
      desc: "نظام ذكي مع تواريخ الانتهاء والتنبيهات التلقائية قبل انتهاء الفترة",
      icon: "Calendar",
      color: "indigo",
    },
    {
      title: "تتبع الحضور بالـ QR",
      desc: "تسجيل حضور سريع عبر مسح الباركود + إحصائيات لحظية لأحواض السباحة",
      icon: "QrCode",
      color: "emerald",
    },
    {
      title: "تصميم وطباعة البطاقات",
      desc: "مصمم بطاقات احترافي WYSIWYG مع دعم الوجهين RECTO/VERSO",
      icon: "IdCard",
      color: "amber",
    },
    {
      title: "الإدارة المالية",
      desc: "لوحة مالية متكاملة: معاملات، اشتراكات، وصولات، وميزانية لحظية",
      icon: "Wallet",
      color: "teal",
    },
    {
      title: "تقارير وإحصائيات",
      desc: "تصدير Word/PDF/Excel + خريطة ازدحام الحصص وأداء المدربين",
      icon: "BarChart3",
      color: "rose",
    },
  ],
  marqueeItems: [
    "منظومة AquaCore الاحترافية لنوادي السباحة",
    "AQUACORE CLUB MANAGER 2026",
    "حضور سريع ببطاقات الـ QR الذكية",
    "تزامن فوري سحابي ومحلي بدون إنترنت",
    "إدارة مالية دقيقة وشفافة",
    "v10.0 · موثوق ومعتمد",
  ],
  announcement: "",
  announcementType: "info",
  loginTitle: "تسجيل الدخول",
  loginSubtitle: "أدخل بياناتك للوصول إلى لوحة الإدارة",
  allowOfflineMode: true,
};
