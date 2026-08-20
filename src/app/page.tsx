"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Users, Wallet, ShieldCheck, Waves, TrendingUp, Filter, X,
  RefreshCw, Calendar, Droplet, Clock, Activity, Crown, Sparkles, Waves as WavesIcon,
  QrCode, Download, Settings as SettingsIcon, LogOut, Moon, Sun, ChevronLeft,
  UserCheck, RefreshCcw, FileText, Bell, Zap, Award, Pencil, Trash2,
  CreditCard, Inbox, UserCog, Database, Layers, Menu, CalendarOff, ListPlus, Building2,
  ArrowDownAZ, Banknote, Briefcase, Copy,
} from "lucide-react";
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
import { FinancialDashboard } from "@/components/financial-dashboard";
import { FinancialPayments } from "@/components/financial-payments";
import { FinancialReports } from "@/components/financial-reports";
import { ThemeToggle } from "@/components/theme-toggle";
import { SyncIndicator } from "@/components/sync-indicator";
import { UserManagement } from "@/components/user-management";
import { WorkHoursPanel } from "@/components/work-hours-panel";
import { WorkHoursManagement } from "@/components/work-hours-management";
import { PointagePanel } from "@/components/pointage-panel";
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


import { NotificationBell } from "@/components/notification-bell";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { BackupPanel } from "@/components/backup-panel";
import { ChargesPanel } from "@/components/charges-panel";
import { SubscriberRecordModal } from "@/components/subscriber-record-modal";
import { WhatsAppReminders } from "@/components/whatsapp-reminders";
import { hasPermission, ROLE_LABELS, ROLE_ICONS } from "@/lib/roles";
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

