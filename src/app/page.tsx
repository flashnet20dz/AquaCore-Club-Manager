"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DataPagination } from "@/components/ui/data-pagination";
import {
  Plus, Search, Users, Wallet, ShieldCheck, Waves, TrendingUp, Filter, X,
  RefreshCw, Calendar, Droplet, Clock, Activity, Crown, Sparkles, Waves as WavesIcon,
  QrCode, Download, Settings as SettingsIcon, LogOut, Moon, Sun, ChevronLeft,
  UserCheck, RefreshCcw, FileText, Bell, Zap, Award, Pencil, Trash2,
  CreditCard, Inbox, UserCog, Database, Layers, Menu, CalendarOff, ListPlus, Building2,
  ArrowDownAZ, Banknote, Landmark, Copy, ArrowRightLeft,
  PanelRightClose, PanelRightOpen, Wifi,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ResponsiveGrid } from "@/components/responsive-grid";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/stat-card";
import { ProgressBars, DonutChart } from "@/components/charts";
import { SubscriberCard } from "@/components/subscriber-card";
import { SubscriberForm, type SubscriberFormValues } from "@/components/subscriber-form";
import { QRBadgeModal } from "@/components/qr-badge-modal";
import { AttendancePanel } from "@/components/attendance-panel";
import { RenewalPanel } from "@/components/renewal-panel";
import { ExportPanel } from "@/components/export-panel";
import { ReportViewer } from "@/components/reports";
import { SettingsPanel } from "@/components/settings-panel";
import { ThemeSettingsPanel } from "@/components/theme-settings-panel";
import { FinancialHub } from "@/components/financial-hub";
import { FinancialTransactionDialog } from "@/components/financial-transaction-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { SyncIndicator } from "@/components/sync-indicator";
import { UserManagement } from "@/components/user-management";
import { WorkHoursPanel } from "@/components/work-hours-panel";
import { WorkHoursManagement } from "@/components/work-hours-management";
import { PointagePanel } from "@/components/pointage-panel";
import { PoolSchedule } from "@/components/pool-schedule";
import { ImportPanel } from "@/components/import-panel";
import { CardDesignerPro } from "@/components/card-designer-pro";
import { InsurancePanel } from "@/components/insurance-panel";
import { CompoundPanel } from "@/components/compound-panel";
import { MembersDirectoryPanel } from "@/components/members-directory-panel";
import { CompensationsPanel } from "@/components/compensations-panel";
import { StaffCompensationsPanel } from "@/components/staff-compensations-panel";
import { WaitlistPanel } from "@/components/waitlist-panel";
import { useSubscriptionTypes } from "@/hooks/use-subscription-types";
import { ContractsPanel } from "@/components/contracts-panel";
import { IncomingMailPanel } from "@/components/incoming-mail-panel";
import { ProfessionalFooter } from "@/components/professional-footer";


import { NotificationBell } from "@/components/notification-bell";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { BackupPanel } from "@/components/backup-panel";
import { SubscriberRecordModal } from "@/components/subscriber-record-modal";
import { LocalNetworkCard } from "@/components/local-network-card";
import { NetworkConnectionDialog } from "@/components/network-connection-dialog";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { WhatsAppReminders } from "@/components/whatsapp-reminders";
import { hasPermission, ROLE_LABELS, ROLE_ICONS } from "@/lib/roles";
import { onFinancialUpdated } from "@/lib/financial-events";
import { formatDate } from "@/lib/date-utils";
import { fetchFinancialDashboard } from "@/lib/financial-query";
import { notifyClick, notifySuccess } from "@/lib/sounds";
import { toast } from "sonner";
import {
  AGE_CATEGORY_INFO,
  AGE_CATEGORY_ORDER,
  getAgeCategory,
  type SubscriberWithComputed,
} from "@/lib/rcs";
import { SubscriptionGate } from "@/components/subscription-gate";
import { SubscriptionBadge } from "@/components/subscription-badge";
import { CommandPalette } from "@/components/command-palette";
import { DashboardExtras } from "@/components/dashboard-extras";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { AchievementsPanel } from "@/components/achievements-panel";
import { KioskMode } from "@/components/kiosk-mode";
import { POSReceipt } from "@/components/pos-receipt";
import { ExecutiveDashboard } from "@/components/dashboard/executive-dashboard";
import { EnterpriseHub } from "@/components/enterprise-hub";

interface Stats {
  total: number;
  paid: number;
  bySubscriptionType: { type: string; count: number }[];
  byPaymentStatus: { status: string; count: number }[];
  byRenewalStatus: { status: string; count: number }[];
  ageGender: {
    malesUnder13: number; femalesUnder13: number;
    malesOver13: number; femalesOver13: number;
    totalMales: number; totalFemales: number;
    adultsOver14: number; childrenUnder14: number;
  };
  byBloodType: { type: string; count: number }[];
  bySwimmingDays: { days: string; count: number }[];
  byTimeSlot: { slot: string; count: number }[];
  // ★ المرحلة 4: إحصائيات المسبح (من الإعدادات وساعات العمل — بلا مالية)
  pool?: {
    todayKey: string | null;
    operatingToday: boolean;
    todaySessions: number;
    activeLifeguardsToday: number;
    todayWorkHours: number;
    pendingWagesMonth: number;
  } | null;
  // ★ المرحلة 5 (§25/§27): قسم العمال — نفس مصادر الأجور والعقود
  workers?: {
    employeesCount: number;
    activeEmployees: number;
    activeContracts: number;
    contractsExpiringSoon: number;
    expiringContractsList: Array<{ contractNumber: string; employeeName: string; endDate: string; daysRemaining: number }>;
    approvedHoursMonth: number;
    grossWagesMonth: number;
    paidWagesMonth: number;
    outstandingWagesMonth: number;
  } | null;
}

// ★ الأرقام المالية من الدفتر وحده (/api/financial/dashboard) — لا حساب موازٍ من المنخرطين
interface FinSummary {
  balance: {
    totalIncome: number; totalExpense: number; balance: number;
    incomeByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
  };
  monthlyComparison: { thisMonthIncome: number; netThisMonth: number };
  period: {
    openingBalance: number; income: number; expense: number; net: number;
    closingBalance: number; count: number; avgAmount: number;
    incomeByCategory: Record<string, { amount: number; count: number }>;
    expenseByCategory: Record<string, { amount: number; count: number }>;
  };
  receivables: { subscription: number; insurance: number; compound: number; total: number };
  payables: { wages: number; total: number };
  realAvailable: number;
  integrity: { matches: boolean; cachedBalance: number; ledgerBalance: number; diff: number };
  cancelled: { total: number; count: number };
}

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  subscriber?: { fileNumber: string; lastName: string; firstName: string } | null;
}

const SUBSCRIPTION_COLORS_HEX: Record<string, string> = {
  "/": "#0d9488", "OPOW": "#7c3aed", "DJS": "#c026d3",
  "FCS": "#0891b2", "RCS": "#4f46e5", "POLICE": "#475569",
};

