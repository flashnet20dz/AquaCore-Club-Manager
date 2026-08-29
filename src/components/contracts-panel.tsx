"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Briefcase, FileText, Plus, Edit2, Trash2, Printer, Download,
  Loader2, RefreshCw, Archive, Eye, X, Save, FilePlus, UserPlus,
  Calendar, Phone, MapPin, Hash, DollarSign, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UnifiedReportHeader, unifiedReportHeaderHTML } from "@/components/unified-report-header";
import type { EnteteConfig } from "@/components/unified-report-header";
import { AVAILABLE_VARIABLES, substituteVariables } from "@/lib/contract-variables";

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

// ════════════ Main Component ════════════
export function ContractsPanel() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="employees" className="text-xs flex-1 gap-1">
            <Briefcase className="h-3.5 w-3.5" /> قائمة العمال
          </TabsTrigger>
          <TabsTrigger value="contracts" className="text-xs flex-1 gap-1">
            <FileText className="h-3.5 w-3.5" /> أرشيف العقود
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs flex-1 gap-1">
            <Layers className="h-3.5 w-3.5" /> قوالب العقود
          </TabsTrigger>
          <TabsTrigger value="create" className="text-xs flex-1 gap-1">
            <FilePlus className="h-3.5 w-3.5" /> إنشاء عقد
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-3">
          <EmployeesTab />
        </TabsContent>
        <TabsContent value="contracts" className="mt-3">
          <ContractsArchiveTab />
        </TabsContent>
        <TabsContent value="templates" className="mt-3">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="create" className="mt-3">
          <CreateContractTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ════════════ Tab 1: Employees ════════════
