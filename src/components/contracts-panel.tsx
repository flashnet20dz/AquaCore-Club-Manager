"use client";

/**
 * عقود العمال — لوحة مؤسسية
 * ═══════════════════════════════════════════════════════════════
 * تبويبات: قائمة العمال / أرشيف العقود / قوالب العقود / إنشاء عقد
 * - بطاقات إحصائية أعلى الصفحة (نفس أسلوب StatCard في work-hours-management)
 * - جدول عقود احترافي (بحث + فلتر حالة + تمرير + نسخة بطاقات للموبايل)
 * - مستند عقد رسمي A4 (ترويسة موحدة + أقسام مرقمة + تواقيع + @media print)
 * - زر التصدير الموحّد ExportButton (Excel/CSV/PDF/طباعة)
 * ملاحظة: لا تغيير على أي API أو Model أو منطق حفظ — تحسين عرض فقط.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Briefcase, FileText, Plus, Edit2, Trash2, Printer, Download,
  Loader2, RefreshCw, Archive, Eye, X, FilePlus, UserPlus,
  Calendar, DollarSign, Layers, Search, Users, BadgeCheck,
  AlertTriangle, FileSignature,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { unifiedReportHeaderHTML } from "@/components/unified-report-header";
import type { EnteteConfig } from "@/components/unified-report-header";
import { AVAILABLE_VARIABLES, substituteVariables } from "@/lib/contract-variables";
import { ExportButton } from "@/components/shared/export-button";

// ──────────────── Types ────────────────
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  birthPlace: string | null;
  address: string | null;
  phone: string | null;
  nationalId: string | null;
  position: string;
  hourRate: number;
  hireDate: string;
  active: boolean;
  user?: { id: string; name: string; email: string } | null;
  contracts?: Contract[];
}

interface Contract {
  id: string;
  contractNumber: string;
  position: string;
  startDate: string;
  endDate: string | null;
  hourRate: number;
  monthlySalary?: number | null;
  workSchedule: string | null;
  content: string;
  status: string;
  version: number;
  notes: string | null;
  createdAt: string;
  employee?: Employee;
  template?: { id: string; name: string; code: string } | null;
}

interface Template {
  id: string;
  name: string;
  code: string;
  description: string | null;
  content: string;
  defaultDuration: number;
  active: boolean;
}

// ──────────────── Constants & Helpers ────────────────
const POSITIONS = [
  { value: "guard", label: "حارس سباحة" },
  { value: "coach", label: "مدرب" },
  { value: "admin", label: "إداري" },
  { value: "maintenance", label: "عامل صيانة" },
  { value: "cleaner", label: "منظفة" },
  { value: "seasonal", label: "موسمي" },
  { value: "other", label: "أخرى" },
];

function positionLabel(code: string): string {
  return POSITIONS.find((p) => p.value === code)?.label || code;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function todayYMD(): string {
  return new Date().toISOString().split("T")[0];
}

/** الأيام المتبقية حتى تاريخ ما (سالب = مضى) */
function daysUntil(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** عقد نشط ينتهي خلال 30 يوماً أو أقل */
function isExpiringSoon(c: Contract): boolean {
  const d = daysUntil(c.endDate);
  return d !== null && d >= 0 && d <= 30;
}

/** مدة العقد بالأيام (محسوبة من تاريخي البداية والنهاية) */
function contractDurationDays(c: Contract): number | null {
  const s = new Date(c.startDate);
  const e = c.endDate ? new Date(c.endDate) : null;
  if (isNaN(s.getTime()) || !e || isNaN(e.getTime())) return null;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000));
}

type ContractStatusKey = "active" | "expiring" | "expired" | "terminated" | "renewed";