export default function Home() {
  const [sessionUser, setSessionUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [subscribers, setSubscribers] = useState<SubscriberWithComputed[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  // ★ الملخص المالي من دفتر القيود — المصدر الوحيد لأرقام لوحة التحكم المالية
  const [finSummary, setFinSummary] = useState<FinSummary | null>(null);
  // ★ فترة عرض الأرقام المالية في لوحة التحكم (اليوم / 7 أيام / الشهر / 90 يوماً / السنة)
  const [finPeriod, setFinPeriod] = useState<"today" | "week" | "month" | "90d" | "year">("month");
  // ★ نافذة تسجيل حركة مالية سريعة من الصفحة الرئيسية
  const [quickTxOpen, setQuickTxOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterRenewal, setFilterRenewal] = useState("");
  const [filterAgeCategory, setFilterAgeCategory] = useState("");
  // 🔑 ترقيم صفحات شبكة المنخرطين للأداء العالي (10,000 منخرط بسلاسة 60 إطار/ثانية)
  const [subscribersPage, setSubscribersPage] = useState(1);
  const [subscribersPageSize, setSubscribersPageSize] = useState(48);
  // ★ الفئة المحددة لعرض قائمة المنخرطين
  const [selectedCat, setSelectedCat] = useState<{ key: string; title: string } | null>(null);
  // 🔑 ترتيب حسب رقم الملف
  const [sortBy, setSortBy] = useState("fileNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [formOpen, setFormOpen] = useState(false);
  // ★ الميزات الاحترافية الجديدة
  const [cmdOpen, setCmdOpen] = useState(false); // Command Palette
  const [kioskOpen, setKioskOpen] = useState(false); // Kiosk Mode
  const [wifiModalOpen, setWifiModalOpen] = useState(false); // Local Wi-Fi Connect
  const [posOpen, setPosOpen] = useState(false); // POS Receipt
  const [posSubscriber, setPosSubscriber] = useState<SubscriberWithComputed | null>(null);
  const [editInitial, setEditInitial] = useState<Partial<SubscriberFormValues> & { id?: string } | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<SubscriberWithComputed | null>(null);
  const [qrTarget, setQrTarget] = useState<SubscriberWithComputed | null>(null);
  const [recordTarget, setRecordTarget] = useState<SubscriberWithComputed | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // ★ التبويبات المالية المدمجة — قديم → جديد (توافق مع الروابط السابقة)
  const LEGACY_TAB_MAP: Record<string, string> = {
    "financial-dashboard": "financial-hub",
    "cash-register": "financial-hub",
    "charges": "financial-hub",
    "financial-payments": "financial-hub",
    "financial-reports": "financial-hub",
  };

  // Controlled tabs + mobile nav drawer
  // 🔑 التبويب الافتراضي حسب الدور
  const defaultTab = sessionUser?.role === "accountant" ? "financial-hub"
    : (sessionUser?.role === "admin" || sessionUser?.role === "superadmin" ? "dashboard" : "attendance");

  // ★ تحديد التبويب الأولي: إذا تم تحديث الصفحة (F5) يبقى في التبويب الحالي
  // بينما فتح الحساب الجديد يبدأ من أول صفحة (لوحة التحكم)
  const getInitialTab = (): string => {
    if (typeof window === "undefined") return defaultTab;
    try {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash && hash !== "dashboard") return LEGACY_TAB_MAP[hash] || hash;
      const sessionTab = sessionStorage.getItem("rcs-active-tab");
      if (sessionTab && sessionTab !== "dashboard") return LEGACY_TAB_MAP[sessionTab] || sessionTab;
    } catch {}
    return defaultTab;
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([getInitialTab()]));

  // حالة طي القائمة الجانبية مع التخزين في localStorage وتكيف تلقائي للأجهزة اللوحية
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aquacore_sidebar_collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      } else if (typeof window !== "undefined" && window.innerWidth < 1024) {
        // الأجهزة اللوحية (iPad/Tablets < 1024px): تبدأ مصغرة تلقائياً لترك مساحة كافية للعمل
        setSidebarCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("aquacore_sidebar_collapsed", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Hook موحد لجلب أنواع الاشتراك — Single Source of Truth
  // يجب استدعاؤه قبل أي early return (قواعد الـ Hooks)
  const { types: subscriptionTypes, refresh: refreshSubTypes } = useSubscriptionTypes();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // التقرير المفتوح حالياً في مركز التقارير
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  // ★ استرجاع التبويب عند تحديث الصفحة F5
  useEffect(() => {
    try {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const mapped = LEGACY_TAB_MAP[hash] || hash;
        setActiveTab(mapped);
      } else {
        const sessionTab = sessionStorage.getItem("rcs-active-tab");
        if (sessionTab) {
          const mapped = LEGACY_TAB_MAP[sessionTab] || sessionTab;
          setActiveTab(mapped);
        }
      }
    } catch {}
  }, []);

  // مسح التقرير المفتوح عند تغيير التبويب + حفظ التبويب في الجلسة والرابط للـ F5
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    try {
      sessionStorage.setItem("rcs-active-tab", tab);
      localStorage.setItem("rcs-active-tab", tab);
      if (typeof window !== "undefined") {
        const newHash = tab === defaultTab || tab === "dashboard" ? "" : `#${tab}`;
        const newUrl = window.location.pathname + window.location.search + newHash;
        window.history.replaceState(null, "", newUrl);
      }
    } catch {}
    if (tab !== "export") setOpenReportId(null);
  };
  // Filters drawer (mobile)
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  // Customizable header/footer text from settings
  const [headerTitle, setHeaderTitle] = useState("AquaCore Club Manager");
  const [headerSubtitle, setHeaderSubtitle] = useState("منظومة إدارة الاشتراكات والسباحة");
  const [footerText, setFooterText] = useState("AquaCore Club Manager — منظومة إدارة الاشتراكات والسباحة");
  const [footerNote, setFooterNote] = useState("المبلغ الإجمالي = رسوم الاشتراك + مصاريف التأمين");
  const [headerLogo, setHeaderLogo] = useState<string>("");
  const [themePrimary, setThemePrimary] = useState("#0f766e");
  const [themeSecondary, setThemeSecondary] = useState("#0369a1");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Check authentication on mount + load settings
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          // SuperAdmin → redirect to super-admin dashboard
          if (data.user.role === "superadmin") {
            window.location.href = "/super-admin";
            return;
          }
          setSessionUser(data.user);
        } else {
          window.location.href = "/login";
        }
      })
      .catch(() => {
        window.location.href = "/login";
      })
      .finally(() => setAuthLoading(false));

    // Load customizable header/footer text
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings || {};
        if (s.headerTitle) setHeaderTitle(s.headerTitle);
        if (s.headerSubtitle) setHeaderSubtitle(s.headerSubtitle);
        if (s.footerText) setFooterText(s.footerText);
        if (s.footerNote) setFooterNote(s.footerNote);
        if (s.headerLogo) setHeaderLogo(s.headerLogo);
        if (s.themePrimary) setThemePrimary(s.themePrimary);
        if (s.themeSecondary) setThemeSecondary(s.themeSecondary);
      })
      .catch(() => {});
  }, []);

  // ★ اختصار Ctrl+K لفتح Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ★ الاستماع لحدث "navigate-to-renewals" من Kiosk Mode
  useEffect(() => {
    const handler = () => handleTabChange("renewals");
    window.addEventListener("navigate-to-renewals", handler);
    return () => window.removeEventListener("navigate-to-renewals", handler);
  }, []);

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem("rcs-active-tab");
      localStorage.removeItem("rcs-active-tab");
    } catch {}
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPayment) params.set("paymentStatus", filterPayment);
      if (filterType) params.set("subscriptionType", filterType);
      if (filterGender) params.set("gender", filterGender);
      if (filterRenewal) params.set("renewalStatus", filterRenewal);
      // 🔑 ترتيب حسب رقم الملف
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("limit", "10000");

      const canFin = sessionUser ? hasPermission(sessionUser.role, "financialDashboard") : false;
      const [subsRes, statsRes, actRes, finRes] = await Promise.all([
        fetch(`/api/subscribers?${params.toString()}`).then((r) => r.json()).catch(() => ({ subscribers: [] })),
        fetch("/api/stats"),
        fetch("/api/activities"),
        // ★ المال من الدفتر فقط — للصلاحيات المالية فقط (الكاشير لا يرى بطاقات المال)
        // المرحلة 3: عبر طبقة الاستعلام المالية الموحدة (مصدر واحد للحقيقة)
        // .catch → فشل المسار المالي لا يُسقط بقية لوحة التحكم (نفس سلوك finRes.ok الأصلي)
        canFin ? fetchFinancialDashboard<FinSummary>("month").catch(() => null) : Promise.resolve(null as FinSummary | null),
      ]);
      const statsData = await statsRes.json();
      const actData = await actRes.json();
      setSubscribers(subsRes.subscribers || []);
      setStats(statsData);
      setActivities(actData.activities || []);
      setFinSummary(finRes);
    } catch {
      toast.error("تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [filterPayment, filterType, filterGender, filterRenewal, sortBy, sortOrder, sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [fetchData, sessionUser]);

  // ★ مزامنة فورية: أي عملية مالية في أي مكان تُحدّث بطاقات الصفحة الرئيسية بلا تحديث
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;
  useEffect(() => onFinancialUpdated(() => fetchDataRef.current()), []);

  // ★ إجمالي المداخيل «مع التحديث»: جلب خفيف للملخص المالي فقط (بلا إعادة تحميل الصفحة)
  //   — كل 45 ثانية + عند العودة إلى التبويبة + زر تحديث فوري في البطاقة.
  //   الأرقام تبقى من دفتر القيود حصراً (/api/financial/dashboard) — بلا أي حساب موازٍ.
  const [finRefreshing, setFinRefreshing] = useState(false);
  const refreshFinSummary = useCallback(async (periodOverride?: "today" | "week" | "month" | "90d" | "year") => {
    if (!sessionUser || !hasPermission(sessionUser.role, "financialDashboard")) return;
    setFinRefreshing(true);
    const targetPeriod = periodOverride || finPeriod;
    try {
      const data = await fetchFinancialDashboard<FinSummary>(targetPeriod);
      setFinSummary(data);
    } catch {
      /* صامت — تُبقى الأرقام الحالية معروضة حتى نجاح التحديث التالي */
    } finally {
      setFinRefreshing(false);
    }
  }, [sessionUser, finPeriod]);

  useEffect(() => {
    if (!sessionUser || !hasPermission(sessionUser.role, "financialDashboard")) return;
    const tick = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") refreshFinSummary();
    }, 45_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshFinSummary();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionUser, refreshFinSummary]);

  const handleAdd = () => {
    setEditInitial(undefined);
    setFormOpen(true);
  };

  const handleEdit = (sub: SubscriberWithComputed) => {
    setEditInitial({
      id: sub.id,
      lastName: sub.lastName,
      firstName: sub.firstName,
      birthDate: sub.birthDate ? new Date(sub.birthDate).toISOString().slice(0, 10) : undefined,
      gender: sub.gender,
      bloodType: sub.bloodType ?? undefined,
      subscriptionType: sub.subscriptionType,
      lastPaymentDate: sub.lastPaymentDate ? new Date(sub.lastPaymentDate).toISOString().slice(0, 10) : undefined,
      paymentStatus: sub.paymentStatus,
      swimmingDays: sub.swimmingDays,
      timeSlot: sub.timeSlot,
      phone: sub.phone ?? undefined,
    });
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { offlineFetch } = await import("@/hooks/use-offline-mutation");
      const res = await offlineFetch(`/api/subscribers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      const data = await res.json().catch(() => ({}));
      notifyClick();
      if (data.offline) {
        toast.success("✓ تم وضع علامة الحذف محلياً — سيُزامن عند عودة الاتصال");
      } else {
        toast.success(`تم حذف ${deleteTarget.lastName} ${deleteTarget.firstName}`);
      }
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error("فشل حذف المنخرط");
    }
  };

  const clearFilters = () => {
    setSearch(""); setFilterPayment(""); setFilterType(""); setFilterGender(""); setFilterRenewal(""); setFilterAgeCategory("");
    setSubscribersPage(1);
  };

  const hasFilters = search || filterPayment || filterType || filterGender || filterRenewal || filterAgeCategory;

  // بحث فوري (client-side) — بدون أي طلب شبكة، نتيجة لحظية أثناء الكتابة
  const normalizedSearch = search.trim().toLowerCase();
  const searchFiltered = normalizedSearch
    ? subscribers.filter((s) => {
        const haystack = `${s.fileNumber} ${s.firstName} ${s.lastName} ${s.phone || ""}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : subscribers;

  // Client-side age-category filter (API doesn't support this dimension)
  const visibleSubscribers = filterAgeCategory
    ? searchFiltered.filter((s) => getAgeCategory(s.gender, s.age) === filterAgeCategory)
    : searchFiltered;

  // 🔑 ترقيم صفحات شبكة المنخرطين للأداء العالي (10,000 منخرط بسلاسة 60 إطار/ثانية)
  const totalFilteredSubscribers = visibleSubscribers.length;
  const totalSubscribersPages = Math.max(1, Math.ceil(totalFilteredSubscribers / subscribersPageSize));
  const currentSubscribersPage = Math.min(subscribersPage, totalSubscribersPages);
  const pagedSubscribers = useMemo(() => {
    const start = (currentSubscribersPage - 1) * subscribersPageSize;
    return visibleSubscribers.slice(start, start + subscribersPageSize);
  }, [visibleSubscribers, currentSubscribersPage, subscribersPageSize]);

  // Bulk delete handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };
  const selectAll = () => setSelectedIds(visibleSubscribers.map((s) => s.id));
  const deselectAll = () => setSelectedIds([]);
  const enterSelectionMode = () => { setSelectionMode(true); setSelectedIds([]); };
  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds([]); };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/subscribers/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`تم حذف ${data.deletedCount} منخرط بنجاح`);
      setBulkDeleteOpen(false);
      exitSelectionMode();
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    } finally {
      setBulkDeleting(false);
    }
  };

  if (authLoading || !sessionUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-600 via-sky-700 to-indigo-800">
        <div className="text-white text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md mb-3">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
          <p className="text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const isAdmin = sessionUser.role === "admin" || sessionUser.role === "superadmin";
  // ★ المحاسب المالي يرى واجهة إدارة ساعات العمل الكاملة (لعرض الأجور) لكن لا يدير
  const canViewWorkHoursManagement = isAdmin || sessionUser.role === "accountant";

  // ★ الصلاحية المالية — بطاقات المال في لوحة التحكم للصلاحيات المالية فقط
  const canFin = sessionUser ? hasPermission(sessionUser.role, "financialDashboard") : false;
  return (
    <SubscriptionGate>
    <div
      className="min-h-screen ambient-canvas flex flex-col transition-colors duration-300"
      style={{ "--theme-primary": themePrimary, "--theme-secondary": themeSecondary } as React.CSSProperties}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/80 shadow-xs transition-colors duration-300">
        <div className="w-full mx-auto px-2 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
            {/* Mobile Sidebar Hamburger Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
              aria-label="فتح القائمة الجانبية"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Desktop Sidebar Collapse / Expand Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="hidden md:inline-flex h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
              title={sidebarCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
              aria-label="تبديل القائمة الجانبية"
            >
              {sidebarCollapsed ? <PanelRightOpen className="h-5 w-5" /> : <PanelRightClose className="h-5 w-5" />}
            </Button>

            <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-600 text-white shadow-md shadow-teal-500/30 overflow-hidden shrink-0">
              {headerLogo ? (
                <img src={headerLogo} alt="شعار" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <WavesIcon className="h-5 w-5" strokeWidth={2.5} />
              )}
              <span className="absolute -bottom-1 -left-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-full w-full rounded-full bg-amber-500" />
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xs xs:text-sm sm:text-base md:text-lg font-extrabold leading-tight truncate" dir="auto">
                {headerTitle}
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground -mt-0.5 truncate hidden md:block" dir="auto">
                {headerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-nowrap shrink-0 justify-end">
            {sessionUser.role !== "superadmin" && (
              <div className="hidden md:block shrink-0">
                <SubscriptionBadge />
              </div>
            )}
            <div className="shrink-0">
              <ThemeToggle />
            </div>
            <div className="hidden md:block shrink-0">
              <SyncIndicator />
            </div>
            <div className="shrink-0">
              <NotificationBell />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchData}
              title="تحديث البيانات"
              aria-label="تحديث البيانات"
              className="hidden lg:inline-flex h-9 w-9 shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {/* ★ زر البحث السريع (Ctrl+K) — يظهر من التابلت فما فوق */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCmdOpen(true)}
              className="hidden sm:inline-flex h-9 px-2 sm:px-3 gap-1.5 text-muted-foreground shrink-0"
              title="بحث سريع (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <kbd className="hidden md:inline text-[10px] font-mono border rounded px-1">Ctrl+K</kbd>
            </Button>
            {/* ★ زر ربط الهاتف والشبكة (سحابي / واي فاي محلي) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWifiModalOpen(true)}
              className="inline-flex h-9 px-2 sm:px-3 gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
              title="إعدادات الاتصال والشبكة (سحابي / محلي)"
            >
              <Wifi className="h-4 w-4" />
              <span className="hidden sm:inline">ربط الشبكة</span>
            </Button>
            {/* ★ زر شاشة البوابة الذكية */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setKioskOpen(true)}
              className="hidden xl:inline-flex h-9 gap-1.5 border-teal-400/40 text-teal-700 hover:bg-teal-50 shrink-0"
              title="شاشة البوابة الذكية"
            >
              <QrCode className="h-4 w-4" />
              <span>البوابة</span>
            </Button>
            {/* زر إضافة منخرط جديد: أيقونة على الموبايل، زر كامل على الشاشات الأكبر */}
            <Button
              onClick={handleAdd}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3.5 shadow-md shadow-primary/20 shrink-0"
              title="إضافة منخرط جديد"
              style={{ display: hasPermission(sessionUser.role, "subscribers") ? "" : "none" }}
            >
              <Plus className="h-4 w-4 sm:ml-1" />
              <span className="hidden sm:inline">منخرط جديد</span>
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 h-9 px-1.5 sm:px-2 rounded-lg border border-border/60 bg-card hover:bg-accent transition shrink-0 cursor-pointer">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                      {sessionUser?.name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden xl:inline text-xs font-semibold max-w-[100px] truncate">
                    {sessionUser?.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-semibold">{sessionUser?.name}</p>
                  <p className="text-xs text-muted-foreground font-normal">{sessionUser?.email}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {ROLE_ICONS[sessionUser.role as keyof typeof ROLE_ICONS] || "👤"} {ROLE_LABELS[sessionUser.role as keyof typeof ROLE_LABELS] || sessionUser.role}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 ml-2" /> تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-row min-w-0 w-full relative">
        {/* Desktop Sidebar (Collapsible & Reorderable via Settings) */}
        <div className="hidden md:flex shrink-0 sticky top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] z-30">
          <AppSidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            userRole={sessionUser.role}
            subscribersCount={stats?.total}
            expiredRenewalsCount={stats?.byRenewalStatus?.find(r => r.status === "منتهية")?.count}
            expiringContractsCount={stats?.workers?.contractsExpiringSoon}
            clubName={headerTitle}
            clubLogo={headerLogo}
          />
        </div>

        {/* Mobile Navigation Drawer */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="right" className="p-0 w-[280px] max-w-[85vw] border-l border-border bg-card h-full flex flex-col">
            <AppSidebar
              activeTab={activeTab}
              onTabChange={(tab) => {
                handleTabChange(tab);
                setMobileNavOpen(false);
              }}
              isCollapsed={false}
              onToggleCollapse={() => setMobileNavOpen(false)}
              userRole={sessionUser.role}
              subscribersCount={stats?.total}
              expiredRenewalsCount={stats?.byRenewalStatus?.find(r => r.status === "منتهية")?.count}
              expiringContractsCount={stats?.workers?.contractsExpiringSoon}
              clubName={headerTitle}
              clubLogo={headerLogo}
              isMobile={true}
              onCloseMobile={() => setMobileNavOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main Workspace Area */}
        <main className={cn(
          "flex-1 min-w-0 overflow-y-auto pb-24 md:pb-8",
          activeTab === "cards-pro" ? "p-0 space-y-0 overflow-hidden" : "px-2 sm:px-4 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6"
        )}>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            {/* DASHBOARD TAB */}
            {visitedTabs.has("dashboard") && (
              <TabsContent value="dashboard" forceMount className="space-y-6 mt-0 data-[state=inactive]:hidden">
            <OnboardingChecklist onGoTab={handleTabChange} />
            {loading || !stats ? (
              <DashboardSkeleton />
            ) : (
              <ExecutiveDashboard
                sessionUser={sessionUser}
                finSummary={finSummary}
                stats={stats}
                activities={activities}
                onNavigateTab={handleTabChange}
                onQuickTx={() => setQuickTxOpen(true)}
                onRefreshFinancial={() => refreshFinSummary(finPeriod)}
                finPeriod={finPeriod}
                onFinPeriodChange={(p) => {
                  setFinPeriod(p);
                  refreshFinSummary(p);
                }}
              />
            )}

            <DashboardExtras />
          </TabsContent>
        )}

          {/* SUBSCRIBERS TAB */}
          {visitedTabs.has("subscribers") && (
            <TabsContent value="subscribers" forceMount className="space-y-4 mt-0 data-[state=inactive]:hidden">
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              {/* Search bar — always visible */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث بالاسم، اللقب، رقم الملف، أو الهاتف..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSubscribersPage(1); }}
                    className="pr-10 h-11"
                  />
                </div>
                {/* 🔑 زر ترتيب حسب رقم الملف */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-3 shrink-0"
                  onClick={() => { setSortBy("fileNumber"); setSortOrder("asc"); setSubscribersPage(1); fetchData(); }}
                  title="ترتيب حسب رقم الملف"
                >
                  <ArrowDownAZ className="h-4 w-4 ml-1" />
                  <span className="hidden sm:inline">ترتيب</span>
                </Button>
                {/* Mobile: filter button that opens a Drawer */}
                <Button
                  variant="outline"
                  className="sm:hidden h-11 px-3 relative"
                  onClick={() => setFiltersDrawerOpen(true)}
                >
                  <Filter className="h-4 w-4 ml-1" />
                  فلترة
                  {hasFilters && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                      {[filterPayment, filterType, filterRenewal, filterAgeCategory, filterGender].filter(Boolean).length}
                    </span>
                  )}
                </Button>
                {hasFilters && (
                  <Button variant="ghost" size="icon" onClick={clearFilters} className="sm:hidden h-11 w-11" title="مسح الفلاتر">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Desktop: inline filters (hidden on mobile) */}
              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                <Select value={filterPayment || "all"} onValueChange={(v) => { setFilterPayment(v === "all" ? "" : v); setSubscribersPage(1); }}>
                  <SelectTrigger className="w-[140px] h-11"><SelectValue placeholder="حالة الدفع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="مدفوع">مدفوع</SelectItem>
                    <SelectItem value="لم يدفع">لم يدفع</SelectItem>
                    <SelectItem value="تأمين فقط">تأمين فقط</SelectItem>
                    <SelectItem value="اشتراك 300">اشتراك 300</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType || "all"} onValueChange={(v) => { setFilterType(v === "all" ? "" : v); setSubscribersPage(1); }}>
                  <SelectTrigger className="w-[140px] h-11"><SelectValue placeholder="نوع الاشتراك" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {subscriptionTypes.filter(t => t.active).map((t) => (
                      <SelectItem key={t.code} value={t.code}>
                        {t.name === t.code ? t.name : `${t.name} (${t.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterRenewal || "all"} onValueChange={(v) => { setFilterRenewal(v === "all" ? "" : v); setSubscribersPage(1); }}>
                  <SelectTrigger className="w-[140px] h-11"><SelectValue placeholder="حالة التجديد" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="سارية">سارية</SelectItem>
                    <SelectItem value="قريبة">قريبة الانتهاء</SelectItem>
                    <SelectItem value="منتهية">منتهية</SelectItem>
                    <SelectItem value="مجمدة">مجمدة</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterAgeCategory || "all"} onValueChange={(v) => { setFilterAgeCategory(v === "all" ? "" : v); setSubscribersPage(1); }}>
                  <SelectTrigger className="w-[160px] h-11"><SelectValue placeholder="الفئة العمرية" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفئات</SelectItem>
                    {AGE_CATEGORY_ORDER.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {AGE_CATEGORY_INFO[cat].icon} {AGE_CATEGORY_INFO[cat].shortLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasFilters && (
                  <Button variant="ghost" size="icon" onClick={clearFilters} className="h-11 w-11" title="مسح">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {(hasFilters || subscribers.length > 0) && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Filter className="h-3 w-3" />
                    {loading ? "جاري التحميل..." : `${visibleSubscribers.length} منخرط ${totalSubscribersPages > 1 ? `(صفحة ${currentSubscribersPage} من ${totalSubscribersPages})` : ""}`}
                  </span>
                  <div className="flex items-center gap-3">
                    {hasFilters && <button onClick={clearFilters} className="text-primary hover:underline">مسح الفلاتر</button>}
                    {!selectionMode ? (
                      <button onClick={enterSelectionMode} className="text-primary hover:underline flex items-center gap-1">
                        <Trash2 className="h-3 w-3" /> تحديد وحذف
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={selectAll} className="text-primary hover:underline">تحديد الكل</button>
                        <button onClick={deselectAll} className="text-muted-foreground hover:underline">إلغاء التحديد</button>
                        <button onClick={exitSelectionMode} className="text-rose-600 hover:underline">خروج</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bulk delete bar */}
            {selectionMode && selectedIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-16 z-30 rounded-2xl bg-rose-500/95 backdrop-blur-md text-white p-3 flex items-center justify-between shadow-lg"
              >
                <span className="text-sm font-semibold">
                  تم تحديد {selectedIds.length} منخرط
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white text-rose-600 hover:bg-white/90"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4 ml-1" /> حذف المحدد ({selectedIds.length})
                </Button>
              </motion.div>
            )}

            {loading ? (
              <ResponsiveGrid minCardWidth={260} gap={16}>
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
              </ResponsiveGrid>
            ) : visibleSubscribers.length === 0 ? (
              <EmptyState onAdd={handleAdd} hasFilters={!!hasFilters} />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                  <AnimatePresence mode="popLayout">
                    {pagedSubscribers.map((sub, i) => (
                      <SubscriberCard
                        key={sub.id}
                        subscriber={sub}
                        onEdit={handleEdit}
                        onDelete={setDeleteTarget}
                        onShowQR={setQrTarget}
                        onViewRecord={setRecordTarget}
                        onPrintPOS={(s) => { setPosSubscriber(s); setPosOpen(true); }}
                        index={i}
                        selectionMode={selectionMode}
                        selected={selectedIds.includes(sub.id)}
                        onToggleSelect={toggleSelect}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* 🔑 شريط الترقيم السلس للأداء العالي مع 10,000 منخرط */}
                <DataPagination
                  currentPage={currentSubscribersPage}
                  totalPages={totalSubscribersPages}
                  totalItems={totalFilteredSubscribers}
                  pageSize={subscribersPageSize}
                  onPageChange={(p) => {
                    setSubscribersPage(p);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onPageSizeChange={(sz) => {
                    setSubscribersPageSize(sz);
                    setSubscribersPage(1);
                  }}
                  pageSizeOptions={[24, 48, 96, 192]}
                  itemLabel="منخرط"
                />
              </div>
            )}
          </TabsContent>
        )}

          {/* ATTENDANCE TAB */}
          {visitedTabs.has("attendance") && (
            <TabsContent value="attendance" forceMount className="mt-0 data-[state=inactive]:hidden">
              <AttendancePanel subscribers={subscribers} onRefresh={fetchData} />
            </TabsContent>
          )}

          {/* RENEWALS TAB */}
          {visitedTabs.has("renewals") && (
            <TabsContent value="renewals" forceMount className="space-y-4 mt-0 data-[state=inactive]:hidden">
              <WhatsAppReminders />
              <RenewalPanel subscribers={subscribers} onRefresh={fetchData} />
            </TabsContent>
          )}

          {/* COMPENSATIONS TAB */}
          {visitedTabs.has("compensations") && (
            <TabsContent value="compensations" forceMount className="mt-0 data-[state=inactive]:hidden">
              <CompensationsPanel />
            </TabsContent>
          )}

          {visitedTabs.has("waitlist") && (
            <TabsContent value="waitlist" forceMount className="mt-0 data-[state=inactive]:hidden">
              <WaitlistPanel />
            </TabsContent>
          )}

          {/* INSURANCE TAB */}
          {hasPermission(sessionUser.role, "subscribers") && visitedTabs.has("insurance") && (
            <TabsContent value="insurance" forceMount className="mt-0 data-[state=inactive]:hidden">
              <InsurancePanel subscribers={subscribers} onRefresh={fetchData} />
            </TabsContent>
          )}

          {/* COMPOUND RIGHTS TAB */}
          {hasPermission(sessionUser.role, "subscribers") && visitedTabs.has("compound") && (
            <TabsContent value="compound" forceMount className="mt-0 data-[state=inactive]:hidden">
              <CompoundPanel />
            </TabsContent>
          )}

          {/* ★ MEMBERS DIRECTORY TAB */}
          {hasPermission(sessionUser.role, "subscribers") && visitedTabs.has("members-directory") && (
            <TabsContent value="members-directory" forceMount className="mt-0 data-[state=inactive]:hidden">
              <MembersDirectoryPanel />
            </TabsContent>
          )}

          {/* CATEGORIES TAB */}
          {visitedTabs.has("categories") && (
            <TabsContent value="categories" forceMount className="space-y-4 mt-0 data-[state=inactive]:hidden">
              {loading || !stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
                </div>
              ) : (
                <>
                  <ResponsiveGrid minCardWidth={140} gap={12}>
                    <CategoryCard title="ذكور أقل من 13 سنة" count={stats.ageGender.malesUnder13} icon="👦" gradient="from-sky-500/15 to-sky-500/5" border="border-sky-500/30" onClick={() => setSelectedCat({ key: "males_under_13", title: "ذكور أقل من 13 سنة" })} />
                    <CategoryCard title="إناث أقل من 13 سنة" count={stats.ageGender.femalesUnder13} icon="👧" gradient="from-pink-500/15 to-pink-500/5" border="border-pink-500/30" onClick={() => setSelectedCat({ key: "females_under_13", title: "إناث أقل من 13 سنة" })} />
                    <CategoryCard title="ذكور 13 سنة فما فوق" count={stats.ageGender.malesOver13} icon="👨" gradient="from-indigo-500/15 to-indigo-500/5" border="border-indigo-500/30" onClick={() => setSelectedCat({ key: "males_13_plus", title: "ذكور 13 سنة فما فوق" })} />
                    <CategoryCard title="إناث 13 سنة فما فوق" count={stats.ageGender.femalesOver13} icon="👩" gradient="from-fuchsia-500/15 to-fuchsia-500/5" border="border-fuchsia-500/30" onClick={() => setSelectedCat({ key: "females_13_plus", title: "إناث 13 سنة فما فوق" })} />
                  </ResponsiveGrid>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/60 bg-card p-5">
                      <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> توزيع الجنس</h3>
                      <div className="flex items-center justify-around gap-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-sky-500/15 mx-auto mb-2"><Users className="h-8 w-8 text-sky-600 dark:text-sky-300" /></div>
                          <p className="text-2xl font-extrabold text-sky-700 dark:text-sky-300">{stats.ageGender.totalMales}</p>
                          <p className="text-xs text-muted-foreground">ذكور</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-pink-500/15 mx-auto mb-2"><Users className="h-8 w-8 text-pink-600 dark:text-pink-300" /></div>
                          <p className="text-2xl font-extrabold text-pink-700 dark:text-pink-300">{stats.ageGender.totalFemales}</p>
                          <p className="text-xs text-muted-foreground">إناث</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/40 p-2 text-center">
                          <p className="text-xs text-muted-foreground">13 سنة فما فوق</p>
                          <p className="font-bold">{stats.ageGender.adultsOver14}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2 text-center">
                          <p className="text-xs text-muted-foreground">أقل من 13 سنة</p>
                          <p className="font-bold">{stats.ageGender.childrenUnder14}</p>
                        </div>
                      </div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border/60 bg-card p-5">
                      <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Waves className="h-4 w-4 text-primary" /> أيام السباحة</h3>
                      <ProgressBars items={stats.bySwimmingDays.map((d) => ({ label: d.days, value: d.count, color: "bg-gradient-to-l from-teal-500 to-sky-500" }))} total={Math.max(...stats.bySwimmingDays.map(d => d.count), 1)} />
                    </motion.div>
                  </div>
                </>
              )}
            </TabsContent>
          )}

          {/* ★ Modal: قائمة المنخرطين في فئة محددة */}
          {selectedCat && (
            <Dialog open={!!selectedCat} onOpenChange={(o) => !o && setSelectedCat(null)}>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" /> {selectedCat.title}
                    <Badge variant="secondary">
                      {subscribers.filter((s) => {
                        const cat = getAgeCategory(s.gender, s.age);
                        if (selectedCat.key === "males_under_13") return cat === "males_under_13";
                        if (selectedCat.key === "females_under_13") return cat === "females_under_13";
                        if (selectedCat.key === "males_13_plus") return cat === "males_13_plus";
                        if (selectedCat.key === "females_13_plus") return cat === "females_13_plus";
                        return false;
                      }).length} منخرط
                    </Badge>
                  </DialogTitle>
                </DialogHeader>
                <CategorySubscriberList
                  subscribers={subscribers.filter((s) => {
                    const cat = getAgeCategory(s.gender, s.age);
                    if (selectedCat.key === "males_under_13") return cat === "males_under_13";
                    if (selectedCat.key === "females_under_13") return cat === "females_under_13";
                    if (selectedCat.key === "males_13_plus") return cat === "males_13_plus";
                    if (selectedCat.key === "females_13_plus") return cat === "females_13_plus";
                    return false;
                  })}
                  categoryTitle={selectedCat.title}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* EXPORT TAB — مركز التقارير */}
          {visitedTabs.has("export") && (
            <TabsContent value="export" forceMount className="mt-0 data-[state=inactive]:hidden">
              {openReportId ? (
                <ReportViewer reportId={openReportId} onBack={() => setOpenReportId(null)} />
              ) : (
                <ExportPanel onOpenReport={(id) => { setOpenReportId(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              )}
            </TabsContent>
          )}

          {/* ★ المركز المالي — صفحة تقارير ومعاملات مالية موحّدة بلا تكرار */}
          {(hasPermission(sessionUser.role, "charges") || hasPermission(sessionUser.role, "financialDashboard") || hasPermission(sessionUser.role, "financialReports")) && visitedTabs.has("financial-hub") && (
            <TabsContent value="financial-hub" forceMount className="mt-0 data-[state=inactive]:hidden">
              <FinancialHub role={sessionUser.role} />
            </TabsContent>
          )}

          {/* ★ STAFF COMPENSATIONS TAB (financial — admin/assistant/lifeguard) */}
          {hasPermission(sessionUser.role, "staffCompensations") && visitedTabs.has("staff-compensations") && (
            <TabsContent value="staff-compensations" forceMount className="mt-0 data-[state=inactive]:hidden">
              {/* ★ المحاسب المالي يرى التعويضات لكن لا يضيف/يعدّل (canManage=false) */}
              <StaffCompensationsPanel canManage={hasPermission(sessionUser.role, "staffCompensationsManage")} />
            </TabsContent>
          )}

          {/* INCOMING MAIL TAB (الوارد الإداري) */}
          {hasPermission(sessionUser.role, "incomingMail") && visitedTabs.has("incoming-mail") && (
            <TabsContent value="incoming-mail" forceMount className="mt-0 data-[state=inactive]:hidden">
              <IncomingMailPanel userRole={sessionUser.role} />
            </TabsContent>
          )}

          {/* CONTRACTS TAB (admin only) */}
          {isAdmin && visitedTabs.has("contracts") && (
            <TabsContent value="contracts" forceMount className="mt-0 data-[state=inactive]:hidden">
              <ContractsPanel />
            </TabsContent>
          )}

          {/* ANALYTICS TAB */}
          {visitedTabs.has("analytics") && (
            <TabsContent value="analytics" forceMount className="mt-0 data-[state=inactive]:hidden">
              <AnalyticsCharts />
              <AchievementsPanel />
            </TabsContent>
          )}

          {/* WORK HOURS TAB */}
          {hasPermission(sessionUser.role, "workHours") && visitedTabs.has("workhours") && (
            <TabsContent value="workhours" forceMount className="mt-0 data-[state=inactive]:hidden">
              {/* ★ المحاسب المالي + المدير = واجهة الإدارة الكاملة (ساعات + أجور) */}
              {/* ★ role يُمرَّر لعرض قسم «أيام وساعات استغلال المسبح» للمدير فقط */}
              {canViewWorkHoursManagement ? <WorkHoursManagement role={sessionUser.role} /> : <PointagePanel />}
            </TabsContent>
          )}

          {/* POOL SCHEDULE TAB (المرحلة 4) — المصدر الموحّد لجلسات المسبح */}
          {hasPermission(sessionUser.role, "workHours") && visitedTabs.has("pool-schedule") && (
            <TabsContent value="pool-schedule" forceMount className="mt-0 data-[state=inactive]:hidden">
              <PoolSchedule role={sessionUser.role} />
            </TabsContent>
          )}

          {/* CARD DESIGNER PRO TAB (unified — المصمم الوحيد) */}
          {hasPermission(sessionUser.role, "cards") && visitedTabs.has("cards-pro") && (
            <TabsContent value="cards-pro" forceMount className="mt-0 data-[state=inactive]:hidden">
              <CardDesignerPro subscribers={subscribers} onBack={() => handleTabChange("dashboard")} />
            </TabsContent>
          )}

          {/* IMPORT TAB */}
          {hasPermission(sessionUser.role, "import") && visitedTabs.has("import") && (
            <TabsContent value="import" forceMount className="mt-0 data-[state=inactive]:hidden">
              <ImportPanel />
            </TabsContent>
          )}

          {/* USERS TAB (admin only) */}
          {isAdmin && visitedTabs.has("users") && (
            <TabsContent value="users" forceMount className="mt-0 data-[state=inactive]:hidden">
              <UserManagement />
            </TabsContent>
          )}

          {/* ENTERPRISE HUB TAB (Club Admin) */}
          {isAdmin && visitedTabs.has("enterprise-hub") && (
            <TabsContent value="enterprise-hub" forceMount className="mt-0 data-[state=inactive]:hidden">
              <EnterpriseHub clubName={headerTitle || "النادي الرياضي"} />
            </TabsContent>
          )}

          {/* BACKUP TAB (admin only) */}
          {isAdmin && visitedTabs.has("backup") && (
            <TabsContent value="backup" forceMount className="mt-0 data-[state=inactive]:hidden">
              <BackupPanel />
            </TabsContent>
          )}

          {/* SETTINGS TAB (admin only) */}
          {isAdmin && visitedTabs.has("settings") && (
            <TabsContent value="settings" forceMount className="space-y-4 mt-0 data-[state=inactive]:hidden">
              <SettingsPanel />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>

      {/* ====== Mobile filters Drawer (subscribers tab) ====== */}
      <Sheet open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
        <SheetContent side="bottom" className="h-[80vh] p-0">
          <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white">
            <SheetTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Filter className="h-5 w-5" /> تصفية المنخرطين
              </span>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded">
                  مسح الكل
                </button>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">حالة الدفع</label>
              <Select value={filterPayment || "all"} onValueChange={(v) => setFilterPayment(v === "all" ? "" : v)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="مدفوع">مدفوع</SelectItem>
                  <SelectItem value="لم يدفع">لم يدفع</SelectItem>
                  <SelectItem value="تأمين فقط">تأمين فقط</SelectItem>
                  <SelectItem value="اشتراك 300">اشتراك 300</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">نوع الاشتراك</label>
              <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {subscriptionTypes.filter(t => t.active).map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.name === t.code ? t.name : `${t.name} (${t.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">حالة التجديد</label>
              <Select value={filterRenewal || "all"} onValueChange={(v) => setFilterRenewal(v === "all" ? "" : v)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="سارية">سارية</SelectItem>
                  <SelectItem value="قريبة">قريبة الانتهاء</SelectItem>
                  <SelectItem value="منتهية">منتهية</SelectItem>
                  <SelectItem value="مجمدة">مجمدة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">الفئة العمرية</label>
              <Select value={filterAgeCategory || "all"} onValueChange={(v) => setFilterAgeCategory(v === "all" ? "" : v)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="كل الفئات" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفئات</SelectItem>
                  {AGE_CATEGORY_ORDER.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {AGE_CATEGORY_INFO[cat].icon} {AGE_CATEGORY_INFO[cat].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full h-11"
              onClick={() => setFiltersDrawerOpen(false)}
            >
              عرض النتائج ({visibleSubscribers.length} منخرط)
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ProfessionalFooter
        clubName={headerTitle}
        headerTitle={headerSubtitle}
        onNavigateTab={handleTabChange}
        onOpenCommandPalette={() => setCmdOpen(true)}
        sessionUser={sessionUser}
      />

      <SubscriberForm open={formOpen} onOpenChange={setFormOpen} initial={editInitial} onSaved={fetchData} />
      <QRBadgeModal open={!!qrTarget} onOpenChange={(o) => !o && setQrTarget(null)} subscriber={qrTarget} />
      <SubscriberRecordModal subscriber={recordTarget} open={!!recordTarget} onOpenChange={(o) => !o && setRecordTarget(null)} />

      {/* ★ الميزات الاحترافية الجديدة */}
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        subscribers={subscribers}
        onNavigate={handleTabChange}
        onAddSubscriber={handleAdd}
        onOpenKiosk={() => setKioskOpen(true)}
      />
      <KioskMode open={kioskOpen} onClose={() => setKioskOpen(false)} />
      <POSReceipt
        open={posOpen}
        onClose={() => { setPosOpen(false); setPosSubscriber(null); }}
        subscriber={posSubscriber}
      />
      <FinancialTransactionDialog
        open={quickTxOpen}
        onOpenChange={setQuickTxOpen}
        currentBalance={finSummary?.balance.balance ?? 0}
        onSaved={() => {
          refreshFinSummary();
          fetchData();
        }}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المنخرط{" "}
              <span className="font-bold text-foreground">{deleteTarget?.lastName} {deleteTarget?.firstName}</span>؟
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">نعم، احذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف الجماعي</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف{" "}
              <span className="font-bold text-rose-600">{selectedIds.length} منخرط</span>؟
              سيتم حذف جميع بياناتهم (الحضور، التجديدات، الأنشطة) نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {bulkDeleting ? "جاري الحذف..." : `نعم، احذف ${selectedIds.length} منخرط`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* نافذة إعدادات الاتصال بالسيرفر والشبكة (سحابي / محلي) */}
      <NetworkConnectionDialog open={wifiModalOpen} onClose={() => setWifiModalOpen(false)} />

      {/* شريط التنقل السفلي الاحترافي للأجهزة المحمولة */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenMenu={() => setMobileNavOpen(true)}
        subscribersCount={stats?.total}
        unresolvedAlertsCount={stats?.workers?.contractsExpiringSoon}
      />
    </div>
    </SubscriptionGate>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
    create: { icon: UserCheck, color: "bg-emerald-500/15 text-emerald-600" },
    update: { icon: Pencil, color: "bg-sky-500/15 text-sky-600" },
    delete: { icon: Trash2, color: "bg-rose-500/15 text-rose-600" },
    renewal: { icon: RefreshCw, color: "bg-amber-500/15 text-amber-600" },
    attendance: { icon: QrCode, color: "bg-violet-500/15 text-violet-600" },
    payment: { icon: Wallet, color: "bg-teal-500/15 text-teal-600" },
  };
  const { icon: Icon, color } = map[type] || map.update;
  return (
    <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${color}`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function FinanceRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/80">{label}</span>
        <span className="font-bold tabular-nums">{count} منخرط</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div className={`absolute inset-y-0 right-0 rounded-full ${color}`} style={{ width: `${count > 0 ? 100 : 0}%` }} />
      </div>
      <p className="text-xs text-muted-foreground text-left">{total.toLocaleString("en-US")} دج</p>
    </div>
  );
}

function CategoryCard({ title, count, icon, gradient, border, onClick }: { title: string; count: number; icon: string; gradient: string; border: string; onClick?: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-5 text-right cursor-pointer hover:shadow-lg transition-shadow`}
    >
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-3xl font-extrabold tabular-nums">{count}</p>
      <p className="text-xs text-muted-foreground mt-1">{title}</p>
      {onClick && <p className="text-[10px] text-primary mt-1 opacity-70">اضغط للتفاصيل ←</p>}
    </motion.button>
  );
}

function EmptyState({ onAdd, hasFilters }: { onAdd: () => void; hasFilters: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-sky-600 text-white shadow-xl">
          <Waves className="h-10 w-10" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-lg font-bold mb-1">{hasFilters ? "لا توجد نتائج" : "ابدأ بتسجيل أول منخرط"}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        {hasFilters ? "لم نعثر على منخرطين مطابقين للفلاتر." : "أنشئ سجلك الأول للمنخرطين في AquaCore Club Manager."}
      </p>
      <Button onClick={onAdd} className="h-11 px-6"><Plus className="h-4 w-4 ml-1" /> تسجيل منخرط</Button>
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-3xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}

// ---------- Mobile navigation item (for hamburger Drawer) ----------
function MobileNavItem({
  icon: Icon,
  label,
  badge,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg text-sm transition mb-0.5",
        active
          ? "bg-primary/10 text-primary font-semibold border border-primary/30"
          : "hover:bg-accent border border-transparent"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-right">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{badge}</Badge>
      )}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════
// ★ CategorySubscriberList — قائمة المنخرطين في فئة محددة
// تعرض الجدول + أزرار نسخ وتحميل (Word/Excel)
// ═════════════════════════════════════════════════════════════
function CategorySubscriberList({ subscribers, categoryTitle }: {
  subscribers: SubscriberWithComputed[];
  categoryTitle: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = subscribers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.lastName?.toLowerCase().includes(q) ||
      s.firstName?.toLowerCase().includes(q) ||
      s.fileNumber?.toLowerCase().includes(q);
  });

  // ★ نسخ القائمة إلى الحافظة
  const handleCopy = async () => {
    if (filtered.length === 0) { toast.error("لا يوجد منخرطون للنسخ"); return; }
    const header = "#\tرقم الملف\tاللقب\tالاسم\tالميلاد\tالجنس\tالعمر\tنوع الاشتراك\tحالة الدفع";
    const rows = filtered.map((s, i) => {
      const bd = s.birthDate ? new Date(s.birthDate) : null;
      const bdStr = bd ? `${String(bd.getDate()).padStart(2,"0")}/${String(bd.getMonth()+1).padStart(2,"0")}/${bd.getFullYear()}` : "—";
      return `${i + 1}\t${s.fileNumber}\t${s.lastName}\t${s.firstName}\t${bdStr}\t${s.gender}\t${s.age}\t${s.subscriptionType}\t${s.paymentStatus}`;
    }).join("\n");
    const text = `${categoryTitle}\n\n${header}\n${rows}\n\nالإجمالي: ${filtered.length} منخرط`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`تم نسخ ${filtered.length} منخرط`);
    } catch {
      toast.error("تعذر النسخ");
    }
  };

  // ★ تحميل Word
  const handleDownloadWord = () => {
    if (filtered.length === 0) { toast.error("لا يوجد منخرطون"); return; }
    const tableRows = filtered.map((s, i) => `<tr>
      <td style="text-align:center;padding:5px;border:1px solid #ccc;">${i + 1}</td>
      <td style="text-align:center;font-family:monospace;padding:5px;border:1px solid #ccc;">${s.fileNumber}</td>
      <td style="padding:5px;border:1px solid #ccc;">${s.lastName}</td>
      <td style="padding:5px;border:1px solid #ccc;">${s.firstName}</td>
      <td style="text-align:center;padding:5px;border:1px solid #ccc;">${s.birthDate ? (() => { const _d = new Date(s.birthDate); return `${String(_d.getDate()).padStart(2,'0')}/${String(_d.getMonth()+1).padStart(2,'0')}/${_d.getFullYear()}`; })() : '—'}</td>
      <td style="text-align:center;padding:5px;border:1px solid #ccc;">${s.gender}</td>
      <td style="text-align:center;padding:5px;border:1px solid #ccc;">${s.age}</td>
      <td style="text-align:center;padding:5px;border:1px solid #ccc;">${s.subscriptionType}</td>
      <td style="text-align:center;padding:5px;border:1px solid #ccc;">${s.paymentStatus}</td>
    </tr>`).join("");
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <style>body{font-family:'Cairo','Tahoma',Arial;font-size:10pt;direction:rtl}
      table{border-collapse:collapse;width:100%}th{background:#0f766e;color:white;padding:5px;border:1px solid #ccc}
      td{padding:5px;border:1px solid #ccc}tr:nth-child(even){background:#f0fdfa}</style></head><body>
      <h2 style="color:#0f766e;text-align:center">${categoryTitle}</h2>
      <p style="text-align:center;color:#555">عدد المنخرطين: ${filtered.length} — ${formatDate(new Date())}</p>
      <table><thead><tr><th>#</th><th>رقم الملف</th><th>اللقب</th><th>الاسم</th><th>الميلاد</th><th>الجنس</th><th>العمر</th><th>نوع الاشتراك</th><th>حالة الدفع</th></tr></thead>
      <tbody>${tableRows}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: "application/msword; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `AquaCore_${categoryTitle.replace(/\s/g, "_")}.doc`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("تم تحميل قائمة الفئة بصيغة Word");
  };

  // ★ تحميل Excel
  const handleDownloadExcel = () => {
    if (filtered.length === 0) { toast.error("لا يوجد منخطرطون"); return; }
    import("xlsx").then((XLSX) => {
      const data = filtered.map((s, i) => ({
        "#": i + 1, "رقم الملف": s.fileNumber, "اللقب": s.lastName, "الاسم": s.firstName,
        "الميلاد": s.birthDate ? (() => { const _d = new Date(s.birthDate); return `${String(_d.getDate()).padStart(2,'0')}/${String(_d.getMonth()+1).padStart(2,'0')}/${_d.getFullYear()}`; })() : "—",
        "الجنس": s.gender, "العمر": s.age, "نوع الاشتراك": s.subscriptionType, "حالة الدفع": s.paymentStatus,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "الفئة");
      XLSX.writeFile(wb, `AquaCore_${categoryTitle.replace(/\s/g, "_")}.xlsx`);
      toast.success("تم تحميل قائمة الفئة بصيغة Excel");
    });
  };

  return (
    <div className="space-y-3">
      {/* أزرار النسخ والتحميل */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 flex-1 max-w-xs" />
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={handleCopy} disabled={filtered.length === 0}
            className="border-sky-500/40 bg-sky-500/5 text-sky-700 hover:bg-sky-500/10">
            <Copy className="h-3.5 w-3.5 ml-1" /> نسخ
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadWord} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5 ml-1" /> Word
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadExcel} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5 ml-1" /> Excel
          </Button>
        </div>
      </div>

      {/* جدول المنخرطين */}
      <div className="rounded-xl border overflow-y-auto max-h-[50vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 z-10">
            <tr className="text-right border-b-2 border-primary/20">
              <th className="p-2 w-10">#</th>
              <th className="p-2">رقم الملف</th>
              <th className="p-2">اللقب</th>
              <th className="p-2">الاسم</th>
              <th className="p-2 text-center">الميلاد</th>
              <th className="p-2 text-center w-12">الجنس</th>
              <th className="p-2 text-center w-12">العمر</th>
              <th className="p-2 text-center">الاشتراك</th>
              <th className="p-2 text-center">الدفع</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">لا يوجد منخخطون في هذه الفئة</td></tr>
            ) : (
              filtered.map((s, i) => (
                <tr key={s.id} className="border-b border-border/40 hover:bg-muted/40">
                  <td className="p-2 text-center text-xs text-muted-foreground">{i + 1}</td>
                  <td className="p-2 text-center font-mono text-xs">{s.fileNumber}</td>
                  <td className="p-2 font-medium">{s.lastName}</td>
                  <td className="p-2 font-medium">{s.firstName}</td>
                  <td className="p-2 text-center text-xs">{s.birthDate ? (() => { const _d = new Date(s.birthDate); return `${String(_d.getDate()).padStart(2,'0')}/${String(_d.getMonth()+1).padStart(2,'0')}/${_d.getFullYear()}`; })() : "—"}</td>
                  <td className="p-2 text-center">{s.gender === "ذكر" ? "♂" : "♀"}</td>
                  <td className="p-2 text-center text-xs">{s.age}</td>
                  <td className="p-2 text-center"><Badge variant="outline" className="text-[9px]">{s.subscriptionType}</Badge></td>
                  <td className="p-2 text-center"><Badge variant="outline" className={cn("text-[9px]", s.paymentStatus === "مدفوع" ? "bg-emerald-100 text-emerald-700" : s.paymentStatus === "معفى" ? "bg-violet-100 text-violet-700" : "bg-rose-100 text-rose-700")}>{s.paymentStatus}</Badge></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground text-center">الإجمالي: {filtered.length} منخرط</p>
    </div>
  );
}