function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<any>({
    firstName: "", lastName: "", birthDate: "", birthPlace: "", address: "",
    phone: "", nationalId: "", position: "guard", hourRate: 200, active: true,
  });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch {
      toast.error("فشل تحميل العمال");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleSave = async () => {
    if (!form.firstName || !form.lastName) {
      toast.error("الاسم واللقب مطلوبان");
      return;
    }
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
      fetchEmployees();
    } catch {
      toast.error("فشل الحفظ");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا العامل؟ سيتم حذف جميع عقوده.")) return;
    try {
      await fetch(`/api/employees/${id}`, { method: "DELETE" });
      toast.success("تم الحذف");
      fetchEmployees();
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
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-base">قائمة العمال</h3>
          <Badge variant="outline" className="text-[10px]">{employees.length}</Badge>
        </div>
        <Button size="sm" onClick={openAdd}>
          <UserPlus className="h-4 w-4 ml-1" /> إضافة عامل
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">لا يوجد عمال بعد</p>
          <p className="text-xs mt-1">اضغط "إضافة عامل" لإنشاء أول عامل</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b">
              <tr className="text-right">
                <th className="p-2 font-semibold">الاسم واللقب</th>
                <th className="p-2 font-semibold">المنصب</th>
                <th className="p-2 font-semibold">الهاتف</th>
                <th className="p-2 font-semibold">تاريخ التوظيف</th>
                <th className="p-2 font-semibold">العقود</th>
                <th className="p-2 font-semibold">الحالة</th>
                <th className="p-2 font-semibold text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-accent/30">
                  <td className="p-2 font-semibold">{emp.lastName} {emp.firstName}</td>
                  <td className="p-2">{positionLabel(emp.position)}</td>
                  <td className="p-2 font-mono" dir="ltr">{emp.phone || "—"}</td>
                  <td className="p-2">{formatDate(emp.hireDate)}</td>
                  <td className="p-2 text-center">
                    <Badge variant="outline" className="text-[10px]">{emp.contracts?.length || 0}</Badge>
                  </td>
                  <td className="p-2">
                    {emp.active ? (
                      <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/30">نشط</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/30">متوقف</Badge>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-0.5 justify-center">
                      <button onClick={() => openEdit(emp)} className="p-1.5 hover:bg-accent rounded text-primary" title="تعديل">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="p-1.5 hover:bg-rose-500/10 rounded text-rose-500" title="حذف">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل بيانات العامل" : "إضافة عامل جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="col-span-2">
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
            <Button onClick={handleSave}>{editing ? "حفظ" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════ Tab 2: Contracts Archive ════════════
function ContractsArchiveTab() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewContract, setViewContract] = useState<Contract | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contracts");
      const data = await res.json();
      setContracts(data.contracts || []);
    } catch {
      toast.error("فشل تحميل العقود");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا العقد؟")) return;
    await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    toast.success("تم الحذف");
    fetchContracts();
  };

  const handleRenew = async (id: string) => {
    const newEndDate = prompt("أدخل تاريخ نهاية العقد الجديد (YYYY-MM-DD):");
    if (!newEndDate) return;
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "renew", newEndDate }),
      });
      if (!res.ok) throw new Error();
      toast.success("تم تجديد العقد بنجاح");
      fetchContracts();
    } catch {
      toast.error("فشل التجديد");
    }
  };

  const handlePrint = (contract: Contract) => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const headerHTML = unifiedReportHeaderHTML({
      reportType: "عقد عمل",
      reportNumber: contract.contractNumber,
      date: formatDate(new Date()),
    });
    printWin.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>عقد ${contract.contractNumber}</title>
      <style>
        *{font-family:'Cairo','Tahoma',Arial,sans-serif;box-sizing:border-box;}
        body{padding:15px;}
        @media print{body{padding:0;}}
      </style></head><body>
      ${headerHTML}
      ${contract.content}
      <script>setTimeout(()=>window.print(),300);</script>
      </body></html>
    `);
    printWin.document.close();
  };

  const handleExportWord = (contract: Contract) => {
    const headerHTML = unifiedReportHeaderHTML({
      reportType: "عقد عمل",
      reportNumber: contract.contractNumber,
      date: formatDate(new Date()),
    });
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>عقد ${contract.contractNumber}</title>
<style>
  *{font-family:'Cairo','Tahoma',Arial,sans-serif;}
  body{padding:15px;}
  @page{size:A4;margin:1.5cm;}
</style></head>
<body>
${headerHTML}
${contract.content}
</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `عقد_${contract.contractNumber}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Archive className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-base">أرشيف العقود</h3>
        <Badge variant="outline" className="text-[10px]">{contracts.length}</Badge>
      </div>

      {contracts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">لا توجد عقود بعد</p>
          <p className="text-xs mt-1">اذهب إلى "إنشاء عقد" لإنشاء أول عقد</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b">
              <tr className="text-right">
                <th className="p-2 font-semibold">رقم العقد</th>
                <th className="p-2 font-semibold">العامل</th>
                <th className="p-2 font-semibold">المنصب</th>
                <th className="p-2 font-semibold">تاريخ البداية</th>
                <th className="p-2 font-semibold">تاريخ النهاية</th>
                <th className="p-2 font-semibold">النسخة</th>
                <th className="p-2 font-semibold">الحالة</th>
                <th className="p-2 font-semibold text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-b hover:bg-accent/30">
                  <td className="p-2 font-mono font-semibold">{c.contractNumber}</td>
                  <td className="p-2">{c.employee ? `${c.employee.lastName} ${c.employee.firstName}` : "—"}</td>
                  <td className="p-2">{positionLabel(c.position)}</td>
                  <td className="p-2">{formatDate(c.startDate)}</td>
                  <td className="p-2">{formatDate(c.endDate)}</td>
                  <td className="p-2 text-center">v{c.version}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      c.status === "active" && "bg-green-500/10 text-green-700 border-green-500/30",
                      c.status === "expired" && "bg-amber-500/10 text-amber-700 border-amber-500/30",
                      c.status === "terminated" && "bg-red-500/10 text-red-700 border-red-500/30",
                      c.status === "renewed" && "bg-blue-500/10 text-blue-700 border-blue-500/30",
                    )}>
                      {c.status === "active" ? "نشط" : c.status === "expired" ? "منتهي" : c.status === "terminated" ? "ملغى" : "مجدّد"}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-0.5 justify-center">
                      <button onClick={() => setViewContract(c)} className="p-1.5 hover:bg-accent rounded text-primary" title="عرض">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handlePrint(c)} className="p-1.5 hover:bg-accent rounded text-primary" title="طباعة">
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleExportWord(c)} className="p-1.5 hover:bg-accent rounded text-primary" title="Word">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleRenew(c.id)} className="p-1.5 hover:bg-accent rounded text-blue-500" title="تجديد">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-rose-500/10 rounded text-rose-500" title="حذف">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contract Viewer Dialog */}
      <Dialog open={!!viewContract} onOpenChange={(o) => !o && setViewContract(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>عقد: {viewContract?.contractNumber}</span>
              <Button variant="ghost" size="sm" onClick={() => setViewContract(null)}><X className="h-4 w-4" /></Button>
            </DialogTitle>
          </DialogHeader>
          {viewContract && (
            <div className="space-y-3">
              <UnifiedReportHeader
                reportType="عقد عمل"
                reportNumber={viewContract.contractNumber}
              />
              <div
                className="bg-white rounded-xl border border-border/60 p-4 text-foreground"
                dangerouslySetInnerHTML={{ __html: viewContract.content }}
              />
              <div className="flex gap-2 pt-3 border-t">
                <Button size="sm" variant="outline" onClick={() => handlePrint(viewContract)}>
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
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-base">قوالب العقود</h3>
          <Badge variant="outline" className="text-[10px]">{templates.length}</Badge>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 ml-1" /> إضافة قالب
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-border/60 p-3 hover:border-primary/40 transition">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-sm">{t.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{t.code}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{t.defaultDuration} يوم</Badge>
            </div>
            {t.description && <p className="text-xs text-muted-foreground mb-2">{t.description}</p>}
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => openEdit(t)}>
                <Edit2 className="h-3 w-3 ml-1" /> تعديل
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-rose-500" onClick={() => handleDelete(t.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Template Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل القالب" : "إضافة قالب جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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
                      className="text-right p-1.5 rounded border border-border hover:border-primary/40 hover:bg-accent/50 text-[11px]"
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
function CreateContractTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
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
    Promise.all([
      fetch("/api/employees").then((r) => r.json()),
      fetch("/api/contract-templates").then((r) => r.json()),
    ]).then(([empData, tplData]) => {
      setEmployees(empData.employees || []);
      setTemplates(tplData.templates || []);
      setLoading(false);
    }).catch(() => setLoading(false));
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
    } catch {
      toast.error("فشل إنشاء العقد");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FilePlus className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-base">إنشاء عقد جديد</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        يتم تعبئة بيانات العقد تلقائياً من بيانات العامل، مع توليد رقم عقد فريد، وحفظ نسخة في الأرشيف.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: form */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs flex items-center gap-1"><Briefcase className="h-3 w-3" /> العامل *</Label>
            <select
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="w-full h-9 text-xs rounded border bg-card px-2"
            >
              <option value="">— اختر العامل —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.lastName} {emp.firstName} — {positionLabel(emp.position)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><Layers className="h-3 w-3" /> القالب *</Label>
            <select
              value={form.templateId}
              onChange={(e) => setForm({ ...form, templateId: e.target.value })}
              className="w-full h-9 text-xs rounded border bg-card px-2"
            >
              <option value="">— اختر القالب —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
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

        {/* Right: live preview */}
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
  );
}
