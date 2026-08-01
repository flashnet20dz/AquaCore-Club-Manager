"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2,
  LayoutDashboard,
  Settings,
  Shield,
  Palette,
  Database,
  Cloud,
  Download,
  FileText,
  Sparkles,
  Crown,
  Search,
  Filter,
  RefreshCw,
  Save,
  Trash2,
  Eye,
  Lock,
  KeyRound,
  Globe,
  Smartphone,
  Monitor,
  MessageSquare,
  AlertCircle,
  Building2,
  Boxes,
  Layers,
  Zap,
  Clock,
  Server,
  CheckCircle2,
  XCircle,
  Send,
  HardDrive,
  Fingerprint,
  Wifi,
  Activity,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
//  الأنواع (Types)
// ═══════════════════════════════════════════════════════════════

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  visible: boolean;
  readOnly: boolean;
  allowEdit: boolean;
  allowDelete: boolean;
  allowPrint: boolean;
  allowExport: boolean;
  isBeta: boolean;
  isPremium: boolean;
  minVersion: string;
  platforms: string;
  countries: string | null;
  plans: string | null;
  icon: string | null;
  sortOrder: number;
  accessCount: number;
  updatedAt: string;
}

interface Club {
  id: string;
  name: string;
  city: string;
  status: string;
  createdAt: string;
}

interface ClubGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  memberCount: number;
  createdAt: string;
}

interface DefaultClubConfig {
  id?: string;
  clubName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  language: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  calendar: string;
  defaultPlan: string;
  trialDays: number;
  enabledFeatures: string[];
  settings: Record<string, unknown>;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  ipAddress: string | null;
  metadata: string | null;
  createdAt: string;
}

interface FeatureAccess {
  id: string;
  featureId: string;
  featureKey: string;
  featureName: string;
  scope: string;
  clubId: string | null;
  clubName: string | null;
  clubGroupId: string | null;
  clubGroupName: string | null;
  enabled: boolean | null;
  visible: boolean | null;
  readOnly: boolean | null;
  allowEdit: boolean | null;
  allowDelete: boolean | null;
  allowPrint: boolean | null;
  allowExport: boolean | null;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════
//  ثوابت مساعدة
// ═══════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  module: "وحدة",
  feature: "ميزة",
  integration: "تكامل",
  permission: "صلاحية",
};

const CATEGORY_COLORS: Record<string, string> = {
  module: "bg-teal-500/15 text-teal-700 border-teal-500/30",
  feature: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  integration: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  permission: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

const PLATFORM_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  all: Globe,
  desktop: Monitor,
  web: Globe,
  mobile: Smartphone,
};

