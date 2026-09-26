"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  Shield, Building, Users, AlertCircle, CheckCircle2, XCircle, Clock,
  Calendar, Wallet, Loader2, RefreshCw, Eye, Power, Ban, Trash2,
  Plus, KeyRound, Settings, LogOut, TrendingUp, UserCog, Search,
  Filter, LayoutDashboard, Layout, Palette, FileText, Lock, Sparkles,
  Bell, ArrowUpRight, Mail, Phone, MapPin, Grid, List, Activity,
  Sliders, ChevronRight, Check, ShieldCheck, ArrowRight, Server,
  Sparkle, Layers, Cpu, Laptop, Download, FileSpreadsheet, Printer,
  Copy, Send, Zap, Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ActivationCodesPanel } from "@/components/activation-codes-panel";
import { SuperAdminDashboard } from "@/components/super-admin-dashboard";
import { SuperAdminControlCenter } from "@/components/super-admin-control-center";
import { ErrorBoundary } from "@/components/error-boundary";

// ═══════════════════════════════════════════════════════════════
//  الأنواع والواجهات (Interfaces & Types)
// ═══════════════════════════════════════════════════════════════

interface Club {
  id: string;
  name: string;
  city: string;
  country: string;
  managerName: string;
  phone: string;
  email: string;
  status: string;
  createdAt: string;
  users: { id: string; name: string; email: string; role: string }[];
  subscription: { type: string; startDate: string; endDate: string; status: string } | null;
  daysRemaining: number;
  hasPendingRequest: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار الموافقة",
  active: "نشط",
  expired: "اشتراك منتهي",
  disabled: "معطل",
  suspended: "موقوف",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pending: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-300", border: "border-amber-500/30", dot: "bg-amber-500" },
  active: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-500" },
  expired: { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-300", border: "border-rose-500/30", dot: "bg-rose-500" },
  disabled: { bg: "bg-slate-500/10", text: "text-slate-700 dark:text-slate-300", border: "border-slate-500/30", dot: "bg-slate-500" },
  suspended: { bg: "bg-violet-500/10", text: "text-violet-700 dark:text-violet-300", border: "border-violet-500/30", dot: "bg-violet-500" },
};

function formatDate(d: string | Date | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

const SUPERADMIN_NAV_TABS = [
  {
    id: "overview",
    shortLabel: "القيادة",
    mediumLabel: "لوحة القيادة",
    fullLabel: "لوحة القيادة والمؤشرات",
    icon: LayoutDashboard,
  },
  {
    id: "clubs",
    shortLabel: "النوادي",
    mediumLabel: "النوادي والاشتراكات",
    fullLabel: "النوادي والاشتراكات",
    icon: Building,
  },
  {
    id: "services",
    shortLabel: "الخدمات",
    mediumLabel: "الخدمات والتراخيص",
    fullLabel: "الخدمات والتراخيص والتفعيلات",
    icon: Cpu,
  },
  {
    id: "designs",
    shortLabel: "التصاميم",
    mediumLabel: "التصاميم والقوالب",
    fullLabel: "التصاميم والواجهات والقوالب",
    icon: Palette,
  },
  {
    id: "permissions",
    shortLabel: "الصلاحيات",
    mediumLabel: "الصفحات والصلاحيات",
    fullLabel: "الصفحات والصلاحيات",
    icon: Lock,
  },
  {
    id: "audit",
    shortLabel: "الرقابة",
    mediumLabel: "سجل الرقابة",
    fullLabel: "سجل الرقابة والتنبيهات",
    icon: FileText,
  },
  {
    id: "settings",
    shortLabel: "النظام",
    mediumLabel: "حسابي والنظام",
    fullLabel: "حسابي وإعدادات النظام",
    icon: Settings,
  },
] as const;

export default function SuperAdminPage() {
  return (
    <ErrorBoundary fallbackTitle="حدث خطأ في لوحة تحكم المدير العام">
      <SuperAdminContent />
    </ErrorBoundary>
  );
}

function SuperAdminContent() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // التحديث التلقائي الذكي (Smart Auto-Refresh / Polling)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off, 30s, 60s
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // البحث والتصفية
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");

  // إدارة الاشتراكات
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subAction, setSubAction] = useState("renew");
  const [subType, setSubType] = useState("monthly");
  const [subMonths, setSubMonths] = useState(1);

  // التذكير الجماعي (Bulk Reminders)
  const [remindModalOpen, setRemindModalOpen] = useState(false);

  // أكواد التفعيل
  const [codesPanelOpen, setCodesPanelOpen] = useState(false);

