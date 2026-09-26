"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, CreditCard, Calendar, Award, Users, Headphones,
  Receipt, Tag, Plus, Check, Clock, AlertCircle, Search, Filter,
  Printer, Download, ShieldCheck, HeartHandshake, Star, MessageSquare,
  Gift, Trophy, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  FileText, Send, Phone, Mail, HelpCircle, ArrowUpRight, Percent,
  TrendingUp, RefreshCw, Eye, ThumbsUp, ThumbsDown, MessageCircle,
  DollarSign, Activity, Zap, Compass, UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
//  الأنواع والواجهات (Types & Mock Data)
// ═══════════════════════════════════════════════════════════════

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  memberName: string;
  amount: number;
  discount: number;
  total: number;
  status: "paid" | "pending" | "refunded";
  date: string;
  category: string;
}

interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  expiryDate: string;
  usesCount: number;
  maxUses: number;
  active: boolean;
}

interface ClubEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  price: number;
  capacity: number;
  registeredCount: number;
  category: "tournament" | "course" | "workshop";
  status: "open" | "full" | "completed";
}

interface LoyaltyMember {
  id: string;
  name: string;
  phone: string;
  points: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  referralCode: string;
  referralsCount: number;
}

interface SupportTicket {
  id: string;
  ticketNumber: string;
  memberName: string;
  subject: string;
  category: "billing" | "technical" | "general";
  priority: "low" | "medium" | "urgent";
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  lastReply: string;
}

