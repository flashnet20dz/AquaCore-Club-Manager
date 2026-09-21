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
  AlertTriangle, FileSignature, Ban, CheckCircle2,
  Building2, Shield, UserCheck, Coins, Clock, MapPin, Maximize2,
  Sparkles, ChevronDown, ChevronUp, Check, RotateCcw, Copy,
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
import { AVAILABLE_VARIABLES, substituteVariables, OFFICIAL_CDD_TEMPLATE_HTML } from "@/lib/contract-variables";
import { ExportButton } from "@/components/shared/export-button";
// ★ المرحلة 5: مساعدات مشتركة + ملف الموظف الكامل
import {
  POSITIONS, positionLabel, CONTRACT_TYPES, contractTypeLabel,
  EMPLOYEE_STATUS_UI, employeeStatusInfo, formatDate,
} from "@/components/contracts-shared";
import { EmployeeProfileDialog } from "@/components/employees/employee-profile-dialog";

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
  // ★ المرحلة 5 (§3): تواصل + الاسم بالفرنسية + الحالة الرسمية
  email?: string | null;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
  position: string;
  hourRate: number;
  hireDate: string;
  active: boolean;
  status?: string; // ACTIVE / INACTIVE / SUSPENDED / ARCHIVED (المرحلة 5)
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
  // ★ المرحلة 5 (§4): نوع العقد + عنوان + ساعات أسبوعية
  contractType?: string; // HOURLY/MONTHLY/TEMPORARY/FIXED_TERM/OTHER
  title?: string | null;
  weeklyHours?: number | null;
  content: string;
  status: string;
  version: number;
  notes: string | null;
  // ★ المرحلة 5 (§24): إنهاء ناعم
  terminatedAt?: string | null;
  terminatedReason?: string | null;
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
// ★ POSITIONS/positionLabel/formatDate/CONTRACT_TYPES/contractTypeLabel/
//   EMPLOYEE_STATUS_UI/employeeStatusInfo مشتركة من @/components/contracts-shared

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

type ContractStatusKey = "active" | "expiring" | "expired" | "terminated" | "renewed" | "draft" | "cancelled";