const PLAN_LABELS: Record<string, string> = {
  free: "مجاني",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, string> = {
  free: "from-slate-500/10 to-slate-400/10 border-slate-400/30",
  starter: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  professional: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  enterprise: "bg-violet-500/10 text-violet-700 border-violet-500/30",
};

const ROLES = [
  { key: "admin", label: "مدير" },
  { key: "assistant", label: "مساعد" },
  { key: "lifeguard", label: "منقذ" },
  { key: "observer", label: "مراقب" },
] as const;

const TAB_LIST = [
  { value: "general", label: "عام", icon: LayoutDashboard },
  { value: "features", label: "الميزات", icon: Settings },
  { value: "clubs", label: "النوادي", icon: Building2 },
  { value: "modules", label: "الوحدات", icon: Boxes },
  { value: "permissions", label: "الصلاحيات", icon: Lock },
  { value: "default-config", label: "الإعداد الافتراضي", icon: FileText },
  { value: "plans", label: "خطط الاشتراك", icon: Crown },
  { value: "branding", label: "الهوية", icon: Palette },
  { value: "audit", label: "سجل التدقيق", icon: Activity },
] as const;

function formatDate(d: string | Date): string {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatDateTime(d: string | Date): string {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

// ═══════════════════════════════════════════════════════════════
//  مكونات مساعدة مشتركة
// ═══════════════════════════════════════════════════════════════

function Loader({ label = "جاري التحميل..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-50" />
      <p className="text-xs">{message}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg mb-2",
          color
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-extrabold tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-l from-teal-500/15 to-sky-500/15 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description && (
                <CardDescription className="text-xs">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const TOGGLE_COLUMNS: {
  key: keyof Pick<
    FeatureFlag,
    | "enabled"
    | "visible"
    | "readOnly"
    | "allowEdit"
    | "allowDelete"
    | "allowPrint"
    | "allowExport"
  >;
  label: string;
  short: string;
}[] = [
  { key: "enabled", label: "مفعّلة", short: "فعّال" },
  { key: "visible", label: "مرئية", short: "مرئي" },
  { key: "readOnly", label: "قراءة فقط", short: "RO" },
  { key: "allowEdit", label: "السماح بالتعديل", short: "تعديل" },
  { key: "allowDelete", label: "السماح بالحذف", short: "حذف" },
  { key: "allowPrint", label: "السماح بالطباعة", short: "طباعة" },
  { key: "allowExport", label: "السماح بالتصدير", short: "تصدير" },
];

// ═══════════════════════════════════════════════════════════════
//  1) تبويب عام — نظرة عامة وإحصاءات
// ═══════════════════════════════════════════════════════════════

function GeneralTab() {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, cRes, gRes] = await Promise.all([
        fetch("/api/super-admin/feature-flags", { cache: "no-store" }),
        fetch("/api/super-admin/clubs", { cache: "no-store" }),
        fetch("/api/super-admin/club-groups", { cache: "no-store" }),
      ]);
      if (fRes.ok) {
        const fd = await fRes.json();
        setFeatures(fd.features || []);
      }
      if (cRes.ok) {
        const cd = await cRes.json();
        setClubs(cd.clubs || []);
      }
      if (gRes.ok) {
        const gd = await gRes.json();
        setGroups(gd.groups || []);
      }
    } catch {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const stats = useMemo(
    () => ({
      total: features.length,
      enabled: features.filter((f) => f.enabled).length,
      premium: features.filter((f) => f.isPremium).length,
      beta: features.filter((f) => f.isBeta).length,
      clubs: clubs.length,
      groups: groups.length,
    }),
    [features, clubs, groups]
  );

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of features) map[f.category] = (map[f.category] || 0) + 1;
    return map;
  }, [features]);

  if (loading) return <Loader label="تحميل النظرة العامة..." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Layers}
          label="إجمالي الميزات"
          value={stats.total}
          color="text-teal-700 bg-teal-500/10"
        />
        <StatCard
          icon={CheckCircle2}
          label="ميزات مفعّلة"
          value={stats.enabled}
          color="text-emerald-700 bg-emerald-500/10"
        />
        <StatCard
          icon={Crown}
          label="ميزات مدفوعة"
          value={stats.premium}
          color="text-amber-700 bg-amber-500/10"
        />
        <StatCard
          icon={Sparkles}
          label="ميزات تجريبية"
          value={stats.beta}
          color="bg-violet-500/10 text-violet-700"
        />
        <StatCard
          icon={Building2}
          label="النوادي"
          value={stats.clubs}
          color="text-sky-700 bg-sky-500/10"
        />
        <StatCard
          icon={Boxes}
          label="مجموعات النوادي"
          value={stats.groups}
          color="text-rose-700 bg-rose-500/10"
        />
      </div>

      <SectionCard
        title="توزيع الميزات حسب الفئة"
        description="عدد الميزات في كل فئة"
        icon={Boxes}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(byCategory).map(([cat, count]) => (
            <div
              key={cat}
              className={cn(
                "rounded-xl border p-3 text-center",
                CATEGORY_COLORS[cat] || "bg-muted text-muted-foreground"
              )}
            >
              <p className="text-2xl font-extrabold tabular-nums">{count}</p>
              <p className="text-xs mt-1">
                {CATEGORY_LABELS[cat] || cat}
              </p>
            </div>
          ))}
          {Object.keys(byCategory).length === 0 && (
            <EmptyState icon={AlertCircle} message="لا توجد ميزات مسجّلة" />
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="آخر الميزات تحديثاً"
        description="أحدث 5 ميزات تم تعديلها"
        icon={Clock}
      >
        <div className="space-y-2">
          {[...features]
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            )
            .slice(0, 5)
            .map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-border/60 p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{f.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px]",
                      CATEGORY_COLORS[f.category]
                    )}
                  >
                    {CATEGORY_LABELS[f.category] || f.category}
                  </Badge>
                  {f.isPremium && (
                    <Badge
                      variant="outline"
                      className="text-[9px] bg-amber-500/15 text-amber-700 border-amber-500/30"
                    >
                      <Crown className="h-2.5 w-2.5 ml-0.5" /> مدفوع
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatDateTime(f.updatedAt)}
                </span>
              </div>
            ))}
          {features.length === 0 && (
            <EmptyState icon={AlertCircle} message="لا توجد ميزات" />
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  2) تبويب الميزات — الجدول الرئيسي مع التبديلات والتحديد الجماعي
// ═══════════════════════════════════════════════════════════════

function FeaturesTab() {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyScope, setApplyScope] = useState<
    "ALL_CLUBS" | "CLUB_SPECIFIC" | "CLUB_GROUP"
  >("ALL_CLUBS");
  const [applyClubIds, setApplyClubIds] = useState<string[]>([]);
  const [applyGroupId, setApplyGroupId] = useState<string>("");
  const [applyOverrides, setApplyOverrides] = useState({
    enabled: true,
    visible: true,
    readOnly: false,
    allowEdit: true,
    allowDelete: true,
    allowPrint: true,
    allowExport: true,
  });
  const [applyReset, setApplyReset] = useState(false);
  const [applying, setApplying] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/feature-flags", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features || []);
      } else {
        toast.error("فشل تحميل الميزات");
      }
    } catch {
      toast.error("فشل تحميل الميزات");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTargets = useCallback(async () => {
    try {
      const [cRes, gRes] = await Promise.all([
        fetch("/api/super-admin/clubs", { cache: "no-store" }),
        fetch("/api/super-admin/club-groups", { cache: "no-store" }),
      ]);
      if (cRes.ok) {
        const cd = await cRes.json();
        setClubs(cd.clubs || []);
      }
      if (gRes.ok) {
        const gd = await gRes.json();
        setGroups(gd.groups || []);
      }
    } catch {
      /* تجاهل — تُحمّل عند فتح الحوار */
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const categories = useMemo(() => {
    const set = new Set(features.map((f) => f.category));
    return Array.from(set);
  }, [features]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return features.filter((f) => {
      if (categoryFilter !== "all" && f.category !== categoryFilter)
        return false;
      if (
        q &&
        !f.name.toLowerCase().includes(q) &&
        !f.key.toLowerCase().includes(q) &&
        !(f.description || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [features, search, categoryFilter]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filtered.map((f) => f.id)));
    else setSelectedIds(new Set());
  };

  const handleToggle = async (
    feature: FeatureFlag,
    field: (typeof TOGGLE_COLUMNS)[number]["key"],
    value: boolean
  ) => {
    // تحديث متفائل
    setFeatures((prev) =>
      prev.map((f) => (f.id === feature.id ? { ...f, [field]: value } : f))
    );
    setUpdatingId(feature.id);
    try {
      const res = await fetch(
        `/api/super-admin/feature-flags/${feature.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(`${feature.name}: ${field} = ${value ? "نعم" : "لا"}`);
    } catch {
      // التراجع عن التحديث المتفائل
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === feature.id ? { ...f, [field]: !value } : f
        )
      );
      toast.error("فشل تحديث الميزة");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (feature: FeatureFlag) => {
    if (!confirm(`حذف الميزة "${feature.name}"؟ لا يمكن التراجع.`)) return;
    try {
      const res = await fetch(
        `/api/super-admin/feature-flags/${feature.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      toast.success("تم حذف الميزة");
      setFeatures((prev) => prev.filter((f) => f.id !== feature.id));
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const openApply = async () => {
    if (selectedIds.size === 0) {
      toast.warning("اختر ميزة واحدة على الأقل");
      return;
    }
    await fetchTargets();
    setApplyOpen(true);
  };

  const submitApply = async () => {
    const featureIds = Array.from(selectedIds);
    if (applyScope === "CLUB_SPECIFIC" && applyClubIds.length === 0) {
      toast.warning("اختر نادياً واحداً على الأقل");
      return;
    }
    if (applyScope === "CLUB_GROUP" && !applyGroupId) {
      toast.warning("اختر مجموعة");
      return;
    }
    setApplying(true);
    try {
      const body: Record<string, unknown> = {
        scope: applyScope,
        featureIds,
        overrides: applyOverrides,
        reset: applyReset,
      };
      if (applyScope === "CLUB_SPECIFIC") body.clubIds = applyClubIds;
      if (applyScope === "CLUB_GROUP") body.clubGroupId = applyGroupId;

      const res = await fetch("/api/super-admin/apply-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(
        `تم ${applyReset ? "إعادة تعيين" : "تطبيق"} الإعداد — ${data.processed} عملية`
      );
      setApplyOpen(false);
      setSelectedIds(new Set());
    } catch {
      toast.error("فشل تطبيق الإعداد");
    } finally {
      setApplying(false);
    }
  };

  return (
    <SectionCard
      title="إدارة الميزات"
      description="جدول كامل بالميزات مع التبديلات المباشرة والتطبيق الجماعي"
      icon={Settings}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFeatures}
            className="h-8"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
          </Button>
          <Button
            size="sm"
            onClick={openApply}
            disabled={selectedIds.size === 0}
            className="h-8 bg-gradient-to-l from-teal-500 to-sky-500 border-0"
          >
            <Send className="h-3.5 w-3.5 ml-1" /> تطبيق على النوادي
            {selectedIds.size > 0 && (
              <Badge className="ml-1 bg-white/20 text-white text-[9px]">
                {selectedIds.size}
              </Badge>
            )}
          </Button>
        </div>
      }
    >
      {/* أدوات التصفية */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو المفتاح..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <Filter className="h-3.5 w-3.5 ml-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفئات</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c] || c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Loader label="تحميل الميزات..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={AlertCircle} message="لا توجد ميزات مطابقة" />
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        filtered.length > 0 &&
                        filtered.every((f) => selectedIds.has(f.id))
                      }
                      onCheckedChange={(v) => selectAll(!!v)}
                    />
                  </TableHead>
                  <TableHead className="min-w-[180px]">الميزة</TableHead>
                  <TableHead>الفئة</TableHead>
                  {TOGGLE_COLUMNS.map((col) => (
                    <TableHead
                      key={col.key}
                      className="text-center min-w-[70px]"
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help text-[11px]">
                              {col.short}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{col.label}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  ))}
                  <TableHead>المنصات</TableHead>
                  <TableHead>الخطط</TableHead>
                  <TableHead>آخر تحديث</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow
                    key={f.id}
                    className={cn(
                      selectedIds.has(f.id) && "bg-primary/5",
                      updatingId === f.id && "opacity-70"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(f.id)}
                        onCheckedChange={(v) => toggleSelect(f.id, !!v)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-l from-teal-500/10 to-sky-500/10 text-primary">
                          {f.icon ? (
                            <Sparkles className="h-3.5 w-3.5" />
                          ) : (
                            <Layers className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground" dir="ltr">
                            {f.key}
                          </p>
                          <div className="flex gap-1 mt-0.5">
                            {f.isPremium && (
                              <Badge
                                variant="outline"
                                className="text-[8px] h-4 px-1 bg-amber-500/15 text-amber-700 border-amber-500/30"
                              >
                                <Crown className="h-2 w-2 ml-0.5" /> مدفوع
                              </Badge>
                            )}
                            {f.isBeta && (
                              <Badge
                                variant="outline"
                                className="text-[8px] h-4 px-1 bg-violet-500/15 text-violet-700 border-violet-500/30"
                              >
                                <Sparkles className="h-2 w-2 ml-0.5" /> Beta
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px]",
                          CATEGORY_COLORS[f.category]
                        )}
                      >
                        {CATEGORY_LABELS[f.category] || f.category}
                      </Badge>
                    </TableCell>
                    {TOGGLE_COLUMNS.map((col) => (
                      <TableCell key={col.key} className="text-center">
                        <Switch
                          checked={f[col.key] as boolean}
                          onCheckedChange={(v) => handleToggle(f, col.key, v)}
                          disabled={updatingId === f.id}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-1">
                        {(f.platforms || "all")
                          .split(",")
                          .map((p) => p.trim())
                          .filter(Boolean)
                          .slice(0, 3)
                          .map((p) => {
                            const Icon = PLATFORM_ICON[p] || Globe;
                            return (
                              <TooltipProvider key={p}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-muted text-muted-foreground">
                                      <Icon className="h-3 w-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{p}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {(f.plans || "")
                          .split(",")
                          .map((p) => p.trim())
                          .filter(Boolean)
                          .map((p) => (
                            <Badge
                              key={p}
                              variant="outline"
                              className="text-[8px] h-4 px-1 bg-sky-500/10 text-sky-700 border-sky-500/30"
                            >
                              {PLAN_LABELS[p] || p}
                            </Badge>
                          ))}
                        {!f.plans && (
                          <span className="text-[10px] text-muted-foreground">
                            الكل
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDate(f.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-600 hover:bg-rose-500/10"
                        onClick={() => handleDelete(f)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      {/* حوار التطبيق الجماعي */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> تطبيق الإعداد على النوادي
            </DialogTitle>
            <DialogDescription>
              سيتم تطبيق الإعداد على {selectedIds.size} ميزة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pl-1">
            <div className="space-y-1">
              <Label className="text-xs">النطاق</Label>
              <Select
                value={applyScope}
                onValueChange={(v) =>
                  setApplyScope(v as typeof applyScope)
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_CLUBS">كل النوادي</SelectItem>
                  <SelectItem value="CLUB_SPECIFIC">نوادي محددة</SelectItem>
                  <SelectItem value="CLUB_GROUP">مجموعة نوادي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {applyScope === "CLUB_SPECIFIC" && (
              <div className="space-y-1">
                <Label className="text-xs">النوادي المستهدفة</Label>
                <div className="rounded-lg border max-h-40 overflow-y-auto p-2 space-y-1">
                  {clubs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      لا توجد نوادي
                    </p>
                  ) : (
                    clubs.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/40 rounded px-1 py-0.5"
                      >
                        <Checkbox
                          checked={applyClubIds.includes(c.id)}
                          onCheckedChange={(v) => {
                            setApplyClubIds((prev) =>
                              v
                                ? [...prev, c.id]
                                : prev.filter((x) => x !== c.id)
                            );
                          }}
                        />
                        <span>{c.name}</span>
                        <span className="text-muted-foreground">— {c.city}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {applyScope === "CLUB_GROUP" && (
              <div className="space-y-1">
                <Label className="text-xs">المجموعة</Label>
                <Select value={applyGroupId} onValueChange={setApplyGroupId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="اختر مجموعة" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.memberCount} نادٍ)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">الإعدادات المُطبَّقة</Label>
              <div className="grid grid-cols-2 gap-2">
                {TOGGLE_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center justify-between rounded-lg border px-2 py-1.5 text-xs cursor-pointer"
                  >
                    <span>{col.label}</span>
                    <Switch
                      checked={
                        applyOverrides[col.key] as boolean
                      }
                      onCheckedChange={(v) =>
                        setApplyOverrides((prev) => ({
                          ...prev,
                          [col.key]: v,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            <label className="flex items-center gap-2 text-xs cursor-pointer rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
              <Checkbox
                checked={applyReset}
                onCheckedChange={(v) => setApplyReset(!!v)}
              />
              <span>
                إعادة التعيين (حذف كل التجاوزات وإرجاع الافتراضي)
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={submitApply}
              disabled={applying}
              className="bg-gradient-to-l from-teal-500 to-sky-500 border-0"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <Send className="h-4 w-4 ml-1" />
              )}
              تطبيق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════
//  3) تبويب النوادي — قائمة النوادي مع عدّاد التجاوزات
// ═══════════════════════════════════════════════════════════════

function ClubsTab() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [access, setAccess] = useState<FeatureAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, aRes] = await Promise.all([
        fetch("/api/super-admin/clubs", { cache: "no-store" }),
        fetch("/api/super-admin/feature-access", { cache: "no-store" }),
      ]);
      if (cRes.ok) {
        const cd = await cRes.json();
        setClubs(cd.clubs || []);
      }
      if (aRes.ok) {
        const ad = await aRes.json();
        setAccess(ad.access || []);
      }
    } catch {
      toast.error("فشل تحميل النوادي");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const overridesByClub = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of access) {
      if (a.clubId) map[a.clubId] = (map[a.clubId] || 0) + 1;
    }
    return map;
  }, [access]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [clubs, search]);

  const STATUS_LABELS: Record<string, string> = {
    pending: "بانتظار الموافقة",
    active: "نشط",
    expired: "منتهي",
    disabled: "معطل",
    suspended: "موقوف",
  };
  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    expired: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    disabled: "bg-slate-500/15 text-slate-700 border-slate-500/30",
    suspended: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  };

  return (
    <SectionCard
      title="إدارة النوادي"
      description="قائمة النوادي مع عدّاد تجاوزات الميزات لكل نادٍ"
      icon={Building2}
      action={
        <Button variant="outline" size="sm" onClick={fetchAll} className="h-8">
          <RefreshCw
            className={cn("h-3.5 w-3.5", loading && "animate-spin")}
          />
        </Button>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث عن نادٍ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-8 h-9"
        />
      </div>

      {loading ? (
        <Loader label="تحميل النوادي..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} message="لا توجد نوادي" />
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>النادي</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead className="text-center">تجاوزات الميزات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const count = overridesByClub[c.id] || 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold">{c.name}</TableCell>
                    <TableCell>{c.city}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px]",
                          STATUS_COLORS[c.status] ||
                            "bg-muted text-muted-foreground"
                        )}
                      >
                        {STATUS_LABELS[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          count > 0
                            ? "bg-sky-500/10 text-sky-700 border-sky-500/30"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════
//  4) تبويب الوحدات — الميزات مجمّعة حسب الفئة في بطاقات
// ═══════════════════════════════════════════════════════════════

function ModulesTab() {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/feature-flags", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features || []);
      }
    } catch {
      toast.error("فشل تحميل الوحدات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const grouped = useMemo(() => {
    const map: Record<string, FeatureFlag[]> = {};
    for (const f of features) {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    }
    return map;
  }, [features]);

  if (loading) return <Loader label="تحميل الوحدات..." />;

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([cat, items]) => (
        <SectionCard
          key={cat}
          title={CATEGORY_LABELS[cat] || cat}
          description={`${items.length} عنصر`}
          icon={Boxes}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-border/60 p-3 space-y-2 hover:border-primary/40 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-l from-teal-500/10 to-sky-500/10 text-primary">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{f.name}</p>
                      <p
                        className="text-[10px] text-muted-foreground"
                        dir="ltr"
                      >
                        {f.key}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {f.isPremium && (
                      <Badge
                        variant="outline"
                        className="text-[8px] h-4 px-1 bg-amber-500/15 text-amber-700 border-amber-500/30"
                      >
                        <Crown className="h-2 w-2 ml-0.5" /> مدفوع
                      </Badge>
                    )}
                    {f.isBeta && (
                      <Badge
                        variant="outline"
                        className="text-[8px] h-4 px-1 bg-violet-500/15 text-violet-700 border-violet-500/30"
                      >
                        <Sparkles className="h-2 w-2 ml-0.5" /> Beta
                      </Badge>
                    )}
                  </div>
                </div>
                {f.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {f.description}
                  </p>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-1 text-[10px]">
                    <Switch checked={f.enabled} disabled className="h-3 w-6" />
                    مفعّلة
                  </label>
                  <label className="flex items-center gap-1 text-[10px]">
                    <Switch checked={f.visible} disabled className="h-3 w-6" />
                    مرئية
                  </label>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
      {features.length === 0 && (
        <EmptyState icon={AlertCircle} message="لا توجد وحدات مسجّلة" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  5) تبويب الصلاحيات — مصفوفة الميزات × الأدوار
// ═══════════════════════════════════════════════════════════════

function PermissionsTab() {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(
    {}
  );

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/feature-flags", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const feats: FeatureFlag[] = data.features || [];
        setFeatures(feats);
        // تهيئة افتراضية: admin=الكل، assistant=معظم، lifeguard/observer=عرض
        const init: Record<string, Record<string, boolean>> = {};
        for (const f of feats) {
          init[f.id] = {
            admin: true,
            assistant: !f.readOnly,
            lifeguard: false,
            observer: false,
          };
        }
        setMatrix(init);
      }
    } catch {
      toast.error("فشل تحميل الميزات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const toggle = (featureId: string, role: string, value: boolean) => {
    setMatrix((prev) => ({
      ...prev,
      [featureId]: { ...(prev[featureId] || {}), [role]: value },
    }));
  };

  const handleSave = () => {
    // ملاحظة: لا يوجد API مخصص للصلاحيات حالياً — يُحفظ محلياً
    toast.success("تم حفظ مصفوفة الصلاحيات محلياً");
  };

  if (loading) return <Loader label="تحميل الميزات..." />;

  return (
    <SectionCard
      title="مصفوفة الصلاحيات"
      description="تحكم في وصول كل دور إلى كل ميزة"
      icon={Lock}
      action={
        <Button
          size="sm"
          onClick={handleSave}
          className="h-8 bg-gradient-to-l from-teal-500 to-sky-500 border-0"
        >
          <Save className="h-3.5 w-3.5 ml-1" /> حفظ
        </Button>
      }
    >
      {features.length === 0 ? (
        <EmptyState icon={AlertCircle} message="لا توجد ميزات" />
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                <TableRow>
                  <TableHead className="min-w-[200px]">الميزة</TableHead>
                  {ROLES.map((r) => (
                    <TableHead key={r.key} className="text-center">
                      {r.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px]",
                            CATEGORY_COLORS[f.category]
                          )}
                        >
                          {CATEGORY_LABELS[f.category] || f.category}
                        </Badge>
                        <span className="text-sm font-semibold">
                          {f.name}
                        </span>
                      </div>
                    </TableCell>
                    {ROLES.map((r) => (
                      <TableCell key={r.key} className="text-center">
                        <Checkbox
                          checked={matrix[f.id]?.[r.key] || false}
                          onCheckedChange={(v) => toggle(f.id, r.key, !!v)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════
//  6) تبويب الإعداد الافتراضي — نموذج DefaultClubConfig
// ═══════════════════════════════════════════════════════════════

function DefaultConfigTab() {
  const [config, setConfig] = useState<DefaultClubConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/default-config", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch {
      toast.error("فشل تحميل الإعداد الافتراضي");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/default-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      toast.success("تم حفظ الإعداد الافتراضي");
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) return <Loader label="تحميل الإعداد..." />;

  return (
    <SectionCard
      title="الإعداد الافتراضي للنوادي الجديدة"
      description="الهوية والتوطين وافتراضات الاشتراك"
      icon={FileText}
      action={
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="h-8 bg-gradient-to-l from-teal-500 to-sky-500 border-0"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />
          ) : (
            <Save className="h-3.5 w-3.5 ml-1" />
          )}
          حفظ
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* الهوية */}
        <div className="space-y-3 rounded-xl border border-border/60 p-3">
          <h4 className="text-xs font-bold flex items-center gap-1">
            <Palette className="h-3.5 w-3.5 text-primary" /> الهوية
          </h4>
          <div className="space-y-1">
            <Label className="text-xs">اسم النادي الافتراضي</Label>
            <Input
              value={config.clubName}
              onChange={(e) =>
                setConfig({ ...config, clubName: e.target.value })
              }
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">اللون الأساسي</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={(e) =>
                    setConfig({ ...config, primaryColor: e.target.value })
                  }
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={config.primaryColor}
                  onChange={(e) =>
                    setConfig({ ...config, primaryColor: e.target.value })
                  }
                  className="h-9"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">اللون الثانوي</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.secondaryColor}
                  onChange={(e) =>
                    setConfig({ ...config, secondaryColor: e.target.value })
                  }
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={config.secondaryColor}
                  onChange={(e) =>
                    setConfig({ ...config, secondaryColor: e.target.value })
                  }
                  className="h-9"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">رابط الشعار</Label>
            <Input
              value={config.logoUrl || ""}
              onChange={(e) =>
                setConfig({ ...config, logoUrl: e.target.value })
              }
              className="h-9"
              dir="ltr"
              placeholder="https://..."
            />
          </div>
        </div>

        {/* التوطين */}
        <div className="space-y-3 rounded-xl border border-border/60 p-3">
          <h4 className="text-xs font-bold flex items-center gap-1">
            <Globe className="h-3.5 w-3.5 text-primary" /> التوطين
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">اللغة</Label>
              <Select
                value={config.language}
                onValueChange={(v) =>
                  setConfig({ ...config, language: v })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">العملة</Label>
              <Input
                value={config.currency}
                onChange={(e) =>
                  setConfig({ ...config, currency: e.target.value })
                }
                className="h-9"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">رمز العملة</Label>
              <Input
                value={config.currencySymbol}
                onChange={(e) =>
                  setConfig({ ...config, currencySymbol: e.target.value })
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المنطقة الزمنية</Label>
              <Input
                value={config.timezone}
                onChange={(e) =>
                  setConfig({ ...config, timezone: e.target.value })
                }
                className="h-9"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">التقويم</Label>
              <Select
                value={config.calendar}
                onValueChange={(v) =>
                  setConfig({ ...config, calendar: v })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gregorian">ميلادي</SelectItem>
                  <SelectItem value="hijri">هجري</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* افتراضات الاشتراك */}
        <div className="space-y-3 rounded-xl border border-border/60 p-3 md:col-span-2">
          <h4 className="text-xs font-bold flex items-center gap-1">
            <Crown className="h-3.5 w-3.5 text-primary" /> افتراضات الاشتراك
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">الخطة الافتراضية</Label>
              <Select
                value={config.defaultPlan}
                onValueChange={(v) =>
                  setConfig({ ...config, defaultPlan: v })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">مجاني</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="yearly">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">أيام التجربة المجانية</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={config.trialDays}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    trialDays: parseInt(e.target.value) || 0,
                  })
                }
                className="h-9"
              />
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════
//  7) تبويب خطط الاشتراك — ربط الميزات بالخطط
// ═══════════════════════════════════════════════════════════════

function PlansTab() {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/feature-flags", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features || []);
      }
    } catch {
      toast.error("فشل تحميل الميزات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const togglePlan = async (feature: FeatureFlag, plan: string, add: boolean) => {
    const current = (feature.plans || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const next = add
      ? Array.from(new Set([...current, plan]))
      : current.filter((p) => p !== plan);
    const newPlans = next.length > 0 ? next.join(",") : null;

    setUpdatingKey(feature.id + plan);
    setFeatures((prev) =>
      prev.map((f) =>
        f.id === feature.id ? { ...f, plans: newPlans } : f
      )
    );
    try {
      const res = await fetch(
        `/api/super-admin/feature-flags/${feature.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plans: newPlans }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(
        `${feature.name}: ${PLAN_LABELS[plan] || plan} ${add ? "أُضيفت" : "أُزيلت"}`
      );
    } catch {
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === feature.id ? { ...f, plans: feature.plans } : f
        )
      );
      toast.error("فشل التحديث");
    } finally {
      setUpdatingKey(null);
    }
  };

  const PLANS = ["free", "starter", "professional", "enterprise"];

  if (loading) return <Loader label="تحميل الخطط..." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PLANS.map((plan) => {
          const count = features.filter((f) => {
            const plans = (f.plans || "")
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean);
            return plans.includes(plan);
          }).length;
          return (
            <div
              key={plan}
              className={cn(
                "rounded-2xl border-2 p-4",
                PLAN_COLORS[plan] || "border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <Crown className="h-5 w-5" />
                <Badge variant="outline" className="text-[9px]">
                  {count} ميزة
                </Badge>
              </div>
              <h3 className="font-bold text-lg mt-2">
                {PLAN_LABELS[plan] || plan}
              </h3>
            </div>
          );
        })}
      </div>

      <SectionCard
        title="ربط الميزات بالخطط"
        description="حدّد الميزات المتاحة لكل خطة"
        icon={Crown}
      >
        {features.length === 0 ? (
          <EmptyState icon={AlertCircle} message="لا توجد ميزات" />
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                  <TableRow>
                    <TableHead className="min-w-[220px]">الميزة</TableHead>
                    {PLANS.map((p) => (
                      <TableHead key={p} className="text-center">
                        {PLAN_LABELS[p] || p}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {features.map((f) => {
                    const plans = (f.plans || "")
                      .split(",")
                      .map((p) => p.trim())
                      .filter(Boolean);
                    return (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px]",
                                CATEGORY_COLORS[f.category]
                              )}
                            >
                              {CATEGORY_LABELS[f.category] || f.category}
                            </Badge>
                            <span className="text-sm font-semibold">
                              {f.name}
                            </span>
                          </div>
                        </TableCell>
                        {PLANS.map((p) => (
                          <TableCell key={p} className="text-center">
                            <Checkbox
                              checked={plans.includes(p)}
                              onCheckedChange={(v) => togglePlan(f, p, !!v)}
                              disabled={
                                updatingKey === f.id + p
                              }
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  8) تبويب الهوية — ألوان وشعار مع معاينة حية
// ═══════════════════════════════════════════════════════════════

function BrandingTab() {
  const [config, setConfig] = useState<DefaultClubConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/default-config", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch {
      toast.error("فشل تحميل الهوية");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/default-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          logoUrl: config.logoUrl,
          clubName: config.clubName,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("تم حفظ الهوية");
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) return <Loader label="تحميل الهوية..." />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SectionCard
        title="إعدادات الهوية"
        description="الألوان الأساسية والشعار"
        icon={Palette}
        action={
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 bg-gradient-to-l from-teal-500 to-sky-500 border-0"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />
            ) : (
              <Save className="h-3.5 w-3.5 ml-1" />
            )}
            حفظ
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">اسم النادي</Label>
            <Input
              value={config.clubName}
              onChange={(e) =>
                setConfig({ ...config, clubName: e.target.value })
              }
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">اللون الأساسي</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={(e) =>
                    setConfig({ ...config, primaryColor: e.target.value })
                  }
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={config.primaryColor}
                  onChange={(e) =>
                    setConfig({ ...config, primaryColor: e.target.value })
                  }
                  className="h-9"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">اللون الثانوي</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.secondaryColor}
                  onChange={(e) =>
                    setConfig({ ...config, secondaryColor: e.target.value })
                  }
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={config.secondaryColor}
                  onChange={(e) =>
                    setConfig({ ...config, secondaryColor: e.target.value })
                  }
                  className="h-9"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">رابط الشعار</Label>
            <Input
              value={config.logoUrl || ""}
              onChange={(e) =>
                setConfig({ ...config, logoUrl: e.target.value })
              }
              className="h-9"
              dir="ltr"
              placeholder="https://..."
            />
          </div>
        </div>
      </SectionCard>

      {/* معاينة حية */}
      <SectionCard
        title="معاينة حية"
        description="كيف ستظهر الهوية للنوادي الجديدة"
        icon={Eye}
      >
        <div className="rounded-2xl overflow-hidden border border-border/60">
          <div
            className="p-6 text-white"
            style={{
              background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})`,
            }}
          >
            <div className="flex items-center gap-3">
              {config.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={config.logoUrl}
                  alt="logo"
                  className="h-12 w-12 rounded-xl bg-white/20 object-contain p-1"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Building2 className="h-6 w-6" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-extrabold">{config.clubName}</h3>
                <p className="text-xs opacity-90">AquaCore Club Manager</p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-2 bg-card">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: config.primaryColor }}
              >
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="text-sm">زر إجراء أساسي</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: config.secondaryColor }}
              >
                <Settings className="h-4 w-4" />
              </span>
              <span className="text-sm">زر إجراء ثانوي</span>
            </div>
            <div className="flex gap-2 pt-2">
              <span
                className="px-3 py-1 rounded-lg text-white text-xs font-semibold"
                style={{ backgroundColor: config.primaryColor }}
              >
                زر أساسي
              </span>
              <span
                className="px-3 py-1 rounded-lg text-white text-xs font-semibold"
                style={{ backgroundColor: config.secondaryColor }}
              >
                زر ثانوي
              </span>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  9) تبويب الأمان — إعدادات عرض فقط
// ═══════════════════════════════════════════════════════════════

function SecurityTab() {
  const items = [
    {
      icon: Lock,
      title: "حدّ تسجيل الدخول",
      rows: [
        { label: "المحاولات المسموحة", value: "10 / 15 دقيقة" },
        { label: "مدة القفل", value: "30 دقيقة" },
        { label: "إعادة التصفير", value: "عند النجاح" },
      ],
      color: "from-rose-500/10 to-orange-500/10",
    },
    {
      icon: KeyRound,
      title: "حدّ رمز الكاشير",
      rows: [
        { label: "المحاولات المسموحة", value: "5 / 15 دقيقة" },
        { label: "مدة القفل", value: "30 دقيقة" },
        { label: "التخزين", value: "مشفّر bcrypt" },
      ],
      color: "from-amber-500/10 to-yellow-500/10",
    },
    {
      icon: Fingerprint,
      title: "سياسة كلمات المرور",
      rows: [
        { label: "الحد الأدنى للطول", value: "8 أحرف" },
        { label: "الأحرف الكبيرة", value: "مطلوبة" },
        { label: "الأرقام", value: "مطلوبة" },
      ],
      color: "from-sky-500/10 to-teal-500/10",
    },
    {
      icon: Clock,
      title: "انتهاء الجلسة",
      rows: [
        { label: "مدة الجلسة", value: "24 ساعة" },
        { label: "التمديد التلقائي", value: "مفعّل" },
        { label: "تسجيل الخروج عند الخمول", value: "60 دقيقة" },
      ],
      color: "from-violet-500/10 to-purple-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <Card
            key={item.title}
            className={cn(
              "rounded-2xl bg-gradient-to-br",
              item.color
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {item.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold">{r.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <SectionCard
        title="ملاحظة أمنية"
        icon={AlertCircle}
      >
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
          هذه الإعدادات للعرض فقط حالياً. لتعديلها يجب تحديث متغيّرات البيئة
          (Rate Limit) أو إعادة تكوين الخادم. يتم تطبيق Rate Limiting في الذاكرة
          لكل instance — للنشر متعدد instances يُنصح باستخدام Upstash Redis.
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  10) تبويب التكاملات — حالة التكاملات
// ═══════════════════════════════════════════════════════════════

function IntegrationsTab() {
  const integrations = [
    {
      icon: MessageSquare,
      title: "WhatsApp",
      status: "متصل",
      connected: true,
      details: [
        { label: "API", value: "WhatsApp Cloud" },
        { label: "آخر إرسال", value: "—" },
        { label: "الرسائل اليوم", value: "0" },
      ],
      color: "from-emerald-500/10 to-green-500/10",
    },
    {
      icon: MessageSquare,
      title: "SMS Gateway",
      status: "غير مفعّل",
      connected: false,
      details: [
        { label: "المزوّد", value: "—" },
        { label: "الرصيد", value: "—" },
        { label: "آخر إرسال", value: "—" },
      ],
      color: "from-slate-500/10 to-gray-500/10",
    },
    {
      icon: Server,
      title: "API العمومية",
      status: "نشط",
      connected: true,
      details: [
        { label: "الإصدار", value: "v1" },
        { label: "المفاتيح النشطة", value: "0" },
        { label: "الطلبات اليوم", value: "0" },
      ],
      color: "from-sky-500/10 to-blue-500/10",
    },
    {
      icon: Cloud,
      title: "المزامنة السحابية",
      status: "نشط",
      connected: true,
      details: [
        { label: "آخر مزامنة", value: "—" },
        { label: "العناصر المعلّقة", value: "0" },
        { label: "التشفير", value: "AES-256" },
      ],
      color: "from-violet-500/10 to-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {integrations.map((it) => (
        <Card key={it.title} className={cn("rounded-2xl bg-gradient-to-br", it.color)}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <it.icon className="h-4 w-4" />
                {it.title}
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px]",
                  it.connected
                    ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                    : "bg-slate-500/15 text-slate-600 border-slate-500/30"
                )}
              >
                {it.connected ? (
                  <CheckCircle2 className="h-2.5 w-2.5 ml-0.5" />
                ) : (
                  <XCircle className="h-2.5 w-2.5 ml-0.5" />
                )}
                {it.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {it.details.map((d) => (
              <div
                key={d.label}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-semibold">{d.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  11) تبويب النسخ الاحتياطي — إعدادات عرض فقط
// ═══════════════════════════════════════════════════════════════

function BackupTab() {
  return (
    <div className="space-y-4">
      <SectionCard
        title="إعدادات النسخ الاحتياطي"
        description="تُدار حالياً عبر البنية التحتية (Neon / Vercel)"
        icon={HardDrive}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/60 p-3 text-center">
            <Cloud className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-sm font-semibold">قاعدة البيانات</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Neon PostgreSQL — نسخ تلقائي
            </p>
            <Badge
              variant="outline"
              className="mt-2 text-[9px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
            >
              <CheckCircle2 className="h-2.5 w-2.5 ml-0.5" /> نشط
            </Badge>
          </div>
          <div className="rounded-xl border border-border/60 p-3 text-center">
            <Download className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-sm font-semibold">تصدير يدوي</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              عبر لوحة النادي — CSV / Excel
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-[10px]"
              onClick={() => toast.info("استخدم لوحة النادي لتصدير البيانات")}
            >
              <Download className="h-3 w-3 ml-1" /> تصدير
            </Button>
          </div>
          <div className="rounded-xl border border-border/60 p-3 text-center">
            <Wifi className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-sm font-semibold">المزامنة</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              أوفلاين ↔ سحابي عبر Sync Outbox
            </p>
            <Badge
              variant="outline"
              className="mt-2 text-[9px] bg-sky-500/15 text-sky-700 border-sky-500/30"
            >
              <Activity className="h-2.5 w-2.5 ml-0.5" /> تلقائي
            </Badge>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="سياسة الاستبقاء" icon={Database}>
        <div className="space-y-2">
          {[
            { label: "نسخ قاعدة البيانات اليومية", value: "7 أيام" },
            { label: "النسخ الأسبوعية", value: "4 أسابيع" },
            { label: "النسخ الشهرية", value: "12 شهراً" },
            { label: "سجل التدقيق", value: "غير محدود" },
          ].map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between text-xs rounded-lg border border-border/60 px-3 py-2"
            >
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  12) تبويب سجل التدقيق — جدول السجلات مع فلاتر
// ═══════════════════════════════════════════════════════════════

function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit-logs?limit=100", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else {
        toast.error("فشل تحميل السجلات");
      }
    } catch {
      toast.error("فشل تحميل السجلات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return Array.from(set);
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (
        q &&
        !l.description.toLowerCase().includes(q) &&
        !l.entityType.toLowerCase().includes(q) &&
        !(l.ipAddress || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [logs, actionFilter, search]);

  const ACTION_COLORS: Record<string, string> = {
    login: "bg-sky-500/15 text-sky-700 border-sky-500/30",
    logout: "bg-slate-500/15 text-slate-700 border-slate-500/30",
    create: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    update: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    delete: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    activate: "bg-teal-500/15 text-teal-700 border-teal-500/30",
    revoke: "bg-violet-500/15 text-violet-700 border-violet-500/30",
    apply: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    reset: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  };

  return (
    <SectionCard
      title="سجل التدقيق"
      description="آخر 100 عملية في النظام"
      icon={Activity}
      action={
        <Button variant="outline" size="sm" onClick={fetchLogs} className="h-8">
          <RefreshCw
            className={cn("h-3.5 w-3.5", loading && "animate-spin")}
          />
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث في الوصف أو النوع أو IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8 h-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <Filter className="h-3.5 w-3.5 ml-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الإجراءات</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Loader label="تحميل السجلات..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Activity} message="لا توجد سجلات مطابقة" />
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الإجراء</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDateTime(l.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px]",
                          ACTION_COLORS[l.action] ||
                            "bg-muted text-muted-foreground"
                        )}
                      >
                        {l.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{l.entityType}</TableCell>
                    <TableCell className="text-xs max-w-[400px]">
                      {l.description}
                    </TableCell>
                    <TableCell
                      className="text-[10px] text-muted-foreground"
                      dir="ltr"
                    >
                      {l.ipAddress || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════
//  المكوّن الرئيسي — مركز تحكم السوبر أدمن (12 تبويب)
// ═══════════════════════════════════════════════════════════════

export function SuperAdminControlCenter() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="p-4 border-b bg-gradient-to-l from-teal-500/10 to-sky-500/10">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          مركز التحكم الشامل
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          تحكّم كامل في الميزات والإعدادات والنوادي والصلاحيات
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full p-4">
        <ScrollArea className="w-full">
          <TabsList className="grid w-max grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 mb-4 h-auto">
            {TAB_LIST.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex-col gap-1 py-2 h-auto text-[11px]"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        <TabsContent value="general" className="mt-2">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="features" className="mt-2">
          <FeaturesTab />
        </TabsContent>
        <TabsContent value="clubs" className="mt-2">
          <ClubsTab />
        </TabsContent>
        <TabsContent value="modules" className="mt-2">
          <ModulesTab />
        </TabsContent>
        <TabsContent value="permissions" className="mt-2">
          <PermissionsTab />
        </TabsContent>
        <TabsContent value="default-config" className="mt-2">
          <DefaultConfigTab />
        </TabsContent>
        <TabsContent value="plans" className="mt-2">
          <PlansTab />
        </TabsContent>
        <TabsContent value="branding" className="mt-2">
          <BrandingTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-2">
          <AuditLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SuperAdminControlCenter;
