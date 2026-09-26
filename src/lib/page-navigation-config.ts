import {
  Activity, Users, QrCode, Clock, Waves, RefreshCcw, CalendarOff,
  ListPlus, ShieldCheck, Building2, Crown, TrendingUp, Sparkles,
  Inbox, Download, Landmark, Banknote, FileText, UserCog, Database,
  Settings as SettingsIcon, LucideIcon, Layers
} from "lucide-react";

export type PageGroupId = "core" | "sports" | "finance" | "management" | "system";

export interface PageNavigationItem {
  id: string;
  label: string;
  shortLabel?: string;
  customLabel?: string;
  customShortLabel?: string;
  customExportTitle?: string;
  description: string;
  icon: LucideIcon;
  iconName: string;
  group: PageGroupId;
  permission?: string;
  adminOnly?: boolean;
  defaultOrder: number;
  defaultVisible: boolean;
  canHide: boolean; // Settings & Dashboard can't be hidden by accident
}

export interface NavigationGroup {
  id: PageGroupId;
  label: string;
  description: string;
}

export const NAVIGATION_GROUPS: Record<PageGroupId, NavigationGroup> = {
  core: {
    id: "core",
    label: "الرئيسية والمنظومة",
    description: "لوحة التحكم والمنخرطون والحضور",
  },
  sports: {
    id: "sports",
    label: "المسبح والتجديدات",
    description: "جدول المسبح، ساعات العمل، والتجديد والتعويضات",
  },
  finance: {
    id: "finance",
    label: "المالية والمحاسبة",
    description: "المركز المالي، التأمين، حقوق المركب والتعويضات",
  },
  management: {
    id: "management",
    label: "الإدارة والعمال",
    description: "عقود العمال، ساعات العمل، والبطاقات",
  },
  system: {
    id: "system",
    label: "النظام والبيانات",
    description: "الاستيراد، التصدير، النسخ الاحتياطي، والإعدادات",
  },
};