const STATUS_UI: Record<ContractStatusKey, { label: string; badge: string }> = {
  active: { label: "نشط", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  expiring: { label: "ينتهي قريباً", badge: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  expired: { label: "منتهٍ", badge: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
  terminated: { label: "منهيّ", badge: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
  renewed: { label: "مجدّد", badge: "bg-teal-500/10 text-teal-700 border-teal-500/30" },
  // ★ المرحلة 5 (§4): مسودة + ملغى
  draft: { label: "مسودة", badge: "bg-sky-500/10 text-sky-700 border-sky-500/30" },
  cancelled: { label: "ملغى", badge: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30" },
};

function contractStatusKey(c: Contract): ContractStatusKey {
  if (c.status === "active") return isExpiringSoon(c) ? "expiring" : "active";
  if (c.status === "expired") return "expired";
  if (c.status === "terminated") return "terminated";
  if (c.status === "renewed") return "renewed";
  if (c.status === "draft") return "draft";
  if (c.status === "cancelled") return "cancelled";
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

function renderOfficialContractFromContract(c: Contract, clubSettings: Record<string, string>): string {
  const emp = c.employee;
  const workerName = emp ? `${emp.lastName} ${emp.firstName}`.trim() : "—";
  const birthDate = emp?.birthDate ? formatDate(emp.birthDate) : "—";
  const birthPlace = emp?.birthPlace || "سعيدة";
  const address = emp?.address || "سعيدة";
  const nationalId = emp?.nationalId || "—";
  const phone = emp?.phone || "—";
  const position = positionLabel(c.position) || "حارس سباحة (منقذ مائي)";
  const startDate = formatDate(c.startDate);
  const endDate = formatDate(c.endDate);
  const workplace = "المسبح النصف الأولمبي طاب لحسن";
  const schedule = c.workSchedule || "احترام جدول العمل الذي تحدده إدارة فرع السباحة";
  const wage = c.monthlySalary && c.monthlySalary > 0
    ? `يتقاضى الطرف الثاني راتباً شهرياً قدره ${c.monthlySalary.toLocaleString("en-US")} دج عن كل شهر عمل.`
    : "يتقاضى الطرف الثاني أجرًا يُحسب على أساس الحجم الساعي كل شهر.";
  const clubName = clubSettings.clubName || "الجمعية الرياضية الهاوية النادي الرياضي متعدد الرياضات الرائد لبلدية سعيدة – فرع السباحة";
  const clubAddress = clubSettings.clubAddress || "طاب لحسن";
  const repName = clubSettings.branchPresident || clubSettings.clubPresident || ".................................";
  const assocPres = clubSettings.associationPresident || clubSettings.clubPresident || ".................................";
  const today = formatDate(new Date());

  return substituteVariables(OFFICIAL_CDD_TEMPLATE_HTML, {
    contract_number: c.contractNumber,
    club_name: clubName,
    club_address: clubAddress,
    first_party_rep: repName,
    first_party_role: "رئيس فرع السباحة",
    worker_name: workerName,
    birth_date: birthDate,
    birth_place: birthPlace,
    address: address,
    national_id: nationalId,
    phone: phone,
    position: position,
    start_date: startDate,
    end_date: endDate,
    workplace: workplace,
    work_schedule: schedule,
    wage_clause: wage,
    city: clubSettings.wilaya || "سعيدة",
    contract_date: today,
    association_president: assocPres,
    association_president_role: "رئيس الجمعية الرياضية الهاوية",
  });
}

/** ترويسة موحدة + عقد العمل الإداري الرسمي الكامل A4 */
function buildContractDocument(
  c: Contract,
  entete: EnteteConfig | null,
  clubSettings: Record<string, string>,
): string {
  const headerHTML = unifiedReportHeaderHTML({
    reportType: "عقد عمل محدد المدة (CDD)",
    reportNumber: c.contractNumber,
    date: formatDate(new Date()),
    entete: entete || undefined,
    settings: {
      clubName: clubSettings.clubName || "الجمعية الرياضية الهاوية النادي الرياضي متعدد الرياضات الرائد لبلدية سعيدة – فرع السباحة",
      branchName: clubSettings.branchName || "فرع السباحة",
      wilaya: clubSettings.wilaya || "سعيدة",
      clubAddress: clubSettings.clubAddress || "طاب لحسن",
      clubPhone: clubSettings.clubPhone,
      clubEmail: clubSettings.clubEmail,
      clubWebsite: clubSettings.clubWebsite,
      sportSeason: clubSettings.sportSeason || "2026/2027",
    },
  });

  const bodyHTML = (c.content && c.content.includes("contract-document"))
    ? c.content
    : renderOfficialContractFromContract(c, clubSettings);

  return `
    <div class="contract-official-wrapper" style="direction:rtl;text-align:right;">
      ${headerHTML}
      <div style="margin-top:14px;">
        ${bodyHTML}
      </div>
    </div>
  `;
}

/** تحويل مسارات الصور النسبية إلى مطلقة (ضروري داخل نافذة الطباعة about:blank) */
function absoluteizeAssets(html: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return html.replace(/src="\//g, `src="${origin}/`);
}

const PRINT_DOC_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap');
  * { font-family: 'Cairo', 'Tajawal', Tahoma, Arial, sans-serif; box-sizing: border-box; margin: 0; }
  body { padding: 16px; background: #f1f5f9; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-sheet { max-width: 210mm; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px 20px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
  .print-btn { display: block; margin: 16px auto 0; background: #0f766e; color: #fff; border: none; padding: 12px 34px; border-radius: 8px; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 14px; box-shadow: 0 2px 8px rgba(15,118,110,0.3); }
  .print-btn:hover { background: #115e59; }
  @page { size: A4; margin: 8mm 10mm; }
  @media print {
    html, body {
      padding: 0 !important;
      margin: 0 !important;
      background: #fff !important;
      color: #0f172a !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .doc-sheet {
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      max-width: none !important;
      width: 100% !important;
    }
    .noprint, .page-divider-screen {
      display: none !important;
    }
    .contract-page-1 {
      page-break-after: always !important;
      break-after: page !important;
    }
    .contract-page-2 {
      margin-top: 0 !important;
      page-break-before: always !important;
      break-before: page !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
  }
`;

/** طباعة مستند العقد فوراً بمقاس A4 */
function printContractHtml(docHTML: string, contractNumber: string) {
  const printWin = window.open("", "_blank");
  if (!printWin) {
    toast.error("فشل فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");
    return;
  }
  const processed = absoluteizeAssets(docHTML);
  printWin.document.write(`
    <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>عقد ${escHTML(contractNumber)}</title>
    <style>${PRINT_DOC_CSS}</style></head><body>
    <div class="doc-sheet">${processed}</div>
    <button class="print-btn noprint" onclick="window.print()">🖨 طباعة / حفظ PDF</button>
    <script>setTimeout(function(){try{window.print()}catch(e){}},400);</script>
    </body></html>
  `);
  printWin.document.close();
}

/** تصدير مستند العقد بصيغة Word (.doc) مع الترويسة الموحدة */
function exportContractHtmlAsWord(docHTML: string, contractNumber: string) {
  const processed = absoluteizeAssets(docHTML);
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>عقد ${escHTML(contractNumber)}</title>
<style>
  *{font-family:'Cairo','Tahoma',Arial,sans-serif;box-sizing:border-box;}
  body{padding:15px;}
  @page{size:A4;margin:1.5cm;}
</style></head>
<body>
<div class="doc-sheet" style="border:none;padding:0;">${processed}</div>
</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeNum = contractNumber.replace(/[\/\\?%*:|"<>]/g, "_").trim();
  a.download = `عقد_${safeNum || "موحد"}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [entete, setEntete] = useState<EnteteConfig | null>(null);
  const [clubSettings, setClubSettings] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("create");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empData, conData, enteteData, settsData] = await Promise.all([
        fetch("/api/employees").then((r) => r.json()).catch(() => ({})),
        fetch("/api/contracts").then((r) => r.json()).catch(() => ({})),
        fetch("/api/entete").then((r) => r.json()).catch(() => ({})),
        fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
      ]);
      setEmployees(empData.employees || []);
      setContracts(conData.contracts || []);
      setEntete(enteteData.config || null);
      setClubSettings(settsData.settings || {});
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 h-auto gap-1 p-1 bg-muted/60">
          <TabsTrigger value="create" className="text-xs gap-1.5 py-2 font-bold data-[state=active]:bg-teal-600 data-[state=active]:text-white transition-all">
            <FileSignature className="h-3.5 w-3.5" /> إنشاء وتحرير عقد
          </TabsTrigger>
          <TabsTrigger value="contracts" className="text-xs gap-1.5 py-2 data-[state=active]:bg-card transition-all">
            <FileText className="h-3.5 w-3.5" /> أرشيف العقود
            {contracts.length > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 h-4 hidden sm:inline-flex">{contracts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs gap-1.5 py-2 data-[state=active]:bg-card transition-all">
            <Layers className="h-3.5 w-3.5" /> قوالب العقود
          </TabsTrigger>
          <TabsTrigger value="employees" className="text-xs gap-1.5 py-2 data-[state=active]:bg-card transition-all">
            <Briefcase className="h-3.5 w-3.5" /> قائمة العمال
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-3">
          <CreateContractTab
            employees={employees}
            contracts={contracts}
            entete={entete}
            clubSettings={clubSettings}
            onCreated={refresh}
            onSwitchToArchive={() => setActiveTab("contracts")}
          />
        </TabsContent>
        <TabsContent value="contracts" className="mt-3">
          <ContractsArchiveTab
            contracts={contracts}
            loading={loading}
            onChanged={refresh}
            entete={entete}
            clubSettings={clubSettings}
          />
        </TabsContent>
        <TabsContent value="templates" className="mt-3">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="employees" className="mt-3">
          <EmployeesTab employees={employees} loading={loading} onChanged={refresh} />
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
  // ★ المرحلة 5 (§29): ملف الموظف الكامل
  const [profileEmployee, setProfileEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<any>({
    firstName: "", lastName: "", birthDate: "", birthPlace: "", address: "",
    phone: "", nationalId: "", position: "guard", hourRate: 200, active: true,
    email: "", firstNameFr: "", lastNameFr: "", status: "ACTIVE",
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
    // ★ المرحلة 5 (§3): الحذف أرشفة ناعمة عند وجود بيانات مرتبطة — لا فقدان تاريخ
    if (!confirm("حذف/أرشفة هذا العامل؟ إن كانت له عقود أو ساعات عمل فسيُؤرشف بدل الحذف.")) return;
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      toast.success(data?.archived ? "تمت الأرشفة — البيانات المرتبطة محفوظة" : "تم الحذف");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      firstName: "", lastName: "", birthDate: "", birthPlace: "", address: "",
      phone: "", nationalId: "", position: "guard", hourRate: 200, active: true,
      email: "", firstNameFr: "", lastNameFr: "", status: "ACTIVE",
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
                      <Badge variant="outline" className={cn("text-[10px]", employeeStatusInfo(emp).badge)}>
                        {employeeStatusInfo(emp).label}
                      </Badge>
                    </td>
                    <td className="p-2.5">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => setProfileEmployee(emp)}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                          title="ملف الموظف"
                          aria-label={`ملف الموظف ${emp.lastName} ${emp.firstName}`}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
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
                  <Badge variant="outline" className={cn("text-[9px] shrink-0", employeeStatusInfo(emp).badge)}>
                    {employeeStatusInfo(emp).label}
                  </Badge>
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
                      onClick={() => setProfileEmployee(emp)}
                      className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                      title="ملف الموظف"
                      aria-label={`ملف الموظف ${emp.lastName} ${emp.firstName}`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
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
            <div>
              <Label className="text-xs">البريد الإلكتروني</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">الحالة</Label>
              <select value={form.status || "ACTIVE"} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-9 text-xs rounded border bg-card px-2">
                <option value="ACTIVE">نشط</option>
                <option value="INACTIVE">غير نشط</option>
                <option value="SUSPENDED">موقوف</option>
                <option value="ARCHIVED">مؤرشف</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">الاسم (فرنسي)</Label>
              <Input value={form.firstNameFr || ""} onChange={(e) => setForm({ ...form, firstNameFr: e.target.value })} className="h-9" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">اللقب (فرنسي)</Label>
              <Input value={form.lastNameFr || ""} onChange={(e) => setForm({ ...form, lastNameFr: e.target.value })} className="h-9" dir="ltr" />
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

      {/* ★ المرحلة 5 (§29): ملف الموظف الكامل */}
      {profileEmployee && (
        <EmployeeProfileDialog
          key={profileEmployee.id}
          employee={profileEmployee}
          onClose={() => setProfileEmployee(null)}
        />
      )}
    </div>
  );
}

// ════════════ Tab 2: Contracts Archive ════════════
function ContractsArchiveTab({
  contracts,
  loading,
  onChanged,
  entete: propEntete,
  clubSettings: propClubSettings,
}: {
  contracts: Contract[];
  loading: boolean;
  onChanged: () => void;
  entete?: EnteteConfig | null;
  clubSettings?: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [renewContract, setRenewContract] = useState<Contract | null>(null);
  const [renewDate, setRenewDate] = useState("");
  const [renewing, setRenewing] = useState(false);
  // ★ المرحلة 5 (§24): إنهاء عقد — سبب إلزامي
  const [terminateTarget, setTerminateTarget] = useState<Contract | null>(null);
  const [terminateReason, setTerminateReason] = useState("");
  const [terminating, setTerminating] = useState(false);
  const [entete, setEntete] = useState<EnteteConfig | null>(propEntete || null);
  const [clubSettings, setClubSettings] = useState<Record<string, string>>(propClubSettings || {});

  // مزامنة الترويسة الموحدة من props أو جلبها إذا لم تُمرر
  useEffect(() => {
    if (propEntete) setEntete(propEntete);
    if (propClubSettings && Object.keys(propClubSettings).length > 0) setClubSettings(propClubSettings);
    if (!propEntete || !propClubSettings || Object.keys(propClubSettings).length === 0) {
      let cancelled = false;
      Promise.all([
        fetch("/api/entete").then((r) => r.json()).catch(() => ({})),
        fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
      ]).then(([eData, sData]) => {
        if (cancelled) return;
        if (!propEntete) setEntete(eData.config || null);
        if (!propClubSettings) setClubSettings(sData.settings || {});
      });
      return () => { cancelled = true; };
    }
  }, [propEntete, propClubSettings]);

  // الفلترة: بحث بالاسم/رقم العقد + فلتر الحالة + فلتر نوع العقد (§5)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      const name = c.employee ? `${c.employee.lastName} ${c.employee.firstName}` : "";
      const matchQ = !q || c.contractNumber.toLowerCase().includes(q) || name.toLowerCase().includes(q);
      const matchS = statusFilter === "all" || statusInfo(c).key === statusFilter;
      const matchT = typeFilter === "all" || (c.contractType || "HOURLY") === typeFilter;
      return matchQ && matchS && matchT;
    });
  }, [contracts, search, statusFilter, typeFilter]);

  // ★ المرحلة 5 (§26): الحذف الفعلي للمسودات فقط — العقود الحقيقية تُنهى ناعماً
  const handleDelete = async (c: Contract) => {
    if (c.status !== "draft") {
      toast.error("لا يمكن حذف عقد غير مسودة — استخدم «إنهاء العقد» (التاريخ محفوظ)");
      return;
    }
    if (!confirm("حذف مسودة العقد نهائياً؟")) return;
    try {
      const res = await fetch(`/api/contracts/${c.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      toast.success("تم حذف المسودة");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    }
  };

  // ★ المرحلة 5 (§24): إنهاء عقد ناعم بسبب إلزامي — يظهر فوراً في كل الصفحات
  const handleTerminate = async () => {
    if (!terminateTarget) return;
    if (terminateReason.trim().length < 3) {
      toast.error("سبب الإنهاء إلزامي (3 أحرف على الأقل)");
      return;
    }
    setTerminating(true);
    try {
      const res = await fetch(`/api/contracts/${terminateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate", reason: terminateReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الإنهاء");
      toast.success("تم إنهاء العقد — السبب محفوظ في سجل التدقيق");
      setTerminateTarget(null);
      setTerminateReason("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإنهاء");
    } finally {
      setTerminating(false);
    }
  };

  // ★ تفعيل مسودة (draft → active)
  const handleActivate = async (c: Contract) => {
    try {
      const res = await fetch(`/api/contracts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل التفعيل");
      toast.success("تم تفعيل العقد");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التفعيل");
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
    const docHTML = buildContractDocument(contract, entete, clubSettings);
    printContractHtml(docHTML, contract.contractNumber);
  };

  const handleExportWord = (contract: Contract) => {
    const docHTML = buildContractDocument(contract, entete, clubSettings);
    exportContractHtmlAsWord(docHTML, contract.contractNumber);
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
      {(c.status === "active" || (c.status === "draft" && false)) && (
        <button
          onClick={() => {
            setTerminateTarget(c);
            setTerminateReason("");
          }}
          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors"
          title="إنهاء العقد"
          aria-label={`إنهاء العقد ${c.contractNumber}`}
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
      {c.status === "draft" && (
        <>
          <button
            onClick={() => handleActivate(c)}
            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors"
            title="تفعيل المسودة"
            aria-label={`تفعيل العقد ${c.contractNumber}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDelete(c)}
            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
            title="حذف المسودة"
            aria-label={`حذف مسودة ${c.contractNumber}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
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
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="cancelled">ملغى</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] h-9 text-xs" aria-label="فلترة بنوع العقد">
            <SelectValue placeholder="النوع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {CONTRACT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
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

      {/* ★ المرحلة 5 (§24): حوار إنهاء العقد — سبب إلزامي يُوثَّق في التدقيق */}
      <Dialog open={!!terminateTarget} onOpenChange={(open) => !open && setTerminateTarget(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Ban className="h-4 w-4 text-rose-600" />
              إنهاء العقد {terminateTarget?.contractNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-[11px] text-amber-800">
              إنهاء العقد ناعم: يصبح «منهيّ» ويبقى في الأرشيف مع السبب ومن أنهى —
              لن يُسمح بتسجيل ساعات عمل بعد تاريخ إنهائه إلا بتجاوز صريح.
            </div>
            <div>
              <Label className="text-xs">سبب الإنهاء *</Label>
              <Textarea
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                rows={3}
                className="text-xs"
                placeholder="مثال: نهاية الموسم / استقالة العامل / مخالفة..."
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setTerminateTarget(null)}>إلغاء</Button>
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleTerminate}
              disabled={terminating}
            >
              {terminating && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد الإنهاء
            </Button>
          </div>
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
function CreateContractTab({
  employees,
  contracts,
  entete,
  clubSettings,
  onCreated,
  onSwitchToArchive,
}: {
  employees: Employee[];
  contracts: Contract[];
  entete: EnteteConfig | null;
  clubSettings: Record<string, string>;
  onCreated: () => void;
  onSwitchToArchive: () => void;
}) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // حساب الرقم التسلسلي المقترح للعقد حسب السنة الحالية
  const defaultSeq = useMemo(() => {
    const yrStr = String(currentYear);
    const yrContracts = contracts.filter((c) => c.contractNumber?.includes(yrStr));
    const nextNum = yrContracts.length + 1;
    return String(nextNum).padStart(2, "0");
  }, [contracts, currentYear]);

  // حالة النموذج
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [contractNumber, setContractNumber] = useState<string>(`${defaultSeq} / ن.ر.ر.س. ${currentYear}`);
  const [contractType, setContractType] = useState<string>("FIXED_TERM");
  const [title, setTitle] = useState<string>("عقد عمل محدد المدة (CDD) — حارس سباحة");
  const [startDate, setStartDate] = useState<string>("2026-06-21");
  const [endDate, setEndDate] = useState<string>("2026-09-21");

  // الطرف الأول (صاحب العمل)
  const defaultClubName = clubSettings.clubName || "الجمعية الرياضية الهاوية النادي الرياضي متعدد الرياضات الرائد لبلدية سعيدة – فرع السباحة";
  const defaultClubAddress = clubSettings.clubAddress || "طاب لحسن";
  const defaultFirstPartyRep = clubSettings.branchPresident || clubSettings.clubPresident || ".................................";
  const [clubName, setClubName] = useState<string>(defaultClubName);
  const [clubAddress, setClubAddress] = useState<string>(defaultClubAddress);
  const [firstPartyRep, setFirstPartyRep] = useState<string>(defaultFirstPartyRep);
  const [firstPartyRole, setFirstPartyRole] = useState<string>("رئيس فرع السباحة");

  // الطرف الثاني (العامل)
  const [workerName, setWorkerName] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");
  const [birthPlace, setBirthPlace] = useState<string>("سعيدة");
  const [address, setAddress] = useState<string>("سعيدة");
  const [nationalId, setNationalId] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [position, setPosition] = useState<string>("حارس سباحة (منقذ مائي)");

  // تأشيرة رئيس الجمعية الرياضية الهاوية
  const defaultAssocPres = clubSettings.associationPresident || clubSettings.clubPresident || ".................................";
  const [assocPresident, setAssocPresident] = useState<string>(defaultAssocPres);
  const [assocRole, setAssocRole] = useState<string>("رئيس الجمعية الرياضية الهاوية");

  // بنود العمل والأجر
  const [workplace, setWorkplace] = useState<string>("المسبح النصف الأولمبي طاب لحسن");
  const [workSchedule, setWorkSchedule] = useState<string>(
    "احترام جدول العمل الذي تحدده إدارة فرع السباحة، الحضور قبل بداية العمل بـ15 دقيقة، ويمنع مغادرة المنصب دون ترخيص."
  );
  const [wageType, setWageType] = useState<"hourly" | "monthly">("hourly");
  const [hourRate, setHourRate] = useState<number>(200);
  const [monthlySalary, setMonthlySalary] = useState<number>(30000);
  const [city, setCity] = useState<string>(clubSettings.wilaya || "سعيدة");
  const [contractDate, setContractDate] = useState<string>(formatDate(new Date()));
  const [notes, setNotes] = useState<string>("");

  // محرر نصوص المواد
  const [showArticlesEditor, setShowArticlesEditor] = useState<boolean>(false);
  const [customArticlesHTML, setCustomArticlesHTML] = useState<string>(OFFICIAL_CDD_TEMPLATE_HTML);

  const [saving, setSaving] = useState<boolean>(false);

  // تحديث الحقول تلقائياً عند تغيير الإعدادات العامة
  useEffect(() => {
    if (clubSettings.clubName) setClubName(clubSettings.clubName);
    if (clubSettings.clubAddress) setClubAddress(clubSettings.clubAddress);
    if (clubSettings.branchPresident || clubSettings.clubPresident) {
      setFirstPartyRep(clubSettings.branchPresident || clubSettings.clubPresident || "");
    }
    if (clubSettings.associationPresident) {
      setAssocPresident(clubSettings.associationPresident);
    }
    if (clubSettings.wilaya) setCity(clubSettings.wilaya);
  }, [clubSettings]);

  // ملء بيانات العامل تلقائياً عند اختياره من القائمة
  useEffect(() => {
    if (!selectedEmpId) return;
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;
    setWorkerName(`${emp.lastName} ${emp.firstName}`.trim());
    if (emp.birthDate) {
      const d = new Date(emp.birthDate);
      if (!isNaN(d.getTime())) {
        setBirthDate(d.toISOString().split("T")[0]);
      }
    }
    if (emp.birthPlace) setBirthPlace(emp.birthPlace);
    if (emp.address) setAddress(emp.address);
    if (emp.nationalId) setNationalId(emp.nationalId);
    if (emp.phone) setPhone(emp.phone);
    if (emp.position) setPosition(positionLabel(emp.position));
    if (emp.hourRate && emp.hourRate > 0) setHourRate(emp.hourRate);
  }, [selectedEmpId, employees]);

  // صياغة بند الأجر (المادة 05 لا يُكتب فيها السعر أو الحجم الساعي في العقد)
  const wageClause = useMemo(() => {
    if (wageType === "monthly" && Number(monthlySalary) > 0) {
      return `يتقاضى الطرف الثاني راتباً شهرياً قدره ${Number(monthlySalary).toLocaleString("en-US")} دج عن كل شهر عمل.`;
    }
    return "يتقاضى الطرف الثاني أجرًا يُحسب على أساس الحجم الساعي كل شهر.";
  }, [wageType, monthlySalary]);

  // المتغيرات الجاهزة للاستبدال
  const currentVariables = useMemo(() => {
    return {
      contract_number: contractNumber || "......... / ن.ر.ر.س. 2026",
      club_name: clubName || "الجمعية الرياضية الهاوية النادي الرياضي متعدد الرياضات الرائد لبلدية سعيدة – فرع السباحة",
      club_address: clubAddress || "طاب لحسن",
      first_party_rep: firstPartyRep || ".................................",
      first_party_role: firstPartyRole || "رئيس فرع السباحة",
      worker_name: workerName || ".......................",
      birth_date: birthDate ? formatDate(birthDate) : "...................",
      birth_place: birthPlace || "سعيدة",
      address: address || "سعيدة",
      national_id: nationalId || "............................................",
      phone: phone || ".....................",
      position: position || "حارس سباحة (منقذ مائي)",
      start_date: startDate ? formatDate(startDate) : "21/06/2026",
      end_date: endDate ? formatDate(endDate) : "21/09/2026",
      workplace: workplace || "المسبح النصف الأولمبي طاب لحسن",
      work_schedule: workSchedule,
      wage_clause: wageClause,
      city: city || "سعيدة",
      contract_date: contractDate || formatDate(new Date()),
      association_president: assocPresident || ".................................",
      association_president_role: assocRole || "رئيس الجمعية الرياضية الهاوية",
    };
  }, [
    contractNumber, clubName, clubAddress, firstPartyRep, firstPartyRole,
    workerName, birthDate, birthPlace, address, nationalId, phone, position,
    startDate, endDate, workplace, workSchedule, wageClause, city, contractDate,
    assocPresident, assocRole,
  ]);

  // جسم العقد النهائي بعد استبدال المتغيرات
  const renderedBodyHTML = useMemo(() => {
    return substituteVariables(customArticlesHTML || OFFICIAL_CDD_TEMPLATE_HTML, currentVariables);
  }, [customArticlesHTML, currentVariables]);

  // المستند الكامل: ترويسة موحدة + جسم العقد + التواقيع
  const fullDocumentHTML = useMemo(() => {
    const headerHTML = unifiedReportHeaderHTML({
      reportType: "عقد عمل محدد المدة (CDD)",
      reportNumber: contractNumber || "......... / ن.ر.ر.س. 2026",
      date: contractDate || formatDate(new Date()),
      entete: entete || undefined,
      settings: {
        clubName: clubName,
        branchName: clubSettings.branchName || "فرع السباحة",
        wilaya: city || "سعيدة",
        clubAddress: clubAddress,
        clubPhone: clubSettings.clubPhone,
        clubEmail: clubSettings.clubEmail,
        clubWebsite: clubSettings.clubWebsite,
        sportSeason: clubSettings.sportSeason || "2026/2027",
      },
    });

    return `
      <div class="contract-official-wrapper" style="direction:rtl;text-align:right;">
        ${headerHTML}
        <div style="margin-top:14px;">
          ${renderedBodyHTML}
        </div>
      </div>
    `;
  }, [contractNumber, contractDate, entete, clubName, clubSettings, city, clubAddress, renderedBodyHTML]);

  // ملء بيانات نموذجية للاختبار والمعاينة
  const handleFillSample = () => {
    setContractNumber(`01 / ن.ر.ر.س. ${currentYear}`);
    setWorkerName("سفيان بن علي");
    setBirthDate("1995-04-12");
    setBirthPlace("سعيدة");
    setAddress("حي النصر، بلدية سعيدة");
    setNationalId("108920192837482910");
    setPhone("0661234567");
    setPosition("حارس سباحة (منقذ مائي)");
    setStartDate("2026-06-21");
    setEndDate("2026-09-21");
    setWorkplace("المسبح النصف الأولمبي طاب لحسن");
    setWorkSchedule("احترام جدول العمل الذي تحدده إدارة فرع السباحة، الحضور قبل بداية العمل بـ15 دقيقة، ويمنع مغادرة المنصب دون ترخيص.");
    setWageType("hourly");
    setHourRate(250);
    setCity("سعيدة");
    setContractDate("21/06/2026");
    setFirstPartyRep(clubSettings.branchPresident || clubSettings.clubPresident || "عبد القادر دحمان");
    setFirstPartyRole("رئيس فرع السباحة");
    setAssocPresident(clubSettings.associationPresident || clubSettings.clubPresident || "محمد بلقاسم");
    setAssocRole("رئيس الجمعية الرياضية الهاوية");
    toast.success("تم ملء البيانات النموذجية لتجربة المعاينة الفورية");
  };

  // استعادة النموذج الافتراضي الأصلي
  const handleReset = () => {
    setCustomArticlesHTML(OFFICIAL_CDD_TEMPLATE_HTML);
    setContractNumber(`${defaultSeq} / ن.ر.ر.س. ${currentYear}`);
    setStartDate("2026-06-21");
    setEndDate("2026-09-21");
    setWorkplace("المسبح النصف الأولمبي طاب لحسن");
    setWageType("hourly");
    setHourRate(200);
    toast.info("تمت استعادة النموذج والبنود الإدارية الافتراضية");
  };

  // الطباعة المباشرة
  const handleInstantPrint = () => {
    printContractHtml(fullDocumentHTML, contractNumber || "عقد-عمل-محدد-المدة");
  };

  // التصدير إلى Word
  const handleInstantWord = () => {
    exportContractHtmlAsWord(fullDocumentHTML, contractNumber || "عقد-عمل-محدد-المدة");
  };

  // حفظ العقد في قاعدة البيانات (نشط أو مسودة)
  const handleSaveContract = async (asDraft: boolean) => {
    let empId = selectedEmpId;
    if (!empId) {
      const found = employees.find(
        (e) => `${e.lastName} ${e.firstName}`.trim().toLowerCase() === workerName.trim().toLowerCase()
      );
      if (found) {
        empId = found.id;
      } else if (employees.length > 0) {
        toast.error("يرجى اختيار العامل من القائمة لربط العقد بملفه وساعاته");
        return;
      } else {
        toast.error("يرجى إضافة عمال في قائمة العمال أولاً");
        return;
      }
    }

    if (!startDate) {
      toast.error("يرجى إدخال تاريخ بداية العقد");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: empId,
          contractNumber: contractNumber.trim() || undefined,
          contractType,
          title: title.trim() || "عقد عمل محدد المدة (CDD)",
          startDate,
          endDate: endDate || null,
          hourRate: wageType === "hourly" ? hourRate : undefined,
          monthlySalary: wageType === "monthly" ? monthlySalary : null,
          wageClause,
          workSchedule,
          workplace,
          firstPartyRep,
          firstPartyRole,
          associationPresident: assocPresident,
          associationPresidentRole: assocRole,
          city,
          contractDate,
          customContent: fullDocumentHTML,
          notes,
          asDraft,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل إنشاء العقد");
      }

      const data = await res.json();
      toast.success(
        asDraft
          ? `تم حفظ المسودة بنجاح (${data.contract.contractNumber})`
          : `تم اعتماد العقد ${data.contract.contractNumber} وحفظه في الأرشيف بنجاح`
      );

      onCreated();
      onSwitchToArchive();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل حفظ العقد";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── شريط رأس القسم ── */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-l from-card via-card to-teal-500/5 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 rounded-2xl bg-teal-600/10 text-teal-700 items-center justify-center shrink-0 shadow-inner">
              <FileSignature className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base md:text-lg text-foreground tracking-tight">
                  إنشاء وتحرير عقد عمل موحّد (CDD)
                </h3>
                <Badge className="bg-teal-600 text-white text-[10px] px-2 py-0.5 font-bold">
                  النموذج الرسمي المعتمد
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                الطرف الأول (فرع السباحة) • الطرف الثاني (العامل) • تأشيرة رئيس الجمعية • الترويسة الموحدة
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFillSample}
              className="text-xs gap-1.5 border-teal-500/40 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40"
              title="ملء بيانات نموذجية للاختبار والمعاينة الفورية"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              نموذج تجريبي
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              title="استعادة البنود الإدارية الافتراضية"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              استعادة الافتراضي
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSwitchToArchive}
              className="text-xs gap-1.5"
            >
              <Archive className="h-3.5 w-3.5" />
              أرشيف العقود
            </Button>
          </div>
        </div>
      </div>

      {/* ── تقسيم الصفحة: عمود الإدخال (يمين) + عمود المعاينة المباشرة (يسار) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ══════════ عمود المدخلات (5 أعمدة على الشاشات الكبيرة) ══════════ */}
        <div className="xl:col-span-5 space-y-4">
          {/* بطاقة الطرف الثاني (العامل) */}
          <div className="rounded-2xl border border-teal-500/30 bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-bold text-teal-700 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" />
                معلومات الطرف الثاني (العامل)
              </span>
              <span className="text-[10px] text-muted-foreground">ربط فوري بملف الموظف</span>
            </div>

            <div>
              <Label className="text-xs font-semibold">اختيار العامل من السجل *</Label>
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger className="w-full h-9 text-xs mt-1 bg-muted/20">
                  <SelectValue placeholder="— اختر العامل لملء البيانات تلقائياً —" />
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">الاسم واللقب *</Label>
                <Input
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="سفيان بن علي"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">المهنة / الصفة في العقد</Label>
                <Input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="حارس سباحة (منقذ مائي)"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">تاريخ الميلاد</Label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="h-8 text-xs mt-1"
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="text-xs">مكان الميلاد</Label>
                <Input
                  value={birthPlace}
                  onChange={(e) => setBirthPlace(e.target.value)}
                  placeholder="سعيدة"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">العنوان</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="سعيدة"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">رقم الهاتف</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0661234567"
                  className="h-8 text-xs mt-1"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">رقم بطاقة التعريف الوطنية</Label>
              <Input
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="108920192837482910"
                className="h-8 text-xs mt-1 font-mono"
                dir="ltr"
              />
            </div>
          </div>

          {/* بطاقة الطرف الأول (صاحب العمل) */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                معلومات الطرف الأول (صاحب العمل)
              </span>
              <Badge variant="outline" className="text-[9px]">فرع السباحة</Badge>
            </div>

            <div>
              <Label className="text-xs">الجمعية الرياضية الهاوية</Label>
              <Input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">الكائن مقرها بـ</Label>
                <Input
                  value={clubAddress}
                  onChange={(e) => setClubAddress(e.target.value)}
                  placeholder="طاب لحسن"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">ويمثلها السيد</Label>
                <Input
                  value={firstPartyRep}
                  onChange={(e) => setFirstPartyRep(e.target.value)}
                  placeholder="اسم ممثل النادي"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">صفة ممثل الطرف الأول</Label>
              <Input
                value={firstPartyRole}
                onChange={(e) => setFirstPartyRole(e.target.value)}
                placeholder="رئيس فرع السباحة"
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* بطاقة تأشيرة رئيس الجمعية الرياضية الهاوية */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-500 flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                تأشيرة رئيس الجمعية الرياضية الهاوية (للنادي)
              </span>
              <span className="text-[10px] text-muted-foreground">التوقيع والختم الإداري الثالث</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">الاسم واللقب</Label>
                <Input
                  value={assocPresident}
                  onChange={(e) => setAssocPresident(e.target.value)}
                  placeholder="اسم رئيس الجمعية"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">الصفة الرسمية</Label>
                <Input
                  value={assocRole}
                  onChange={(e) => setAssocRole(e.target.value)}
                  placeholder="رئيس الجمعية الرياضية الهاوية"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* بطاقة تفاصيل العقد وبنود العمل */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                بيانات العقد والمدة ومكان العمل والأجر
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">رقم العقد *</Label>
                <Input
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  placeholder="01 / ن.ر.ر.س. 2026"
                  className="h-8 text-xs mt-1 font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="text-xs">تاريخ التحرير (سعيدة في:)</Label>
                <Input
                  value={contractDate}
                  onChange={(e) => setContractDate(e.target.value)}
                  placeholder="21/06/2026"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">سريان العقد ابتداءً من *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs mt-1"
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="text-xs">إلى غاية تاريخ</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs mt-1"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">مكان العمل (المادة 03)</Label>
              <Input
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value)}
                placeholder="المسبح النصف الأولمبي طاب لحسن"
                className="h-8 text-xs mt-1"
              />
            </div>

            {/* طريقة احتساب الأجر (المادة 05) */}
            <div className="p-2.5 rounded-xl bg-muted/40 space-y-2 border border-border/40">
              <Label className="text-xs font-bold flex items-center gap-1 text-teal-700">
                <DollarSign className="h-3.5 w-3.5" />
                طريقة احتساب الأجر (المادة 05)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWageType("hourly")}
                  className={cn(
                    "text-xs py-1.5 px-2 rounded-lg border text-center font-medium transition-all",
                    wageType === "hourly"
                      ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                      : "bg-card hover:bg-muted border-border text-foreground"
                  )}
                >
                  حسب الحجم الساعي
                </button>
                <button
                  type="button"
                  onClick={() => setWageType("monthly")}
                  className={cn(
                    "text-xs py-1.5 px-2 rounded-lg border text-center font-medium transition-all",
                    wageType === "monthly"
                      ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                      : "bg-card hover:bg-muted border-border text-foreground"
                  )}
                >
                  راتب شهري ثابت
                </button>
              </div>

              {wageType === "hourly" ? (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground">سعر الساعة بالنظام (دج/ساعة)</Label>
                    <span className="text-[10px] text-amber-600 font-medium">للحساب الداخلي للنظام فقط — لا يُكتب في العقد</span>
                  </div>
                  <Input
                    type="number"
                    value={hourRate}
                    onChange={(e) => setHourRate(+e.target.value)}
                    className="h-8 text-xs mt-1"
                    placeholder="200"
                  />
                  <div className="mt-1.5 p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-900 dark:text-teal-200 font-medium leading-relaxed">
                    نص المادة 05 في العقد: <strong>«يتقاضى الطرف الثاني أجرًا يُحسب على أساس الحجم الساعي كل شهر.»</strong>
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-[11px] text-muted-foreground">الراتب الشهري الصافي (دج/شهر)</Label>
                  <Input
                    type="number"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(+e.target.value)}
                    className="h-8 text-xs mt-1"
                    placeholder="30000"
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">أوقات العمل وجدول الدوام (المادة 04)</Label>
              <Textarea
                value={workSchedule}
                onChange={(e) => setWorkSchedule(e.target.value)}
                rows={2}
                className="text-xs mt-1 resize-none"
              />
            </div>

            <div>
              <Label className="text-xs">ملاحظات داخلية (اختياري)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
                placeholder="ملاحظات لإدارة النادي لا تظهر في العقد المطبوع..."
                className="text-xs mt-1 resize-none"
              />
            </div>
          </div>

          {/* محرر المواد القانونية (قابلة للتعديل والطي) */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setShowArticlesEditor(!showArticlesEditor)}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-foreground hover:bg-muted/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-600" />
                تخصيص نصوص المواد العشر (المادة 01 إلى 10)
              </span>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>{showArticlesEditor ? "إخفاء المحرر" : "فتح والتعديل"}</span>
                {showArticlesEditor ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {showArticlesEditor && (
              <div className="p-3 border-t border-border/60 bg-muted/20 space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  يمكنك تعديل أي مادة من المواد العشر أدناه. تستبدل المتغيرات المضمنة بين <code className="font-mono bg-muted px-1 rounded">{"{{}}"}</code> تلقائياً:
                </p>
                <Textarea
                  value={customArticlesHTML}
                  onChange={(e) => setCustomArticlesHTML(e.target.value)}
                  rows={14}
                  className="font-mono text-[11px] dir-ltr text-left"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomArticlesHTML(OFFICIAL_CDD_TEMPLATE_HTML)}
                  className="text-xs text-rose-600 hover:text-rose-700"
                >
                  <RotateCcw className="h-3 w-3 ml-1" />
                  استعادة النص النموذجي الأصلي للمواد العشر
                </Button>
              </div>
            )}
          </div>

          {/* أزرار الحفظ والإجراءات في عمود المدخلات */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              onClick={() => handleSaveContract(false)}
              disabled={saving}
              className="h-10 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              حفظ واعتماد العقد
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSaveContract(true)}
              disabled={saving}
              className="h-10 text-xs font-bold gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              حفظ كمسودة
            </Button>
          </div>
        </div>

        {/* ══════════ عمود المعاينة المباشرة المطبوعة (7 أعمدة على الشاشات الكبيرة) ══════════ */}
        <div className="xl:col-span-7 space-y-3">
          {/* شريط الإجراءات السريعة للمعاينة */}
          <div className="rounded-xl border border-border/60 bg-card p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-foreground">
                معاينة مستند A4 المعتمد (الترويسة الموحدة + التواقيع)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={handleInstantPrint}
                className="h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 gap-1"
                title="طباعة العقد بمقاس A4 أو حفظه كـ PDF"
              >
                <Printer className="h-3.5 w-3.5" />
                طباعة فورية / PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleInstantWord}
                className="h-8 text-xs font-medium gap-1"
                title="تصدير بصيغة Word جاهز للتعديل"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                Word
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSaveContract(false)}
                disabled={saving}
                className="h-8 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white gap-1"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                اعتماد وحفظ
              </Button>
            </div>
          </div>

          {/* حاوية الورقة A4 المطبوعة */}
          <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 shadow-inner">
            <div className="mx-auto w-full max-w-[210mm] bg-white rounded-xl shadow-xl border border-slate-200 p-5 md:p-8 max-h-[820px] overflow-y-auto text-foreground print:max-h-none print:shadow-none print:border-none">
              <div dangerouslySetInnerHTML={{ __html: fullDocumentHTML }} />
            </div>
          </div>

          {/* شريط الإجراءات السفلي لتسهيل الاستخدام بعد التمرير */}
          <div className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-xl text-xs text-muted-foreground">
            <span>جاهز للتسليم والاعتماد الإداري من 3 نسخ</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleInstantPrint}
                className="h-8 text-xs gap-1"
              >
                <Printer className="h-3.5 w-3.5" />
                طباعة سريعة
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSaveContract(false)}
                disabled={saving}
                className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                اعتماد العقد
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