const STATUS_UI: Record<ContractStatusKey, { label: string; badge: string }> = {
  active: { label: "نشط", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  expiring: { label: "ينتهي قريباً", badge: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  expired: { label: "منتهٍ", badge: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
  terminated: { label: "منهيّ", badge: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
  renewed: { label: "مجدّد", badge: "bg-teal-500/10 text-teal-700 border-teal-500/30" },
};

function contractStatusKey(c: Contract): ContractStatusKey {
  if (c.status === "active") return isExpiringSoon(c) ? "expiring" : "active";
  if (c.status === "expired") return "expired";
  if (c.status === "terminated") return "terminated";
  if (c.status === "renewed") return "renewed";
  return "expired";
}

function statusInfo(c: Contract): { key: ContractStatusKey; label: string; badge: string } {
  const key = contractStatusKey(c);
  return { key, ...STATUS_UI[key] };
}

function contractType(c: Contract): string {
  return c.template?.name || "عقد عمل";
}

/** الأجر المعروض: راتب شهري إن وُجد وإلا أجر الساعة */
function formatWage(c: Pick<Contract, "hourRate" | "monthlySalary">): string {
  if (c.monthlySalary && c.monthlySalary > 0) {
    return `${c.monthlySalary.toLocaleString("en-US")} دج / شهر`;
  }
  return `${(c.hourRate ?? 0).toLocaleString("en-US")} دج / ساعة`;
}

function escHTML(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ──────────────── مستند العقد الرسمي (A4) ────────────────
// يُبنى مرة واحدة كـ HTML خام ويُستخدم في: حوار العرض + الطباعة + Word
// حتى تكون المعاينة مطابقة تماماً للمطبوع. الحقول كلها من بيانات العقد الفعلية.

function docSectionHTML(no: string, title: string, bodyHTML: string): string {
  return `
  <div style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;break-inside:avoid;">
    <div style="background:#f0fdfa;color:#0f766e;font-weight:700;font-size:12.5px;padding:7px 12px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;">
      <span style="background:#0f766e;color:#fff;min-width:20px;height:20px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;">${no}</span>
      <span>${escHTML(title)}</span>
    </div>
    <div style="padding:10px 12px;font-size:12.5px;color:#1e293b;line-height:1.9;">${bodyHTML}</div>
  </div>`;
}

function docKVTableHTML(pairs: Array<[string, string | number | null | undefined]>): string {
  return `<table style="width:100%;border-collapse:collapse;">${pairs.map(([k, v]) => `
    <tr>
      <td style="padding:5px 8px;color:#64748b;font-size:11.5px;width:36%;border-bottom:1px dashed #e2e8f0;vertical-align:top;">${escHTML(k)}</td>
      <td style="padding:5px 8px;font-weight:600;font-size:12px;border-bottom:1px dashed #e2e8f0;color:#0f172a;">${v === null || v === undefined || v === "" ? "—" : v}</td>
    </tr>`).join("")}</table>`;
}

function docSignatureBlockHTML(): string {
  const slot = (label: string, hint: string) => `
    <div style="flex:1;text-align:center;">
      <p style="font-size:11.5px;font-weight:700;color:#334155;margin:0 0 42px;">${escHTML(label)}</p>
      <div style="border-top:1.5px dashed #94a3b8;width:85%;margin:0 auto;padding-top:5px;font-size:9.5px;color:#94a3b8;">${escHTML(hint)}</div>
    </div>`;
  return `
  <div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;break-inside:avoid;">
    <div style="background:#f0fdfa;color:#0f766e;font-weight:700;font-size:12.5px;padding:7px 12px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;">
      <span style="background:#0f766e;color:#fff;min-width:20px;height:20px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
      </span>
      <span>التواقيع</span>
    </div>
    <div style="display:flex;gap:10px;padding:16px 12px 12px;">
      ${slot("توقيع مسؤول النادي", "الاسم والتوقيع")}
      ${slot("توقيع العامل", "الاسم والتوقيع")}
      ${slot("التاريخ", "__.__ / __.__ / __.___")}
    </div>
  </div>
  <p style="margin-top:12px;text-align:center;font-size:9.5px;color:#94a3b8;">
    أُنشئ هذا العقد إلكترونياً عبر نظام إدارة النادي — جميع الحقول أعلاه معتمدة من بيانات العقد المحفوظة
  </p>`;
}

function contractDocumentBodyHTML(c: Contract): string {
  const emp = c.employee ?? null;
  const parts: Array<{ title: string; body: string }> = [];

  // 1 — بيانات العامل (من سجل العامل المرتبط بالعقد)
  if (emp) {
    parts.push({
      title: "بيانات العامل",
      body: docKVTableHTML([
        ["الاسم واللقب", escHTML(`${emp.lastName} ${emp.firstName}`.trim())],
        ["تاريخ الميلاد", emp.birthDate ? formatDate(emp.birthDate) : "—"],
        ["مكان الميلاد", emp.birthPlace || "—"],
        ["العنوان", emp.address || "—"],
        ["الهاتف", emp.phone || "—"],
        ["رقم بطاقة التعريف", emp.nationalId || "—"],
      ]),
    });
  }

  // 2 — الوظيفة
  parts.push({
    title: "الوظيفة",
    body: docKVTableHTML([
      ["المنصب", escHTML(positionLabel(c.position))],
      ...(emp ? ([["تاريخ التوظيف", formatDate(emp.hireDate)]] as Array<[string, string]>) : []),
    ]),
  });

  // 3 — نوع العقد (القالب المستخدم)
  parts.push({
    title: "نوع العقد",
    body: docKVTableHTML([
      ["نوع العقد", escHTML(contractType(c))],
      ["رمز القالب", c.template?.code || "—"],
      ["نسخة العقد", `v${c.version}`],
    ]),
  });

  // 4 — مدة العقد
  const duration = contractDurationDays(c);
  parts.push({
    title: "مدة العقد",
    body: docKVTableHTML([
      ["من تاريخ", formatDate(c.startDate)],
      ["إلى تاريخ", c.endDate ? formatDate(c.endDate) : "غير محدد"],
      ["المدة الإجمالية", duration !== null ? `${duration.toLocaleString("en-US")} يوماً` : "—"],
    ]),
  });

  // 5 — الأجر وطريقة الحساب
  const wageBody = (c.monthlySalary && c.monthlySalary > 0)
    ? `<p>يتقاضى العامل راتباً شهرياً قدره <strong style="color:#0f766e;">${c.monthlySalary.toLocaleString("en-US")} دج</strong> عن كل شهر عمل.</p>`
    : `<p>يتقاضى العامل أجراً قدره <strong style="color:#0f766e;">${(c.hourRate ?? 0).toLocaleString("en-US")} دج</strong> عن كل ساعة عمل، بناءً على الساعات الفعلية المسجلة.</p>`;
  parts.push({ title: "الأجر وطريقة الحساب", body: wageBody });

  // 6 — ساعات وأيام العمل
  parts.push({
    title: "ساعات وأيام العمل",
    body: c.workSchedule
      ? `<p>${escHTML(c.workSchedule)}</p>`
      : `<p style="color:#94a3b8;">غير محدد في بيانات العقد</p>`,
  });

  // 7 — نص العقد والشروط (النسخة المعتمدة المحفوظة كما هي)
  parts.push({ title: "نص العقد والشروط", body: c.content || "—" });

  // 8 — ملاحظات (إن وُجدت)
  if (c.notes) {
    parts.push({ title: "ملاحظات", body: `<p>${escHTML(c.notes)}</p>` });
  }

  return parts
    .map((p, i) => docSectionHTML(String(i + 1), p.title, p.body))
    .join("") + docSignatureBlockHTML();
}

/** ترويسة موحدة + أقسام المستند — نفس ما يُعرض ويُطبع */
function buildContractDocument(
  c: Contract,
  entete: EnteteConfig | null,
  clubSettings: Record<string, string>,
): string {
  const headerHTML = unifiedReportHeaderHTML({
    reportType: "عقد عمل",
    reportNumber: c.contractNumber,
    date: formatDate(new Date()),
    entete: entete || undefined,
    settings: {
      clubName: clubSettings.clubName,
      branchName: clubSettings.branchName,
      wilaya: clubSettings.wilaya,
      clubAddress: clubSettings.clubAddress,
      clubPhone: clubSettings.clubPhone,
      clubEmail: clubSettings.clubEmail,
      clubWebsite: clubSettings.clubWebsite,
      sportSeason: clubSettings.sportSeason,
    },
  });
  return headerHTML + contractDocumentBodyHTML(c);
}

/** تحويل مسارات الصور النسبية إلى مطلقة (ضروري داخل نافذة الطباعة about:blank) */
function absoluteizeAssets(html: string): string {
  const origin = window.location.origin;
  return html.replace(/src="\//g, `src="${origin}/`);
}

const PRINT_DOC_CSS = `
  *{font-family:'Cairo','Tahoma',Arial,sans-serif;box-sizing:border-box;margin:0;}
  body{padding:16px;background:#f1f5f9;}
  .doc-sheet{max-width:210mm;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);}
  .print-btn{display:block;margin:14px auto 0;background:#0f766e;color:#fff;border:none;padding:10px 30px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px;}
  @page{size:A4;margin:11mm;}
  @media print{
    body{padding:0;background:#fff;}
    .doc-sheet{border:none;border-radius:0;padding:0;box-shadow:none;max-width:none;}
    .noprint{display:none !important;}
  }
`;

// ──────────────── StatCard (نفس أسلوب work-hours-management) ────────────────
function StatCard({ icon: Icon, label, value, sublabel, color, delay = 0 }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sublabel?: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className={cn("rounded-xl p-3 text-white bg-gradient-to-br shadow-sm", color)}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon className="h-4 w-4 opacity-90 shrink-0" />
        {sublabel && (
          <span className="text-[9px] bg-white/15 rounded-full px-1.5 py-0.5 whitespace-nowrap">{sublabel}</span>
        )}
      </div>
      <p className="text-xl md:text-2xl font-extrabold tabular-nums leading-none mt-2">{value.toLocaleString()}</p>
      <p className="text-[10px] opacity-90 mt-1">{label}</p>
    </motion.div>
  );
}

/** خانة معلومة صغيرة داخل بطاقات الموبايل */
function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-1.5 py-1.5 text-center min-w-0">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-[11px] font-bold truncate" title={value}>{value}</p>
    </div>
  );
}

// ════════════ Main Component ════════════
export function ContractsPanel() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empData, conData] = await Promise.all([
        fetch("/api/employees").then((r) => r.json()).catch(() => ({})),
        fetch("/api/contracts").then((r) => r.json()).catch(() => ({})),
      ]);
      setEmployees(empData.employees || []);
      setContracts(conData.contracts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = useCallback(() => { fetchData(); }, [fetchData]);

  // ── الإحصائيات (محسوبة من البيانات المحمّلة أصلاً) ──
  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === "active").length;
    const ended = contracts.filter((c) => c.status === "expired" || c.status === "terminated").length;
    const expiring = contracts.filter((c) => c.status === "active" && isExpiringSoon(c)).length;
    const renewed = contracts.filter((c) => c.status === "renewed").length;
    const activeEmployees = employees.filter((e) => e.active).length;
    return { totalEmployees: employees.length, activeEmployees, active, ended, expiring, renewed };
  }, [employees, contracts]);

  return (
    <div className="space-y-4">
      {/* ── بطاقات إحصائية ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {loading ? (
          <>
            <Skeleton className="h-[84px] rounded-xl" />
            <Skeleton className="h-[84px] rounded-xl" />
            <Skeleton className="h-[84px] rounded-xl" />
            <Skeleton className="h-[84px] rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              icon={Users}
              label="إجمالي العمال"
              value={stats.totalEmployees}
              sublabel={`${stats.activeEmployees} نشط`}
              color="from-teal-500 to-teal-600"
              delay={0}
            />
            <StatCard
              icon={BadgeCheck}
              label="العقود النشطة"
              value={stats.active}
              sublabel={`من إجمالي ${contracts.length} عقد`}
              color="from-emerald-500 to-emerald-600"
              delay={0.05}
            />
            <StatCard
              icon={Archive}
              label="العقود المنتهية"
              value={stats.ended}
              sublabel={stats.renewed > 0 ? `${stats.renewed} مجدّد` : undefined}
              color="from-slate-500 to-slate-600"
              delay={0.1}
            />
            <StatCard
              icon={AlertTriangle}
              label="تنتهي خلال 30 يوماً"
              value={stats.expiring}
              sublabel={stats.expiring > 0 ? "تحتاج إجراء تجديد" : "لا شيء عاجل"}
              color="from-amber-500 to-orange-600"
              delay={0.15}
            />
          </>
        )}
      </div>

      {/* ── التبويبات ── */}
      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 h-auto gap-1 p-1">
          <TabsTrigger value="employees" className="text-xs gap-1.5 py-2">
            <Briefcase className="h-3.5 w-3.5" /> قائمة العمال
          </TabsTrigger>
          <TabsTrigger value="contracts" className="text-xs gap-1.5 py-2">
            <FileText className="h-3.5 w-3.5" /> أرشيف العقود
            {contracts.length > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 h-4 hidden sm:inline-flex">{contracts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs gap-1.5 py-2">
            <Layers className="h-3.5 w-3.5" /> قوالب العقود
          </TabsTrigger>
          <TabsTrigger value="create" className="text-xs gap-1.5 py-2">
            <FilePlus className="h-3.5 w-3.5" /> إنشاء عقد
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-3">
          <EmployeesTab employees={employees} loading={loading} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="contracts" className="mt-3">
          <ContractsArchiveTab contracts={contracts} loading={loading} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="templates" className="mt-3">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="create" className="mt-3">
          <CreateContractTab employees={employees} onCreated={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ════════════ Tab 1: Employees ════════════
function EmployeesTab({ employees, loading, onChanged }: {
  employees: Employee[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    firstName: "", lastName: "", birthDate: "", birthPlace: "", address: "",
    phone: "", nationalId: "", position: "guard", hourRate: 200, active: true,
  });

  const handleSave = async () => {
    if (!form.firstName || !form.lastName) {
      toast.error("الاسم واللقب مطلوبان");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/employees/${editing.id}` : "/api/employees";
      const method = editing ? "PATCH" : "POST";
      const body = {
        ...form,
        birthDate: form.birthDate ? new Date(form.birthDate) : null,
      };
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      setDialogOpen(false);
      onChanged();
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا العامل؟ سيتم حذف جميع عقوده.")) return;
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("تم الحذف");
      onChanged();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      firstName: "", lastName: "", birthDate: "", birthPlace: "", address: "",
      phone: "", nationalId: "", position: "guard", hourRate: 200, active: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      ...emp,
      birthDate: emp.birthDate ? new Date(emp.birthDate).toISOString().split("T")[0] : "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* رأس القسم */}
      <div className="flex items-center justify-between gap-2 p-4 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 rounded-xl bg-primary/10 items-center justify-center shrink-0">
            <Briefcase className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm">قائمة العمال</h3>
            <p className="text-[10px] text-muted-foreground">{employees.length} عامل مسجّل</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={employees}
            filename="قائمة-العمال"
            title="قائمة عمال النادي"
            formats={["excel", "csv", "pdf", "print"]}
            disabled={loading}
            columns={[
              { key: "name", label: "الاسم", format: (e) => `${e.lastName} ${e.firstName}` },
              { key: "position", label: "المنصب", format: (e) => positionLabel(e.position) },
              { key: "phone", label: "الهاتف", format: (e) => e.phone || "—" },
              { key: "hire", label: "تاريخ التوظيف", format: (e) => formatDate(e.hireDate) },
              { key: "rate", label: "سعر الساعة", format: (e) => `${e.hourRate} دج` },
              { key: "contracts", label: "عدد العقود", format: (e) => String((e.contracts || []).length) },
              { key: "active", label: "العقد النشط", format: (e) => { const c = (e.contracts || []).find((x) => contractStatusKey(x) === "active"); return c ? c.contractNumber : "—"; } },
            ]}
          />
          <Button size="sm" onClick={openAdd}>
            <UserPlus className="h-4 w-4 ml-1" /> إضافة عامل
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">لا يوجد عمال بعد</p>
          <p className="text-xs mt-1">اضغط «إضافة عامل» لإنشاء أول عامل</p>
        </div>
      ) : (
        <>
          {/* جدول (شاشات متوسطة وما فوق) */}
          <div className="hidden md:block max-h-[520px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="text-right border-b-2 border-primary/20">
                  <th className="p-2.5 font-semibold">العامل</th>
                  <th className="p-2.5 text-center font-semibold">المنصب</th>
                  <th className="p-2.5 text-center font-semibold">الهاتف</th>
                  <th className="p-2.5 text-center font-semibold">تاريخ التوظيف</th>
                  <th className="p-2.5 text-center font-semibold">العقود</th>
                  <th className="p-2.5 text-center font-semibold">الحالة</th>
                  <th className="p-2.5 text-center font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-500/15 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {(emp.lastName || emp.firstName || "?").charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{emp.lastName} {emp.firstName}</p>
                          {emp.user?.email && <p className="text-[10px] text-muted-foreground truncate" dir="ltr">{emp.user.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-2.5 text-center">{positionLabel(emp.position)}</td>
                    <td className="p-2.5 text-center font-mono" dir="ltr">{emp.phone || "—"}</td>
                    <td className="p-2.5 text-center">{formatDate(emp.hireDate)}</td>
                    <td className="p-2.5 text-center">
                      <Badge variant="outline" className="text-[10px]">{emp.contracts?.length || 0}</Badge>
                    </td>
                    <td className="p-2.5 text-center">
                      {emp.active ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">نشط</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-700 border-rose-500/30">متوقف</Badge>
                      )}
                    </td>
                    <td className="p-2.5">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => openEdit(emp)}
                          className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-500/10 transition-colors"
                          title="تعديل"
                          aria-label={`تعديل ${emp.lastName} ${emp.firstName}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="حذف"
                          aria-label={`حذف ${emp.lastName} ${emp.firstName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* بطاقات الموبايل */}
          <div className="md:hidden divide-y divide-border/40">
            {employees.map((emp) => (
              <div key={emp.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-teal-500/15 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {(emp.lastName || emp.firstName || "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{emp.lastName} {emp.firstName}</p>
                      <p className="text-[10px] text-muted-foreground">{positionLabel(emp.position)}</p>
                    </div>
                  </div>
                  {emp.active ? (
                    <Badge variant="outline" className="text-[9px] shrink-0 bg-emerald-500/10 text-emerald-700 border-emerald-500/30">نشط</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] shrink-0 bg-rose-500/10 text-rose-700 border-rose-500/30">متوقف</Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <MiniInfo label="الهاتف" value={emp.phone || "—"} />
                  <MiniInfo label="التوظيف" value={formatDate(emp.hireDate)} />
                  <MiniInfo label="العقود" value={String(emp.contracts?.length || 0)} />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">{emp.phone || ""}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(emp)}
                      className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-500/10 transition-colors"
                      title="تعديل"
                      aria-label={`تعديل ${emp.lastName} ${emp.firstName}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="حذف"
                      aria-label={`حذف ${emp.lastName} ${emp.firstName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              {editing ? "تعديل بيانات العامل" : "إضافة عامل جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">الاسم *</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">اللقب *</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">تاريخ الميلاد</Label>
              <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="h-9" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">مكان الميلاد</Label>
              <Input value={form.birthPlace} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} className="h-9" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">العنوان</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">رقم بطاقة التعريف</Label>
              <Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} className="h-9" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">المنصب</Label>
              <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full h-9 text-xs rounded border bg-card px-2">
                {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">سعر الساعة (دج)</Label>
              <Input type="number" value={form.hourRate} onChange={(e) => setForm({ ...form, hourRate: +e.target.value })} className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              {editing ? "حفظ" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════ Tab 2: Contracts Archive ════════════
function ContractsArchiveTab({ contracts, loading, onChanged }: {
  contracts: Contract[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [renewContract, setRenewContract] = useState<Contract | null>(null);
  const [renewDate, setRenewDate] = useState("");
  const [renewing, setRenewing] = useState(false);
  const [entete, setEntete] = useState<EnteteConfig | null>(null);
  const [clubSettings, setClubSettings] = useState<Record<string, string>>({});

  // بيانات الترويسة الموحدة (GET فقط) — لتكون المعاينة والطباعة مطابقتين تماماً
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/entete").then((r) => r.json()).catch(() => ({})),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([eData, sData]) => {
      if (cancelled) return;
      setEntete(eData.config || null);
      setClubSettings(sData.settings || {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // الفلترة: بحث بالاسم/رقم العقد + فلتر الحالة
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      const name = c.employee ? `${c.employee.lastName} ${c.employee.firstName}` : "";
      const matchQ = !q || c.contractNumber.toLowerCase().includes(q) || name.toLowerCase().includes(q);
      const matchS = statusFilter === "all" || statusInfo(c).key === statusFilter;
      return matchQ && matchS;
    });
  }, [contracts, search, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا العقد نهائياً؟")) return;
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("تم الحذف");
      onChanged();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const openRenew = (c: Contract) => {
    const d = new Date();
    d.setDate(d.getDate() + 365);
    setRenewDate(d.toISOString().split("T")[0]);
    setRenewContract(c);
  };

  const handleRenewConfirm = async () => {
    if (!renewContract || !renewDate) return;
    setRenewing(true);
    try {
      const res = await fetch(`/api/contracts/${renewContract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "renew", newEndDate: renewDate }),
      });
      if (!res.ok) throw new Error();
      toast.success("تم تجديد العقد بنجاح — عقد جديد بنسخة أعلى");
      setRenewContract(null);
      onChanged();
    } catch {
      toast.error("فشل التجديد");
    } finally {
      setRenewing(false);
    }
  };

  const handlePrint = (contract: Contract) => {
    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast.error("فشل فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");
      return;
    }
    const docHTML = absoluteizeAssets(buildContractDocument(contract, entete, clubSettings));
    printWin.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>عقد ${escHTML(contract.contractNumber)}</title>
      <style>${PRINT_DOC_CSS}</style></head><body>
      <div class="doc-sheet">${docHTML}</div>
      <button class="print-btn noprint" onclick="window.print()">🖨 طباعة / حفظ PDF</button>
      <script>setTimeout(function(){try{window.print()}catch(e){}},400);</script>
      </body></html>
    `);
    printWin.document.close();
  };

  const handleExportWord = (contract: Contract) => {
    const docHTML = buildContractDocument(contract, entete, clubSettings);
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>عقد ${escHTML(contract.contractNumber)}</title>
<style>
  *{font-family:'Cairo','Tahoma',Arial,sans-serif;box-sizing:border-box;}
  body{padding:15px;}
  @page{size:A4;margin:1.5cm;}
</style></head>
<body>
<div class="doc-sheet" style="border:none;padding:0;">${docHTML}</div>
</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `عقد_${contract.contractNumber}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportColumns = [
    { key: "contractNumber", label: "رقم العقد", format: (c: Contract) => c.contractNumber },
    { key: "employee", label: "العامل", format: (c: Contract) => (c.employee ? `${c.employee.lastName} ${c.employee.firstName}` : "—") },
    { key: "position", label: "الوظيفة", format: (c: Contract) => positionLabel(c.position) },
    { key: "type", label: "نوع العقد", format: (c: Contract) => contractType(c) },
    { key: "start", label: "من تاريخ", format: (c: Contract) => formatDate(c.startDate) },
    { key: "end", label: "إلى تاريخ", format: (c: Contract) => formatDate(c.endDate) },
    { key: "wage", label: "الأجر", format: (c: Contract) => formatWage(c) },
    { key: "status", label: "الحالة", format: (c: Contract) => statusInfo(c).label },
    { key: "version", label: "النسخة", format: (c: Contract) => `v${c.version}` },
  ];

  const actionButtons = (c: Contract) => (
    <>
      <button
        onClick={() => setViewContract(c)}
        className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-500/10 transition-colors"
        title="عرض"
        aria-label={`عرض العقد ${c.contractNumber}`}
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => handlePrint(c)}
        className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-500/10 transition-colors"
        title="طباعة"
        aria-label={`طباعة العقد ${c.contractNumber}`}
      >
        <Printer className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => handleExportWord(c)}
        className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-500/10 transition-colors"
        title="تصدير Word"
        aria-label={`تصدير العقد ${c.contractNumber} إلى Word`}
      >
        <Download className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => openRenew(c)}
        className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/10 transition-colors"
        title="تجديد"
        aria-label={`تجديد العقد ${c.contractNumber}`}
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => handleDelete(c.id)}
        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
        title="حذف"
        aria-label={`حذف العقد ${c.contractNumber}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* رأس القسم + زر التصدير الموحّد */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 rounded-xl bg-primary/10 items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm">أرشيف العقود</h3>
            <p className="text-[10px] text-muted-foreground">
              {filtered.length} من {contracts.length} عقد
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onChanged}
            title="تحديث"
            aria-label="تحديث قائمة العقود"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <ExportButton
            rows={filtered}
            columns={exportColumns}
            filename={`عقود-العمال-${todayYMD()}`}
            title="سجل عقود العمال"
            formats={["excel", "csv", "pdf", "print"]}
            disabled={loading}
            label="تصدير"
          />
        </div>
      </div>

      {/* البحث والفلترة */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border/60 bg-muted/20">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث برقم العقد أو اسم العامل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 h-9 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-9 text-xs" aria-label="فلترة بالحالة">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="expiring">ينتهي قريباً</SelectItem>
            <SelectItem value="expired">منتهٍ</SelectItem>
            <SelectItem value="terminated">منهيّ</SelectItem>
            <SelectItem value="renewed">مجدّد</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {contracts.length === 0 && !loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">لا توجد عقود بعد</p>
          <p className="text-xs mt-1">اذهب إلى «إنشاء عقد» لإنشاء أول عقد</p>
        </div>
      ) : (
        <>
          {/* جدول (شاشات متوسطة وما فوق) */}
          <div className="hidden md:block max-h-[520px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="text-right border-b-2 border-primary/20">
                  <th className="p-2.5 font-semibold">رقم العقد</th>
                  <th className="p-2.5 font-semibold">العامل</th>
                  <th className="p-2.5 text-center font-semibold">الوظيفة</th>
                  <th className="p-2.5 font-semibold">نوع العقد</th>
                  <th className="p-2.5 text-center font-semibold">من تاريخ</th>
                  <th className="p-2.5 text-center font-semibold">إلى تاريخ</th>
                  <th className="p-2.5 text-center font-semibold">الأجر</th>
                  <th className="p-2.5 text-center font-semibold">الحالة</th>
                  <th className="p-2.5 text-center font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">لا نتائج مطابقة للبحث أو الفلتر</td></tr>
                ) : (
                  filtered.map((c) => {
                    const st = statusInfo(c);
                    return (
                      <tr key={c.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                        <td className="p-2.5 font-mono font-semibold whitespace-nowrap">{c.contractNumber}</td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-teal-500/15 text-teal-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {c.employee ? (c.employee.lastName || c.employee.firstName || "?").charAt(0) : "?"}
                            </div>
                            <span className="font-semibold truncate">
                              {c.employee ? `${c.employee.lastName} ${c.employee.firstName}` : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">{positionLabel(c.position)}</td>
                        <td className="p-2.5">
                          <span className="truncate block max-w-[130px]" title={contractType(c)}>{contractType(c)}</span>
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">{formatDate(c.startDate)}</td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          {formatDate(c.endDate)}
                          {st.key === "expiring" && c.endDate && (
                            <span className="block text-[9px] text-amber-600 font-semibold">
                              متبقٍ {daysUntil(c.endDate)} يوماً
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-semibold text-amber-600 whitespace-nowrap">{formatWage(c)}</td>
                        <td className="p-2.5 text-center">
                          <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", st.badge)}>
                            {st.label}
                          </Badge>
                        </td>
                        <td className="p-2.5">
                          <div className="flex gap-0.5 justify-center">{actionButtons(c)}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* بطاقات الموبايل */}
          <div className="md:hidden divide-y divide-border/40 max-h-[560px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs">لا نتائج مطابقة للبحث أو الفلتر</div>
            ) : (
              filtered.map((c) => {
                const st = statusInfo(c);
                return (
                  <div key={c.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {c.employee ? (c.employee.lastName || c.employee.firstName || "?").charAt(0) : "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">
                            {c.employee ? `${c.employee.lastName} ${c.employee.firstName}` : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">{c.contractNumber}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-[9px] shrink-0", st.badge)}>{st.label}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <MiniInfo label="الوظيفة" value={positionLabel(c.position)} />
                      <MiniInfo label="نوع العقد" value={contractType(c)} />
                      <MiniInfo label="الأجر" value={formatWage(c)} />
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>من {formatDate(c.startDate)} — إلى {formatDate(c.endDate)}</span>
                    </div>
                    {st.key === "expiring" && c.endDate && (
                      <p className="text-[10px] font-semibold text-amber-600">
                        ⚠ ينتهي بعد {daysUntil(c.endDate)} يوماً
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground">نسخة v{c.version}</span>
                      <div className="flex gap-0.5">{actionButtons(c)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Contract Viewer Dialog — مستند العقد الرسمي */}
      <Dialog open={!!viewContract} onOpenChange={(o) => !o && setViewContract(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <FileSignature className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">عرض العقد {viewContract?.contractNumber}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setViewContract(null)} aria-label="إغلاق">
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {viewContract && (
            <div className="space-y-3">
              {/* ورقة A4 — نفس HTML الطباعة تماماً */}
              <div
                className="mx-auto w-full max-w-[210mm] rounded-xl border border-border/60 bg-white p-3 sm:p-5 text-foreground"
                dangerouslySetInnerHTML={{ __html: buildContractDocument(viewContract, entete, clubSettings) }}
              />
              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <Button size="sm" onClick={() => handlePrint(viewContract)}>
                  <Printer className="h-4 w-4 ml-1" /> طباعة / PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExportWord(viewContract)}>
                  <Download className="h-4 w-4 ml-1" /> Word
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Renew Dialog */}
      <Dialog open={!!renewContract} onOpenChange={(o) => !o && setRenewContract(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              تجديد العقد {renewContract?.contractNumber}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed">
            سيتم إنشاء عقد جديد بنفس بيانات العامل والقالب، برقم عقد جديد ونسخة أعلى،
            ويُعلَّم العقد الحالي كمجدّد.
          </p>
          <div>
            <Label className="text-xs">تاريخ نهاية العقد الجديد *</Label>
            <Input
              type="date"
              value={renewDate}
              min={todayYMD()}
              onChange={(e) => setRenewDate(e.target.value)}
              className="h-9"
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewContract(null)}>إلغاء</Button>
            <Button onClick={handleRenewConfirm} disabled={renewing || !renewDate}>
              {renewing && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد التجديد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════ Tab 3: Templates ════════════
function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<any>({
    name: "", code: "", description: "", content: "", defaultDuration: 365, active: true,
  });
  const [showVarsHelper, setShowVarsHelper] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contract-templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast.error("فشل تحميل القوالب");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.error("الاسم والرمز مطلوبان");
      return;
    }
    try {
      const url = editing ? `/api/contract-templates/${editing.id}` : "/api/contract-templates";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      setDialogOpen(false);
      fetchTemplates();
    } catch {
      toast.error("فشل الحفظ");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا القالب؟")) return;
    await fetch(`/api/contract-templates/${id}`, { method: "DELETE" });
    toast.success("تم الحذف");
    fetchTemplates();
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "", code: "", description: "", content: `<div dir="rtl" style="font-family:'Cairo','Tahoma',Arial;font-size:12pt;padding:20px;">
<h2 style="text-align:center;color:#0f766e;">عقد عمل — {{position}}</h2>
<p>في اليوم {{today}}، بين {{club_name}} والسيد/ة {{worker_name}}.</p>
<p>المنصب: {{position}}</p>
<p>المدة: من {{start_date}} إلى {{end_date}}</p>
<p>الأجر: {{hour_rate}} دج/ساعة</p>
<p>رقم العقد: {{contract_number}}</p>
</div>`, defaultDuration: 365, active: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm(t);
    setDialogOpen(true);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* رأس القسم */}
      <div className="flex items-center justify-between gap-2 p-4 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 rounded-xl bg-primary/10 items-center justify-center shrink-0">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm">قوالب العقود</h3>
            <p className="text-[10px] text-muted-foreground">{templates.length} قالب متوفر</p>
          </div>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 ml-1" /> إضافة قالب
        </Button>
      </div>

      <div className="p-4">
        {templates.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">لا توجد قوالب بعد</p>
            <p className="text-xs mt-1">أضف قالباً لتسهيل إنشاء العقود</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-border/60 p-3 hover:border-primary/40 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{t.code}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{t.defaultDuration} يوم</Badge>
                </div>
                {t.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{t.description}</p>}
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => openEdit(t)}>
                    <Edit2 className="h-3 w-3 ml-1" /> تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                    onClick={() => handleDelete(t.id)}
                    aria-label={`حذف القالب ${t.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              {editing ? "تعديل القالب" : "إضافة قالب جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الاسم *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" placeholder="عقد حارس السباحة" />
              </div>
              <div>
                <Label className="text-xs">الرمز *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-9 font-mono" placeholder="guard" dir="ltr" />
              </div>
            </div>
            <div>
              <Label className="text-xs">الوصف</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">المدة الافتراضية (أيام)</Label>
              <Input type="number" value={form.defaultDuration} onChange={(e) => setForm({ ...form, defaultDuration: +e.target.value })} className="h-9" />
            </div>

            {/* Variables Helper */}
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-2">
              <button
                onClick={() => setShowVarsHelper(!showVarsHelper)}
                className="w-full flex items-center justify-between text-xs font-bold text-primary"
                aria-expanded={showVarsHelper}
              >
                <span>📚 الحقول المتاحة (انقر للعرض)</span>
                <span>{showVarsHelper ? "▲" : "▼"}</span>
              </button>
              {showVarsHelper && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-2">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => {
                        setForm({ ...form, content: form.content + `{{${v.key}}}` });
                      }}
                      className="text-right p-1.5 rounded border border-border hover:border-primary/40 hover:bg-accent/50 text-[11px] transition-colors"
                      title={v.description}
                    >
                      <span className="font-mono font-bold text-primary">{"{{"}{v.key}{"}}"}</span>
                      <div className="text-[9px] text-muted-foreground">{v.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">محتوى القالب (HTML)</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={12}
                className="font-mono text-[11px]"
                dir="ltr"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                استخدم الحقول بين <code className="font-mono">{"{{}}"}</code> — سيتم استبدالها تلقائياً عند إنشاء العقد
              </p>
            </div>

            {/* Preview */}
            <div>
              <Label className="text-xs mb-1 block">معاينة</Label>
              <div
                className="bg-white border border-border/60 rounded-lg p-3 max-h-64 overflow-y-auto"
                dangerouslySetInnerHTML={{
                  __html: substituteVariables(form.content || "", {
                    club_name: "النادي الهاوي متعدد الرياضات",
                    club_branch: "فرع السباحة",
                    worker_name: "محمد أمين",
                    birth_date: "1990/01/15",
                    birth_place: "سعيدة",
                    address: "حي 5 جويلية",
                    phone: "048.XX.XX.XX",
                    national_id: "123456789",
                    position: "حارس سباحة",
                    contract_number: "CTR-2025-001",
                    start_date: "2025/01/01",
                    end_date: "2025/12/31",
                    hour_rate: 200,
                    work_schedule: "40 ساعة/أسبوع",
                    club_president: "—",
                    association_president: "—",
                    today: formatDate(new Date()),
                  }),
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>{editing ? "حفظ" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════ Tab 4: Create Contract ════════════
function CreateContractTab({ employees, onCreated }: {
  employees: Employee[];
  onCreated: () => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    templateId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    hourRate: 200,
    workSchedule: "",
    notes: "",
  });
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    fetch("/api/contract-templates")
      .then((r) => r.json())
      .then((tplData) => {
        setTemplates(tplData.templates || []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  // Auto-fill hourRate from selected employee
  useEffect(() => {
    if (form.employeeId) {
      const emp = employees.find((e) => e.id === form.employeeId);
      if (emp) {
        setForm((f) => ({ ...f, hourRate: emp.hourRate }));
        // Auto-fill end date from template defaultDuration
        const tpl = templates.find((t) => t.id === form.templateId);
        if (tpl) {
          const sd = new Date(form.startDate);
          sd.setDate(sd.getDate() + tpl.defaultDuration);
          setForm((f) => ({ ...f, endDate: sd.toISOString().split("T")[0] }));
        }
      }
    }
  }, [form.employeeId, employees]);

  // Update preview when inputs change
  useEffect(() => {
    if (!form.employeeId || !form.templateId) {
      setPreview("");
      return;
    }
    const emp = employees.find((e) => e.id === form.employeeId);
    const tpl = templates.find((t) => t.id === form.templateId);
    if (!emp || !tpl) return;
    const rendered = substituteVariables(tpl.content, {
      club_name: "—",
      club_branch: "—",
      worker_name: `${emp.lastName} ${emp.firstName}`.trim(),
      birth_date: formatDate(emp.birthDate),
      birth_place: emp.birthPlace || "—",
      address: emp.address || "—",
      phone: emp.phone || "—",
      national_id: emp.nationalId || "—",
      position: positionLabel(emp.position),
      contract_number: "CTR-PREVIEW",
      start_date: formatDate(form.startDate),
      end_date: formatDate(form.endDate),
      hour_rate: form.hourRate,
      work_schedule: form.workSchedule || "—",
      today: formatDate(new Date()),
    });
    setPreview(rendered);
  }, [form, employees, templates]);

  const handleCreate = async () => {
    if (!form.employeeId) { toast.error("اختر العامل"); return; }
    if (!form.templateId) { toast.error("اختر القالب"); return; }
    if (!form.startDate) { toast.error("أدخل تاريخ البداية"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId,
          templateId: form.templateId,
          startDate: form.startDate,
          endDate: form.endDate || null,
          hourRate: form.hourRate,
          workSchedule: form.workSchedule,
          notes: form.notes,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`تم إنشاء العقد ${data.contract.contractNumber} بنجاح`);
      // Reset form
      setForm({
        employeeId: "", templateId: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "", hourRate: 200, workSchedule: "", notes: "",
      });
      setPreview("");
      onCreated();
    } catch {
      toast.error("فشل إنشاء العقد");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* رأس القسم */}
      <div className="p-4 border-b border-border/60 flex items-center gap-2">
        <div className="flex h-9 w-9 rounded-xl bg-primary/10 items-center justify-center shrink-0">
          <FilePlus className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm">إنشاء عقد جديد</h3>
          <p className="text-[10px] text-muted-foreground">
            تعبئة تلقائية من بيانات العامل + رقم عقد فريد + حفظ في الأرشيف
          </p>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Right: form (RTL أول عمود) */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs flex items-center gap-1"><Briefcase className="h-3 w-3" /> العامل *</Label>
              <Select
                value={form.employeeId || undefined}
                onValueChange={(v) => setForm({ ...form, employeeId: v })}
              >
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="— اختر العامل —" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.lastName} {emp.firstName} — {positionLabel(emp.position)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1"><Layers className="h-3 w-3" /> القالب *</Label>
              <Select
                value={form.templateId || undefined}
                onValueChange={(v) => setForm({ ...form, templateId: v })}
              >
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="— اختر القالب —" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> تاريخ البداية *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-9" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> تاريخ النهاية</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-9" dir="ltr" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs flex items-center gap-1"><DollarSign className="h-3 w-3" /> سعر الساعة (دج)</Label>
                <Input type="number" value={form.hourRate} onChange={(e) => setForm({ ...form, hourRate: +e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">جدول العمل</Label>
                <Input value={form.workSchedule} onChange={(e) => setForm({ ...form, workSchedule: e.target.value })} className="h-9" placeholder="40 ساعة/أسبوع" />
              </div>
            </div>

            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="text-xs" />
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <FilePlus className="h-4 w-4 ml-1" />}
              إنشاء العقد وحفظه في الأرشيف
            </Button>
          </div>

          {/* Left: live preview */}
          <div className="space-y-2">
            <Label className="text-xs">معاينة مباشرة</Label>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="bg-muted/40 p-2 text-[10px] text-muted-foreground text-center">
                المعاينة تستخدم بيانات العامل المختار
              </div>
              <div className="bg-white max-h-[500px] overflow-y-auto">
                {preview ? (
                  <div className="[&_h2]:text-[#0f766e] [&_h3]:text-[#0f766e] p-4" dangerouslySetInnerHTML={{ __html: preview }} />
                ) : (
                  <div className="p-12 text-center text-muted-foreground text-xs">
                    اختر العامل والقالب لعرض المعاينة
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