export const DEFAULT_PAGE_ITEMS: PageNavigationItem[] = [
  // ─── 1. core ───
  {
    id: "dashboard",
    label: "لوحة التحكم",
    shortLabel: "الرئيسية",
    description: "المؤشرات العامة والنبض المالي والتنفيذي",
    icon: Activity,
    iconName: "Activity",
    group: "core",
    adminOnly: true,
    defaultOrder: 1,
    defaultVisible: true,
    canHide: false,
  },
  {
    id: "subscribers",
    label: "المنخرطون",
    shortLabel: "المنخرطون",
    description: "إدارة المشتركين والبطاقات والاشتراكات",
    icon: Users,
    iconName: "Users",
    group: "core",
    permission: "subscribers",
    defaultOrder: 2,
    defaultVisible: true,
    canHide: false,
  },
  {
    id: "attendance",
    label: "الحضور وQR",
    shortLabel: "الحضور",
    description: "تسجيل الحضور اليومي عبر الباركود وQR",
    icon: QrCode,
    iconName: "QrCode",
    group: "core",
    defaultOrder: 3,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "members-directory",
    label: "سجل المنخرطين",
    shortLabel: "السجل",
    description: "دليل المشتركين الكامل مع الفلاتر السريعة",
    icon: Users,
    iconName: "Users",
    group: "core",
    permission: "subscribers",
    defaultOrder: 4,
    defaultVisible: true,
    canHide: true,
  },

  // ─── 2. sports & swimming ───
  {
    id: "pool-schedule",
    label: "جدول المسبح",
    shortLabel: "المسبح",
    description: "تنظيم الجلسات وتوزيع الأفواج والمسابح",
    icon: Waves,
    iconName: "Waves",
    group: "sports",
    permission: "workHours",
    defaultOrder: 5,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "workhours",
    label: "ساعات العمل",
    shortLabel: "الساعات",
    description: "حساب ساعات عمل الحراس والمدربين",
    icon: Clock,
    iconName: "Clock",
    group: "sports",
    permission: "workHours",
    defaultOrder: 6,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "renewals",
    label: "تجديد الاشتراكات",
    shortLabel: "التجديد",
    description: "متابعة الاشتراكات المنتهية وإرسال التذكيرات",
    icon: RefreshCcw,
    iconName: "RefreshCcw",
    group: "sports",
    permission: "renewals",
    defaultOrder: 7,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "compensations",
    label: "حصص التعويض",
    shortLabel: "التعويضات",
    description: "تسجيل وإدارة الحصص التعويضية للمنخرطين",
    icon: CalendarOff,
    iconName: "CalendarOff",
    group: "sports",
    permission: "renewals",
    defaultOrder: 8,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "waitlist",
    label: "قوائم الانتظار",
    shortLabel: "الانتظار",
    description: "تسجيل الراغبين بالانضمام للأفواج الممتلئة",
    icon: ListPlus,
    iconName: "ListPlus",
    group: "sports",
    permission: "renewals",
    defaultOrder: 9,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "categories",
    label: "الفئات العمرية",
    shortLabel: "الفئات",
    description: "تصنيف السباحين حسب الفئات والأعمار",
    icon: Crown,
    iconName: "Crown",
    group: "sports",
    permission: "subscribers",
    defaultOrder: 10,
    defaultVisible: true,
    canHide: true,
  },

  // ─── 3. finance ───
  {
    id: "financial-hub",
    label: "المركز المالي",
    shortLabel: "المالية",
    description: "دفتر القيود، الصندوق، الأعباء، والتقارير المالية",
    icon: Landmark,
    iconName: "Landmark",
    group: "finance",
    permission: "financialDashboard",
    defaultOrder: 11,
    defaultVisible: true,
    canHide: false,
  },
  {
    id: "insurance",
    label: "التأمين السنوي",
    shortLabel: "التأمين",
    description: "كشوفات التأمين وتجهيز تقارير شركة التأمين",
    icon: ShieldCheck,
    iconName: "ShieldCheck",
    group: "finance",
    permission: "subscribers",
    defaultOrder: 12,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "compound",
    label: "حقوق المركب (OPOW)",
    shortLabel: "المركب",
    description: "مستحقات المركب الأولمبي ونسب الديوان",
    icon: Building2,
    iconName: "Building2",
    group: "finance",
    permission: "subscribers",
    defaultOrder: 13,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "staff-compensations",
    label: "أتعاب وتعويضات العمال",
    shortLabel: "الأتعاب",
    description: "تسديدات أجور الحراس والموظفين والمدربين",
    icon: Banknote,
    iconName: "Banknote",
    group: "finance",
    permission: "staffCompensations",
    defaultOrder: 14,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "analytics",
    label: "التحليلات المتقدمة",
    shortLabel: "التحليلات",
    description: "رسوم بيانية ومؤشرات النمو والتدفقات",
    icon: TrendingUp,
    iconName: "TrendingUp",
    group: "finance",
    adminOnly: true,
    defaultOrder: 15,
    defaultVisible: true,
    canHide: true,
  },

  // ─── 4. management ───
  {
    id: "incoming-mail",
    label: "الوارد الإداري",
    shortLabel: "الوارد",
    description: "تسجيل ومتابعة المراسلات والوثائق الواردة للنادي",
    icon: Inbox,
    iconName: "Inbox",
    group: "management",
    permission: "incomingMail",
    defaultOrder: 16,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "contracts",
    label: "عقود العمل",
    shortLabel: "العقود",
    description: "إدارة عقود التوظيف وتواريخ التجديد",
    icon: FileText,
    iconName: "FileText",
    group: "management",
    permission: "workHours",
    defaultOrder: 17,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "cards-pro",
    label: "مصمم البطاقات Pro",
    shortLabel: "البطاقات",
    description: "تصميم وطباعة شارات وبطاقات العضوية الاحترافية",
    icon: Sparkles,
    iconName: "Sparkles",
    group: "management",
    permission: "cards",
    defaultOrder: 17,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "enterprise-hub",
    label: "خدمات وفعاليات النادي المتقدمة (Enterprise)",
    shortLabel: "خدمات النادي المتقدمة",
    description: "فواتير وكوبونات النادي، تنظيم البطولات والفعاليات، برامج ولاء السباحين، وإدارة رضا المشتركين",
    icon: Layers,
    iconName: "Layers",
    group: "management",
    adminOnly: true,
    defaultOrder: 18,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "users",
    label: "إدارة المستخدمين",
    shortLabel: "المستخدمون",
    description: "صلاحيات وحسابات الموظفين والمديرين",
    icon: UserCog,
    iconName: "UserCog",
    group: "management",
    adminOnly: true,
    defaultOrder: 19,
    defaultVisible: true,
    canHide: true,
  },

  // ─── 5. system ───
  {
    id: "import",
    label: "استيراد من Excel",
    shortLabel: "الاستيراد",
    description: "رفع وتحليل واستيراد المشتركين وتحديث المبالغ",
    icon: Inbox,
    iconName: "Inbox",
    group: "system",
    permission: "import",
    defaultOrder: 19,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "export",
    label: "تصدير البيانات",
    shortLabel: "التصدير",
    description: "تصدير الجداول إلى Excel وPDF وCSV",
    icon: Download,
    iconName: "Download",
    group: "system",
    permission: "export",
    defaultOrder: 20,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "backup",
    label: "النسخ الاحتياطي",
    shortLabel: "النسخ",
    description: "أخذ واستعادة نسخ احتياطية لقاعدة البيانات",
    icon: Database,
    iconName: "Database",
    group: "system",
    adminOnly: true,
    defaultOrder: 21,
    defaultVisible: true,
    canHide: true,
  },
  {
    id: "settings",
    label: "إعدادات النادي",
    shortLabel: "الإعدادات",
    description: "ترتيب الصفحات، المظهر، الأسعار، والنظام",
    icon: SettingsIcon,
    iconName: "SettingsIcon",
    group: "system",
    adminOnly: true,
    defaultOrder: 22,
    defaultVisible: true,
    canHide: false,
  },
];

