"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  Banknote,
  Wallet,
  Plus,
  Download,
  Printer,
  Search,
  Filter,
  X,
  Eye,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Receipt,
  Calculator,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  RefreshCw,
  MoreHorizontal,
  Calendar,
  Phone,
  Briefcase,
  Hash,
  Coins,
  TrendingUp,
  TrendingDown,
  Save,
  CalendarDays,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════
// أنواع البيانات
// ═══════════════════════════════════════════════════════════

interface StaffCompensation {
  id: string;
  employeeId: string | null;
  userId: string | null;
  personName: string;
  personPosition: string;
  month: number;
  year: number;
  periodLabel: string | null;
  workHours: number;
  hourRate: number;
  baseAmount: number;
  overtimeHours: number;
  overtimeAmount: number;
  bonusAmount: number;
  deductions: number;
  totalAmount: number;
  paymentStatus: string;
  paymentDate: string | null;
  paymentMethod: string | null;
  compensationType: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    hourRate: number;
    phone: string | null;
  } | null;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface CompStats {
  totalRecords: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  processingCount: number;
  processingAmount: number;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  hourRate: number;
  phone: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
  } | null;
}

// ═══════════════════════════════════════════════════════════
// ثوابت
// ═══════════════════════════════════════════════════════════

const MONTH_NAMES_AR = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const POSITION_LABELS: Record<string, string> = {
  guard: "حارس سباحة",
  coach: "مدرب",
  admin: "إدارة",
  maintenance: "صيانة",
  cleaner: "نظافة",
  seasonal: "موسمي",
  other: "أخرى",
};

const POSITION_COLORS: Record<string, string> = {
  guard: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  coach: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  admin: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  maintenance: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  cleaner: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  seasonal: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  other: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  processing: "قيد المعالجة",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  unpaid: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  processing: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

const PAYMENT_STATUS_DOT: Record<string, string> = {
  paid: "bg-emerald-500",
  unpaid: "bg-rose-500",
  processing: "bg-amber-500",
};

const COMPENSATION_TYPE_LABELS: Record<string, string> = {
  monthly: "شهري",
  bonus: "مكافأة",
  overtime: "ساعات إضافية",
  penalty: "خصم / عقوبة",
  other: "أخرى",
};

const COMPENSATION_TYPE_COLORS: Record<string, string> = {
  monthly: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  bonus: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  overtime: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  penalty: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  other: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  bank: "تحويل بنكي",
  cheque: "شيك",
};

type SortColumn = "totalAmount" | "personName" | "date" | "workHours" | "baseAmount";
type SortDirection = "asc" | "desc";

// ═══════════════════════════════════════════════════════════
// دوال مساعدة
// ═══════════════════════════════════════════════════════════

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return "0 دج";
  return `${Math.round(amount).toLocaleString("en-US")} دج`;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || isNaN(value)) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-DZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-DZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function getPositionLabel(pos: string): string {
  return POSITION_LABELS[pos] || pos || "—";
}

function getPositionColor(pos: string): string {
  return POSITION_COLORS[pos] || POSITION_COLORS.other;
}

// Hook: debounce a value
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ═══════════════════════════════════════════════════════════
// بطاقة إحصائية
// ═══════════════════════════════════════════════════════════

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subText?: string;
  colorClass: string;
  iconBg: string;
  index: number;
}

function StatCard({ icon: Icon, label, value, subText, colorClass, iconBg, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className={cn("relative overflow-hidden border-t-4", colorClass)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
              {subText && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{subText}</p>
              )}
            </div>
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconBg)}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// نموذج إضافة/تعديل التعويض
// ═══════════════════════════════════════════════════════════

interface CompensationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecord: StaffCompensation | null;
  employees: Employee[];
  defaultMonth: number;
  defaultYear: number;
  onSaved: () => void;
}

interface FormState {
  employeeId: string;
  userId: string;
  personName: string;
  personPosition: string;
  month: number;
  year: number;
  workHours: string;
  hourRate: string;
  baseAmount: string;
  overtimeHours: string;
  overtimeAmount: string;
  bonusAmount: string;
  deductions: string;
  paymentStatus: string;
  paymentDate: string;
  paymentMethod: string;
  compensationType: string;
  note: string;
}

const EMPTY_FORM: FormState = {
  employeeId: "",
  userId: "",
  personName: "",
  personPosition: "guard",
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  workHours: "",
  hourRate: "200",
  baseAmount: "",
  overtimeHours: "",
  overtimeAmount: "",
  bonusAmount: "",
  deductions: "",
  paymentStatus: "unpaid",
  paymentDate: "",
  paymentMethod: "cash",
  compensationType: "monthly",
  note: "",
};

