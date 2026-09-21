"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Plus, Search, Filter, Printer, Download,
  FileText, Calendar, Building2, User, AlertCircle,
  Clock, CheckCircle2, Archive, Trash2, Edit3, Eye,
  Paperclip, ExternalLink, RefreshCw, Send, ShieldAlert,
  ChevronDown, ArrowUpDown, FileCheck, FileX, Tag, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { toLocalYMD } from "@/lib/wall-clock";
import { cn } from "@/lib/utils";
import { unifiedReportHeaderHTML, UnifiedReportHeader } from "@/components/unified-report-header";

export interface IncomingMail {
  id: string;
  mailNumber: string;
  seq: number;
  year: number;
  receivedDate: string;
  letterNumber: string;
  letterDate: string;
  sender: string;
  senderType?: string | null;
  subject: string;
  documentType: string;
  urgency: "normal" | "urgent" | "top_urgent" | "confidential";
  assignedTo?: string | null;
  deliveryMethod: string;
  notes?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: "new" | "in_progress" | "referred" | "completed" | "archived";
  referralDate?: string | null;
  processedDate?: string | null;
  createdAt: string;
}

interface IncomingMailStats {
  total: number;
  new: number;
  in_progress: number;
  referred: number;
  completed: number;
  archived: number;
}

const COMMON_SENDERS = [
  "مديرية الشباب والرياضة لولاية سعيدة",
  "بلدية سعيدة",
  "ديوان المركب المتعدد الرياضات (OPOW)",
  "الرابطة الولائية للسباحة سعيدة",
  "الاتحادية الجزائرية للسباحة (FAN)",
  "مصالح الحماية المدنية",
  "صندوق التأمينات الاجتماعية (CNAS)",
  "مفتشية العمل",
  "مؤسسة عمومية",
  "جمعية / نادي رياضي",
  "شخص / مواطن",
  "أخرى",
];

const DOCUMENT_TYPES = [
  "مراسلة",
  "طلب",
  "استدعاء",
  "إعذار",
  "تقرير",
  "فاتورة",
  "دعوة",
  "قرار",
  "ترخيص",
  "وثيقة إدارية",
  "أخرى",
];

const DELIVERY_METHODS: Record<string, string> = {
  hand: "باليد",
  registered_mail: "بريد مسجل",
  mail: "بريد عادي",
  email: "بريد إلكتروني",
  fax: "فاكس",
  other: "أخرى",
};