interface Stats {
  total: number;
  paid: number;
  financial: {
    totalSubscriptionFees: number;
    totalInsuranceFees: number;
    totalCompoundRights: number;
    totalRevenue: number;
    avgPayment: number;
  };
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
  financialDetail: {
    count300: number; sum300: number;
    count1300: number; sum1300: number;
    count1500: number; sum1500: number;
    totalInsurance: number; totalCompoundRights: number;
  };
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterRenewal, setFilterRenewal] = useState("");
  const [filterAgeCategory, setFilterAgeCategory] = useState("");
  // ★ الفئة المحددة لعرض قائمة المنخرطين
  const [selectedCat, setSelectedCat] = useState<{ key: string; title: string } | null>(null);
  // 🔑 ترتيب حسب رقم الملف
  const [sortBy, setSortBy] = useState("fileNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [formOpen, setFormOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<Partial<SubscriberFormValues> & { id?: string } | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<SubscriberWithComputed | null>(null);
  const [qrTarget, setQrTarget] = useState<SubscriberWithComputed | null>(null);
  const [recordTarget, setRecordTarget] = useState<SubscriberWithComputed | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Controlled tabs + mobile nav drawer
  // 🔑 التبويب الافتراضي حسب الدور، لكن يُحفظ في localStorage ليبقى عند التحديث
  const defaultTab = sessionUser?.role === "accountant" ? "financial-dashboard"
    : (sessionUser?.role === "admin" || sessionUser?.role === "superadmin" ? "dashboard" : "attendance");
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  // Hook موحد لجلب أنواع الاشتراك — Single Source of Truth
  // يجب استدعاؤه قبل أي early return (قواعد الـ Hooks)
  const { types: subscriptionTypes, refresh: refreshSubTypes } = useSubscriptionTypes();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // التقرير المفتوح حالياً في مركز التقارير
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  // ★ استرجاع التبويب المحفوظ عند تحميل الصفحة (يبقى عند التحديث)
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem("rcs-active-tab");
      if (savedTab) setActiveTab(savedTab);
    } catch {}
  }, []);

  // مسح التقرير المفتوح عند تغيير التبويب + حفظ التبويب
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    try { localStorage.setItem("rcs-active-tab", tab); } catch {}
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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const fetchAllSubscribers = useCallback(async (params: URLSearchParams) => {
    // نظام الترقيم بالسيرفر يرجّع 100 بالصفحة افتراضياً (500 حد أقصى) —
    // نلف على كل الصفحات ونجمعها بمصفوفة واحدة، حتى تبقى تجربة "قائمة
    // كاملة محمَّلة + بحث فوري بالمتصفح" شغالة بدون تغيير بباقي الواجهة.
    const all: any[] = [];
    let page = 1;
    const MAX_PAGES = 40; // سقف أمان: 40 × 500 = 20,000 سجل، أعلى بكثير من أي نادٍ واقعي
    while (page <= MAX_PAGES) {
      params.set("page", String(page));
      params.set("limit", "500");
      const res = await fetch(`/api/subscribers?${params.toString()}`);
      const data = await res.json();
      all.push(...(data.subscribers || []));
      if (!data.pagination?.hasMore) break;
      page++;
    }
    return all;
  }, []);

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

      const [allSubs, statsRes, actRes] = await Promise.all([
        fetchAllSubscribers(params),
        fetch("/api/stats"),
        fetch("/api/activities"),
      ]);
      const statsData = await statsRes.json();
      const actData = await actRes.json();
      setSubscribers(allSubs);
      setStats(statsData);
      setActivities(actData.activities || []);
    } catch {
      toast.error("تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [filterPayment, filterType, filterGender, filterRenewal, sortBy, sortOrder, fetchAllSubscribers]);

  useEffect(() => {
    if (!sessionUser) return;
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [fetchData, sessionUser]);

  const handleAdd = () => {
    setEditInitial(undefined);
    setFormOpen(true);
  };

  const handleEdit = (sub: SubscriberWithComputed) => {
    setEditInitial({
      id: sub.id,
      lastName: sub.lastName,
      firstName: sub.firstName,
      birthDate: sub.birthDate,
      gender: sub.gender,
      bloodType: sub.bloodType,
      subscriptionType: sub.subscriptionType,
      lastPaymentDate: sub.lastPaymentDate,
      paymentStatus: sub.paymentStatus,
      swimmingDays: sub.swimmingDays,
      timeSlot: sub.timeSlot,
      phone: sub.phone,
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

  return (
    <SubscriptionGate>
    <div
      className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col"
      style={{ "--theme-primary": themePrimary, "--theme-secondary": themeSecondary } as React.CSSProperties}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/40">
        <div className="max-w-[1500px] mx-auto px-2 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-600 text-white shadow-lg shadow-teal-500/30 overflow-hidden">
              {headerLogo ? (
                <img src={headerLogo} alt="شعار" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <WavesIcon className="h-5 w-5" strokeWidth={2.5} />
              )}
              <span className="absolute -bottom-1 -left-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold leading-tight">
                {headerTitle}
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground -mt-0.5">
                {headerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {sessionUser.role !== "superadmin" && <SubscriptionBadge />}
            <ThemeToggle />
            <SyncIndicator />
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={fetchData} title="تحديث" aria-label="تحديث البيانات" className="h-9 w-9">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleAdd} className="h-9 px-3 sm:px-5 shadow-md shadow-primary/20" style={{ display: hasPermission(sessionUser.role, "subscribers") ? "" : "none" }}>
              <Plus className="h-4 w-4 ml-1" />
              <span className="hidden sm:inline">منخرط جديد</span>
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 h-9 px-2 rounded-lg border border-border/60 bg-card hover:bg-accent transition">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                      {sessionUser?.name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:inline text-xs font-semibold max-w-[100px] truncate">
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

      <main className="flex-1 max-w-[1500px] w-full mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Mobile: hamburger button that opens a Drawer with all tabs */}
          <div className="sm:hidden -mx-2 mb-2 px-2">
            <Button
              variant="outline"
              className="w-full h-11 justify-between"
              onClick={() => setMobileNavOpen(true)}
            >
              <span className="flex items-center gap-2">
                <Menu className="h-5 w-5" />
                <span className="font-semibold">القائمة</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {activeTab === "dashboard" ? "لوحة التحكم" :
                 activeTab === "subscribers" ? "المنخرطون" :
                 activeTab === "attendance" ? "الحضور" :
                 activeTab === "renewals" ? "التجديد" :
                 activeTab === "compensations" ? "التعويضات" :
                 activeTab === "waitlist" ? "قائمة الانتظار" :
                 activeTab === "workhours" ? "ساعات العمل" :
                 activeTab === "insurance" ? "التأمين" :
                 activeTab === "categories" ? "الفئات" :
                 activeTab === "analytics" ? "التحليلات" :
                 activeTab === "cards-pro" ? "مصمم البطاقات" :
                 activeTab === "import" ? "الاستيراد" :
                 activeTab === "export" ? "التصدير" :
                 activeTab === "charges" ? "الأعباء" :
                 activeTab === "staff-compensations" ? "تعويضات العمال" :
                 activeTab === "financial-dashboard" ? "لوحة المالية والتقارير" :
                 activeTab === "financial-payments" ? "الدفعات" :
                 activeTab === "financial-reports" ? "التقارير المالية" :
                 activeTab === "members-directory" ? "سجل المنخرطين" :
                 activeTab === "contracts" ? "عقود العمال" :
                 activeTab === "users" ? "المستخدمون" :
                 activeTab === "backup" ? "النسخ الاحتياطي" :
                 activeTab === "settings" ? "الإعدادات" : activeTab}
              </span>
            </Button>
          </div>

          {/* Desktop: horizontal scrollable tab bar (hidden on mobile) */}
          <div className="hidden sm:block overflow-x-auto pb-2 -mx-2 px-2">
            <TabsList className="bg-card border border-border/60 p-1 h-auto inline-flex">
              {/* 🔑 لوحة التحكم والتحليلات: للمدير فقط (admin + superadmin) */}
              {(sessionUser.role === "admin" || sessionUser.role === "superadmin") && (
                <TabsTrigger value="dashboard" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Activity className="h-4 w-4" /> لوحة التحكم
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "subscribers") && (
                <TabsTrigger value="subscribers" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Users className="h-4 w-4" /> المنخرطون
                  {stats && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{stats.total}</Badge>}
                </TabsTrigger>
              )}
              <TabsTrigger value="attendance" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                <QrCode className="h-4 w-4" /> الحضور
              </TabsTrigger>
              {hasPermission(sessionUser.role, "workHours") && (
                <TabsTrigger value="workhours" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Clock className="h-4 w-4" /> ساعات العمل
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "renewals") && (
                <TabsTrigger value="renewals" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <RefreshCcw className="h-4 w-4" /> التجديد
                  {stats && stats.byRenewalStatus.find(r => r.status === "منتهية")?.count > 0 && (
                    <span className="flex h-2 w-2 bg-rose-500 rounded-full" />
                  )}
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "renewals") && (
                <TabsTrigger value="compensations" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <CalendarOff className="h-4 w-4" /> التعويضات
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "renewals") && (
                <TabsTrigger value="waitlist" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <ListPlus className="h-4 w-4" /> الانتظار
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "subscribers") && (
                <TabsTrigger value="insurance" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <ShieldCheck className="h-4 w-4" /> التأمين
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "subscribers") && (
                <TabsTrigger value="compound" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Building2 className="h-4 w-4" /> حقوق المركب
                </TabsTrigger>
              )}
              {/* ★ سجل المنخرطين الكامل */}
              {hasPermission(sessionUser.role, "subscribers") && (
                <TabsTrigger value="members-directory" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Users className="h-4 w-4" /> سجل المنخرطين
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "subscribers") && (
                <TabsTrigger value="categories" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Crown className="h-4 w-4" /> الفئات
                </TabsTrigger>
              )}
              {/* 🔑 التحليلات: للمدير فقط */}
              {(sessionUser.role === "admin" || sessionUser.role === "superadmin") && (
                <TabsTrigger value="analytics" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <TrendingUp className="h-4 w-4" /> التحليلات
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "cards") && (
                <TabsTrigger value="cards-pro" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Sparkles className="h-4 w-4" /> مصمم البطاقات
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "import") && (
                <TabsTrigger value="import" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Inbox className="h-4 w-4" /> الاستيراد
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "export") && (
                <TabsTrigger value="export" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Download className="h-4 w-4" /> التصدير
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "charges") && (
                <TabsTrigger value="charges" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Wallet className="h-4 w-4" /> الأعباء والتسديدات
                </TabsTrigger>
              )}
              {hasPermission(sessionUser.role, "staffCompensations") && (
                <TabsTrigger value="staff-compensations" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Banknote className="h-4 w-4" /> تعويضات العمال
                </TabsTrigger>
              )}
              {/* ★ Financial System (المحاسب المالي) — 3 tabs */}
              {hasPermission(sessionUser.role, "financialDashboard") && (
                <TabsTrigger value="financial-dashboard" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Briefcase className="h-4 w-4" /> لوحة المالية والتقارير
                </TabsTrigger>
              )}
              {/* ★ تم دمج الدفعات ضمن تبويب الأعباء، والتقارير ضمن لوحة المالية */}
              {isAdmin && (
                <TabsTrigger value="contracts" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <FileText className="h-4 w-4" /> عقود العمال
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="users" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <UserCog className="h-4 w-4" /> المستخدمون
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="backup" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <Database className="h-4 w-4" /> النسخ الاحتياطي
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="settings" className="gap-1 px-2 sm:px-4 py-1.5 text-xs sm:text-sm whitespace-nowrap">
                  <SettingsIcon className="h-4 w-4" /> الإعدادات
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard" className="space-y-6 mt-0">
            {loading || !stats ? (
              <DashboardSkeleton />
            ) : (
              <>
                {/* Hero */}
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-teal-600 via-sky-700 to-indigo-800 p-6 sm:p-8 text-white"
                >
                  <div className="absolute inset-0 opacity-20">
                    <svg className="absolute bottom-0 left-0 w-full h-32" viewBox="0 0 1200 120" preserveAspectRatio="none">
                      <path d="M0,60 C150,100 350,0 600,60 C850,120 1050,20 1200,60 L1200,120 L0,120 Z" fill="white" />
                    </svg>
                    <svg className="absolute bottom-0 left-0 w-full h-20" viewBox="0 0 1200 120" preserveAspectRatio="none">
                      <path d="M0,80 C200,40 400,100 600,80 C800,60 1000,100 1200,80 L1200,120 L0,120 Z" fill="white" opacity="0.5" />
                    </svg>
                  </div>
                  <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-amber-300" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                          مرحباً {sessionUser?.name}
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold mb-1">AquaCore Club Manager</h2>
                      <p className="text-sm text-white/80 max-w-md">
                        تابع اشتراكات، حضور، وتجديدات منخرطيك في مكان واحد — مع QR وإشعارات WhatsApp
                      </p>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                      <div className="text-center">
                        <div className="text-3xl font-extrabold tabular-nums">{stats.total}</div>
                        <div className="text-xs text-white/80 mt-0.5">إجمالي المنخرطين</div>
                      </div>
                      <div className="h-12 w-px bg-white/20" />
                      <div className="text-center">
                        <div className="text-3xl font-extrabold tabular-nums text-amber-300">
                          {stats.financial.totalRevenue.toLocaleString("en-US")}
                        </div>
                        <div className="text-xs text-white/80 mt-0.5">الإيرادات (دج)</div>
                      </div>
                    </div>
                  </div>
                </motion.section>

                {/* Stat cards — auto-fit grid (1 col mobile, 2 tablet, 4 desktop) */}
                <ResponsiveGrid minCardWidth={140} gap={12}>
                  <StatCard label="رسوم الاشتراكات" value={stats.financial.totalSubscriptionFees} suffix="دج" icon={Wallet} accent="ocean" delay={0} sublabel={`${stats.paid} منخرط نشط`} />
                  <StatCard label="مصاريف التأمين" value={stats.financial.totalInsuranceFees} suffix="دج" icon={ShieldCheck} accent="emerald" delay={0.05} sublabel="500 دج لكل منخرط" />
                  <StatCard label="حقوق المركب" value={stats.financial.totalCompoundRights} suffix="دج" icon={Waves} accent="teal" delay={0.1} sublabel="مستثناة من الإجمالي" />
                  <StatCard label="متوسط الدفعة" value={stats.financial.avgPayment} suffix="دج" icon={TrendingUp} accent="amber" delay={0.15} sublabel="لكل منخرط مدفوع" />
                </ResponsiveGrid>

                {/* Renewal + Activity feed */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="rounded-2xl border border-border/60 bg-card p-5"
                  >
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" /> حالة التجديد
                    </h3>
                    <div className="flex items-center justify-around gap-3">
                      <DonutChart
                        slices={[
                          { label: "سارية", value: stats.byRenewalStatus.find(r => r.status === "سارية")?.count || 0, color: "#10b981" },
                          { label: "قريبة", value: stats.byRenewalStatus.find(r => r.status === "قريبة الانتهاء")?.count || 0, color: "#f59e0b" },
                          { label: "منتهية", value: stats.byRenewalStatus.find(r => r.status === "منتهية")?.count || 0, color: "#ef4444" },
                          { label: "مجمدة", value: stats.byRenewalStatus.find(r => r.status === "مجمدة")?.count || 0, color: "#64748b" },
                        ]}
                        centerValue={stats.total}
                        centerLabel="منخرط"
                        size={140}
                      />
                      <div className="space-y-2 text-xs">
                        <LegendItem color="#10b981" label="سارية" value={stats.byRenewalStatus.find(r => r.status === "سارية")?.count || 0} />
                        <LegendItem color="#f59e0b" label="قريبة الانتهاء" value={stats.byRenewalStatus.find(r => r.status === "قريبة الانتهاء")?.count || 0} />
                        <LegendItem color="#ef4444" label="منتهية" value={stats.byRenewalStatus.find(r => r.status === "منتهية")?.count || 0} />
                        <LegendItem color="#64748b" label="مجمدة" value={stats.byRenewalStatus.find(r => r.status === "مجمدة")?.count || 0} />
                      </div>
                    </div>
                  </motion.div>

                  {/* Activity Feed */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 }}
                    className="rounded-2xl border border-border/60 bg-card p-5 lg:col-span-2"
                  >
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" /> آخر النشاطات
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {activities.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-6">لا توجد نشاطات</p>
                      ) : (
                        activities.slice(0, 10).map((a, i) => (
                          <motion.div
                            key={a.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent/40 transition text-sm"
                          >
                            <ActivityIcon type={a.type} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground/90">{a.description}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(a.createdAt).toLocaleString("ar-DZ", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                              </p>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </section>

                {/* Subscription types + payment status */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="rounded-2xl border border-border/60 bg-card p-5"
                  >
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" /> توزيع أنواع الاشتراك
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {stats.bySubscriptionType.map((item) => (
                        <div key={item.type} className="rounded-xl border border-border/60 p-2.5 text-center hover:shadow-md transition">
                          <div className="flex items-center justify-center gap-1">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: SUBSCRIPTION_COLORS_HEX[item.type] }} />
                            <span className="text-xs font-bold">{item.type === "/" ? "عادي" : item.type}</span>
                          </div>
                          <p className="text-xl font-extrabold tabular-nums mt-1">{item.count}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                    className="rounded-2xl border border-border/60 bg-card p-5"
                  >
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" /> حالات الدفع
                    </h3>
                    <ProgressBars
                      items={stats.byPaymentStatus.map((p) => ({
                        label: p.status, value: p.count,
                        color: p.status === "مدفوع" ? "bg-emerald-500"
                          : p.status === "لم يدفع" ? "bg-rose-500"
                          : p.status === "تأمين فقط" ? "bg-sky-500" : "bg-amber-500",
                      }))}
                      total={stats.total}
                      delay={0.4}
                    />
                  </motion.div>
                </section>

                {/* Financial detail + blood types */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    className="rounded-2xl border border-border/60 bg-gradient-to-br from-amber-500/5 to-transparent p-5"
                  >
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-amber-600" /> التفصيل المالي
                    </h3>
                    <div className="space-y-3">
                      <FinanceRow label="رسوم 300 دج × عدد" count={stats.financialDetail.count300} total={stats.financialDetail.sum300} color="bg-amber-500" />
                      <FinanceRow label="رسوم 1300 دج × عدد" count={stats.financialDetail.count1300} total={stats.financialDetail.sum1300} color="bg-teal-500" />
                      <FinanceRow label="رسوم 1500 دج × عدد" count={stats.financialDetail.count1500} total={stats.financialDetail.sum1500} color="bg-sky-500" />
                      <div className="pt-3 mt-3 border-t border-border/60 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">تأمين مُحصَّل</span>
                          <span className="font-bold tabular-nums">{stats.financialDetail.totalInsurance.toLocaleString("en-US")} دج</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">حقوق مركب مُحصَّلة</span>
                          <span className="font-bold tabular-nums">{stats.financialDetail.totalCompoundRights.toLocaleString("en-US")} دج</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.45 }}
                    className="rounded-2xl border border-border/60 bg-card p-5"
                  >
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <Droplet className="h-4 w-4 text-primary" /> فصائل الدم
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {stats.byBloodType.map((bt) => (
                        <div key={bt.type} className="rounded-xl border border-border/60 p-2.5 text-center hover:border-rose-500/40 transition-colors">
                          <div className="flex items-center justify-center gap-1">
                            <Droplet className="h-3 w-3 text-rose-500" />
                            <span className="text-xs font-bold">{bt.type}</span>
                          </div>
                          <p className="text-xl font-extrabold tabular-nums mt-1">{bt.count}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </section>
              </>
            )}
          </TabsContent>

          {/* SUBSCRIBERS TAB */}
          <TabsContent value="subscribers" className="space-y-4 mt-0">
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              {/* Search bar — always visible */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث بالاسم، اللقب، رقم الملف، أو الهاتف..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
                {/* 🔑 زر ترتيب حسب رقم الملف */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-3 shrink-0"
                  onClick={() => { setSortBy("fileNumber"); setSortOrder("asc"); fetchData(); }}
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
                <Select value={filterPayment || "all"} onValueChange={(v) => setFilterPayment(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[140px] h-11"><SelectValue placeholder="حالة الدفع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="مدفوع">مدفوع</SelectItem>
                    <SelectItem value="لم يدفع">لم يدفع</SelectItem>
                    <SelectItem value="تأمين فقط">تأمين فقط</SelectItem>
                    <SelectItem value="اشتراك 300">اشتراك 300</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
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
                <Select value={filterRenewal || "all"} onValueChange={(v) => setFilterRenewal(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[140px] h-11"><SelectValue placeholder="حالة التجديد" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="سارية">سارية</SelectItem>
                    <SelectItem value="قريبة">قريبة الانتهاء</SelectItem>
                    <SelectItem value="منتهية">منتهية</SelectItem>
                    <SelectItem value="مجمدة">مجمدة</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterAgeCategory || "all"} onValueChange={(v) => setFilterAgeCategory(v === "all" ? "" : v)}>
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
                    {loading ? "جاري التحميل..." : `${visibleSubscribers.length} منخرط`}
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
              <motion.div layout className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                <AnimatePresence mode="popLayout">
                  {visibleSubscribers.map((sub, i) => (
                    <SubscriberCard
                      key={sub.id}
                      subscriber={sub}
                      onEdit={handleEdit}
                      onDelete={setDeleteTarget}
                      onShowQR={setQrTarget}
                      onViewRecord={setRecordTarget}
                      index={i}
                      selectionMode={selectionMode}
                      selected={selectedIds.includes(sub.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </TabsContent>

          {/* ATTENDANCE TAB */}
          <TabsContent value="attendance" className="mt-0">
            <AttendancePanel subscribers={subscribers} onRefresh={fetchData} />
          </TabsContent>

          {/* RENEWALS TAB */}
          <TabsContent value="renewals" className="space-y-4 mt-0">
            <WhatsAppReminders />
            <RenewalPanel subscribers={subscribers} onRefresh={fetchData} />
          </TabsContent>

          {/* COMPENSATIONS TAB */}
          <TabsContent value="compensations" className="mt-0">
            <CompensationsPanel />
          </TabsContent>

          <TabsContent value="waitlist" className="mt-0">
            <WaitlistPanel />
          </TabsContent>

          {/* INSURANCE TAB */}
          {hasPermission(sessionUser.role, "subscribers") && (
            <TabsContent value="insurance" className="mt-0">
              <InsurancePanel subscribers={subscribers} onRefresh={fetchData} />
            </TabsContent>
          )}

          {/* COMPOUND RIGHTS TAB */}
          {hasPermission(sessionUser.role, "subscribers") && (
            <TabsContent value="compound" className="mt-0">
              <CompoundPanel />
            </TabsContent>
          )}

          {/* ★ MEMBERS DIRECTORY TAB */}
          {hasPermission(sessionUser.role, "subscribers") && (
            <TabsContent value="members-directory" className="mt-0">
              <MembersDirectoryPanel />
            </TabsContent>
          )}

          {/* CATEGORIES TAB */}
          <TabsContent value="categories" className="space-y-4 mt-0">
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
          <TabsContent value="export" className="mt-0">
            {openReportId ? (
              <ReportViewer reportId={openReportId} onBack={() => setOpenReportId(null)} />
            ) : (
              <ExportPanel onOpenReport={(id) => { setOpenReportId(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            )}
          </TabsContent>

          {/* CHARGES TAB (admin only) */}
          {hasPermission(sessionUser.role, "charges") && (
            <TabsContent value="charges" className="mt-0 space-y-4">
              <ChargesPanel subscribers={subscribers} />
              {/* ★ دمج الدفعات مع الأعباء والتسديدات */}
              {hasPermission(sessionUser.role, "financialPayments") && (
                <div className="mt-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary">
                    <Wallet className="h-4 w-4" /> الدفعات والمعاملات المالية
                  </h3>
                  <FinancialPayments />
                </div>
              )}
            </TabsContent>
          )}

          {/* ★ STAFF COMPENSATIONS TAB (financial — admin/assistant/lifeguard) */}
          {hasPermission(sessionUser.role, "staffCompensations") && (
            <TabsContent value="staff-compensations" className="mt-0">
              {/* ★ المحاسب المالي يرى التعويضات لكن لا يضيف/يعدّل (canManage=false) */}
              <StaffCompensationsPanel canManage={hasPermission(sessionUser.role, "staffCompensationsManage")} />
            </TabsContent>
          )}

          {/* ★ FINANCIAL SYSTEM: دمج لوحة المالية + التقارير المالية في تبويب واحد */}
          {hasPermission(sessionUser.role, "financialDashboard") && (
            <TabsContent value="financial-dashboard" className="mt-0 space-y-4">
              <FinancialDashboard />
              {/* ★ دمج التقارير المالية مع لوحة المالية */}
              {hasPermission(sessionUser.role, "financialReports") && (
                <div className="mt-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary">
                    <FileText className="h-4 w-4" /> التقارير المالية
                  </h3>
                  <FinancialReports />
                </div>
              )}
            </TabsContent>
          )}

          {/* CONTRACTS TAB (admin only) */}
          {isAdmin && (
            <TabsContent value="contracts" className="mt-0">
              <ContractsPanel />
            </TabsContent>
          )}

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="mt-0">
            <AnalyticsCharts />
          </TabsContent>

          {/* WORK HOURS TAB */}
          {hasPermission(sessionUser.role, "workHours") && (
            <TabsContent value="workhours" className="mt-0">
              {/* ★ المحاسب المالي + المدير = واجهة الإدارة الكاملة (ساعات + أجور) */}
              {canViewWorkHoursManagement ? <WorkHoursManagement /> : <PointagePanel />}
            </TabsContent>
          )}

          {/* CARD DESIGNER PRO TAB (unified — المصمم الوحيد) */}
          {hasPermission(sessionUser.role, "cards") && (
            <TabsContent value="cards-pro" className="mt-0">
              <CardDesignerPro subscribers={subscribers} onBack={() => window.location.href = "/"} />
            </TabsContent>
          )}

          {/* IMPORT TAB */}
          {hasPermission(sessionUser.role, "import") && (
            <TabsContent value="import" className="mt-0">
              <ImportPanel />
            </TabsContent>
          )}

          {/* USERS TAB (admin only) */}
          {isAdmin && (
            <TabsContent value="users" className="mt-0">
              <UserManagement />
            </TabsContent>
          )}

          {/* BACKUP TAB (admin only) */}
          {isAdmin && (
            <TabsContent value="backup" className="mt-0">
              <BackupPanel />
            </TabsContent>
          )}

          {/* SETTINGS TAB (admin only) */}
          {isAdmin && (
            <TabsContent value="settings" className="space-y-4 mt-0">
              <ThemeSettingsPanel />
              <SettingsPanel />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* ====== Mobile navigation Drawer (hamburger menu) ====== */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="right" className="w-[280px] sm:w-[320px] p-0">
          <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white">
            <SheetTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Menu className="h-5 w-5" /> القائمة الرئيسية
              </span>
            </SheetTitle>
          </SheetHeader>
          <nav className="p-2 overflow-y-auto h-[calc(100%-56px)]">
            {/* 🔑 لوحة التحكم: للمدير فقط */}
            {isAdmin && (
              <MobileNavItem
                icon={Activity}
                label="لوحة التحكم"
                active={activeTab === "dashboard"}
                onClick={() => { setActiveTab("dashboard"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "subscribers") && (
              <MobileNavItem
                icon={Users}
                label="المنخرطون"
                badge={stats?.total}
                active={activeTab === "subscribers"}
                onClick={() => { setActiveTab("subscribers"); setMobileNavOpen(false); }}
              />
            )}
            <MobileNavItem
              icon={QrCode}
              label="الحضور"
              active={activeTab === "attendance"}
              onClick={() => { setActiveTab("attendance"); setMobileNavOpen(false); }}
            />
            {hasPermission(sessionUser.role, "workHours") && (
              <MobileNavItem
                icon={Clock}
                label="ساعات العمل"
                active={activeTab === "workhours"}
                onClick={() => { setActiveTab("workhours"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "renewals") && (
              <MobileNavItem
                icon={RefreshCcw}
                label="التجديد"
                active={activeTab === "renewals"}
                onClick={() => { setActiveTab("renewals"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "renewals") && (
              <MobileNavItem
                icon={CalendarOff}
                label="التعويضات"
                active={activeTab === "compensations"}
                onClick={() => { setActiveTab("compensations"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "renewals") && (
              <MobileNavItem
                icon={ListPlus}
                label="قائمة الانتظار"
                active={activeTab === "waitlist"}
                onClick={() => { setActiveTab("waitlist"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "subscribers") && (
              <MobileNavItem
                icon={ShieldCheck}
                label="التأمين"
                active={activeTab === "insurance"}
                onClick={() => { setActiveTab("insurance"); setMobileNavOpen(false); }}
              />
            )}
            {/* ★ سجل المنخرطين mobile nav */}
            {hasPermission(sessionUser.role, "subscribers") && (
              <MobileNavItem
                icon={Users}
                label="سجل المنخرطين"
                active={activeTab === "members-directory"}
                onClick={() => { setActiveTab("members-directory"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "subscribers") && (
              <MobileNavItem
                icon={Crown}
                label="الفئات"
                active={activeTab === "categories"}
                onClick={() => { setActiveTab("categories"); setMobileNavOpen(false); }}
              />
            )}
            {/* 🔑 التحليلات: للمدير فقط */}
            {isAdmin && (
              <MobileNavItem
                icon={TrendingUp}
                label="التحليلات"
                active={activeTab === "analytics"}
                onClick={() => { setActiveTab("analytics"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "cards") && (
              <MobileNavItem
                icon={Sparkles}
                label="مصمم البطاقات"
                active={activeTab === "cards-pro"}
                onClick={() => { setActiveTab("cards-pro"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "import") && (
              <MobileNavItem
                icon={Inbox}
                label="الاستيراد"
                active={activeTab === "import"}
                onClick={() => { setActiveTab("import"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "export") && (
              <MobileNavItem
                icon={Download}
                label="التصدير"
                active={activeTab === "export"}
                onClick={() => { handleTabChange("export"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "charges") && (
              <MobileNavItem
                icon={Wallet}
                label="الأعباء والتسديدات"
                active={activeTab === "charges"}
                onClick={() => { handleTabChange("charges"); setMobileNavOpen(false); }}
              />
            )}
            {hasPermission(sessionUser.role, "staffCompensations") && (
              <MobileNavItem
                icon={Banknote}
                label="تعويضات العمال"
                active={activeTab === "staff-compensations"}
                onClick={() => { handleTabChange("staff-compensations"); setMobileNavOpen(false); }}
              />
            )}
            {/* ★ Financial system mobile nav */}
            {hasPermission(sessionUser.role, "financialDashboard") && (
              <MobileNavItem
                icon={Briefcase}
                label="لوحة المالية والتقارير"
                active={activeTab === "financial-dashboard"}
                onClick={() => { handleTabChange("financial-dashboard"); setMobileNavOpen(false); }}
              />
            )}
            {/* ★ تم دمج الدفعات ضمن تبويب الأعباء، والتقارير ضمن لوحة المالية */}
            {isAdmin && (
              <MobileNavItem
                icon={FileText}
                label="عقود العمال"
                active={activeTab === "contracts"}
                onClick={() => { handleTabChange("contracts"); setMobileNavOpen(false); }}
              />
            )}
            {isAdmin && (
              <MobileNavItem
                icon={UserCog}
                label="المستخدمون"
                active={activeTab === "users"}
                onClick={() => { setActiveTab("users"); setMobileNavOpen(false); }}
              />
            )}
            {isAdmin && (
              <MobileNavItem
                icon={Database}
                label="النسخ الاحتياطي"
                active={activeTab === "backup"}
                onClick={() => { setActiveTab("backup"); setMobileNavOpen(false); }}
              />
            )}
            {isAdmin && (
              <MobileNavItem
                icon={SettingsIcon}
                label="الإعدادات"
                active={activeTab === "settings"}
                onClick={() => { setActiveTab("settings"); setMobileNavOpen(false); }}
              />
            )}
          </nav>
        </SheetContent>
      </Sheet>

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

      <footer className="mt-auto border-t border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <WavesIcon className="h-3.5 w-3.5 text-primary" />
            <span>{footerText}</span>
          </div>
          <span>{footerNote}</span>
        </div>
      </footer>

      <SubscriberForm open={formOpen} onOpenChange={setFormOpen} initial={editInitial} onSaved={fetchData} />
      <QRBadgeModal open={!!qrTarget} onOpenChange={(o) => !o && setQrTarget(null)} subscriber={qrTarget} />
      <SubscriberRecordModal subscriber={recordTarget} open={!!recordTarget} onOpenChange={(o) => !o && setRecordTarget(null)} />
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
    const rows = filtered.map((s, i) =>
      `${i + 1}\t${s.fileNumber}\t${s.lastName}\t${s.firstName}\t${s.birthDate ? new Date(s.birthDate).toLocaleDateString("en-GB") : "—"}\t${s.gender}\t${s.age}\t${s.subscriptionType}\t${s.paymentStatus}`
    ).join("\n");
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
      <td style="text-align:center;padding:5px;border:1px solid #ccc;">${s.birthDate ? new Date(s.birthDate).toLocaleDateString("en-GB") : "—"}</td>
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
      <p style="text-align:center;color:#555">عدد المنخرطين: ${filtered.length} — ${new Date().toLocaleDateString("ar-DZ")}</p>
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
        "الميلاد": s.birthDate ? new Date(s.birthDate).toLocaleDateString("en-GB") : "—",
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
                  <td className="p-2 text-center text-xs">{s.birthDate ? new Date(s.birthDate).toLocaleDateString("en-GB") : "—"}</td>
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