/**
 * خريطة ربط معرّفات الصفحات بأنواع التصدير والتقارير المقابلة
 */
export const PAGE_TO_EXPORT_TYPES: Record<string, string[]> = {
  subscribers: ["subscribers-all", "subscribers-active", "subscribers-expired", "subscribers-expiring"],
  "members-directory": ["subscribers-all"],
  attendance: ["attendance"],
  "pool-schedule": ["dist-swimming-days", "dist-time-slots"],
  workhours: ["work-hours"],
  renewals: ["renewals"],
  compensations: ["compensations"],
  waitlist: ["waitlist"],
  categories: ["dist-age-categories"],
  "financial-hub": ["financial-stats", "monthly-revenue", "expenses", "payments"],
  insurance: ["insurance"],
  compound: ["compound"],
  "staff-compensations": ["compensations"],
  contracts: ["contracts"],
  users: ["employees"],
};

/**
 * الحصول على الاسم المعروض الفعلي للصفحة (المخصص أو الافتراضي)
 */
export function getEffectivePageLabel(item: PageNavigationItem): string {
  return item.customLabel?.trim() || item.label;
}

/**
 * الحصول على الاسم المختصر الفعلي للصفحة
 */
export function getEffectivePageShortLabel(item: PageNavigationItem): string {
  return item.customShortLabel?.trim() || item.shortLabel || item.label;
}

/**
 * الحصول على العنوان المعتمد للتصدير والملفات
 */
export function getEffectiveExportTitle(item: PageNavigationItem): string {
  return item.customExportTitle?.trim() || item.customLabel?.trim() || item.label;
}