const URGENCY_CONFIG: Record<string, { label: string; cls: string }> = {
  normal: { label: "عادي", cls: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  urgent: { label: "عاجل", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  top_urgent: { label: "عاجل جداً", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold" },
  confidential: { label: "سري", cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 font-bold" },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  new: { label: "جديد", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", icon: Clock },
  in_progress: { label: "قيد المعالجة", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: ArrowUpDown },
  referred: { label: "محال إلى المسؤول", cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30", icon: Send },
  completed: { label: "تمت المعالجة", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  archived: { label: "مؤرشف", cls: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30", icon: Archive },
};

interface IncomingMailPanelProps {
  userRole?: string;
}

export function IncomingMailPanel({ userRole = "admin" }: IncomingMailPanelProps) {
  const canManage = ["admin", "superadmin", "assistant"].includes(userRole);
  const isAdmin = ["admin", "superadmin"].includes(userRole);

  const [mails, setMails] = useState<IncomingMail[]>([]);
  const [stats, setStats] = useState<IncomingMailStats>({
    total: 0, new: 0, in_progress: 0, referred: 0, completed: 0, archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [nextNumber, setNextNumber] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  // فلاتر
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");

  // حوار الإضافة / التعديل
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IncomingMail | null>(null);

  // حوار العرض
  const [viewTarget, setViewTarget] = useState<IncomingMail | null>(null);

  // حقول النموذج
  const [formData, setFormData] = useState({
    mailNumber: "",
    receivedDate: toLocalYMD(),
    letterNumber: "",
    letterDate: toLocalYMD(),
    sender: "",
    senderCustom: "",
    subject: "",
    documentType: "مراسلة",
    documentTypeCustom: "",
    urgency: "normal" as "normal" | "urgent" | "top_urgent" | "confidential",
    assignedTo: "",
    deliveryMethod: "hand",
    notes: "",
    attachmentUrl: "",
    attachmentName: "",
    status: "new" as "normal" | any,
    referralDate: "",
    processedDate: "",
  });

  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // تحميل البيانات
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear !== "all") params.set("year", selectedYear);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("documentType", typeFilter);
      if (urgencyFilter !== "all") params.set("urgency", urgencyFilter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/incoming-mail?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setMails(data.mails || []);
        if (data.stats) setStats(data.stats);
        if (data.nextNumber) setNextNumber(data.nextNumber);
      } else {
        toast.error(data.error || "فشل تحميل الوارد");
      }
    } catch {
      toast.error("حدث خطأ أثناء تحميل سجل الوارد");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, statusFilter, typeFilter, urgencyFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // فتح حوار إضافة وارد جديد
  const handleOpenAdd = () => {
    setEditTarget(null);
    setFormData({
      mailNumber: nextNumber || `001 / ${selectedYear}`,
      receivedDate: toLocalYMD(),
      letterNumber: "",
      letterDate: toLocalYMD(),
      sender: COMMON_SENDERS[0],
      senderCustom: "",
      subject: "",
      documentType: "مراسلة",
      documentTypeCustom: "",
      urgency: "normal",
      assignedTo: "",
      deliveryMethod: "hand",
      notes: "",
      attachmentUrl: "",
      attachmentName: "",
      status: "new",
      referralDate: "",
      processedDate: "",
    });
    setDialogOpen(true);
  };

  // فتح حوار تعديل وارد
  const handleOpenEdit = (mail: IncomingMail) => {
    setEditTarget(mail);
    const isCommonSender = COMMON_SENDERS.includes(mail.sender);
    const isKnownDocType = DOCUMENT_TYPES.includes(mail.documentType);

    setFormData({
      mailNumber: mail.mailNumber,
      receivedDate: mail.receivedDate ? mail.receivedDate.slice(0, 10) : toLocalYMD(),
      letterNumber: mail.letterNumber || "",
      letterDate: mail.letterDate ? mail.letterDate.slice(0, 10) : toLocalYMD(),
      sender: isCommonSender ? mail.sender : "أخرى",
      senderCustom: isCommonSender ? "" : mail.sender,
      subject: mail.subject,
      documentType: isKnownDocType ? mail.documentType : "أخرى",
      documentTypeCustom: isKnownDocType ? "" : mail.documentType,
      urgency: mail.urgency,
      assignedTo: mail.assignedTo || "",
      deliveryMethod: mail.deliveryMethod || "hand",
      notes: mail.notes || "",
      attachmentUrl: mail.attachmentUrl || "",
      attachmentName: mail.attachmentName || "",
      status: mail.status,
      referralDate: mail.referralDate ? mail.referralDate.slice(0, 10) : "",
      processedDate: mail.processedDate ? mail.processedDate.slice(0, 10) : "",
    });
    setDialogOpen(true);
  };

  // رفع ملف المرفق وتحويله إلى Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("حجم الملف يجب ألا يتجاوز 8 ميغابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({
        ...prev,
        attachmentUrl: reader.result as string,
        attachmentName: file.name,
      }));
      toast.success(`تم إرفاق الملف: ${file.name}`);
    };
    reader.onerror = () => {
      toast.error("فشل قراءة الملف المرفق");
    };
    reader.readAsDataURL(file);
  };

  // حفظ الوارد (جديد أو تعديل)
  const handleSubmit = async () => {
    const finalSender = formData.sender === "أخرى" ? formData.senderCustom.trim() : formData.sender;
    const finalDocType = formData.documentType === "أخرى" ? formData.documentTypeCustom.trim() : formData.documentType;

    if (!finalSender) {
      toast.error("يرجى تحديد أو كتابة الجهة المرسلة");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("يرجى إدخال موضوع المراسلة");
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        // تعديل
        const res = await fetch(`/api/incoming-mail/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receivedDate: formData.receivedDate,
            letterNumber: formData.letterNumber,
            letterDate: formData.letterDate,
            sender: finalSender,
            subject: formData.subject,
            documentType: finalDocType,
            urgency: formData.urgency,
            assignedTo: formData.assignedTo,
            deliveryMethod: formData.deliveryMethod,
            notes: formData.notes,
            attachmentUrl: formData.attachmentUrl,
            attachmentName: formData.attachmentName,
            status: formData.status,
            referralDate: formData.referralDate || null,
            processedDate: formData.processedDate || null,
          }),
        });

        if (res.ok) {
          toast.success("تم تحديث بيانات الوارد بنجاح");
          setDialogOpen(false);
          loadData();
        } else {
          const err = await res.json();
          toast.error(err.error || "فشل التحديث");
        }
      } else {
        // إضافة جديد
        const res = await fetch("/api/incoming-mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customMailNumber: formData.mailNumber,
            receivedDate: formData.receivedDate,
            letterNumber: formData.letterNumber,
            letterDate: formData.letterDate,
            sender: finalSender,
            subject: formData.subject,
            documentType: finalDocType,
            urgency: formData.urgency,
            assignedTo: formData.assignedTo,
            deliveryMethod: formData.deliveryMethod,
            notes: formData.notes,
            attachmentUrl: formData.attachmentUrl,
            attachmentName: formData.attachmentName,
            status: formData.status,
          }),
        });

        if (res.ok) {
          toast.success("تم تسجيل الوارد الجديد بنجاح");
          setDialogOpen(false);
          loadData();
        } else {
          const err = await res.json();
          toast.error(err.error || "فشل تسجيل الوارد");
        }
      }
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  // تبديل الأرشفة
  const handleToggleArchive = async (mail: IncomingMail) => {
    const newStatus = mail.status === "archived" ? "in_progress" : "archived";
    try {
      const res = await fetch(`/api/incoming-mail/${mail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(newStatus === "archived" ? "تم أرشفة الوثيقة بنجاح" : "تم استعادة الوثيقة من الأرشيف");
        loadData();
      }
    } catch {
      toast.error("فشل تغيير حالة الأرشفة");
    }
  };

  // حذف السجل
  const handleDelete = async (mail: IncomingMail) => {
    if (!confirm(`هل أنت متأكد من حذف الوارد رقم: ${mail.mailNumber}؟`)) return;
    try {
      const res = await fetch(`/api/incoming-mail/${mail.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("تم حذف السجل بنجاح");
        setMails((prev) => prev.filter((m) => m.id !== mail.id));
      } else {
        toast.error("فشل حذف السجل");
      }
    } catch {
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  // طباعة بطاقة الوارد الفردية الرسمية بالترويسة الموحدة
  const handlePrintSlip = (mail: IncomingMail) => {
    const printWindow = window.open("", "_blank", "width=850,height=1050");
    if (!printWindow) {
      toast.error("يرجى السماح بالنوافذ المنبثقة للطباعة");
      return;
    }

    const headerHTML = unifiedReportHeaderHTML({
      reportType: "بِطَاقَةُ مُتَابَعَةِ وَثِيقَةٍ وَارِدَة",
      reportSubtitle: `سجل الواردات الإدارية • وارد رقم: ${mail.mailNumber}`,
      reportNumber: mail.mailNumber,
      date: mail.receivedDate.slice(0, 10),
    });

    const urgencyLabel = URGENCY_CONFIG[mail.urgency]?.label || mail.urgency;
    const statusLabel = STATUS_CONFIG[mail.status]?.label || mail.status;
    const deliveryMethodLabel = DELIVERY_METHODS[mail.deliveryMethod] || mail.deliveryMethod;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>بطاقة وارد - ${mail.mailNumber}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 10mm 12mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Cairo', sans-serif; color: #0f172a; margin: 0; padding: 0; direction: rtl; }
          .container { width: 100%; max-width: 190mm; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
          .doc-title-banner { text-align: center; background: #0f766e12; border: 1.5px solid #0f766e; border-radius: 8px; padding: 8px 12px; }
          .doc-title { font-size: 16pt; font-weight: 900; color: #0f766e; margin: 0; }
          .doc-meta { font-size: 10pt; color: #475569; margin-top: 4px; display: flex; justify-content: space-around; font-weight: 600; }
          .card-box { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
          .card-header { background: #f1f5f9; padding: 6px 12px; font-size: 11pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #cbd5e1; }
          .table-info { width: 100%; border-collapse: collapse; }
          .table-info td, .table-info th { padding: 7px 10px; border: 1px solid #e2e8f0; font-size: 10pt; }
          .table-info th { background: #f8fafc; text-align: right; width: 25%; font-weight: 700; color: #334155; }
          .routing-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          .routing-table th, .routing-table td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 9.5pt; }
          .routing-table th { background: #f1f5f9; font-weight: 700; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; text-align: center; }
          .sig-box { border: 1px dashed #94a3b8; border-radius: 8px; padding: 10px; min-height: 100px; display: flex; flex-direction: column; justify-content: space-between; }
          .sig-title { font-weight: 700; font-size: 10.5pt; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="container">
          ${headerHTML}
          <div class="doc-title-banner">
            <h2 class="doc-title">بِطَاقَةُ تَسْجِيلِ وَمُتَابَعَةِ وَثِيقَةٍ وَارِدَة</h2>
            <div class="doc-meta">
              <span>رقم الوارد: <b>${mail.mailNumber}</b></span>
              <span>تاريخ الورود: <b>${mail.receivedDate.slice(0, 10)}</b></span>
              <span>نوع الوثيقة: <b>${mail.documentType}</b></span>
              <span>درجة الاستعجال: <b>${urgencyLabel}</b></span>
            </div>
          </div>

          <div class="card-box">
            <div class="card-header">أولاً: بيانات المراسلة والجهة المرسلة</div>
            <table class="table-info">
              <tr>
                <th>الجهة المرسلة:</th>
                <td style="font-weight: 800; color: #0f766e; font-size: 11pt;">${mail.sender}</td>
                <th>طريقة الاستلام:</th>
                <td>${deliveryMethodLabel}</td>
              </tr>
              <tr>
                <th>رقم المراسلة الأصلية:</th>
                <td style="font-weight: 700;">${mail.letterNumber}</td>
                <th>تاريخ تحرير المراسلة:</th>
                <td>${mail.letterDate ? mail.letterDate.slice(0, 10) : "—"}</td>
              </tr>
              <tr>
                <th>موضوع المراسلة:</th>
                <td colspan="3" style="font-weight: 800; font-size: 11pt; color: #0f172a; line-height: 1.5;">
                  ${mail.subject}
                </td>
              </tr>
              <tr>
                <th>المسؤول / المصلحة المعنية:</th>
                <td style="font-weight: 700;">${mail.assignedTo || "إدارة النادي"}</td>
                <th>الحالة الحالية:</th>
                <td><b>${statusLabel}</b></td>
              </tr>
              ${mail.notes ? `
              <tr>
                <th>ملاحظات وتوجيهات:</th>
                <td colspan="3" style="color: #475569;">${mail.notes}</td>
              </tr>` : ""}
            </table>
          </div>

          <div class="card-box">
            <div class="card-header">ثانياً: مسار وتأشيرات المعالجة الإدارية</div>
            <table class="routing-table">
              <thead>
                <tr>
                  <th style="width: 25%;">المرحلة الإدارية</th>
                  <th style="width: 25%;">المسؤول المعني</th>
                  <th style="width: 25%;">التاريخ والتأشيرة</th>
                  <th style="width: 25%;">القرار / الإجراء المتخذ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>1. الاستلام والتسجيل</b></td>
                  <td>أمانة النادي</td>
                  <td>${mail.receivedDate.slice(0, 10)}</td>
                  <td>تم القيد بالسجل العام</td>
                </tr>
                <tr>
                  <td><b>2. الإحالة والتوجيه</b></td>
                  <td>${mail.assignedTo || "—"}</td>
                  <td>${mail.referralDate ? mail.referralDate.slice(0, 10) : "—"}</td>
                  <td>قيد الدراسة والمتابعة</td>
                </tr>
                <tr>
                  <td><b>3. المعالجة النهائية</b></td>
                  <td>المسؤول المعني</td>
                  <td>${mail.processedDate ? mail.processedDate.slice(0, 10) : "—"}</td>
                  <td>${mail.status === "completed" ? "تمت التسوية والرد" : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-title">تأشيرة أمانة الضبط والواردات</div>
              <div style="font-size: 8.5pt; color: #94a3b8; margin-top: auto;">الاسم والختم والتاريخ</div>
            </div>
            <div class="sig-box">
              <div class="sig-title">ختم وتأشيرة إدارة النادي</div>
              <div style="font-size: 8.5pt; color: #94a3b8; margin-top: auto;">رئيس النادي / المدير العام</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 400); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // طباعة سجل الوارد الكامل للفترة بالترويسة الموحدة
  const handlePrintRegister = () => {
    const printWindow = window.open("", "_blank", "width=1050,height=850");
    if (!printWindow) {
      toast.error("يرجى السماح بالنوافذ المنبثقة");
      return;
    }

    const headerHTML = unifiedReportHeaderHTML({
      reportType: "سِجِلُّ المُرَاسَلَاتِ وَالوَثَائِقِ الوَارِدَة",
      reportSubtitle: `سنة: ${selectedYear === "all" ? "جميع السنوات" : selectedYear} • إجمالي السجلات: ${mails.length}`,
      reportNumber: `سجل الوارد لسنة ${selectedYear}`,
      date: toLocalYMD(),
    });

    const rowsHTML = mails.map((m, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="text-align: center; font-weight: bold; color: #0f766e;">${m.mailNumber}</td>
        <td style="text-align: center;">${m.receivedDate.slice(0, 10)}</td>
        <td style="text-align: center;">${m.letterNumber}<br><small style="color:#64748b;">${m.letterDate ? m.letterDate.slice(0, 10) : ""}</small></td>
        <td style="font-weight: bold;">${m.sender}</td>
        <td>${m.subject}</td>
        <td style="text-align: center;">${m.documentType}</td>
        <td style="text-align: center;">${m.assignedTo || "—"}</td>
        <td style="text-align: center; font-weight: bold;">${STATUS_CONFIG[m.status]?.label || m.status}</td>
      </tr>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>سجل المراسلات الواردة - ${selectedYear}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Cairo', sans-serif; color: #0f172a; margin: 0; padding: 0; direction: rtl; font-size: 9.5pt; }
          .container { width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
          .title-bar { text-align: center; background: #0f766e12; border: 1.5px solid #0f766e; border-radius: 6px; padding: 5px; font-weight: 800; color: #0f766e; font-size: 12pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 6px; }
          th { background: #f1f5f9; color: #1e293b; font-weight: 700; text-align: center; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="container">
          ${headerHTML}
          <div class="title-bar">
            سِجِلُّ المُرَاسَلَاتِ وَالوَثَائِقِ الوَارِدَة (${selectedYear})
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 4%;">الرقم</th>
                <th style="width: 11%;">رقم الوارد</th>
                <th style="width: 9%;">تاريخ الورود</th>
                <th style="width: 10%;">رقم/تاريخ المراسلة</th>
                <th style="width: 18%;">الجهة المرسلة</th>
                <th style="width: 25%;">الموضوع</th>
                <th style="width: 8%;">النوع</th>
                <th style="width: 9%;">المسؤول</th>
                <th style="width: 6%;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML || `<tr><td colspan="9" style="text-align:center; padding: 20px;">لا توجد مراسلات مسجلة</td></tr>`}
            </tbody>
          </table>
          <div style="display: flex; justify-content: space-between; margin-top: 14px; padding: 0 20px;">
            <div style="text-align: center; font-weight: 700;">أمانة الضبط والواردات</div>
            <div style="text-align: center; font-weight: 700;">ختم وتأشيرة إدارة النادي</div>
          </div>
        </div>
        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 400); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 pb-12">
      {/* ═══ 1. الترويسة الرئيسية والإحصائيات ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center font-black shadow-xs">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
              الوارد الإداري
              <Badge variant="secondary" className="text-xs">
                {stats.total} وثيقة
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              سجل ومتابعة المراسلات والوثائق الواردة إلى النادي بدقة واعتماد الترويسة الموحدة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrintRegister}
            className="text-xs gap-1.5 border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
          >
            <Printer className="h-4 w-4" />
            طباعة سجل الوارد
          </Button>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={handleOpenAdd}
              className="text-xs gap-1.5 bg-teal-700 hover:bg-teal-800 text-white shadow-xs"
            >
              <Plus className="h-4 w-4" />
              تسجيل وارد جديد
            </Button>
          )}
        </div>
      </div>

      {/* ═══ 2. بطاقات المؤشرات الإدارية ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Card className="rounded-xl border border-border/70 p-2.5 bg-card">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي الوارد</span>
            <Inbox className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <p className="text-lg font-extrabold text-teal-700 dark:text-teal-300 mt-1 tabular-nums">
            {stats.total}
          </p>
        </Card>

        <Card className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-2.5">
          <div className="flex items-center justify-between text-xs text-sky-700 dark:text-sky-300">
            <span>جديد</span>
            <Clock className="h-3.5 w-3.5" />
          </div>
          <p className="text-lg font-extrabold text-sky-700 dark:text-sky-300 mt-1 tabular-nums">
            {stats.new}
          </p>
        </Card>

        <Card className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5">
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
            <span>قيد المعالجة</span>
            <ArrowUpDown className="h-3.5 w-3.5" />
          </div>
          <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300 mt-1 tabular-nums">
            {stats.in_progress}
          </p>
        </Card>

        <Card className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-2.5">
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
            <span>محال للمسؤول</span>
            <Send className="h-3.5 w-3.5" />
          </div>
          <p className="text-lg font-extrabold text-indigo-700 dark:text-indigo-300 mt-1 tabular-nums">
            {stats.referred}
          </p>
        </Card>

        <Card className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5">
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
            <span>تمت المعالجة</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
            {stats.completed}
          </p>
        </Card>

        <Card className="rounded-xl border border-slate-500/30 bg-slate-500/5 p-2.5">
          <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
            <span>مؤرشف</span>
            <Archive className="h-3.5 w-3.5" />
          </div>
          <p className="text-lg font-extrabold text-slate-700 dark:text-slate-300 mt-1 tabular-nums">
            {stats.archived}
          </p>
        </Card>
      </div>

      {/* ═══ 3. شريط الفلاتر والبحث ═══ */}
      <div className="rounded-xl border bg-card p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* بحث نصي */}
          <div className="relative sm:col-span-2">
            <Search className="h-4 w-4 absolute right-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم الوارد، الجهة المرسلة، الموضوع..."
              className="h-9 pr-9 text-xs"
            />
          </div>

          {/* فلتر السنة */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="السنة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل السنوات</SelectItem>
              <SelectItem value="2026">سنة 2026</SelectItem>
              <SelectItem value="2025">سنة 2025</SelectItem>
              <SelectItem value="2024">سنة 2024</SelectItem>
            </SelectContent>
          </Select>

          {/* فلتر الحالة */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* فلتر نوع الوثيقة */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="نوع الوثيقة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ═══ 4. جدول المراسلات الواردة ═══ */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
            جاري تحميل سجل الوارد...
          </div>
        ) : mails.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-1" />
            <p className="font-semibold text-sm text-foreground">لا توجد مراسلات واردة مسجلة</p>
            <p className="text-xs">اضغط على زر «تسجيل وارد جديد» للبدء في قيد المراسلات الإدارية.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-muted/70 font-bold text-slate-700 dark:text-slate-200 border-b">
                <tr>
                  <th className="p-2.5 text-center w-28">رقم الوارد</th>
                  <th className="p-2.5 text-center w-24">تاريخ الورود</th>
                  <th className="p-2.5 text-center w-28">رقم المراسلة</th>
                  <th className="p-2.5 w-44">الجهة المرسلة</th>
                  <th className="p-2.5 min-w-[180px]">الموضوع</th>
                  <th className="p-2.5 text-center w-28">المسؤول</th>
                  <th className="p-2.5 text-center w-24">الحالة</th>
                  <th className="p-2.5 text-center w-16">المرفق</th>
                  <th className="p-2.5 text-center w-36">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mails.map((m) => {
                  const statusInfo = STATUS_CONFIG[m.status] || STATUS_CONFIG.new;
                  const StatusIcon = statusInfo.icon;
                  const urgencyInfo = URGENCY_CONFIG[m.urgency] || URGENCY_CONFIG.normal;

                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        "hover:bg-muted/40 transition-colors",
                        m.status === "archived" && "opacity-75 bg-muted/20"
                      )}
                    >
                      {/* رقم الوارد المتسلسل */}
                      <td className="p-2.5 text-center font-extrabold text-teal-700 dark:text-teal-300">
                        {m.mailNumber}
                      </td>

                      {/* تاريخ الورود */}
                      <td className="p-2.5 text-center tabular-nums font-medium">
                        {m.receivedDate ? m.receivedDate.slice(0, 10) : "—"}
                      </td>

                      {/* رقم المراسلة الأصلية */}
                      <td className="p-2.5 text-center font-semibold">
                        {m.letterNumber || "بدون رقم"}
                        {m.letterDate && (
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            {m.letterDate.slice(0, 10)}
                          </div>
                        )}
                      </td>

                      {/* الجهة المرسلة */}
                      <td className="p-2.5">
                        <div className="font-bold text-foreground truncate max-w-[180px]" title={m.sender}>
                          {m.sender}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{m.documentType}</span>
                          {m.urgency !== "normal" && (
                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0", urgencyInfo.cls)}>
                              {urgencyInfo.label}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* موضوع المراسلة */}
                      <td className="p-2.5">
                        <div className="font-semibold text-foreground line-clamp-2" title={m.subject}>
                          {m.subject}
                        </div>
                        {m.notes && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[250px] mt-0.5">
                            ملاحظة: {m.notes}
                          </div>
                        )}
                      </td>

                      {/* المسؤول المعني */}
                      <td className="p-2.5 text-center">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {m.assignedTo || "إدارة النادي"}
                        </span>
                      </td>

                      {/* الحالة الإدارية */}
                      <td className="p-2.5 text-center">
                        <Badge variant="outline" className={cn("text-[10px] gap-1", statusInfo.cls)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </td>

                      {/* المرفق */}
                      <td className="p-2.5 text-center">
                        {m.attachmentUrl ? (
                          <a
                            href={m.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={m.attachmentName || "مرفق-الوارد"}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
                            title={m.attachmentName || "تحميل المرفق"}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </td>

                      {/* الإجراءات */}
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* عرض */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewTarget(m)}
                            className="h-7 w-7 p-0 text-teal-700 hover:bg-teal-50"
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {/* طباعة بطاقة الوارد */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrintSlip(m)}
                            className="h-7 w-7 p-0 text-sky-700 hover:bg-sky-50"
                            title="طباعة بطاقة الوارد A4"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>

                          {canManage && (
                            <>
                              {/* تعديل */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEdit(m)}
                                className="h-7 w-7 p-0 text-amber-700 hover:bg-amber-50"
                                title="تعديل"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>

                              {/* أرشفة */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleArchive(m)}
                                className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100"
                                title={m.status === "archived" ? "استعادة من الأرشيف" : "أرشفة"}
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}

                          {isAdmin && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(m)}
                              className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                              title="حذف"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ 5. حوار إضافة / تعديل وارد ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-teal-800 dark:text-teal-300">
              <Inbox className="h-5 w-5 text-teal-600" />
              {editTarget ? "تعديل بيانات الوارد الإداري" : "تسجيل وارد إداري جديد"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              يتم قيد المراسلة برقم متسلسل فريد وربطها بالجهة المرسلة ونوعها ومرفقاتها.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* رقم الوارد وتواريخ الورود والمراسلة */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border bg-muted/30 p-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">رقم الوارد المتسلسل *</Label>
                <Input
                  value={formData.mailNumber}
                  onChange={(e) => setFormData((p) => ({ ...p, mailNumber: e.target.value }))}
                  placeholder="001 / 2026"
                  className="h-8 text-xs font-bold text-teal-700"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">تاريخ الورود (الاستلام) *</Label>
                <Input
                  type="date"
                  value={formData.receivedDate}
                  onChange={(e) => setFormData((p) => ({ ...p, receivedDate: e.target.value }))}
                  className="h-8 text-xs font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">طريقة الاستلام</Label>
                <Select
                  value={formData.deliveryMethod}
                  onValueChange={(v) => setFormData((p) => ({ ...p, deliveryMethod: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DELIVERY_METHODS).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* بيانات المراسلة الأصلية والجهة المرسلة */}
            <div className="rounded-xl border bg-card p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">الجهة المرسلة *</Label>
                  <Select
                    value={formData.sender}
                    onValueChange={(v) => setFormData((p) => ({ ...p, sender: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs font-bold">
                      <SelectValue placeholder="اختر الجهة المرسلة" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_SENDERS.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.sender === "أخرى" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">اكتب اسم الجهة المرسلة *</Label>
                    <Input
                      value={formData.senderCustom}
                      onChange={(e) => setFormData((p) => ({ ...p, senderCustom: e.target.value }))}
                      placeholder="اسم الجهة أو الشخص..."
                      className="h-8 text-xs"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">رقم المراسلة الأصلي</Label>
                    <Input
                      value={formData.letterNumber}
                      onChange={(e) => setFormData((p) => ({ ...p, letterNumber: e.target.value }))}
                      placeholder="رقم المراسلة"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">تاريخ المراسلة</Label>
                    <Input
                      type="date"
                      value={formData.letterDate}
                      onChange={(e) => setFormData((p) => ({ ...p, letterDate: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* الموضوع */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">موضوع المراسلة *</Label>
                <Textarea
                  value={formData.subject}
                  onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="اكتب موضوع المراسلة بوضوح..."
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">نوع الوثيقة</Label>
                  <Select
                    value={formData.documentType}
                    onValueChange={(v) => setFormData((p) => ({ ...p, documentType: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.documentType === "أخرى" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">حدد نوع الوثيقة</Label>
                    <Input
                      value={formData.documentTypeCustom}
                      onChange={(e) => setFormData((p) => ({ ...p, documentTypeCustom: e.target.value }))}
                      placeholder="نوع الوثيقة..."
                      className="h-8 text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">درجة الاستعجال</Label>
                  <Select
                    value={formData.urgency}
                    onValueChange={(v: any) => setFormData((p) => ({ ...p, urgency: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">المسؤول / المصلحة المعنية</Label>
                  <Input
                    value={formData.assignedTo}
                    onChange={(e) => setFormData((p) => ({ ...p, assignedTo: e.target.value }))}
                    placeholder="رئيس النادي، المدرب، أمين المال..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* الحالة ودورة المتابعة */}
            <div className="rounded-xl border bg-card p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">الحالة الإدارية</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v: any) => setFormData((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.status === "referred" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">تاريخ الإحالة</Label>
                    <Input
                      type="date"
                      value={formData.referralDate}
                      onChange={(e) => setFormData((p) => ({ ...p, referralDate: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                )}

                {formData.status === "completed" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">تاريخ إتمام المعالجة</Label>
                    <Input
                      type="date"
                      value={formData.processedDate}
                      onChange={(e) => setFormData((p) => ({ ...p, processedDate: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* ملاحظات */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">ملاحظات إضافية</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="تعليمات أو إجراءات مطلوبة..."
                  className="h-8 text-xs"
                />
              </div>

              {/* المرفق (PDF أو صورة) */}
              <div className="space-y-1.5 pt-1 border-t">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>ملف مرفق (PDF أو صورة للمراسلة)</span>
                  {formData.attachmentName && (
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, attachmentUrl: "", attachmentName: "" }))}
                      className="text-[10px] text-rose-600 hover:underline flex items-center gap-0.5"
                    >
                      <X className="h-3 w-3" /> حذف المرفق
                    </button>
                  )}
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs gap-1.5 border-dashed border-teal-500/50"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-teal-600" />
                    {formData.attachmentName ? "تغيير الملف المرفق" : "اختيار ملف مرفق (PDF / صورة)"}
                  </Button>
                  {formData.attachmentName && (
                    <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                      {formData.attachmentName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between border-t pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleSubmit}
              className="bg-teal-700 hover:bg-teal-800 text-white gap-1.5"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
              {editTarget ? "حفظ التعديلات" : "تسجيل الوارد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ 6. حوار تفاصيل الوارد والمعاينة ═══ */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewTarget && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between border-b pb-2">
                  <DialogTitle className="flex items-center gap-2 text-base font-bold">
                    <FileText className="h-5 w-5 text-teal-600" />
                    تفاصيل المراسلة الواردة: {viewTarget.mailNumber}
                  </DialogTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintSlip(viewTarget)}
                    className="h-7 text-xs gap-1 text-teal-700 border-teal-500/30"
                  >
                    <Printer className="h-3 w-3" /> طباعة البطاقة
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                {/* الترويسة الموحدة */}
                <UnifiedReportHeader
                  reportType="بِطَاقَةُ وَثِيقَةٍ وَارِدَة"
                  reportSubtitle={`الموضوع: ${viewTarget.subject}`}
                  reportNumber={viewTarget.mailNumber}
                  date={viewTarget.receivedDate.slice(0, 10)}
                  compact
                />

                <div className="rounded-xl border p-3 space-y-2 bg-card">
                  <div className="grid grid-cols-2 gap-2 border-b pb-2">
                    <div><b>رقم الوارد:</b> <span className="text-teal-700 font-extrabold">{viewTarget.mailNumber}</span></div>
                    <div><b>تاريخ الورود:</b> <span>{viewTarget.receivedDate.slice(0, 10)}</span></div>
                    <div><b>رقم المراسلة:</b> <span>{viewTarget.letterNumber}</span></div>
                    <div><b>تاريخ المراسلة:</b> <span>{viewTarget.letterDate ? viewTarget.letterDate.slice(0, 10) : "—"}</span></div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div><b>الجهة المرسلة:</b> <span className="font-bold text-foreground">{viewTarget.sender}</span></div>
                    <div><b>الموضوع:</b> <span className="font-bold text-teal-800 dark:text-teal-200">{viewTarget.subject}</span></div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div><b>نوع الوثيقة:</b> {viewTarget.documentType}</div>
                      <div><b>درجة الاستعجال:</b> {URGENCY_CONFIG[viewTarget.urgency]?.label || viewTarget.urgency}</div>
                      <div><b>طريقة الاستلام:</b> {DELIVERY_METHODS[viewTarget.deliveryMethod] || viewTarget.deliveryMethod}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t text-muted-foreground">
                    <div>المسؤول المعني: <b className="text-foreground">{viewTarget.assignedTo || "إدارة النادي"}</b></div>
                    <div>الحالة: <b className="text-foreground">{STATUS_CONFIG[viewTarget.status]?.label || viewTarget.status}</b></div>
                    {viewTarget.referralDate && (
                      <div>تاريخ الإحالة: <b>{viewTarget.referralDate.slice(0, 10)}</b></div>
                    )}
                    {viewTarget.processedDate && (
                      <div>تاريخ المعالجة: <b>{viewTarget.processedDate.slice(0, 10)}</b></div>
                    )}
                  </div>

                  {viewTarget.notes && (
                    <div className="pt-2 border-t">
                      <b>ملاحظات:</b> <span className="text-muted-foreground">{viewTarget.notes}</span>
                    </div>
                  )}

                  {viewTarget.attachmentUrl && (
                    <div className="pt-2 border-t flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1">
                        <Paperclip className="h-4 w-4 text-teal-600" />
                        الملف المرفق: {viewTarget.attachmentName || "وثيقة مرفقة"}
                      </span>
                      <a
                        href={viewTarget.attachmentUrl}
                        download={viewTarget.attachmentName || "مرفق"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-teal-700 hover:underline flex items-center gap-1 font-bold"
                      >
                        <Download className="h-3.5 w-3.5" /> تحميل / فتح
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