function CompensationFormDialog({
  open,
  onOpenChange,
  editingRecord,
  employees,
  defaultMonth,
  defaultYear,
  onSaved,
}: CompensationFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [autoCalcLoading, setAutoCalcLoading] = useState(false);

  // Sync form when opening
  useEffect(() => {
    if (!open) return;
    if (editingRecord) {
      const r = editingRecord;
      setForm({
        employeeId: r.employeeId || "",
        userId: r.userId || "",
        personName: r.personName || "",
        personPosition: r.personPosition || "guard",
        month: r.month,
        year: r.year,
        workHours: String(r.workHours ?? ""),
        hourRate: String(r.hourRate ?? "200"),
        baseAmount: String(r.baseAmount ?? ""),
        overtimeHours: String(r.overtimeHours ?? ""),
        overtimeAmount: String(r.overtimeAmount ?? ""),
        bonusAmount: String(r.bonusAmount ?? ""),
        deductions: String(r.deductions ?? ""),
        paymentStatus: r.paymentStatus || "unpaid",
        paymentDate: r.paymentDate ? r.paymentDate.slice(0, 10) : "",
        paymentMethod: r.paymentMethod || "cash",
        compensationType: r.compensationType || "monthly",
        note: r.note || "",
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        month: defaultMonth,
        year: defaultYear,
      });
    }
  }, [open, editingRecord, defaultMonth, defaultYear]);

  // Live calculation: baseAmount = workHours * hourRate
  const workHoursNum = parseFloat(form.workHours) || 0;
  const hourRateNum = parseFloat(form.hourRate) || 0;
  const liveBaseAmount = Math.round(workHoursNum * hourRateNum);
  const overtimeAmountNum = parseFloat(form.overtimeAmount) || 0;
  const bonusAmountNum = parseFloat(form.bonusAmount) || 0;
  const deductionsNum = parseFloat(form.deductions) || 0;
  const totalAmount = liveBaseAmount + overtimeAmountNum + bonusAmountNum - deductionsNum;

  // When employee selected → auto-fill name/position/rate/userId
  const handleEmployeeChange = (empId: string) => {
    if (empId === "__manual__") {
      setForm((f) => ({ ...f, employeeId: "", userId: "", personName: f.personName }));
      return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setForm((f) => ({
        ...f,
        employeeId: emp.id,
        userId: emp.user?.id || "",
        personName: `${emp.firstName} ${emp.lastName}`.trim(),
        personPosition: emp.position || "guard",
        hourRate: String(emp.hourRate || 200),
      }));
    }
  };

  // Auto-calc from Pointage
  const handleAutoCalc = async () => {
    if (!form.employeeId && !form.userId) {
      toast.error("اختر عاملاً أولاً لاستخدام الحساب التلقائي");
      return;
    }
    setAutoCalcLoading(true);
    try {
      const res = await fetch("/api/staff-compensations/auto-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId || undefined,
          userId: form.userId || undefined,
          month: Number(form.month),
          year: Number(form.year),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل الحساب التلقائي");
      }
      setForm((f) => ({
        ...f,
        workHours: String(data.workHours ?? 0),
        hourRate: String(data.hourRate ?? f.hourRate),
        baseAmount: String(data.baseAmount ?? 0),
        personName: data.personName || f.personName,
        personPosition: data.personPosition || f.personPosition,
        employeeId: data.employeeId || f.employeeId,
        userId: data.userId || f.userId,
      }));
      if (data.workHours > 0) {
        toast.success(`تم الحساب: ${data.workHours} ساعة — ${formatCurrency(data.baseAmount)}${data.guardSessions ? ` (${data.guardSessions} جلسة حراسة)` : ""}`);
      } else if (data.message) {
        toast.info(data.message);
      } else {
        toast.info("لا توجد ساعات عمل مسجلة لهذه الفترة");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحساب التلقائي");
    } finally {
      setAutoCalcLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.personName.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    if (!form.month || !form.year) {
      toast.error("الشهر والسنة مطلوبان");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employeeId: form.employeeId || null,
        userId: form.userId || null,
        personName: form.personName.trim(),
        personPosition: form.personPosition,
        month: Number(form.month),
        year: Number(form.year),
        workHours: workHoursNum,
        hourRate: hourRateNum,
        baseAmount: liveBaseAmount,
        overtimeHours: parseFloat(form.overtimeHours) || 0,
        overtimeAmount: overtimeAmountNum,
        bonusAmount: bonusAmountNum,
        deductions: deductionsNum,
        paymentStatus: form.paymentStatus,
        paymentDate: form.paymentStatus === "paid" && form.paymentDate ? form.paymentDate : null,
        paymentMethod: form.paymentStatus === "paid" ? form.paymentMethod : null,
        compensationType: form.compensationType,
        note: form.note.trim() || null,
      };

      const url = editingRecord
        ? `/api/staff-compensations/${editingRecord.id}`
        : "/api/staff-compensations";
      const method = editingRecord ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل الحفظ");
      }
      toast.success(editingRecord ? "تم تحديث التعويض بنجاح" : "تم إنشاء التعويض بنجاح");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92dvh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Banknote className="h-5 w-5 text-teal-600" />
            {editingRecord ? "تعديل التعويض المالي" : "إضافة تعويض مالي جديد"}
          </DialogTitle>
          <DialogDescription>
            {editingRecord
              ? `تعديل تعويض ${editingRecord.personName} — ${editingRecord.periodLabel || ""}`
              : "أدخل بيانات التعويض المالي للعامل أو الحارس"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          {/* القسم 1: الشخص */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-semibold">الشخص</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">اختر عاملاً من القائمة</Label>
                <Select
                  value={form.employeeId || "__manual__"}
                  onValueChange={handleEmployeeChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— إدخال يدوي —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">— إدخال يدوي —</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} — {getPositionLabel(emp.position)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الاسم الكامل *</Label>
                <Input
                  value={form.personName}
                  onChange={(e) => update("personName", e.target.value)}
                  placeholder="مثال: أحمد بن علي"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الوظيفة</Label>
                <Select
                  value={form.personPosition}
                  onValueChange={(v) => update("personPosition", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(POSITION_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نوع التعويض</Label>
                <Select
                  value={form.compensationType}
                  onValueChange={(v) => update("compensationType", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPENSATION_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          {/* القسم 2: الفترة */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-semibold">الفترة</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">الشهر</Label>
                <Select
                  value={String(form.month)}
                  onValueChange={(v) => update("month", Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES_AR.map((name, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">السنة</Label>
                <Select
                  value={String(form.year)}
                  onValueChange={(v) => update("year", Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateYearOptions().map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          {/* القسم 3: ساعات العمل */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-600" />
                <h3 className="text-sm font-semibold">ساعات العمل والأجر</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoCalc}
                disabled={autoCalcLoading}
                className="gap-1.5 border-teal-500/40 text-teal-700 hover:bg-teal-500/10 dark:text-teal-300"
              >
                {autoCalcLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Calculator className="h-3.5 w-3.5" />
                )}
                حساب تلقائي من Pointage
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">ساعات العمل</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.workHours}
                  onChange={(e) => update("workHours", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الأجر / الساعة (دج)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.hourRate}
                  onChange={(e) => update("hourRate", e.target.value)}
                  placeholder="200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">التعويض الأساسي (دج)</Label>
                <div className="flex h-9 items-center rounded-md border bg-teal-500/5 px-3 font-semibold tabular-nums text-teal-700 dark:text-teal-300">
                  {formatCurrency(liveBaseAmount)}
                </div>
                <p className="text-[10px] text-muted-foreground">= ساعات × أجر/ساعة</p>
              </div>
            </div>
          </section>

          <Separator />

          {/* القسم 4: الإضافات والخصومات */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold">الإضافات والخصومات</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ساعات إضافية</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.overtimeHours}
                  onChange={(e) => update("overtimeHours", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">مبلغ الإضافي (دج)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.overtimeAmount}
                  onChange={(e) => update("overtimeAmount", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">مكافأة (دج)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.bonusAmount}
                  onChange={(e) => update("bonusAmount", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">خصومات (دج)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.deductions}
                  onChange={(e) => update("deductions", e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* المبلغ الإجمالي */}
          <div className="flex items-center justify-between rounded-xl border-2 border-teal-500/30 bg-gradient-to-l from-teal-500/10 to-cyan-500/5 p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-teal-600" />
              <span className="text-sm font-semibold">المبلغ الإجمالي</span>
            </div>
            <span className="text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          <Separator />

          {/* القسم 5: حالة الدفع */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-semibold">حالة الدفع</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">حالة الدفع</Label>
                <Select
                  value={form.paymentStatus}
                  onValueChange={(v) => update("paymentStatus", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.paymentStatus === "paid" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">تاريخ الدفع</Label>
                    <Input
                      type="date"
                      value={form.paymentDate}
                      onChange={(e) => update("paymentDate", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">طريقة الدفع</Label>
                    <Select
                      value={form.paymentMethod}
                      onValueChange={(v) => update("paymentMethod", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </section>

          <Separator />

          {/* القسم 6: ملاحظات */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-semibold">ملاحظات</h3>
            </div>
            <Textarea
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
              placeholder="ملاحظات إضافية حول هذا التعويض..."
              rows={3}
            />
          </section>
        </div>

        <DialogFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-teal-600 hover:bg-teal-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {editingRecord ? "حفظ التعديلات" : "إنشاء التعويض"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function generateYearOptions(): number[] {
  const current = new Date().getFullYear();
  return [current - 2, current - 1, current, current + 1, current + 2];
}

// ═══════════════════════════════════════════════════════════
// لوحة التفاصيل الجانبية
// ═══════════════════════════════════════════════════════════

interface DetailSheetProps {
  record: StaffCompensation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (record: StaffCompensation) => void;
  onPrint: (record: StaffCompensation) => void;
}

function DetailSheet({ record, open, onOpenChange, onEdit, onPrint }: DetailSheetProps) {
  if (!record) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="border-b bg-gradient-to-l from-teal-500/10 to-cyan-500/5 px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15">
              <Banknote className="h-5 w-5 text-teal-600" />
            </div>
            <span>تفاصيل التعويض</span>
          </SheetTitle>
          <SheetDescription>
            {record.periodLabel || `${MONTH_NAMES_AR[record.month - 1]} ${record.year}`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-5">
          {/* معلومات الشخص */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              معلومات الشخص
            </h4>
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-500/15 text-base font-bold text-teal-700 dark:text-teal-300">
                  {record.personName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{record.personName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("gap-1", getPositionColor(record.personPosition))}>
                      <Briefcase className="h-3 w-3" />
                      {getPositionLabel(record.personPosition)}
                    </Badge>
                    {record.employee?.phone && (
                      <Badge variant="outline" className="gap-1">
                        <Phone className="h-3 w-3" />
                        {record.employee.phone}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* تفاصيل العمل */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              تفاصيل العمل والأجر
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <DetailItem icon={Clock} label="ساعات العمل" value={`${formatNumber(record.workHours)} ساعة`} />
              <DetailItem icon={Hash} label="الأجر/الساعة" value={formatCurrency(record.hourRate)} />
              <DetailItem icon={Wallet} label="التعويض الأساسي" value={formatCurrency(record.baseAmount)} />
              <DetailItem icon={Clock} label="ساعات إضافية" value={`${formatNumber(record.overtimeHours)} ساعة`} />
              <DetailItem icon={TrendingUp} label="مبلغ الإضافي" value={formatCurrency(record.overtimeAmount)} />
              <DetailItem icon={TrendingUp} label="مكافأة" value={formatCurrency(record.bonusAmount)} />
              <DetailItem icon={TrendingDown} label="خصومات" value={formatCurrency(record.deductions)} />
              <DetailItem icon={Calendar} label="الفترة" value={record.periodLabel || `${MONTH_NAMES_AR[record.month - 1]} ${record.year}`} />
            </div>
          </section>

          {/* المبلغ الإجمالي */}
          <div className="flex items-center justify-between rounded-xl border-2 border-teal-500/30 bg-gradient-to-l from-teal-500/10 to-cyan-500/5 p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-teal-600" />
              <span className="text-sm font-semibold">المبلغ الإجمالي</span>
            </div>
            <span className="text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
              {formatCurrency(record.totalAmount)}
            </span>
          </div>

          {/* حالة الدفع */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              حالة الدفع
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">الحالة</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", PAYMENT_STATUS_DOT[record.paymentStatus])} />
                  <Badge variant="outline" className={PAYMENT_STATUS_COLORS[record.paymentStatus]}>
                    {PAYMENT_STATUS_LABELS[record.paymentStatus] || record.paymentStatus}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">تاريخ الدفع</p>
                <p className="mt-1 text-sm font-medium">{formatDate(record.paymentDate)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">طريقة الدفع</p>
                <p className="mt-1 text-sm font-medium">
                  {record.paymentMethod ? PAYMENT_METHOD_LABELS[record.paymentMethod] || record.paymentMethod : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">نوع التعويض</p>
                <Badge variant="outline" className={cn("mt-1", COMPENSATION_TYPE_COLORS[record.compensationType])}>
                  {COMPENSATION_TYPE_LABELS[record.compensationType] || record.compensationType}
                </Badge>
              </div>
            </div>
          </section>

          {/* ملاحظات */}
          {record.note && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ملاحظات
              </h4>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                {record.note}
              </div>
            </section>
          )}

          {/* الطوابع الزمنية */}
          <section className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            <p>أُنشئ في: {formatDateTime(record.createdAt)}</p>
            <p>آخر تحديث: {formatDateTime(record.updatedAt)}</p>
          </section>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => onPrint(record)}
          >
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
          {/* ★ إخفاء زر التعديل للمحاسب (canManage=false → onEdit=undefined) */}
          {onEdit && (
            <Button
              className="gap-2 bg-teal-600 hover:bg-teal-700"
              onClick={() => onEdit(record)}
            >
              <Pencil className="h-4 w-4" />
              تعديل
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ═══════════════════════════════════════════════════════════

export function StaffCompensationsPanel({ canManage = true }: { canManage?: boolean }) {
  // ── الحالة ──
  const [records, setRecords] = useState<StaffCompensation[]>([]);
  const [stats, setStats] = useState<CompStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // الفترة
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // البحث والفلاتر
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // الترقيم والترتيب
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // التحديد الجماعي
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // النوافذ المنبثقة
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StaffCompensation | null>(null);
  const [detailRecord, setDetailRecord] = useState<StaffCompensation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffCompensation | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchIdRef = useRef(0);

  // ── تحميل البيانات ──
  const fetchData = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
      params.set("month", monthStr);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterPosition !== "all") params.set("personPosition", filterPosition);
      if (filterStatus !== "all") params.set("paymentStatus", filterStatus);
      if (filterType !== "all") params.set("compensationType", filterType);

      const res = await fetch(`/api/staff-compensations?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (fetchId !== fetchIdRef.current) return;
      if (!res.ok) throw new Error(data.error || "فشل التحميل");
      setRecords(data.compensations || []);
      setStats(data.stats || null);
    } catch (e) {
      if (fetchId !== fetchIdRef.current) return;
      setError(true);
      toast.error(e instanceof Error ? e.message : "تعذّر تحميل البيانات");
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [selectedMonth, selectedYear, debouncedSearch, filterPosition, filterStatus, filterType]);

  // تحميل الموظفين (مرة واحدة)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/employees", { cache: "no-store" });
        const data = await res.json();
        if (active && res.ok) {
          setEmployees(data.employees || []);
        }
      } catch {
        /* الموظفون اختياريون — الإدخال اليدوي متاح */
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // إعادة تعيين الصفحة عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterPosition, filterStatus, filterType, selectedMonth, selectedYear]);

  // ── الترتيب والترقيم (client-side) ──
  const sortedRecords = useMemo(() => {
    const arr = [...records];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "totalAmount":
          cmp = a.totalAmount - b.totalAmount;
          break;
        case "baseAmount":
          cmp = a.baseAmount - b.baseAmount;
          break;
        case "workHours":
          cmp = a.workHours - b.workHours;
          break;
        case "personName":
          cmp = a.personName.localeCompare(b.personName, "ar");
          break;
        case "date":
        default: {
          const da = new Date(a.createdAt).getTime();
          const db = new Date(b.createdAt).getTime();
          cmp = da - db;
          break;
        }
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [records, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, safePage, pageSize]);

  // ── التنقل بين الأشهر ──
  const shiftMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const goToCurrentMonth = () => {
    const t = new Date();
    setSelectedMonth(t.getMonth() + 1);
    setSelectedYear(t.getFullYear());
  };

  // ── التحديد الجماعي ──
  const allOnPageSelected = paginatedRecords.length > 0 && paginatedRecords.every((r) => selectedIds.has(r.id));
  const someOnPageSelected = paginatedRecords.some((r) => selectedIds.has(r.id));

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        paginatedRecords.forEach((r) => next.add(r.id));
      } else {
        paginatedRecords.forEach((r) => next.delete(r.id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAllRecords = () => {
    setSelectedIds(new Set(sortedRecords.map((r) => r.id)));
    toast.success(`تم تحديد ${sortedRecords.length} تعويض`);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedRecords = useMemo(
    () => sortedRecords.filter((r) => selectedIds.has(r.id)),
    [sortedRecords, selectedIds]
  );

  // ── الإجراءات ──
  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (record: StaffCompensation) => {
    setEditingRecord(record);
    setDetailOpen(false);
    setFormOpen(true);
  };

  const handleOpenDetail = (record: StaffCompensation) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    setBulkActionLoading(true);
    try {
      const res = await fetch(`/api/staff-compensations/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل الحذف");
      }
      toast.success("تمت أرشفة التعويض — السجل محفوظ في الأرشيف");
      setDeleteTarget(null);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkActionLoading(true);
    let success = 0;
    let failed = 0;
    await Promise.all(
      Array.from(selectedIds).map(async (id) => {
        try {
          const res = await fetch(`/api/staff-compensations/${id}`, { method: "DELETE" });
          if (res.ok) success++;
          else failed++;
        } catch {
          failed++;
        }
      })
    );
    setBulkActionLoading(false);
    setBulkDeleteOpen(false);
    clearSelection();
    fetchData();
    if (success > 0) toast.success(`تمت أرشفة ${success} تعويض — السجلات محفوظة`);
    if (failed > 0) toast.error(`فشل أرشفة ${failed} تعويض`);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    setBulkActionLoading(true);
    let success = 0;
    let failed = 0;
    await Promise.all(
      Array.from(selectedIds).map(async (id) => {
        try {
          const payload: Record<string, unknown> = { paymentStatus: newStatus };
          if (newStatus === "paid") {
            payload.paymentDate = new Date().toISOString().slice(0, 10);
          }
          const res = await fetch(`/api/staff-compensations/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) success++;
          else failed++;
        } catch {
          failed++;
        }
      })
    );
    setBulkActionLoading(false);
    fetchData();
    if (success > 0) toast.success(`تم تحديث حالة ${success} تعويض إلى «${PAYMENT_STATUS_LABELS[newStatus]}»`);
    if (failed > 0) toast.error(`فشل تحديث ${failed} تعويض`);
  };

  const handleRowStatusChange = async (record: StaffCompensation, newStatus: string) => {
    try {
      const payload: Record<string, unknown> = { paymentStatus: newStatus };
      if (newStatus === "paid" && !record.paymentDate) {
        payload.paymentDate = new Date().toISOString().slice(0, 10);
        payload.paymentMethod = record.paymentMethod || "cash";
      }
      const res = await fetch(`/api/staff-compensations/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل التحديث");
      }
      toast.success(`تم تغيير الحالة إلى «${PAYMENT_STATUS_LABELS[newStatus]}»`);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    }
  };

  // ── التصدير ──
  const buildExportRows = (list: StaffCompensation[]) =>
    list.map((r, i) => ({
      "#": i + 1,
      "الاسم الكامل": r.personName,
      "الوظيفة": getPositionLabel(r.personPosition),
      "الفترة": r.periodLabel || `${MONTH_NAMES_AR[r.month - 1]} ${r.year}`,
      "ساعات العمل": r.workHours,
      "الأجر/الساعة": r.hourRate,
      "التعويض الأساسي": r.baseAmount,
      "مبلغ الإضافي": r.overtimeAmount,
      "المكافأة": r.bonusAmount,
      "الخصومات": r.deductions,
      "المبلغ الإجمالي": r.totalAmount,
      "حالة الدفع": PAYMENT_STATUS_LABELS[r.paymentStatus] || r.paymentStatus,
      "تاريخ الدفع": formatDate(r.paymentDate),
      "طريقة الدفع": r.paymentMethod ? PAYMENT_METHOD_LABELS[r.paymentMethod] || r.paymentMethod : "",
      "نوع التعويض": COMPENSATION_TYPE_LABELS[r.compensationType] || r.compensationType,
      "ملاحظات": r.note || "",
    }));

  const handleExportExcel = (list: StaffCompensation[]) => {
    if (list.length === 0) { toast.error("لا توجد بيانات للتصدير"); return; }
    try {
      const rows = buildExportRows(list);
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "التعويضات");
      XLSX.writeFile(wb, `التعويضات_${selectedMonth}_${selectedYear}.xlsx`);
      toast.success("تم تصدير ملف Excel");
    } catch (e) {
      toast.error("فشل تصدير Excel");
    }
  };

  const handleExportCSV = (list: StaffCompensation[]) => {
    if (list.length === 0) { toast.error("لا توجد بيانات للتصدير"); return; }
    try {
      const rows = buildExportRows(list);
      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(","),
        ...rows.map((r) =>
          headers.map((h) => {
            const val = String(r[h as keyof typeof r] ?? "");
            return `"${val.replace(/"/g, '""')}"`;
          }).join(",")
        ),
      ];
      const csv = "\uFEFF" + csvLines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `التعويضات_${selectedMonth}_${selectedYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير ملف CSV");
    } catch (e) {
      toast.error("فشل تصدير CSV");
    }
  };

  const handleExportWord = (list: StaffCompensation[]) => {
    if (list.length === 0) { toast.error("لا توجد بيانات للتصدير"); return; }
    try {
      const rows = buildExportRows(list);
      const headers = Object.keys(rows[0]);
      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>كشف التعويضات</title>
        <style>
          body { font-family: "Traditional Arabic", "Arial", sans-serif; direction: rtl; padding: 20px; }
          h1 { color: #0d9488; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #999; padding: 6px 8px; font-size: 12px; text-align: right; }
          th { background: #0d9488; color: white; }
          tr:nth-child(even) { background: #f0fdfa; }
        </style></head>
        <body>
          <h1>كشف التعويضات المالية — ${MONTH_NAMES_AR[selectedMonth - 1]} ${selectedYear}</h1>
          <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h as keyof typeof r] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>
        </body></html>`;
      const blob = new Blob(["\uFEFF", html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `التعويضات_${selectedMonth}_${selectedYear}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير ملف Word");
    } catch (e) {
      toast.error("فشل تصدير Word");
    }
  };

  // ── الطباعة ──
  const handlePrint = (list: StaffCompensation[]) => {
    if (list.length === 0) { toast.error("لا توجد بيانات للطباعة"); return; }
    const rows = buildExportRows(list);
    const headers = Object.keys(rows[0]);
    const totalSum = list.reduce((s, r) => s + r.totalAmount, 0);
    const paidSum = list.filter((r) => r.paymentStatus === "paid").reduce((s, r) => s + r.totalAmount, 0);
    const unpaidSum = list.filter((r) => r.paymentStatus === "unpaid").reduce((s, r) => s + r.totalAmount, 0);

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>كشف التعويضات — ${MONTH_NAMES_AR[selectedMonth - 1]} ${selectedYear}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Arial", "Traditional Arabic", sans-serif; direction: rtl; color: #1f2937; margin: 0; padding: 16px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0d9488; padding-bottom: 12px; margin-bottom: 16px; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-box { width: 48px; height: 48px; border-radius: 10px; background: linear-gradient(135deg, #0d9488, #06b6d4); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; }
  .logo-text h1 { margin: 0; font-size: 18px; color: #0d9488; }
  .logo-text p { margin: 2px 0 0; font-size: 11px; color: #6b7280; }
  .doc-title { text-align: center; margin: 12px 0; }
  .doc-title h2 { margin: 0; font-size: 20px; color: #0f172a; }
  .doc-title p { margin: 4px 0 0; font-size: 13px; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
  thead th { background: #0d9488; color: white; padding: 7px 5px; border: 1px solid #0f766e; text-align: right; white-space: nowrap; }
  tbody td { padding: 5px; border: 1px solid #d1d5db; text-align: right; }
  tbody tr:nth-child(even) { background: #f0fdfa; }
  .summary { margin-top: 16px; display: flex; gap: 12px; justify-content: flex-start; }
  .summary-box { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 14px; min-width: 150px; }
  .summary-box .label { font-size: 10px; color: #6b7280; }
  .summary-box .value { font-size: 16px; font-weight: bold; color: #0d9488; margin-top: 2px; }
  .signatures { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
  .sig-block { flex: 1; text-align: center; }
  .sig-block .role { font-size: 12px; color: #6b7280; margin-bottom: 40px; border-bottom: 1px dashed #9ca3af; padding-bottom: 4px; }
  .sig-block .name { font-size: 12px; color: #374151; }
  .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  @media print { .no-print { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <div class="logo-box">AC</div>
      <div class="logo-text">
        <h1>AquaCore Club Manager</h1>
        <p>نظام إدارة النوادي الرياضية</p>
      </div>
    </div>
    <div style="text-align: left; font-size: 11px; color: #6b7280;">
      <p>تاريخ الإصدار: ${new Date().toLocaleDateString("fr-DZ")}</p>
      <p>عدد السجلات: ${list.length}</p>
    </div>
  </div>

  <div class="doc-title">
    <h2>كشف التعويضات المالية</h2>
    <p>الفترة: ${MONTH_NAMES_AR[selectedMonth - 1]} ${selectedYear}</p>
  </div>

  <table>
    <thead>
      <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h as keyof typeof r] ?? ""}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>

  <div class="summary">
    <div class="summary-box"><div class="label">إجمالي المبالغ</div><div class="value">${totalSum.toLocaleString("en-US")} دج</div></div>
    <div class="summary-box"><div class="label">المدفوع</div><div class="value">${paidSum.toLocaleString("en-US")} دج</div></div>
    <div class="summary-box"><div class="label">غير المدفوع</div><div class="value">${unpaidSum.toLocaleString("en-US")} دج</div></div>
  </div>

  <div class="signatures">
    <div class="sig-block"><div class="role">إعداد المحاسب</div><div class="name">التوقيع والختم</div></div>
    <div class="sig-block"><div class="role">مراجعة المدير</div><div class="name">التوقيع والختم</div></div>
    <div class="sig-block"><div class="role">اعتماد الرئيس</div><div class="name">التوقيع والختم</div></div>
  </div>

  <div class="footer">AquaCore Club Manager — وثيقة رسمية ${new Date().toLocaleString("fr-DZ")}</div>

  <div class="no-print" style="text-align:center; margin-top: 20px;">
    <button onclick="window.print()" style="background:#0d9488;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;">طباعة</button>
  </div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) { toast.error("يرجى السماح بالنوافذ المنبثقة للطباعة"); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* user can print manually */ } }, 400);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const hasActiveFilters = debouncedSearch !== "" || filterPosition !== "all" || filterStatus !== "all" || filterType !== "all";

  const clearFilters = () => {
    setSearchInput("");
    setFilterPosition("all");
    setFilterStatus("all");
    setFilterType("all");
  };

  // ── العرض ──
  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-5">
        {/* الرأس */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-sm">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">التعويضات المالية</h2>
              <p className="text-sm text-muted-foreground">إدارة ومتابعة تعويضات العاملين والحراس والموظفين</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* ★ المحاسب المالي لا يمكنه إضافة/تعديل (canManage=false) */}
            {canManage && (
              <Button onClick={handleOpenAdd} className="gap-2 bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4" />
                إضافة تعويض
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  تصدير
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>تصدير التعويضات</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExportExcel(sortedRecords)} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Excel (xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCSV(sortedRecords)} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-sky-600" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportWord(sortedRecords)} className="gap-2 cursor-pointer">
                  <FileType className="h-4 w-4 text-blue-600" />
                  Word (doc)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handlePrint(sortedRecords)} className="gap-2 cursor-pointer">
                  <Printer className="h-4 w-4 text-rose-600" />
                  PDF (طباعة)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => handlePrint(sortedRecords)} className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة
            </Button>
          </div>
        </div>

        {/* بطاقات الإحصائيات */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              index={0}
              icon={ClipboardList}
              label="إجمالي التعويضات"
              value={stats.totalRecords}
              subText="كل الفترات"
              colorClass="border-teal-500/40"
              iconBg="bg-teal-500/15 text-teal-600 dark:text-teal-300"
            />
            <StatCard
              index={1}
              icon={Hash}
              label="عدد التعويضات"
              value={records.length}
              subText="للفترة الحالية"
              colorClass="border-cyan-500/40"
              iconBg="bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"
            />
            <StatCard
              index={2}
              icon={CheckCircle2}
              label="مدفوعة"
              value={stats.paidCount}
              subText={formatCurrency(stats.paidAmount)}
              colorClass="border-emerald-500/40"
              iconBg="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            />
            <StatCard
              index={3}
              icon={XCircle}
              label="غير مدفوعة"
              value={stats.unpaidCount}
              subText={formatCurrency(stats.unpaidAmount)}
              colorClass="border-rose-500/40"
              iconBg="bg-rose-500/15 text-rose-600 dark:text-rose-300"
            />
            <StatCard
              index={4}
              icon={Clock}
              label="قيد المعالجة"
              value={stats.processingCount}
              subText={formatCurrency(stats.processingAmount)}
              colorClass="border-amber-500/40"
              iconBg="bg-amber-500/15 text-amber-600 dark:text-amber-300"
            />
            <StatCard
              index={5}
              icon={Wallet}
              label="إجمالي المبالغ"
              value={formatCurrency(stats.totalAmount)}
              subText="مجموع كل الفترات"
              colorClass="border-violet-500/40"
              iconBg="bg-violet-500/15 text-violet-600 dark:text-violet-300"
            />
          </div>
        )}

        {/* محدد الفترة */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-semibold">الفترة:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)} className="gap-1">
                  <ChevronRight className="h-4 w-4" />
                  الشهر السابق
                </Button>
                <div className="flex items-center gap-2">
                  <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES_AR.map((name, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateYearOptions().map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => shiftMonth(1)} className="gap-1">
                  الشهر التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="sm" onClick={goToCurrentMonth} className="gap-1">
                  الشهر الحالي
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* البحث والفلاتر */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="ابحث عن العامل أو الحارس..."
                  className="pr-9"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="مسح البحث"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterPosition} onValueChange={setFilterPosition}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="الوظيفة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الوظائف</SelectItem>
                    {Object.entries(POSITION_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="حالة الدفع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="نوع التعويض" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    {Object.entries(COMPENSATION_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-rose-600 hover:bg-rose-500/10">
                    <X className="h-4 w-4" />
                    مسح الفلاتر
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* شريط الإجراءات الجماعية */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-teal-500/40 bg-teal-500/5">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    تم تحديد {selectedIds.size} تعويض
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllRecords} className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تحديد الكل
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrint(selectedRecords)} className="gap-1">
                      <Printer className="h-3.5 w-3.5" />
                      طباعة المحدد
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportExcel(selectedRecords)} className="gap-1">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      تصدير المحدد
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Banknote className="h-3.5 w-3.5" />
                          تغيير حالة المحدد
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("paid")} className="gap-2 cursor-pointer">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> مدفوع
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("unpaid")} className="gap-2 cursor-pointer">
                          <XCircle className="h-4 w-4 text-rose-600" /> غير مدفوع
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("processing")} className="gap-2 cursor-pointer">
                          <Clock className="h-4 w-4 text-amber-600" /> قيد المعالجة
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="gap-1">
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف المحدد
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      إلغاء
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* الجدول (سطح المكتب) */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="max-h-[70vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 bg-muted/95">
                        <Checkbox
                          checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                          onCheckedChange={(v) => toggleSelectAllOnPage(v === true)}
                          aria-label="تحديد الكل"
                        />
                      </TableHead>
                      <TableHead className="w-10 bg-muted/95">#</TableHead>
                      <TableHead className="bg-muted/95 min-w-32">
                        <SortButton label="الاسم الكامل" column="personName" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      </TableHead>
                      <TableHead className="bg-muted/95">الوظيفة</TableHead>
                      <TableHead className="bg-muted/95 min-w-28">الفترة</TableHead>
                      <TableHead className="bg-muted/95 text-center">
                        <SortButton label="ساعات العمل" column="workHours" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      </TableHead>
                      <TableHead className="bg-muted/95 text-center">الأجر/الساعة</TableHead>
                      <TableHead className="bg-muted/95 text-center">
                        <SortButton label="الأساسي" column="baseAmount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      </TableHead>
                      <TableHead className="bg-muted/95 text-center">الإضافات</TableHead>
                      <TableHead className="bg-muted/95 text-center">الخصومات</TableHead>
                      <TableHead className="bg-muted/95 text-center">
                        <SortButton label="المبلغ الإجمالي" column="totalAmount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      </TableHead>
                      <TableHead className="bg-muted/95 text-center">حالة الدفع</TableHead>
                      <TableHead className="bg-muted/95 min-w-28">تاريخ الدفع</TableHead>
                      <TableHead className="bg-muted/95 text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell colSpan={14}><Skeleton className="h-8 w-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : error ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <AlertTriangle className="h-10 w-10 text-rose-500" />
                            <p className="text-sm text-muted-foreground">تعذّر تحميل البيانات</p>
                            <Button variant="outline" size="sm" onClick={fetchData} className="gap-1">
                              <RefreshCw className="h-4 w-4" />
                              إعادة المحاولة
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-16 text-center">
                          <EmptyState onAdd={handleOpenAdd} />
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRecords.map((r, idx) => {
                        const isSelected = selectedIds.has(r.id);
                        const rowIndex = (safePage - 1) * pageSize + idx + 1;
                        const additions = r.overtimeAmount + r.bonusAmount;
                        return (
                          <motion.tr
                            key={r.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: idx * 0.02 }}
                            className={cn(
                              "group cursor-pointer border-b transition-colors hover:bg-teal-500/5",
                              isSelected && "bg-teal-500/10"
                            )}
                            onClick={() => handleOpenDetail(r)}
                          >
                            <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(v) => toggleSelectOne(r.id, v === true)}
                                aria-label={`تحديد ${r.personName}`}
                              />
                            </TableCell>
                            <TableCell className="w-10 text-xs text-muted-foreground tabular-nums">{rowIndex}</TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-xs font-bold text-teal-700 dark:text-teal-300">
                                  {r.personName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate">{r.personName}</p>
                                  {r.employee?.phone && (
                                    <p className="text-[10px] text-muted-foreground">{r.employee.phone}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("gap-1", getPositionColor(r.personPosition))}>
                                {getPositionLabel(r.personPosition)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {r.periodLabel || `${MONTH_NAMES_AR[r.month - 1]} ${r.year}`}
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-sm">{formatNumber(r.workHours)}</TableCell>
                            <TableCell className="text-center tabular-nums text-sm">{formatCurrency(r.hourRate)}</TableCell>
                            <TableCell className="text-center tabular-nums text-sm">{formatCurrency(r.baseAmount)}</TableCell>
                            <TableCell className="text-center tabular-nums text-sm text-emerald-600 dark:text-emerald-400">
                              {additions > 0 ? `+${formatCurrency(additions)}` : "—"}
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-sm text-rose-600 dark:text-rose-400">
                              {r.deductions > 0 ? `-${formatCurrency(r.deductions)}` : "—"}
                            </TableCell>
                            <TableCell className="text-center font-bold tabular-nums whitespace-nowrap">
                              {formatCurrency(r.totalAmount)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={cn("gap-1", PAYMENT_STATUS_COLORS[r.paymentStatus])}>
                                <span className={cn("h-1.5 w-1.5 rounded-full", PAYMENT_STATUS_DOT[r.paymentStatus])} />
                                {PAYMENT_STATUS_LABELS[r.paymentStatus] || r.paymentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(r.paymentDate)}</TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDetail(r)}>
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>عرض</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(r)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>تعديل</TooltipContent>
                                </Tooltip>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <Banknote className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    <DropdownMenuLabel>تغيير حالة الدفع</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleRowStatusChange(r, "paid")} className="gap-2 cursor-pointer">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> مدفوع
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRowStatusChange(r, "unpaid")} className="gap-2 cursor-pointer">
                                      <XCircle className="h-4 w-4 text-rose-600" /> غير مدفوع
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRowStatusChange(r, "processing")} className="gap-2 cursor-pointer">
                                      <Clock className="h-4 w-4 text-amber-600" /> قيد المعالجة
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handlePrint([r])} className="gap-2 cursor-pointer">
                                      <Printer className="h-4 w-4" /> طباعة
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint([r])}>
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>طباعة</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700" onClick={() => setDeleteTarget(r)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>حذف</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* ترقيم الصفحات */}
            {!loading && !error && paginatedRecords.length > 0 && (
              <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>عرض</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-7 w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>من أصل {sortedRecords.length} سجل</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="gap-1">
                    <ChevronRight className="h-4 w-4" />
                    السابق
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i + 1;
                      } else if (safePage <= 4) {
                        page = i + 1;
                      } else if (safePage >= totalPages - 3) {
                        page = totalPages - 6 + i;
                      } else {
                        page = safePage - 3 + i;
                      }
                      return (
                        <Button
                          key={page}
                          variant={page === safePage ? "default" : "outline"}
                          size="sm"
                          className={cn("h-8 w-8 p-0", page === safePage && "bg-teal-600 hover:bg-teal-700")}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="gap-1">
                    التالي
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* عرض البطاقات (الجوال) */}
        <div className="md:hidden">
          {loading ? (
            <div className="grid grid-cols-1 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={`msk-${i}`}>
                  <CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <AlertTriangle className="h-10 w-10 text-rose-500" />
                <p className="text-sm text-muted-foreground">تعذّر تحميل البيانات</p>
                <Button variant="outline" size="sm" onClick={fetchData} className="gap-1">
                  <RefreshCw className="h-4 w-4" />
                  إعادة المحاولة
                </Button>
              </CardContent>
            </Card>
          ) : paginatedRecords.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <EmptyState onAdd={handleOpenAdd} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {paginatedRecords.map((r, idx) => {
                const isSelected = selectedIds.has(r.id);
                const additions = r.overtimeAmount + r.bonusAmount;
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                  >
                    <Card className={cn("overflow-hidden", isSelected && "border-teal-500 bg-teal-500/5")}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) => toggleSelectOne(r.id, v === true)}
                            className="mt-1"
                          />
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/10 font-bold text-teal-700 dark:text-teal-300">
                            {r.personName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold truncate" onClick={() => handleOpenDetail(r)}>{r.personName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {r.periodLabel || `${MONTH_NAMES_AR[r.month - 1]} ${r.year}`}
                                </p>
                              </div>
                              <Badge variant="outline" className={cn("shrink-0 gap-1", PAYMENT_STATUS_COLORS[r.paymentStatus])}>
                                <span className={cn("h-1.5 w-1.5 rounded-full", PAYMENT_STATUS_DOT[r.paymentStatus])} />
                                {PAYMENT_STATUS_LABELS[r.paymentStatus] || r.paymentStatus}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={getPositionColor(r.personPosition)}>
                                {getPositionLabel(r.personPosition)}
                              </Badge>
                              <Badge variant="outline" className={COMPENSATION_TYPE_COLORS[r.compensationType]}>
                                {COMPENSATION_TYPE_LABELS[r.compensationType] || r.compensationType}
                              </Badge>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">ساعات</p>
                                <p className="font-semibold tabular-nums">{formatNumber(r.workHours)} س</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">إضافات</p>
                                <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                  {additions > 0 ? formatCurrency(additions) : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">الإجمالي</p>
                                <p className="font-bold tabular-nums text-teal-700 dark:text-teal-300">
                                  {formatCurrency(r.totalAmount)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center gap-1">
                              <Button variant="outline" size="sm" className="h-8 flex-1 gap-1" onClick={() => handleOpenDetail(r)}>
                                <Eye className="h-3.5 w-3.5" />
                                عرض
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 flex-1 gap-1" onClick={() => handleOpenEdit(r)}>
                                <Pencil className="h-3.5 w-3.5" />
                                تعديل
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 flex-1 gap-1" onClick={() => handlePrint([r])}>
                                <Printer className="h-3.5 w-3.5" />
                                طباعة
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => setDeleteTarget(r)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
              {/* ترقيم صفحات مبسط للجوال */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 px-1">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="gap-1">
                    <ChevronRight className="h-4 w-4" />
                    السابق
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    صفحة {safePage} من {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="gap-1">
                    التالي
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* نافذة النموذج */}
        <CompensationFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          editingRecord={editingRecord}
          employees={employees}
          defaultMonth={selectedMonth}
          defaultYear={selectedYear}
          onSaved={fetchData}
        />

        {/* لوحة التفاصيل */}
        <DetailSheet
          record={detailRecord}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onEdit={canManage ? handleOpenEdit : undefined}
          onPrint={(r) => handlePrint([r])}
        />

        {/* تأكيد حذف فردي */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                تأكيد الأرشفة
              </AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من أرشفة تعويض <span className="font-semibold text-foreground">{deleteTarget?.personName}</span> للفترة {deleteTarget?.periodLabel}؟ سيُخفى السجل من القوائم والإحصاءات لكنه يبقى محفوظاً في قاعدة البيانات للتاريخ والتدقيق، وتُلغى أي قيود مالية مرتبطة به (الإجراء قابل للمراجعة من سجل التدقيق).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkActionLoading}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDeleteSingle(); }}
                disabled={bulkActionLoading}
                className="bg-rose-600 hover:bg-rose-700"
              >
                {bulkActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                أرشفة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* تأكيد حذف جماعي */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                حذف {selectedIds.size} تعويض
              </AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف جميع التعويضات المحددة ({selectedIds.size} سجل). لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkActionLoading}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
                disabled={bulkActionLoading}
                className="bg-rose-600 hover:bg-rose-700"
              >
                {bulkActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                حذف الكل
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

// ═══════════════════════════════════════════════════════════
// مكوّنات مساعدة صغيرة
// ═══════════════════════════════════════════════════════════

function SortButton({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (col: SortColumn) => void;
}) {
  const active = sortColumn === column;
  return (
    <button
      onClick={() => onSort(column)}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
      {active ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3 w-3 text-teal-600" />
        ) : (
          <ArrowDown className="h-3 w-3 text-teal-600" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10">
        <Receipt className="h-8 w-8 text-teal-600" />
      </div>
      <div>
        <p className="font-medium">لا توجد تعويضات لهذه الفترة</p>
        <p className="text-sm text-muted-foreground">ابدأ بإضافة تعويض مالي جديد للعاملين</p>
      </div>
      <Button onClick={onAdd} className="gap-2 bg-teal-600 hover:bg-teal-700">
        <Plus className="h-4 w-4" />
        إضافة تعويض
      </Button>
    </div>
  );
}

export default StaffCompensationsPanel;