export function EnterpriseHub({ clubName }: { clubName?: string } = {}) {
  const [activeSubsystem, setActiveSubsystem] = useState("billing");

  return (
    <div className="space-y-6" dir="rtl">
      {/* ─── الهيدر الرئيسي لمركز ميزات وفعاليات النادي ─── */}
      <div className="relative rounded-3xl bg-gradient-to-r from-teal-950 via-slate-900 to-sky-950 border border-teal-500/30 p-6 lg:p-8 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-sky-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex flex-wrap items-center gap-2">
                  <span>خدمات وفعاليات النادي المتقدمة</span>
                  {clubName && (
                    <span className="text-teal-300 font-bold text-base sm:text-lg">
                      — {clubName}
                    </span>
                  )}
                  <Badge className="bg-gradient-to-l from-teal-500 to-sky-500 text-slate-950 font-extrabold text-[10px] px-2 py-0.5">
                    باقة Enterprise
                  </Badge>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  حلول متكاملة للنادي: الفواتير والكوبونات، البطولات والفعاليات، برامج ولاء السباحين، وإدارة رضا المشتركين
                </p>
              </div>
            </div>
          </div>

          {/* شارات المؤشرات السريعة */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-900/80 border border-teal-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              <span className="text-slate-300 font-semibold">جاهزية المنظومة:</span>
              <span className="text-emerald-400 font-bold">100% نشط</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-sky-400" />
              <span className="text-slate-300 font-semibold">5 وحدات متكاملة</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── التبويبات القيادية للأنظمة الـ 5 ─── */}
      <Tabs value={activeSubsystem} onValueChange={setActiveSubsystem} className="space-y-6">
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <TabsList className="bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl inline-flex gap-2 shadow-lg w-max min-w-full sm:min-w-0 sm:w-auto">
            <TabsTrigger
              value="billing"
              className="data-[state=active]:bg-gradient-to-l data-[state=active]:from-teal-600 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-xl px-4 py-2.5 text-xs font-semibold gap-2 text-slate-400 transition-all"
            >
              <CreditCard className="h-4 w-4" />
              <span>الفواتير والكوبونات (Billing)</span>
            </TabsTrigger>

            <TabsTrigger
              value="events"
              className="data-[state=active]:bg-gradient-to-l data-[state=active]:from-teal-600 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-xl px-4 py-2.5 text-xs font-semibold gap-2 text-slate-400 transition-all"
            >
              <Calendar className="h-4 w-4" />
              <span>الفعاليات والتقويم (Events)</span>
            </TabsTrigger>

            <TabsTrigger
              value="loyalty"
              className="data-[state=active]:bg-gradient-to-l data-[state=active]:from-teal-600 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-xl px-4 py-2.5 text-xs font-semibold gap-2 text-slate-400 transition-all"
            >
              <Award className="h-4 w-4" />
              <span>الولاء والمكافآت (Loyalty)</span>
            </TabsTrigger>

            <TabsTrigger
              value="crm"
              className="data-[state=active]:bg-gradient-to-l data-[state=active]:from-teal-600 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-xl px-4 py-2.5 text-xs font-semibold gap-2 text-slate-400 transition-all"
            >
              <Users className="h-4 w-4" />
              <span>إدارة العلاقات (CRM & NPS)</span>
            </TabsTrigger>

            <TabsTrigger
              value="support"
              className="data-[state=active]:bg-gradient-to-l data-[state=active]:from-teal-600 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-xl px-4 py-2.5 text-xs font-semibold gap-2 text-slate-400 transition-all"
            >
              <Headphones className="h-4 w-4" />
              <span>الدعم والمساعدة (HelpDesk)</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            الوحدة 1: نظام الدفع والفواتير والكوبونات
           ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="billing" className="space-y-6 mt-0">
          <BillingSubsystem />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            الوحدة 2: نظام الفعاليات والأنشطة والتقويم
           ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="events" className="space-y-6 mt-0">
          <EventsSubsystem />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            الوحدة 3: برنامج الولاء والمكافآت
           ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="loyalty" className="space-y-6 mt-0">
          <LoyaltySubsystem />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            الوحدة 4: نظام CRM وإدارة العلاقات والرضا
           ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="crm" className="space-y-6 mt-0">
          <CrmSubsystem />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════
            الوحدة 5: نظام الدعم الفني والمساعدة
           ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="support" className="space-y-6 mt-0">
          <SupportSubsystem />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  1. النظام الفرعي: الدفع والفواتير والكوبونات (Billing Subsystem)
// ═══════════════════════════════════════════════════════════════

function BillingSubsystem() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([
    { id: "1", invoiceNumber: "INV-2026-001", memberName: "محمد بن علي", amount: 4500, discount: 500, total: 4000, status: "paid", date: "2026/09/20", category: "اشتراك سنوي" },
    { id: "2", invoiceNumber: "INV-2026-002", memberName: "خالد بن يحيى", amount: 2500, discount: 0, total: 2500, status: "paid", date: "2026/09/22", category: "اشتراك شهري" },
    { id: "3", invoiceNumber: "INV-2026-003", memberName: "ياسمين قاسمي", amount: 3500, discount: 700, total: 2800, status: "pending", date: "2026/09/23", category: "دورة تعليمية خاصة" },
  ]);

  const [coupons, setCoupons] = useState<Coupon[]>([
    { id: "1", code: "AQUA2026", type: "percent", value: 15, expiryDate: "2026/12/31", usesCount: 34, maxUses: 100, active: true },
    { id: "2", code: "WELCOME500", type: "fixed", value: 500, expiryDate: "2026/10/30", usesCount: 18, maxUses: 50, active: true },
    { id: "3", code: "SUMMER25", type: "percent", value: 25, expiryDate: "2026/08/31", usesCount: 50, maxUses: 50, active: false },
  ]);

  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [newInv, setNewInv] = useState({ memberName: "", amount: "", discount: "0", category: "اشتراك شهري" });

  const [createCouponOpen, setCreateCouponOpen] = useState(false);
  const [newCpn, setNewCpn] = useState({ code: "", type: "percent", value: "10", maxUses: "50", expiry: "2026/12/31" });

  const [previewInvoice, setPreviewInvoice] = useState<InvoiceItem | null>(null);

  const handleAddInvoice = () => {
    if (!newInv.memberName.trim() || !newInv.amount) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    const amt = parseFloat(newInv.amount) || 0;
    const disc = parseFloat(newInv.discount) || 0;
    const item: InvoiceItem = {
      id: Date.now().toString(),
      invoiceNumber: `INV-2026-00${invoices.length + 1}`,
      memberName: newInv.memberName.trim(),
      amount: amt,
      discount: disc,
      total: Math.max(0, amt - disc),
      status: "paid",
      date: new Date().toLocaleDateString("ar-DZ"),
      category: newInv.category,
    };
    setInvoices([item, ...invoices]);
    setCreateInvoiceOpen(false);
    setNewInv({ memberName: "", amount: "", discount: "0", category: "اشتراك شهري" });
    toast.success(`تم إنشاء الفاتورة رقم ${item.invoiceNumber} بنجاح`);
  };

  const handleAddCoupon = () => {
    if (!newCpn.code.trim() || !newCpn.value) {
      toast.error("يرجى إدخال كود الكوبون وقيمة الخصم");
      return;
    }
    const item: Coupon = {
      id: Date.now().toString(),
      code: newCpn.code.toUpperCase().trim(),
      type: newCpn.type as "percent" | "fixed",
      value: parseFloat(newCpn.value) || 0,
      expiryDate: newCpn.expiry,
      usesCount: 0,
      maxUses: parseInt(newCpn.maxUses) || 50,
      active: true,
    };
    setCoupons([item, ...coupons]);
    setCreateCouponOpen(false);
    setNewCpn({ code: "", type: "percent", value: "10", maxUses: "50", expiry: "2026/12/31" });
    toast.success(`تم تفعيل كوبون الخصم: ${item.code}`);
  };

  return (
    <div className="space-y-6">
      {/* البطاقات الإحصائية للفوترة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">إجمالي الفواتير المحصلة</CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-400">
              {invoices.filter(i => i.status === "paid").reduce((acc, i) => acc + i.total, 0).toLocaleString()} دج
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-400">{invoices.length} فواتير مسجلة</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">إجمالي الخصومات المقدمة</CardDescription>
            <CardTitle className="text-2xl font-black text-sky-400">
              {invoices.reduce((acc, i) => acc + i.discount, 0).toLocaleString()} دج
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-400">عبر الكوبونات وعروض الولاء</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">الكوبونات النشطة</CardDescription>
            <CardTitle className="text-2xl font-black text-teal-400">
              {coupons.filter(c => c.active).length} كوبونات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-400">استُخدمت {coupons.reduce((a, c) => a + c.usesCount, 0)} مرة</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* جدول الفواتير الأخيرة */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-teal-400" />
              <h3 className="font-bold text-sm text-slate-100">سجل الفواتير والإيصالات الرقمية</h3>
            </div>
            <Button
              size="sm"
              onClick={() => setCreateInvoiceOpen(true)}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" /> إنشاء فاتورة
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                <tr className="text-right">
                  <th className="p-2.5 font-semibold">رقم الفاتورة</th>
                  <th className="p-2.5 font-semibold">المشترك</th>
                  <th className="p-2.5 font-semibold">البند</th>
                  <th className="p-2.5 font-semibold">المبلغ</th>
                  <th className="p-2.5 font-semibold">الخصم</th>
                  <th className="p-2.5 font-semibold">الصافي</th>
                  <th className="p-2.5 font-semibold">الحالة</th>
                  <th className="p-2.5 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-2.5 font-mono text-teal-400 font-bold">{inv.invoiceNumber}</td>
                    <td className="p-2.5 font-semibold text-slate-200">{inv.memberName}</td>
                    <td className="p-2.5 text-slate-300">{inv.category}</td>
                    <td className="p-2.5 font-mono">{inv.amount} دج</td>
                    <td className="p-2.5 font-mono text-amber-400">-{inv.discount} دج</td>
                    <td className="p-2.5 font-mono font-bold text-emerald-400">{inv.total} دج</td>
                    <td className="p-2.5">
                      <Badge className={inv.status === "paid" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]" : "bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]"}>
                        {inv.status === "paid" ? "مدفوعة" : "معلقة"}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewInvoice(inv)}
                        className="h-7 w-7 text-slate-400 hover:text-white"
                        title="معاينة وطباعة الفاتورة"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* محرك الكوبونات والعروض */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-sky-400" />
              <h3 className="font-bold text-sm text-slate-100">كوبونات الخصم</h3>
            </div>
            <Button
              size="sm"
              onClick={() => setCreateCouponOpen(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs gap-1 h-8 px-2.5"
            >
              <Plus className="h-3.5 w-3.5" /> جديد
            </Button>
          </div>

          <div className="space-y-3">
            {coupons.map((cpn) => (
              <div key={cpn.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-500/15 text-teal-400 border border-teal-500/30 tracking-wider">
                    {cpn.code}
                  </span>
                  <Badge variant="outline" className={cpn.active ? "text-[10px] text-emerald-400 border-emerald-500/30" : "text-[10px] text-slate-500 border-slate-700"}>
                    {cpn.active ? "نشط" : "منتهي"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>الخصم: <strong className="text-slate-200">{cpn.type === "percent" ? `${cpn.value}%` : `${cpn.value} دج`}</strong></span>
                  <span>الاستخدام: {cpn.usesCount}/{cpn.maxUses}</span>
                </div>
                <p className="text-[10px] text-slate-500">ينتهي في: {cpn.expiryDate}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: إنشاء فاتورة جديدة */}
      <Dialog open={createInvoiceOpen} onOpenChange={setCreateInvoiceOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-5 w-5 text-teal-400" /> إنشاء فاتورة جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">اسم المشترك *</Label>
              <Input
                value={newInv.memberName}
                onChange={(e) => setNewInv({ ...newInv, memberName: e.target.value })}
                placeholder="أحمد محمد"
                className="h-9 bg-slate-800 border-slate-700 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">نوع البند / الخدمة</Label>
              <Select value={newInv.category} onValueChange={(v) => setNewInv({ ...newInv, category: v })}>
                <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="اشتراك شهري">اشتراك شهري</SelectItem>
                  <SelectItem value="اشتراك سنوي">اشتراك سنوي</SelectItem>
                  <SelectItem value="تأمين سنوي">تأمين سنوي</SelectItem>
                  <SelectItem value="دورة تدريبية">دورة تدريبية</SelectItem>
                  <SelectItem value="بطاقة عضوية">إصدار بطاقة عضوية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">المبلغ الأساسي (دج) *</Label>
                <Input
                  type="number"
                  value={newInv.amount}
                  onChange={(e) => setNewInv({ ...newInv, amount: e.target.value })}
                  placeholder="3000"
                  className="h-9 bg-slate-800 border-slate-700 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الخصم (دج)</Label>
                <Input
                  type="number"
                  value={newInv.discount}
                  onChange={(e) => setNewInv({ ...newInv, discount: e.target.value })}
                  placeholder="0"
                  className="h-9 bg-slate-800 border-slate-700 text-xs font-mono"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateInvoiceOpen(false)} className="border-slate-700 text-xs">إلغاء</Button>
            <Button onClick={handleAddInvoice} className="bg-teal-600 hover:bg-teal-500 text-white text-xs">توليد الفاتورة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: إنشاء كوبون جديد */}
      <Dialog open={createCouponOpen} onOpenChange={setCreateCouponOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Tag className="h-5 w-5 text-sky-400" /> إضافة كود خصم جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">كود الكوبون *</Label>
              <Input
                value={newCpn.code}
                onChange={(e) => setNewCpn({ ...newCpn, code: e.target.value })}
                placeholder="PROMO2026"
                className="h-9 bg-slate-800 border-slate-700 text-xs font-mono uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">نوع الخصم</Label>
                <Select value={newCpn.type} onValueChange={(v) => setNewCpn({ ...newCpn, type: v })}>
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="percent">نسبة مئوية (%)</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت (دج)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">قيمة الخصم *</Label>
                <Input
                  type="number"
                  value={newCpn.value}
                  onChange={(e) => setNewCpn({ ...newCpn, value: e.target.value })}
                  placeholder="15"
                  className="h-9 bg-slate-800 border-slate-700 text-xs font-mono"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateCouponOpen(false)} className="border-slate-700 text-xs">إلغاء</Button>
            <Button onClick={handleAddCoupon} className="bg-sky-600 hover:bg-sky-500 text-white text-xs">حفظ وتفعيل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: معاينة الفاتورة للطباعة */}
      {previewInvoice && (
        <Dialog open={!!previewInvoice} onOpenChange={(o) => !o && setPreviewInvoice(null)}>
          <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-100" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base">
                <span>فاتورة تسديد رسمية</span>
                <span className="font-mono text-xs text-teal-400">{previewInvoice.invoiceNumber}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="p-5 rounded-2xl bg-white text-slate-900 space-y-4 my-2 text-xs shadow-inner">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h4 className="font-black text-base text-slate-900">AquaCore Club Manager</h4>
                  <p className="text-[11px] text-slate-500">نادي السباحة والرياضات المائية</p>
                </div>
                <div className="text-left text-[11px] font-mono text-slate-600">
                  <p>التاريخ: {previewInvoice.date}</p>
                  <p>الحالة: مدفوعة ✓</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center text-xs">
                <span>المشترك / المستفيد: <strong>{previewInvoice.memberName}</strong></span>
                <span>الخدمة: <strong>{previewInvoice.category}</strong></span>
              </div>

              <div className="space-y-1.5 pt-2 border-t text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">المبلغ الإجمالي:</span>
                  <span className="font-mono font-bold">{previewInvoice.amount} دج</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>الخصم المطبق:</span>
                  <span className="font-mono font-bold">-{previewInvoice.discount} دج</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t pt-2 text-teal-800">
                  <span>الصافي المدفوع:</span>
                  <span className="font-mono text-base">{previewInvoice.total} دج</span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPreviewInvoice(null)} className="border-slate-700 text-xs">إغلاق</Button>
              <Button onClick={() => window.print()} className="bg-teal-600 hover:bg-teal-500 text-white text-xs gap-1.5">
                <Printer className="h-4 w-4" /> طباعة الإيصال
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  2. النظام الفرعي: الفعاليات والأنشطة والتقويم (Events Subsystem)
// ═══════════════════════════════════════════════════════════════

function EventsSubsystem() {
  const [events, setEvents] = useState<ClubEvent[]>([
    { id: "1", title: "بطولة التحدي الصيفية للسباحة الحرة", date: "2026/10/15", time: "09:00 - 14:00", location: "المسبح الأولمبي 50م", price: 1500, capacity: 40, registeredCount: 28, category: "tournament", status: "open" },
    { id: "2", title: "دورة الإنقاذ المائي والسلامة المتقدمة", date: "2026/10/22", time: "16:00 - 18:30", location: "قاعة التدريب والمسبح", price: 3000, capacity: 20, registeredCount: 20, category: "course", status: "full" },
    { id: "3", title: "مهرجان السباحين الصغار (أقل من 12 سنة)", date: "2026/11/05", time: "10:00 - 13:00", location: "المسبح نصف الأولمبي 25م", price: 800, capacity: 50, registeredCount: 15, category: "workshop", status: "open" },
  ]);

  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", date: "2026/10/30", time: "10:00", location: "المسبح الرئيسي", price: "1000", capacity: "30" });

  const handleCreateEvent = () => {
    if (!newEvent.title.trim()) {
      toast.error("يرجى كتابة عنوان الفعالية");
      return;
    }
    const item: ClubEvent = {
      id: Date.now().toString(),
      title: newEvent.title.trim(),
      date: newEvent.date,
      time: newEvent.time,
      location: newEvent.location,
      price: parseFloat(newEvent.price) || 0,
      capacity: parseInt(newEvent.capacity) || 30,
      registeredCount: 0,
      category: "tournament",
      status: "open",
    };
    setEvents([...events, item]);
    setAddEventOpen(false);
    toast.success(`تمت إضافة فعالية: ${item.title}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" /> جدول الفعاليات والبطولات الرياضية
          </h3>
          <p className="text-xs text-slate-400">إدارة البطولات، الحصص الخاصة، وحساب نسب التسجيل والعوائد</p>
        </div>
        <Button
          onClick={() => setAddEventOpen(true)}
          className="bg-gradient-to-l from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs gap-1.5 h-9"
        >
          <Plus className="h-4 w-4" /> إضافة بطولة أو فعالية
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {events.map((ev) => (
          <div key={ev.id} className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 shadow-xl hover:border-slate-700 transition">
            <div className="flex justify-between items-start">
              <Badge variant="outline" className={ev.status === "open" ? "text-emerald-400 border-emerald-500/30 text-[10px]" : "text-rose-400 border-rose-500/30 text-[10px]"}>
                {ev.status === "open" ? "التسجيل متاح" : "اكتمل العدد"}
              </Badge>
              <span className="font-mono text-xs font-bold text-teal-400">{ev.price > 0 ? `${ev.price} دج` : "مجانية"}</span>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-100">{ev.title}</h4>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" /> {ev.date} • {ev.time}
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-slate-500" /> {ev.location}
              </p>
            </div>

            {/* شريط الامتلاء */}
            <div className="space-y-1 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>المشاركون: {ev.registeredCount}/{ev.capacity}</span>
                <span className="font-bold text-slate-300">{Math.round((ev.registeredCount / ev.capacity) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-teal-500 to-sky-500 rounded-full"
                  style={{ width: `${(ev.registeredCount / ev.capacity) * 100}%` }}
                />
              </div>
            </div>

            <Button
              size="sm"
              disabled={ev.status === "full"}
              onClick={() => toast.success(`تم فتح استمارة تسجيل مشترك في ${ev.title}`)}
              className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-700 text-teal-300"
            >
              <UserCheck className="h-3.5 w-3.5 ml-1" /> تسجيل مشترك
            </Button>
          </div>
        ))}
      </div>

      {/* Modal: إضافة فعالية */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-amber-400" /> إضافة فعالية أو بطولة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">عنوان الفعالية *</Label>
              <Input
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="دورة السباحة الصيفية"
                className="h-9 bg-slate-800 border-slate-700 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">التاريخ</Label>
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="h-9 bg-slate-800 border-slate-700 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">رسوم التسجيل (دج)</Label>
                <Input
                  type="number"
                  value={newEvent.price}
                  onChange={(e) => setNewEvent({ ...newEvent, price: e.target.value })}
                  className="h-9 bg-slate-800 border-slate-700 text-xs font-mono"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddEventOpen(false)} className="border-slate-700 text-xs">إلغاء</Button>
            <Button onClick={handleCreateEvent} className="bg-teal-600 hover:bg-teal-500 text-white text-xs">نشر الفعالية</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  3. النظام الفرعي: برنامج الولاء والمكافآت (Loyalty Subsystem)
// ═══════════════════════════════════════════════════════════════

function LoyaltySubsystem() {
  const [members] = useState<LoyaltyMember[]>([
    { id: "1", name: "كريم منصوري", phone: "0550112233", points: 1450, tier: "gold", referralCode: "KM145", referralsCount: 8 },
    { id: "2", name: "سميرة حداد", phone: "0661223344", points: 820, tier: "silver", referralCode: "SH820", referralsCount: 3 },
    { id: "3", name: "بلال عيسى", phone: "0770334455", points: 2600, tier: "platinum", referralCode: "BE260", referralsCount: 15 },
    { id: "4", name: "أمين طاهري", phone: "0554445566", points: 310, tier: "bronze", referralCode: "AT310", referralsCount: 1 },
  ]);

  const [pointsToRedeem, setPointsToRedeem] = useState<string>("500");

  const discountAmount = useMemo(() => {
    const pts = parseInt(pointsToRedeem) || 0;
    // كل 100 نقطة تعادل 200 دج خصم
    return Math.floor(pts / 100) * 200;
  }, [pointsToRedeem]);

  return (
    <div className="space-y-6">
      {/* مستويات العضوية والامتيازات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TierCard tier="برونزي" icon="🥉" points="0 - 499" discount="خصم 5%" color="border-amber-700/40 bg-amber-950/20 text-amber-300" />
        <TierCard tier="فضي" icon="🥈" points="500 - 999" discount="خصم 10% + حصة تعويض" color="border-slate-400/40 bg-slate-800/40 text-slate-200" />
        <TierCard tier="ذهبي" icon="🥇" points="1000 - 1999" discount="خصم 15% + بطاقة VIP" color="border-yellow-500/40 bg-yellow-950/20 text-yellow-300" />
        <TierCard tier="بلاتيني" icon="💎" points="2000+" discount="خصم 25% + مدرب شخصي" color="border-cyan-500/40 bg-cyan-950/20 text-cyan-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* قائمة أعضاء برنامج الولاء */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Gift className="h-5 w-5 text-teal-400" /> أعضاء برنامج الولاء والأرصدة
            </h3>
            <span className="text-xs text-slate-400">{members.length} مشتركين مميزين</span>
          </div>

          <div className="space-y-2.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg">
                    {m.tier === "platinum" ? "💎" : m.tier === "gold" ? "🥇" : m.tier === "silver" ? "🥈" : "🥉"}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-100">{m.name}</p>
                    <p className="text-[11px] text-slate-400">كود الإحالة: <strong className="font-mono text-teal-400">{m.referralCode}</strong> • {m.referralsCount} دعوات ناجحة</p>
                  </div>
                </div>

                <div className="text-left">
                  <span className="font-mono text-sm font-black text-amber-400">{m.points.toLocaleString()}</span>
                  <p className="text-[10px] text-slate-400">نقطة مكتسبة</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* حاسبة استبدال النقاط */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 shadow-xl">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-sky-400" /> حاسبة استبدال النقاط
          </h3>
          <p className="text-xs text-slate-400">تحويل رصيد النقاط إلى خصم فوري على التجديد القادم</p>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">النقاط المراد استبدالها</Label>
              <Input
                type="number"
                step={100}
                value={pointsToRedeem}
                onChange={(e) => setPointsToRedeem(e.target.value)}
                className="h-10 bg-slate-800 border-slate-700 text-sm font-mono"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-1">
              <p className="text-[11px] text-slate-400">الخصم المستحق على الفاتورة:</p>
              <p className="text-2xl font-black text-emerald-400 font-mono">{discountAmount} دج</p>
              <p className="text-[10px] text-slate-500">(100 نقطة = 200 دج)</p>
            </div>

            <Button
              onClick={() => toast.success(`تم تطبيق خصم بقيمة ${discountAmount} دج بنجاح للمشترك`)}
              className="w-full bg-gradient-to-l from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white text-xs font-semibold h-10"
            >
              تطبيق الخصم الآن
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TierCard({ tier, icon, points, discount, color }: { tier: string; icon: string; points: string; discount: string; color: string }) {
  return (
    <div className={cn("p-4 rounded-2xl border space-y-1 text-center shadow-lg", color)}>
      <span className="text-2xl">{icon}</span>
      <h4 className="font-black text-sm">{tier}</h4>
      <p className="text-[11px] font-mono opacity-80">{points}</p>
      <p className="text-xs font-bold pt-1">{discount}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  4. النظام الفرعي: إدارة العلاقات والرضا (CRM & NPS)
// ═══════════════════════════════════════════════════════════════

function CrmSubsystem() {
  const [npsScores] = useState({ promoters: 74, passives: 18, detractors: 8, totalVotes: 142 });
  const npsCalculated = npsScores.promoters - npsScores.detractors;

  const [interactions, setInteractions] = useState([
    { id: "1", member: "رضوان مراد", type: "call", note: "تم الاتصال للاطمئنان على سبب الغياب لأسبوعين", date: "أمس" },
    { id: "2", member: "فاطمة زهراء", type: "whatsapp", note: "استفسار عن إمكانية تغيير الفوج من الإثنين للسبت", date: "منذ يومين" },
    { id: "3", member: "عمر فاروق", type: "email", note: "إرسال شهادة التأمين السنوي", date: "منذ 3 أيام" },
  ]);

  const [newNote, setNewNote] = useState({ member: "", note: "" });

  const handleAddNote = () => {
    if (!newNote.member.trim() || !newNote.note.trim()) {
      toast.error("يرجى ملء الاسم والملاحظة");
      return;
    }
    setInteractions([
      { id: Date.now().toString(), member: newNote.member.trim(), type: "call", note: newNote.note.trim(), date: "الآن" },
      ...interactions,
    ]);
    setNewNote({ member: "", note: "" });
    toast.success("تم تسجيل الملاحظة في ملف العضو بنجاح");
  };

  return (
    <div className="space-y-6">
      {/* بطاقة مؤشر الرضا NPS */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-rose-400" />
            <h3 className="font-bold text-base text-slate-100">مؤشر رضا المنخرطين (Net Promoter Score)</h3>
          </div>
          <p className="text-xs text-slate-400">قياس مدى ولاء المشتركين واستعدادهم لترشيح النادي لأصدقائهم</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="text-4xl font-black text-emerald-400 font-mono">+{npsCalculated}</span>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">ممتاز (Excellent)</p>
          </div>

          <div className="space-y-1.5 text-xs w-48">
            <div className="flex justify-between text-emerald-400">
              <span>المروجون (9-10)</span>
              <strong>{npsScores.promoters}%</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>المحايدون (7-8)</span>
              <strong>{npsScores.passives}%</strong>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>المنتقدون (0-6)</span>
              <strong>{npsScores.detractors}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* سجل التواصل والمتابعة اليومية */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 shadow-xl">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Phone className="h-4 w-4 text-teal-400" /> سجل اتصالات ومتابعة المنخرطين
          </h3>

          <div className="space-y-3">
            {interactions.map((it) => (
              <div key={it.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-100">{it.member}</span>
                  <span className="text-[10px] text-slate-500">{it.date}</span>
                </div>
                <p className="text-xs text-slate-300">{it.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* تسجيل اتصال أو ملاحظة سريعة */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-3 shadow-xl">
          <h3 className="font-bold text-sm text-slate-100">تسجيل متابعة سريعة</h3>
          <div className="space-y-2 text-xs">
            <div>
              <Label className="text-xs">اسم المنخرط</Label>
              <Input
                value={newNote.member}
                onChange={(e) => setNewNote({ ...newNote, member: e.target.value })}
                placeholder="اسم العضو..."
                className="h-9 bg-slate-800 border-slate-700 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">تفاصيل الملاحظة / المكالمة</Label>
              <textarea
                value={newNote.note}
                onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
                placeholder="ماذا دار في التواصل..."
                className="w-full h-24 p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <Button
              onClick={handleAddNote}
              className="w-full h-9 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
            >
              حفظ في ملف المشترك
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  5. النظام الفرعي: الدعم الفني وتذاكر المساعدة (Support Subsystem)
// ═══════════════════════════════════════════════════════════════

function SupportSubsystem() {
  const [tickets, setTickets] = useState<SupportTicket[]>([
    { id: "1", ticketNumber: "TCK-401", memberName: "طارق زياني", subject: "مشكلة في قراءة بطاقة QR عند البوابة", category: "technical", priority: "urgent", status: "open", createdAt: "2026/09/24", lastReply: "جاري فحص الماسح الضوئي" },
    { id: "2", ticketNumber: "TCK-402", memberName: "حسناء عماري", subject: "طلب استرجاع إيصال تسديد التأمين", category: "billing", priority: "medium", status: "in_progress", createdAt: "2026/09/23", lastReply: "تم تجهيز الوثيقة للإرسال" },
    { id: "3", ticketNumber: "TCK-403", memberName: "عادل بوجمعة", subject: "استفسار حول أوقات مسبح الكبار", category: "general", priority: "low", status: "resolved", createdAt: "2026/09/21", lastReply: "تم الرد وتوضيح التوقيت" },
  ]);

  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newTkt, setNewTkt] = useState({ memberName: "", subject: "", category: "technical", priority: "medium" });

  const handleCreateTicket = () => {
    if (!newTkt.memberName.trim() || !newTkt.subject.trim()) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    const item: SupportTicket = {
      id: Date.now().toString(),
      ticketNumber: `TCK-40${tickets.length + 1}`,
      memberName: newTkt.memberName.trim(),
      subject: newTkt.subject.trim(),
      category: newTkt.category as any,
      priority: newTkt.priority as any,
      status: "open",
      createdAt: new Date().toLocaleDateString("ar-DZ"),
      lastReply: "بانتظار مراجعة الفريق",
    };
    setTickets([item, ...tickets]);
    setNewTicketOpen(false);
    toast.success(`تم فتح التذكرة رقم ${item.ticketNumber}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Headphones className="h-5 w-5 text-teal-400" /> مركز تذاكر الدعم الفني والمساعدة
          </h3>
          <p className="text-xs text-slate-400">متابعة وحل المشكلات والاستفسارات الإدارية والتقنية</p>
        </div>
        <Button
          onClick={() => setNewTicketOpen(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white text-xs gap-1.5 h-9"
        >
          <Plus className="h-4 w-4" /> فتح تذكرة دعم
        </Button>
      </div>

      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
              <tr className="text-right">
                <th className="p-3 font-semibold">رقم التذكرة</th>
                <th className="p-3 font-semibold">المشترك</th>
                <th className="p-3 font-semibold">الموضوع</th>
                <th className="p-3 font-semibold">القسم</th>
                <th className="p-3 font-semibold">الأولوية</th>
                <th className="p-3 font-semibold">الحالة</th>
                <th className="p-3 font-semibold">آخر تحديث</th>
                <th className="p-3 font-semibold text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-mono font-bold text-teal-400">{t.ticketNumber}</td>
                  <td className="p-3 font-semibold text-slate-200">{t.memberName}</td>
                  <td className="p-3 text-slate-300 max-w-[200px] truncate">{t.subject}</td>
                  <td className="p-3 text-slate-400">{t.category === "technical" ? "تقني" : t.category === "billing" ? "مالي" : "عام"}</td>
                  <td className="p-3">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", t.priority === "urgent" ? "bg-rose-500/20 text-rose-400" : t.priority === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400")}>
                      {t.priority === "urgent" ? "عاجلة" : t.priority === "medium" ? "متوسطة" : "عادية"}
                    </span>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={t.status === "open" ? "text-rose-400 border-rose-500/30 text-[10px]" : t.status === "in_progress" ? "text-amber-400 border-amber-500/30 text-[10px]" : "text-emerald-400 border-emerald-500/30 text-[10px]"}>
                      {t.status === "open" ? "مفتوحة" : t.status === "in_progress" ? "قيد المتابعة" : "تم الحل"}
                    </Badge>
                  </td>
                  <td className="p-3 text-slate-400 text-[11px]">{t.lastReply}</td>
                  <td className="p-3 text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        toast.success(`تم تحديث التذكرة ${t.ticketNumber} إلى "تم الحل"`);
                        setTickets(tickets.map(tk => tk.id === t.id ? { ...tk, status: "resolved", lastReply: "تم إغلاق التذكرة بنجاح" } : tk));
                      }}
                      className="h-7 text-xs text-teal-400 hover:text-white"
                    >
                      حل التذكرة
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: فتح تذكرة جديدة */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Headphones className="h-5 w-5 text-teal-400" /> فتح تذكرة دعم جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">اسم صاحب الطلب *</Label>
              <Input
                value={newTkt.memberName}
                onChange={(e) => setNewTkt({ ...newTkt, memberName: e.target.value })}
                placeholder="اسم العضو أو الموظف"
                className="h-9 bg-slate-800 border-slate-700 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">موضوع المشكلة *</Label>
              <Input
                value={newTkt.subject}
                onChange={(e) => setNewTkt({ ...newTkt, subject: e.target.value })}
                placeholder="وصف موجز للمشكلة"
                className="h-9 bg-slate-800 border-slate-700 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">القسم المختص</Label>
                <Select value={newTkt.category} onValueChange={(v) => setNewTkt({ ...newTkt, category: v })}>
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="technical">الدعم الفني</SelectItem>
                    <SelectItem value="billing">الحسابات والفوترة</SelectItem>
                    <SelectItem value="general">استفسار عام</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الأولوية</Label>
                <Select value={newTkt.priority} onValueChange={(v) => setNewTkt({ ...newTkt, priority: v })}>
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="low">عادية</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="urgent">عاجلة جداً</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewTicketOpen(false)} className="border-slate-700 text-xs">إلغاء</Button>
            <Button onClick={handleCreateTicket} className="bg-teal-600 hover:bg-teal-500 text-white text-xs">تسجيل التذكرة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EnterpriseHub;