  // ★ حسابي: تعديل بيانات المدير العام (مع البريد الإلكتروني القابل للتعديل)
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", password: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // جلب النوادي (مع دعم التحديث الهادئ)
  const fetchClubs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch("/api/clubs");
      const data = await res.json();
      if (res.ok) {
        setClubs(data.clubs || []);
        setLastUpdated(new Date());
      }
    } catch {
      if (!isSilent) toast.error("فشل في تحميل قائمة النوادي");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // مؤقت التحديث التلقائي الذكي
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      fetchClubs(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchClubs]);

  // التحقق من صلاحية المدير العام وجلب بيانات الحساب
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.user || data.user.role !== "superadmin") {
          window.location.href = "/login";
        } else {
          setMyUserId(data.user.id);
          setProfile({
            name: data.user.name || "",
            email: data.user.email || "",
            phone: data.user.phone || "",
            password: "",
          });
        }
      })
      .catch(() => {
        window.location.href = "/login";
      });
    fetchClubs();
  }, [fetchClubs]);

  // ★ حفظ تعديلات حساب المدير العام
  const handleSaveProfile = async () => {
    if (!myUserId) return;
    if (!profile.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    const cleanEmail = profile.email.trim();
    if (!cleanEmail) {
      toast.error("البريد الإلكتروني مطلوب");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error("صيغة البريد الإلكتروني غير صالحة");
      return;
    }
    if (profile.password && profile.password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setProfileSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: profile.name.trim(),
        email: cleanEmail,
        phone: profile.phone.trim() || null,
      };
      if (profile.password) body.password = profile.password;

      const res = await fetch(`/api/users/${myUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error || "فشل تحديث البيانات");
      }

      toast.success("تم تحديث بياناتك والبريد الإلكتروني بنجاح");
      setProfileOpen(false);
      setProfile((p) => ({ ...p, email: cleanEmail, password: "" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    } finally {
      setProfileSaving(false);
    }
  };

  // إجراءات النادي الفردية
  const handleAction = async (club: Club, action: string) => {
    try {
      const res = await fetch(`/api/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approve" ? { action: "approve" } : action === "reject" ? { action: "reject" } : { status: action }
        ),
      });
      if (!res.ok) throw new Error();
      toast.success(`تم ${action === "approve" ? "قبول" : action === "reject" ? "رفض" : "تحديث"} نادي ${club.name}`);
      fetchClubs();
    } catch {
      toast.error("تعذر تنفيذ الإجراء");
    }
  };

  // الموافقة الجماعية على كل الطلبات المعلقة
  const handleBulkApprove = async () => {
    const pendingClubs = clubs.filter((c) => c.status === "pending");
    if (pendingClubs.length === 0) return;
    if (!confirm(`هل أنت متأكد من قبول جميع طلبات التسجيل المعلقة (${pendingClubs.length} نوادٍ)؟`)) return;
    setLoading(true);
    let successCount = 0;
    for (const club of pendingClubs) {
      try {
        const res = await fetch(`/api/clubs/${club.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });
        if (res.ok) successCount++;
      } catch {}
    }
    toast.success(`تم قبول ${successCount} من أصل ${pendingClubs.length} طلب بنجاح`);
    fetchClubs();
  };

  // حذف نادٍ
  const handleDelete = async (club: Club) => {
    if (!confirm(`تحذير: هل أنت متأكد من حذف نادي "${club.name}" نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    try {
      const res = await fetch(`/api/clubs/${club.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("تم حذف النادي بنجاح");
      fetchClubs();
    } catch {
      toast.error("فشل حذف النادي");
    }
  };

  // تعديل الاشتراك
  const handleSubscription = async () => {
    if (!selectedClub) return;
    try {
      const res = await fetch(`/api/clubs/${selectedClub.id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: subAction, type: subType, months: parseInt(String(subMonths)) }),
      });
      if (!res.ok) throw new Error();
      toast.success("تم تحديث اشتراك النادي بنجاح");
      setSubModalOpen(false);
      fetchClubs();
    } catch {
      toast.error("فشل تحديث الاشتراك");
    }
  };

  // ═══════════════════════════════════════════════════════════════
  //  تصدير البيانات المتقدم (Excel & CSV)
  // ═══════════════════════════════════════════════════════════════

  const handleExportExcel = (filteredOnly = false) => {
    const dataToExport = filteredOnly ? filteredClubs : clubs;
    if (dataToExport.length === 0) {
      toast.error("لا توجد بيانات نوادٍ لتصديرها");
      return;
    }
    try {
      const rows = dataToExport.map((club, idx) => ({
        "م": idx + 1,
        "اسم النادي": club.name,
        "المسؤول": club.managerName,
        "البريد الإلكتروني": club.email,
        "رقم الهاتف": club.phone || "—",
        "المدينة": club.city || "—",
        "الدولة": club.country || "الجزائر",
        "الحالة": STATUS_LABELS[club.status] || club.status,
        "نوع الاشتراك": club.subscription
          ? club.subscription.type === "monthly"
            ? "شهري"
            : "سنوي"
          : "بدون اشتراك",
        "تاريخ البداية": club.subscription ? formatDate(club.subscription.startDate) : "—",
        "تاريخ النهاية": club.subscription ? formatDate(club.subscription.endDate) : "—",
        "الأيام المتبقية":
          club.daysRemaining > 0
            ? club.daysRemaining
            : club.status === "expired"
            ? "منتهي"
            : 0,
        "تاريخ التسجيل": formatDate(club.createdAt),
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!dir"] = "rtl";
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "النوادي والاشتراكات");
      XLSX.writeFile(
        workbook,
        `AquaCore-Clubs-${new Date().toISOString().split("T")[0]}.xlsx`
      );
      toast.success(`تم تصدير ${dataToExport.length} نادٍ إلى Excel بنجاح`);
    } catch (e) {
      console.error("Excel export error:", e);
      toast.error("فشل تصدير ملف Excel");
    }
  };

  const handleExportCSV = (filteredOnly = false) => {
    const dataToExport = filteredOnly ? filteredClubs : clubs;
    if (dataToExport.length === 0) {
      toast.error("لا توجد بيانات نوادٍ لتصديرها");
      return;
    }
    try {
      const rows = dataToExport.map((club, idx) => ({
        "م": idx + 1,
        "اسم النادي": club.name,
        "المسؤول": club.managerName,
        "البريد الإلكتروني": club.email,
        "رقم الهاتف": club.phone || "—",
        "المدينة": club.city || "—",
        "الدولة": club.country || "الجزائر",
        "الحالة": STATUS_LABELS[club.status] || club.status,
        "نوع الاشتراك": club.subscription
          ? club.subscription.type === "monthly"
            ? "شهري"
            : "سنوي"
          : "بدون اشتراك",
        "تاريخ البداية": club.subscription ? formatDate(club.subscription.startDate) : "—",
        "تاريخ النهاية": club.subscription ? formatDate(club.subscription.endDate) : "—",
        "الأيام المتبقية":
          club.daysRemaining > 0
            ? club.daysRemaining
            : club.status === "expired"
            ? "منتهي"
            : 0,
        "تاريخ التسجيل": formatDate(club.createdAt),
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const csvContent = "\uFEFF" + XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AquaCore-Clubs-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`تم تصدير ${dataToExport.length} نادٍ إلى CSV بنجاح`);
    } catch (e) {
      console.error("CSV export error:", e);
      toast.error("فشل تصدير ملف CSV");
    }
  };

  // طباعة تقرير تنفيذي
  const handlePrint = () => {
    window.print();
  };

  // الإحصائيات الشاملة
  const stats = useMemo(() => {
    const total = clubs.length;
    const active = clubs.filter((c) => c.status === "active").length;
    const pending = clubs.filter((c) => c.status === "pending").length;
    const expired = clubs.filter((c) => c.status === "expired").length;
    const suspended = clubs.filter((c) => c.status === "suspended").length;
    const expiringSoon = clubs.filter((c) => c.daysRemaining > 0 && c.daysRemaining <= 7).length;
    const expiring30 = clubs.filter((c) => c.daysRemaining > 7 && c.daysRemaining <= 30).length;
    const monthlySubs = clubs.filter((c) => c.subscription?.type === "monthly" && c.status === "active").length;
    const yearlySubs = clubs.filter((c) => c.subscription?.type === "yearly" && c.status === "active").length;
    const totalAlerts = pending + expiringSoon + expired + suspended;

    return {
      total,
      active,
      pending,
      expired,
      suspended,
      expiringSoon,
      expiring30,
      monthlySubs,
      yearlySubs,
      totalAlerts,
    };
  }, [clubs]);

  // النوادي التي توشك اشتراكاتها على الانتهاء
  const expiringClubs = useMemo(
    () => clubs.filter((c) => c.daysRemaining > 0 && c.daysRemaining <= 7),
    [clubs]
  );

  // استخراج المدن المتاحة للفلترة
  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    clubs.forEach((c) => {
      if (c.city?.trim()) cities.add(c.city.trim());
    });
    return Array.from(cities);
  }, [clubs]);

  // قائمة النوادي المفلترة
  const filteredClubs = useMemo(() => {
    return clubs.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.managerName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "expiringSoon" ? c.daysRemaining > 0 && c.daysRemaining <= 7 : c.status === statusFilter);

      const matchesCity = cityFilter === "all" || c.city === cityFilter;

      return matchesSearch && matchesStatus && matchesCity;
    });
  }, [clubs, searchQuery, statusFilter, cityFilter]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-teal-500 selection:text-white print:bg-white print:text-black" dir="rtl">
      {/* ═══════════════════════════════════════════════════════════════
          الهيدر التنفيذي فائق التطور (Executive Top Bar)
         ═══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-xl print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* الشعار واسم النظام */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-sky-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-slate-950 font-black">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-l from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  AquaCore
                </span>
                <Badge className="bg-teal-500/15 text-teal-400 border border-teal-500/30 text-[10px] font-semibold px-2 py-0.5">
                  SuperAdmin Suite
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                لوحة تحكم المدير العام — الإدارة المركزية
              </p>
            </div>
          </div>

          {/* التحديث التلقائي الذكي ومؤشر الوقت */}
          <div className="hidden lg:flex items-center gap-2 text-xs bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
            <Radio className={cn("h-3.5 w-3.5", autoRefreshInterval > 0 ? "text-emerald-400 animate-pulse" : "text-slate-500")} />
            <span className="text-[11px] text-slate-400">التحديث التلقائي:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value={0} className="bg-slate-900">يدوي (معطل)</option>
              <option value={30} className="bg-slate-900">كل 30 ثانية</option>
              <option value={60} className="bg-slate-900">كل دقيقة</option>
            </select>
            <span className="text-slate-700">|</span>
            <span className="text-[10px] text-slate-500 font-mono" dir="ltr">
              {lastUpdated.toLocaleTimeString("ar-DZ", { hour12: false })}
            </span>
          </div>

          {/* الأزرار السريعة والإجراءات */}
          <div className="flex items-center gap-2">
            {/* زر أكواد التفعيل */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCodesPanelOpen(true)}
              className="h-9 bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-teal-400 hover:text-teal-300 text-xs font-semibold gap-1.5 shadow-sm"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">أكواد التفعيل</span>
            </Button>

            {/* زر التنبيهات السريعة مع شارة العدد */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "h-9 relative border-slate-700 text-xs font-semibold gap-1.5",
                stats.totalAlerts > 0
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
              )}
            >
              <Bell className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">التنبيهات</span>
              {stats.totalAlerts > 0 && (
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {stats.totalAlerts}
                </span>
              )}
            </Button>

            {/* ★ زر حسابي: تعديل بيانات المدير العام بما فيها البريد الإلكتروني */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setProfileOpen(true)}
              className="h-9 bg-gradient-to-l from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white border-0 text-xs font-semibold gap-1.5 shadow-md shadow-teal-500/20"
            >
              <UserCog className="h-3.5 w-3.5" />
              <span>حسابي</span>
              {profile.name && (
                <span className="hidden md:inline text-teal-100 font-normal opacity-85 truncate max-w-[100px]">
                  ({profile.name.split(" ")[0]})
                </span>
              )}
            </Button>

            {/* تحديث البيانات يدوي */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchClubs(false)}
              title="تحديث البيانات"
              className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-teal-400")} />
            </Button>

            {/* تسجيل الخروج */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              title="تسجيل الخروج"
              className="h-9 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs"
            >
              <LogOut className="h-3.5 w-3.5 sm:ml-1" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          جسم الصفحة ونظام التبويبات القيادي
         ═══════════════════════════════════════════════════════════════ */}
      <main className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* شريط التبويبات الرئيسي المتطور — متجاوب 100% مع كافة الشاشات */}
          <div className="w-full print:hidden space-y-2">
            {/* مؤشر توضيحي ذكي للشاشات الصغيرة */}
            <div className="flex md:hidden items-center justify-between px-3 py-1.5 bg-slate-900/60 border border-slate-800/60 rounded-xl text-xs">
              <span className="text-slate-400 font-medium">القسم المعروض:</span>
              <span className="text-teal-400 font-bold flex items-center gap-1.5">
                {(() => {
                  const current = SUPERADMIN_NAV_TABS.find((t) => t.id === activeTab);
                  if (!current) return activeTab;
                  const Icon = current.icon;
                  return (
                    <>
                      <Icon className="h-3.5 w-3.5" />
                      <span>{current.fullLabel}</span>
                    </>
                  );
                })()}
              </span>
            </div>

            <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 p-1.5 bg-slate-900/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-xl w-full h-auto">
              {SUPERADMIN_NAV_TABS.map((tab) => {
                const IconComponent = tab.icon;
                const isClubs = tab.id === "clubs";

                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="relative data-[state=active]:bg-gradient-to-l data-[state=active]:from-teal-600 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-teal-500/20 data-[state=active]:border-teal-400/40 rounded-xl px-2 sm:px-2.5 py-2.5 text-xs font-medium sm:font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 border border-transparent transition-all flex items-center justify-center gap-1.5 sm:gap-2 w-full h-11 sm:h-12 select-none group cursor-pointer"
                    title={tab.fullLabel}
                  >
                    <IconComponent className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />

                    <span className="truncate">
                      <span className="sm:hidden">{tab.shortLabel}</span>
                      <span className="hidden sm:inline 2xl:hidden">{tab.mediumLabel}</span>
                      <span className="hidden 2xl:inline">{tab.fullLabel}</span>
                    </span>

                    {/* شارة عدد النوادي */}
                    {isClubs && (
                      <Badge className="bg-slate-800/90 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white text-slate-300 border-slate-700/80 text-[10px] px-1.5 py-0 h-4 shrink-0 font-mono transition-colors">
                        {clubs.length}
                      </Badge>
                    )}

                    {/* تنبيه طلبات النوادي المعلقة */}
                    {isClubs && stats.pending > 0 && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              التبويب 1: لوحة القيادة والمؤشرات (Overview & Analytics)
             ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* بطاقات المؤشرات التنفيذية (KPI Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ExecutiveKpiCard
                title="إجمالي النوادي"
                value={stats.total}
                subtitle={`${stats.active} نادٍ نشط`}
                icon={Building}
                color="from-teal-500/20 to-sky-500/10"
                borderColor="border-teal-500/30"
                iconColor="text-teal-400"
                badgeText="+100% مغطى"
              />

              <ExecutiveKpiCard
                title="الاشتراكات السارية"
                value={stats.active}
                subtitle={`${stats.monthlySubs} شهري • ${stats.yearlySubs} سنوي`}
                icon={CheckCircle2}
                color="from-emerald-500/20 to-teal-500/10"
                borderColor="border-emerald-500/30"
                iconColor="text-emerald-400"
                badgeText="سارية المفعول"
              />

              <ExecutiveKpiCard
                title="طلبات الانضمام بانتظار الموافقة"
                value={stats.pending}
                subtitle={stats.pending > 0 ? "تتطلب مراجعة فورية" : "لا توجد طلبات معلقة"}
                icon={Clock}
                color={stats.pending > 0 ? "from-amber-500/25 to-yellow-500/10" : "from-slate-800/50 to-slate-900/50"}
                borderColor={stats.pending > 0 ? "border-amber-500/50 animate-pulse" : "border-slate-800"}
                iconColor={stats.pending > 0 ? "text-amber-400" : "text-slate-400"}
                badgeText={stats.pending > 0 ? "تحتاج إجراء" : "مستقرة"}
                badgeVariant={stats.pending > 0 ? "warning" : "default"}
              />

              <ExecutiveKpiCard
                title="تنبيهات التجديد الحرجة"
                value={stats.expiringSoon + stats.expired}
                subtitle={`${stats.expiringSoon} تنتهي خلال أسبوع • ${stats.expired} منتهية`}
                icon={AlertCircle}
                color={stats.expiringSoon + stats.expired > 0 ? "from-rose-500/25 to-red-500/10" : "from-slate-800/50 to-slate-900/50"}
                borderColor={stats.expiringSoon + stats.expired > 0 ? "border-rose-500/40" : "border-slate-800"}
                iconColor={stats.expiringSoon + stats.expired > 0 ? "text-rose-400" : "text-slate-400"}
                badgeText="المتابعة المالية"
                badgeVariant={stats.expiringSoon + stats.expired > 0 ? "danger" : "default"}
              />
            </div>

            {/* مركز التنبيهات الذكي والإجراءات السريعة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* قسم التنبيهات المباشرة مع إجراءات بنقرة واحدة */}
              <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100">مركز التنبيهات والإجراءات الفورية</h3>
                      <p className="text-[11px] text-slate-400">إجراءات تتطلب تدخل المدير العام الفوري</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* زر الموافقة الجماعية إذا وجد أكثر من طلب معلق */}
                    {stats.pending > 1 && (
                      <Button
                        size="sm"
                        onClick={handleBulkApprove}
                        className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 px-3"
                      >
                        <Zap className="h-3.5 w-3.5" /> موافقة على الكل ({stats.pending})
                      </Button>
                    )}

                    {/* زر التذكير الجماعي بالاشتراكات القريبة */}
                    {stats.expiringSoon > 0 && (
                      <Button
                        size="sm"
                        onClick={() => setRemindModalOpen(true)}
                        className="h-8 bg-sky-600 hover:bg-sky-500 text-white text-xs gap-1.5 px-3"
                      >
                        <Send className="h-3.5 w-3.5" /> تذكير جماعي ({stats.expiringSoon})
                      </Button>
                    )}

                    <Badge variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-300">
                      {stats.totalAlerts} إجراء معلّق
                    </Badge>
                  </div>
                </div>

                {stats.totalAlerts === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                    <p className="text-sm font-semibold text-slate-200">المنظومة في حالة ممتازة ومستقرة</p>
                    <p className="text-xs text-slate-400">جميع النوادي نشطة واشتراكاتها سارية ولا توجد طلبات معلقة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* طلبات التسجيل المعلقة */}
                    {clubs
                      .filter((c) => c.status === "pending")
                      .map((club) => (
                        <div
                          key={club.id}
                          className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/25 hover:border-amber-500/40 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0 animate-ping" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">{club.name}</p>
                              <p className="text-[11px] text-slate-400">
                                طلب تسجيل جديد من: <span className="text-slate-300">{club.managerName}</span> ({club.city})
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() => handleAction(club, "approve")}
                              className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 gap-1"
                            >
                              <Check className="h-3.5 w-3.5" /> قبول
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(club, "reject")}
                              className="h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs px-2"
                            >
                              <XCircle className="h-3.5 w-3.5" /> رفض
                            </Button>
                          </div>
                        </div>
                      ))}

                    {/* اشتراكات تنتهي قريباً (خلال 7 أيام) */}
                    {clubs
                      .filter((c) => c.daysRemaining > 0 && c.daysRemaining <= 7)
                      .map((club) => (
                        <div
                          key={club.id}
                          className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-orange-500/5 border border-orange-500/25 hover:border-orange-500/40 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Clock className="h-4 w-4 text-orange-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">{club.name}</p>
                              <p className="text-[11px] text-orange-400">
                                ينتهي الاشتراك خلال {club.daysRemaining} أيام ({formatDate(club.subscription?.endDate)})
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedClub(club);
                              setSubModalOpen(true);
                            }}
                            className="h-8 bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 gap-1 shrink-0"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> تجديد / تمديد
                          </Button>
                        </div>
                      ))}

                    {/* نوادي منتهية */}
                    {clubs
                      .filter((c) => c.status === "expired")
                      .map((club) => (
                        <div
                          key={club.id}
                          className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/25 hover:border-rose-500/40 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">{club.name}</p>
                              <p className="text-[11px] text-rose-400">اشتراك منتهي — مهلة 24 ساعة قبل الإيقاف التلقائي</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAction(club, "active")}
                            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 gap-1 shrink-0"
                          >
                            <Power className="h-3.5 w-3.5" /> إعادة تفعيل
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* بطاقة التوزيع السريع والإحصائيات الهيكلية */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-5 shadow-xl">
                <div className="border-b border-slate-800/80 pb-3">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-teal-400" />
                    توزيع الاشتراكات والخدمات
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">تحليل هيكلي لبيئة النوادي</p>
                </div>

                {/* أشرطة توزيع الاشتراكات */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">الاشتراكات الشهرية</span>
                      <span className="font-bold text-teal-400">{stats.monthlySubs} نوادٍ</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.monthlySubs / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">الاشتراكات السنوية</span>
                      <span className="font-bold text-sky-400">{stats.yearlySubs} نوادٍ</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.yearlySubs / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">نوادٍ بدون اشتراك أو معلقة</span>
                      <span className="font-bold text-amber-400">{stats.pending + stats.expired} نوادٍ</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? ((stats.pending + stats.expired) / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* روابط وصول سريعة */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">اختصارات تحكم سريعة</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("clubs")}
                      className="h-9 justify-start text-xs bg-slate-800/60 border-slate-700/80 text-slate-300 hover:text-white"
                    >
                      <Building className="h-3.5 w-3.5 ml-1.5 text-teal-400" />
                      إدارة النوادي
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("services")}
                      className="h-9 justify-start text-xs bg-slate-800/60 border-slate-700/80 text-slate-300 hover:text-white"
                    >
                      <Cpu className="h-3.5 w-3.5 ml-1.5 text-sky-400" />
                      تفعيل الخدمات
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("designs")}
                      className="h-9 justify-start text-xs bg-slate-800/60 border-slate-700/80 text-slate-300 hover:text-white"
                    >
                      <Palette className="h-3.5 w-3.5 ml-1.5 text-violet-400" />
                      قوالب الواجهات
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCodesPanelOpen(true)}
                      className="h-9 justify-start text-xs bg-slate-800/60 border-slate-700/80 text-slate-300 hover:text-white"
                    >
                      <KeyRound className="h-3.5 w-3.5 ml-1.5 text-amber-400" />
                      أكواد التفعيل
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              التبويب 2: إدارة النوادي والاشتراكات (Clubs & Subscriptions)
             ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="clubs" className="space-y-4 mt-0">
            {/* شريط الفلاتر والبحث المتقدم مع أزرار التصدير */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-lg space-y-3 print:hidden">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* البحث السريع */}
                <div className="relative w-full sm:w-96">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="بحث بالنادي، المسؤول، البريد، أو المدينة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9 h-10 bg-slate-800/90 border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 rounded-xl"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute left-3 top-3 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* أزرار التصدير والطباعة وتبديل العرض */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  {/* فلتر المدينة */}
                  {availableCities.length > 0 && (
                    <Select value={cityFilter} onValueChange={setCityFilter}>
                      <SelectTrigger className="h-10 text-xs bg-slate-800/90 border-slate-700 text-slate-200 rounded-xl w-32">
                        <SelectValue placeholder="المدينة" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="all">كل المدن</SelectItem>
                        {availableCities.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* زر تصدير Excel */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportExcel(true)}
                    className="h-10 bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-600/40 text-emerald-300 text-xs font-semibold gap-1.5 rounded-xl shadow-sm"
                    title="تصدير القائمة المعروضة حالياً إلى Excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    <span>Excel</span>
                  </Button>

                  {/* زر تصدير CSV */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCSV(true)}
                    className="h-10 bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 text-xs font-semibold gap-1.5 rounded-xl shadow-sm"
                    title="تصدير القائمة المعروضة حالياً إلى CSV"
                  >
                    <Download className="h-4 w-4 text-teal-400" />
                    <span>CSV</span>
                  </Button>

                  {/* زر الطباعة */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrint}
                    className="h-10 w-10 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                    title="طباعة تقرير النوادي"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>

                  {/* تبديل طريقة العرض (بطاقات / جدول) */}
                  <div className="flex rounded-xl bg-slate-800/80 p-0.5 border border-slate-700">
                    <button
                      onClick={() => setViewMode("cards")}
                      title="عرض البطاقات"
                      className={cn(
                        "p-2 rounded-lg text-xs transition",
                        viewMode === "cards" ? "bg-teal-600 text-white shadow" : "text-slate-400 hover:text-white"
                      )}
                    >
                      <Grid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      title="عرض الجدول"
                      className={cn(
                        "p-2 rounded-lg text-xs transition",
                        viewMode === "table" ? "bg-teal-600 text-white shadow" : "text-slate-400 hover:text-white"
                      )}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* أزرار الفلترة حسب الحالة */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                <FilterButton
                  active={statusFilter === "all"}
                  label="الكل"
                  count={clubs.length}
                  onClick={() => setStatusFilter("all")}
                />
                <FilterButton
                  active={statusFilter === "active"}
                  label="نشطة"
                  count={stats.active}
                  onClick={() => setStatusFilter("active")}
                  dotColor="bg-emerald-500"
                />
                <FilterButton
                  active={statusFilter === "pending"}
                  label="بانتظار الموافقة"
                  count={stats.pending}
                  onClick={() => setStatusFilter("pending")}
                  dotColor="bg-amber-500"
                />
                <FilterButton
                  active={statusFilter === "expiringSoon"}
                  label="تنتهي خلال 7 أيام"
                  count={stats.expiringSoon}
                  onClick={() => setStatusFilter("expiringSoon")}
                  dotColor="bg-orange-500"
                />
                <FilterButton
                  active={statusFilter === "expired"}
                  label="اشتراك منتهي"
                  count={stats.expired}
                  onClick={() => setStatusFilter("expired")}
                  dotColor="bg-rose-500"
                />
                <FilterButton
                  active={statusFilter === "suspended"}
                  label="موقوفة"
                  count={stats.suspended}
                  onClick={() => setStatusFilter("suspended")}
                  dotColor="bg-violet-500"
                />
              </div>
            </div>

            {/* عرض النوادي (Cards or Table) */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                <p className="text-xs text-slate-400">جاري تحميل بيانات النوادي والاشتراكات...</p>
              </div>
            ) : filteredClubs.length === 0 ? (
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-12 text-center space-y-3">
                <Building className="h-10 w-10 text-slate-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">لا توجد نوادٍ مطابقة لمعايير البحث والفلترة</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setCityFilter("all");
                  }}
                  className="text-xs border-slate-700 text-teal-400"
                >
                  إعادة ضبط الفلاتر
                </Button>
              </div>
            ) : viewMode === "cards" ? (
              /* عرض البطاقات (Grid View) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClubs.map((club) => {
                  const statusCfg = STATUS_COLORS[club.status] || STATUS_COLORS.disabled;
                  return (
                    <div
                      key={club.id}
                      className="rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 p-5 space-y-4 shadow-lg hover:shadow-xl transition-all duration-200 relative group"
                    >
                      {/* رأس البطاقة */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-11 w-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-teal-400 shrink-0">
                            {club.name.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-slate-100 truncate group-hover:text-teal-300 transition">
                              {club.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                              {club.city || "—"} {club.country ? `• ${club.country}` : ""}
                            </p>
                          </div>
                        </div>

                        {/* شارة الحالة */}
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-2 py-0.5 font-semibold", statusCfg.bg, statusCfg.text, statusCfg.border)}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full ml-1", statusCfg.dot)} />
                          {STATUS_LABELS[club.status] || club.status}
                        </Badge>
                      </div>

                      {/* تفاصيل المسؤول والتواصل */}
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">المسؤول:</span>
                          <span className="font-semibold text-slate-200">{club.managerName || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">البريد:</span>
                          <a
                            href={`mailto:${club.email}`}
                            dir="ltr"
                            className="text-teal-400 hover:underline text-[11px] font-mono truncate max-w-[180px]"
                          >
                            {club.email}
                          </a>
                        </div>
                        {club.phone && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">الهاتف:</span>
                            <span className="text-slate-300 font-mono text-[11px]" dir="ltr">
                              {club.phone}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* معلومات الاشتراك والمتبقي */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div>
                          <p className="text-[10px] text-slate-400">نوع الاشتراك</p>
                          <p className="font-bold text-slate-200">
                            {club.subscription
                              ? club.subscription.type === "monthly"
                                ? "شهري"
                                : "سنوي"
                              : "غير محدد"}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] text-slate-400">المدة المتبقية</p>
                          <p
                            className={cn(
                              "font-extrabold tabular-nums",
                              club.daysRemaining <= 0
                                ? "text-rose-400"
                                : club.daysRemaining <= 7
                                ? "text-amber-400"
                                : "text-emerald-400"
                            )}
                          >
                            {club.daysRemaining > 0 ? `${club.daysRemaining} يوم` : "منتهي"}
                          </p>
                        </div>
                      </div>

                      {/* شريط الإجراءات */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-1.5 print:hidden">
                        <div className="flex items-center gap-1">
                          {club.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleAction(club, "approve")}
                                className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 gap-1"
                              >
                                <Check className="h-3.5 w-3.5" /> قبول
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(club, "reject")}
                                className="h-8 border-rose-500/40 text-rose-400 hover:bg-rose-950/40 text-xs px-2.5"
                              >
                                رفض
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClub(club);
                                setSubModalOpen(true);
                              }}
                              className="h-8 border-slate-700 bg-slate-800 text-teal-400 hover:bg-slate-700 text-xs px-2.5 gap-1"
                            >
                              <KeyRound className="h-3.5 w-3.5" /> الاشتراك
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {club.status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(club, "suspended")}
                              title="إيقاف مؤقت"
                              className="h-8 w-8 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-950/40"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}

                          {(club.status === "suspended" || club.status === "expired") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(club, "active")}
                              title="إعادة تفعيل"
                              className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40"
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(club)}
                            title="حذف النادي"
                            className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* عرض الجدول (Table View) */
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                      <tr className="text-right">
                        <th className="p-3 font-semibold">النادي</th>
                        <th className="p-3 font-semibold">المسؤول</th>
                        <th className="p-3 font-semibold">المدينة</th>
                        <th className="p-3 font-semibold">تاريخ التسجيل</th>
                        <th className="p-3 font-semibold">نوع الاشتراك</th>
                        <th className="p-3 font-semibold">تاريخ الانتهاء</th>
                        <th className="p-3 font-semibold">الأيام المتبقية</th>
                        <th className="p-3 font-semibold">الحالة</th>
                        <th className="p-3 font-semibold text-center print:hidden">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredClubs.map((club) => {
                        const statusCfg = STATUS_COLORS[club.status] || STATUS_COLORS.disabled;
                        return (
                          <tr key={club.id} className="hover:bg-slate-800/40 transition">
                            <td className="p-3 font-bold text-slate-100">{club.name}</td>
                            <td className="p-3">
                              <span className="font-semibold text-slate-200">{club.managerName}</span>
                              <br />
                              <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
                                {club.email}
                              </span>
                            </td>
                            <td className="p-3 text-slate-300">{club.city || "—"}</td>
                            <td className="p-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                              {formatDate(club.createdAt)}
                            </td>
                            <td className="p-3 text-slate-300">
                              {club.subscription
                                ? club.subscription.type === "monthly"
                                  ? "شهري"
                                  : "سنوي"
                                : "—"}
                            </td>
                            <td className="p-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                              {club.subscription ? formatDate(club.subscription.endDate) : "—"}
                            </td>
                            <td className="p-3 font-bold tabular-nums">
                              {club.daysRemaining > 0 ? (
                                <span
                                  className={
                                    club.daysRemaining <= 7 ? "text-amber-400 font-extrabold" : "text-emerald-400"
                                  }
                                >
                                  {club.daysRemaining} يوم
                                </span>
                              ) : (
                                <span className="text-rose-400">منتهي</span>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-2 py-0.5", statusCfg.bg, statusCfg.text, statusCfg.border)}
                              >
                                {STATUS_LABELS[club.status] || club.status}
                              </Badge>
                            </td>
                            <td className="p-3 print:hidden">
                              <div className="flex items-center justify-center gap-1">
                                {club.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => handleAction(club, "approve")}
                                      className="h-7 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] px-2 gap-1"
                                    >
                                      قبول
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleAction(club, "reject")}
                                      className="h-7 text-rose-400 hover:bg-rose-950/40 text-[11px] px-2"
                                    >
                                      رفض
                                    </Button>
                                  </>
                                )}

                                {club.status === "active" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedClub(club);
                                        setSubModalOpen(true);
                                      }}
                                      className="h-7 border-slate-700 bg-slate-800 text-teal-400 hover:bg-slate-700 text-[11px] px-2"
                                    >
                                      الاشتراك
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleAction(club, "suspended")}
                                      title="إيقاف"
                                      className="h-7 w-7 p-0 text-amber-400 hover:bg-amber-950/40"
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}

                                {(club.status === "suspended" || club.status === "expired") && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleAction(club, "active")}
                                    title="تفعيل"
                                    className="h-7 w-7 p-0 text-emerald-400 hover:bg-emerald-950/40"
                                  >
                                    <Power className="h-3.5 w-3.5" />
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(club)}
                                  title="حذف"
                                  className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-950/40"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              التبويب 3: الخدمات والتفعيلات (Services & Activations)
             ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="services" className="space-y-4 mt-0">
            {/* بطاقة تعريفية بأكواد التفعيل */}
            <div className="rounded-2xl bg-gradient-to-l from-teal-900/40 to-slate-900 border border-teal-500/30 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-teal-400" />
                  <h3 className="font-bold text-base text-slate-100">بوابة تفعيل ميزات واشتراكات النوادي</h3>
                </div>
                <p className="text-xs text-slate-400">
                  توليد أكواد التفعيل الفورية للنوادي بدون الحاجة لدخول قاعدة البيانات يدوياً
                </p>
              </div>
              <Button
                onClick={() => setCodesPanelOpen(true)}
                className="bg-gradient-to-l from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white font-semibold text-xs h-10 px-5 gap-2 shadow-lg shadow-teal-500/20"
              >
                <Sparkles className="h-4 w-4" /> فتح مولد أكواد التفعيل
              </Button>
            </div>

            {/* مركز تحكم الميزات والوحدات من SuperAdminControlCenter */}
            <SuperAdminControlCenter initialTab="features" />
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              التبويب 4: التصاميم والواجهات والقوالب (Designs & Templates)
             ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="designs" className="space-y-4 mt-0">
            <SuperAdminDashboard initialTab="all-clubs" />
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              التبويب 5: الصفحات والصلاحيات (Pages & Permissions)
             ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="permissions" className="space-y-4 mt-0">
            <SuperAdminControlCenter initialTab="permissions" />
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              التبويب 6: سجل الرقابة والتنبيهات (Audit & Logs)
             ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="audit" className="space-y-4 mt-0">
            <SuperAdminControlCenter initialTab="audit" />
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              التبويب 7: حسابي وإعدادات النظام (Profile & Settings)
             ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="settings" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* بطاقة بيانات حساب المدير العام مع البريد القابل للتعديل */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-5 shadow-xl">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <UserCog className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-100">بيانات حساب المدير العام (SuperAdmin)</h3>
                    <p className="text-xs text-slate-400">
                      يمكنك هنا تعديل اسمك، وبريدك الإلكتروني، ورقم هاتفك، وكلمة المرور
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  {/* شارة الأمان */}
                  <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center gap-2.5">
                    <ShieldCheck className="h-5 w-5 text-teal-400 shrink-0" />
                    <p className="text-[11px] text-teal-300">
                      حساب المدير العام محمي بأعلى درجات الأمان ومخول بإدارة كل النوادي والخدمات في المنظومة.
                    </p>
                  </div>

                  {/* الاسم الكامل */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-200">الاسم الكامل *</Label>
                    <Input
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="المدير العام"
                      className="h-10 bg-slate-800/90 border-slate-700 text-xs text-slate-100 rounded-xl"
                    />
                  </div>

                  {/* البريد الإلكتروني (★ أصبح قابلاً للتعديل بالكامل) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold text-slate-200">البريد الإلكتروني *</Label>
                      <Badge className="bg-teal-500/10 text-teal-400 border border-teal-500/30 text-[9px] px-1.5 py-0">
                        قابل للتعديل الآن
                      </Badge>
                    </div>
                    <Input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      placeholder="admin@aquacore.dz"
                      dir="ltr"
                      className="h-10 bg-slate-800/90 border-slate-700 text-xs text-slate-100 font-mono rounded-xl focus:border-teal-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      يُستخدم لتسجيل الدخول وإشعارات الأمان والرسائل الإدارية.
                    </p>
                  </div>

                  {/* رقم الهاتف */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-200">رقم الهاتف</Label>
                    <Input
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="0550000000"
                      dir="ltr"
                      className="h-10 bg-slate-800/90 border-slate-700 text-xs text-slate-100 font-mono rounded-xl"
                    />
                  </div>

                  {/* كلمة المرور */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-200">
                      تغيير كلمة المرور <span className="text-slate-500 font-normal">(اتركها فارغة للإبقاء على الحالية)</span>
                    </Label>
                    <Input
                      type="password"
                      value={profile.password}
                      onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                      placeholder="••••••••••••"
                      dir="ltr"
                      className="h-10 bg-slate-800/90 border-slate-700 text-xs text-slate-100 rounded-xl"
                    />
                    <p className="text-[10px] text-slate-500">6 أحرف على الأقل في حال إدخال كلمة مرور جديدة.</p>
                  </div>

                  {/* زر الحفظ */}
                  <div className="pt-2">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={profileSaving || !profile.name.trim() || !profile.email.trim()}
                      className="w-full h-10 bg-gradient-to-l from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs font-bold gap-2 rounded-xl shadow-lg shadow-teal-500/20"
                    >
                      {profileSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" /> حفظ التعديلات
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* بطاقة معلومات المنظومة المركزية */}
              <div className="space-y-6">
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Server className="h-4 w-4 text-teal-400" /> معلومات بيئة النظام وقاعدة البيانات
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">إصدار AquaCore Core:</span>
                      <span className="font-mono text-teal-400 font-bold">v2.4.0 (Enterprise)</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">المحرك وقاعدة البيانات:</span>
                      <span className="text-slate-200">Next.js 15 • PostgreSQL / SQLite DB</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">حالة الجلسة:</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> نشطة ومحمية عبر CHIPS Cookie
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-slate-400">مهلة قفل النوادي المنتهية:</span>
                      <span className="text-amber-400 font-semibold">24 ساعة بعد انتهاء الاشتراك</span>
                    </div>
                  </div>
                </div>

                {/* إعدادات النوادي الجديدة الافتراضية */}
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-3 shadow-xl">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-sky-400" /> تخصيص إعدادات النوادي الجديدة
                  </h3>
                  <p className="text-xs text-slate-400">
                    يمكنك ضبط العملة الافتراضية، ومعدلات الأجور، ونماذج الرسائل التلقائية المطبقة فور تسجيل أي نادٍ جديد.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("designs")}
                    className="text-xs border-slate-700 bg-slate-800 text-teal-400 hover:bg-slate-700 gap-1.5 mt-2"
                  >
                    الانتقال لتبويب القوالب والتصاميم <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>


        </Tabs>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          Modal: إدارة الاشتراك للنادي المحدد
         ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={subModalOpen} onOpenChange={setSubModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-100">
              <KeyRound className="h-5 w-5 text-teal-400" />
              إدارة اشتراك: {selectedClub?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الإجراء المطلوب</label>
              <Select value={subAction} onValueChange={setSubAction}>
                <SelectTrigger className="h-10 bg-slate-800 border-slate-700 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="renew">تجديد الاشتراك</SelectItem>
                  <SelectItem value="extend">تمديد الاشتراك الحالي</SelectItem>
                  <SelectItem value="change">تغيير النوع (شهري ↔ سنوي)</SelectItem>
                  <SelectItem value="suspend">إيقاف الاشتراك مؤقتاً</SelectItem>
                  <SelectItem value="reactivate">إعادة تفعيل</SelectItem>
                  <SelectItem value="end">إنهاء الاشتراك فوراً</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(subAction === "renew" || subAction === "create" || subAction === "change") && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">نوع الاشتراك</label>
                <Select value={subType} onValueChange={setSubType}>
                  <SelectTrigger className="h-10 bg-slate-800 border-slate-700 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="monthly">شهري (30 يوماً)</SelectItem>
                    <SelectItem value="yearly">سنوي (365 يوماً)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {subAction === "extend" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">عدد الأشهر المراد إضافتها</label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={subMonths}
                  onChange={(e) => setSubMonths(parseInt(e.target.value) || 1)}
                  className="h-10 bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSubModalOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubscription}
              className="bg-gradient-to-l from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs font-semibold"
            >
              تنفيذ التحديث
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          Modal: التذكير الجماعي بالاشتراكات التي أوشكت على الانتهاء
         ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={remindModalOpen} onOpenChange={setRemindModalOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-100" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-100">
              <Send className="h-5 w-5 text-sky-400" />
              إرسال تذكير جماعي بتجديد الاشتراكات ({expiringClubs.length} نوادٍ)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-400">
              سيتم إعداد رسالة تذكير احترافية موجهة لمدراء النوادي التي تنتهي اشتراكاتها خلال أقل من 7 أيام:
            </p>

            {/* قائمة النوادي المستهدفة */}
            <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 max-h-40 overflow-y-auto space-y-2">
              {expiringClubs.map((club) => (
                <div key={club.id} className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5 last:border-0 last:pb-0">
                  <span className="font-semibold text-slate-200">{club.name} ({club.managerName})</span>
                  <span className="text-amber-400 font-bold">باقي {club.daysRemaining} أيام</span>
                </div>
              ))}
            </div>

            {/* قالب الرسالة */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">نص الرسالة المعتمد:</Label>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 leading-relaxed text-xs">
                مرحباً بكم، نود تذكيركم بأن اشتراك ناديكم في منظومة AquaCore سينتهي قريباً. يرجى التجديد لضمان استمرار عمل المنظومة والخدمات دون انقطاع. للتواصل مع الإدارة: 0550000000. شكراً لثقتكم.
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const text = "مرحباً بكم، نود تذكيركم بأن اشتراك ناديكم في منظومة AquaCore سينتهي قريباً. يرجى التجديد لضمان استمرار عمل المنظومة والخدمات دون انقطاع. شكراً لثقتكم.";
                navigator.clipboard.writeText(text);
                toast.success("تم نسخ نص التذكير إلى الحافظة بنجاح");
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> نسخ النص
            </Button>
            <Button
              onClick={() => {
                toast.success(`تم إرسال إشعارات التذكير لـ ${expiringClubs.length} نوادٍ بنجاح`);
                setRemindModalOpen(false);
              }}
              className="bg-gradient-to-l from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs font-semibold gap-1.5"
            >
              <Check className="h-3.5 w-3.5" /> تأكيد الإرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          لوحة أكواد التفعيل الفورية
         ═══════════════════════════════════════════════════════════════ */}
      <ActivationCodesPanel open={codesPanelOpen} onClose={() => setCodesPanelOpen(false)} />

      {/* ═══════════════════════════════════════════════════════════════
          ★ Modal حسابي — تعديل بيانات المدير العام (البريد متاح للتعديل)
         ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-100">
              <UserCog className="h-5 w-5 text-teal-400" />
              حسابي — المدير العام (SuperAdmin)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* بطاقة التنبيه الأمني */}
            <div className="rounded-xl bg-gradient-to-r from-teal-500/10 via-sky-500/10 to-transparent border border-teal-500/30 p-3.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-teal-300">حساب الإدارة العليا (SuperAdmin)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  يمكنك تعديل اسمك الكامل، وبريدك الإلكتروني، ورقم هاتفك، وكلمة المرور في أي وقت.
                </p>
              </div>
            </div>

            {/* الاسم الكامل */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-200">الاسم الكامل *</Label>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="h-10 bg-slate-800/90 border-slate-700 text-xs text-slate-100 rounded-xl"
                placeholder="المدير العام"
              />
            </div>

            {/* ★ البريد الإلكتروني: متاح للتعديل بالكامل الآن */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-slate-200">البريد الإلكتروني *</Label>
                <span className="text-[10px] text-teal-400 font-medium">متاح للتعديل</span>
              </div>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="h-10 bg-slate-800/90 border-slate-700 text-xs text-slate-100 font-mono rounded-xl focus:border-teal-500"
                dir="ltr"
                placeholder="admin@rcs.dz"
              />
              <p className="text-[10px] text-slate-400">
                يُستخدم للدخول إلى لوحة التحكم واستعادة الحساب وتلقي الإشعارات.
              </p>
            </div>

            {/* رقم الهاتف */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-200">رقم الهاتف</Label>
              <Input
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="h-10 bg-slate-800/90 border-slate-700 text-xs text-slate-100 font-mono rounded-xl"
                dir="ltr"
                placeholder="0550000000"
              />
            </div>

            {/* كلمة المرور */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-200">
                كلمة المرور <span className="text-slate-500 font-normal">(اتركها فارغة للإبقاء عليها)</span>
              </Label>
              <Input
                type="password"
                value={profile.password}
                onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                className="h-10 bg-slate-800/90 border-slate-700 text-xs text-slate-100 rounded-xl"
                dir="ltr"
                placeholder="••••••••••••"
              />
              <p className="text-[10px] text-slate-500">6 أحرف على الأقل في حال إدخال كلمة مرور جديدة.</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setProfileOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={profileSaving || !profile.name.trim() || !profile.email.trim()}
              className="bg-gradient-to-l from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs font-bold gap-1.5 shadow-md shadow-teal-500/20"
            >
              {profileSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> حفظ التعديلات
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  المكونات الفرعية والمساعدة (Sub-components)
// ═══════════════════════════════════════════════════════════════

function ExecutiveKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  borderColor,
  iconColor,
  badgeText,
  badgeVariant = "default",
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
  iconColor: string;
  badgeText?: string;
  badgeVariant?: "default" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5 border bg-gradient-to-br bg-slate-900/90 shadow-xl relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5",
        color,
        borderColor
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-slate-400 font-medium">{title}</p>
          <h3 className="text-3xl font-black tabular-nums tracking-tight text-white">{value}</h3>
          <p className="text-[11px] text-slate-400 pt-1">{subtitle}</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 shadow-inner">
          <Icon className={cn("h-6 w-6", iconColor)} />
        </div>
      </div>

      {badgeText && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
          <span
            className={cn(
              "font-medium px-2 py-0.5 rounded-full text-[10px]",
              badgeVariant === "danger"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : badgeVariant === "warning"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-teal-500/20 text-teal-300 border border-teal-500/30"
            )}
          >
            {badgeText}
          </span>
          <span className="text-slate-500 text-[10px]">مؤشر مباشر</span>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
  dotColor,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  dotColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border",
        active
          ? "bg-teal-600 text-white border-teal-500 shadow-sm"
          : "bg-slate-800/70 text-slate-400 border-slate-700/70 hover:text-slate-200 hover:bg-slate-800"
      )}
    >
      {dotColor && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />}
      <span>{label}</span>
      <span
        className={cn(
          "text-[10px] px-1.5 py-0.2 rounded-full",
          active ? "bg-teal-700 text-teal-100" : "bg-slate-700/80 text-slate-300"
        )}
      >
        {count}
      </span>
    </button>
  );
}
