"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, ShieldCheck, Loader2, Users as UsersIcon, Power, Eye, EyeOff, Clock, CheckCircle2, XCircle, KeyRound, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CashierPinManagement } from "@/components/cashier-pin-management";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  active: boolean;
  pending: boolean;
  createdAt: string;
}

const ROLE_INFO: Record<string, { label: string; icon: string; color: string }> = {
  superadmin: { label: "المدير العام", icon: "⭐", color: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
  admin: { label: "مدير", icon: "👑", color: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  accountant: { label: "محاسب مالي", icon: "💰", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  assistant: { label: "مساعد إداري", icon: "💼", color: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  lifeguard: { label: "حارس سباحة", icon: "🏊", color: "bg-teal-500/15 text-teal-700 border-teal-500/30" },
  observer: { label: "مراقب", icon: "👁️", color: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
};

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "lifeguard", phone: "" });
  const [saving, setSaving] = useState(false);
  // ★ Cashier PIN (quick login code)
  const [pinModal, setPinModal] = useState<User | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
      else toast.error(data.error);
    } catch {
      toast.error("تعذر تحميل المستخدمين");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setForm({ name: "", email: "", password: "", role: "lifeguard", phone: "" });
    setModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: "", role: user.role, phone: user.phone || "" });
    setModalOpen(true);
  };

  // ★ إنشاء/تحديث كود الكاشير السريع (PIN)
  const handleGeneratePin = async (user: User) => {
    // توليد PIN عشوائي من 4 أرقام
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPinValue(newPin);
    setPinModal(user);
  };

  const handleSavePin = async () => {
    if (!pinModal || !pinValue || pinValue.length < 4) return;
    setPinSaving(true);
    try {
      // ★ يجب إرسال action:"create" — بدونه يعامل الطلب كمحاولة دخول PIN
      //   فيفشل دائماً برسالة «فشل إنشاء كود الكاشير»
      const res = await fetch("/api/cashier-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          pin: pinValue,
          label: pinModal.name,
          role: pinModal.role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "فشل حفظ الكود");
      toast.success(`تم إنشاء كود الكاشير لـ ${pinModal.name}: ${pinValue}`);
      setPinModal(null);
      setPinValue("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل إنشاء كود الكاشير");
    } finally {
      setPinSaving(false);
    }
  };

  const copyPin = () => {
    navigator.clipboard.writeText(pinValue);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleSave = async () => {
    if (!form.name || !form.email || (!editingUser && !form.password)) {
      toast.error("يرجى ملء الحقول المطلوبة");
      return;
    }
    setSaving(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        phone: form.phone,
      };
      if (!editingUser || form.password) body.password = form.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل");

      toast.success(editingUser ? "تم تحديث المستخدم" : "تم إنشاء المستخدم بنجاح");
      setModalOpen(false);
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      if (!res.ok) throw new Error();
      toast.success(user.active ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
      fetchUsers();
    } catch {
      toast.error("فشل");
    }
  };

  const handleApprove = async (user: User, role: string) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending: false, role, active: true }),
      });
      if (!res.ok) throw new Error();
      toast.success(`تم تفعيل حساب ${user.name} (${ROLE_INFO[role]?.label || role})`);
      fetchUsers();
    } catch {
      toast.error("فشل التفعيل");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success("تم حذف المستخدم");
      setDeleteTarget(null);
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    }
  };

  return (
    <div className="space-y-4">
      {/* Cashier PIN management (top section) */}
      <CashierPinManagement />

      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base">إدارة المستخدمين</h3>
            <Badge variant="secondary">{users.length}</Badge>
          </div>
          <Button onClick={handleOpenAdd} size="sm">
            <Plus className="h-4 w-4 ml-1" /> مستخدم جديد
          </Button>
        </div>

        {/* Roles legend */}
        <div className="flex flex-wrap gap-2 mb-4 p-2 rounded-lg bg-muted/40">
          {Object.entries(ROLE_INFO).map(([key, info]) => (
            <Badge key={key} variant="outline" className={info.color}>
              {info.icon} {info.label}
            </Badge>
          ))}
        </div>

        {/* Pending accounts section */}
        {users.filter((u) => u.pending).length > 0 && (
          <div className="mb-4 rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <h4 className="font-bold text-sm text-amber-800 dark:text-amber-200">
                حسابات بانتظار الموافقة ({users.filter((u) => u.pending).length})
              </h4>
            </div>
            <div className="space-y-2">
              {users.filter((u) => u.pending).map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-lg bg-card p-3 border border-amber-200/50"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-9 w-9 rounded-lg shrink-0">
                        <AvatarFallback className="rounded-md text-xs font-bold bg-amber-500/15 text-amber-700">
                          {u.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">{u.email}</p>
                        {u.phone && <p className="text-xs text-muted-foreground" dir="ltr">{u.phone}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground ml-1">تحديد الدور:</span>
                      <Select defaultValue={u.role} onValueChange={(role) => handleApprove(u, role)}>
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_INFO).map(([key, info]) => (
                            <SelectItem key={key} value={key} className="text-xs">
                              {info.icon} {info.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(u, u.role)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> تفعيل
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-500/10"
                        onClick={() => { setDeleteTarget(u); }}
                      >
                        <XCircle className="h-3.5 w-3.5 ml-1" /> رفض
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">لا يوجد مستخدمون</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((u, i) => {
              const info = ROLE_INFO[u.role] || ROLE_INFO.observer;
              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`rounded-xl border p-3 transition ${!u.active ? "opacity-60 bg-muted/30" : "bg-card hover:shadow-md"}`}
                >
                  <div className="flex items-start gap-2">
                    <Avatar className="h-10 w-10 rounded-lg">
                      <AvatarFallback className="rounded-md text-xs font-bold bg-primary/15 text-primary">
                        {u.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate">{u.name}</p>
                        {!u.active && <Badge variant="outline" className="text-[9px] h-4 px-1">معطّل</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate" dir="ltr">{u.email}</p>
                      <Badge variant="outline" className={`mt-1 text-[10px] ${info.color}`}>
                        {info.icon} {info.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2 pt-2 border-t">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs flex-1" onClick={() => handleOpenEdit(u)}>
                      <Pencil className="h-3 w-3 ml-1" /> تعديل
                    </Button>
                    {/* ★ زر كود الكاشير السريع — مخفي للمدير العام */}
                    {u.role !== "superadmin" && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleGeneratePin(u)} title="إنشاء كود كاشير سريع">
                        <KeyRound className="h-3.5 w-3.5 ml-1" /> كود
                      </Button>
                    )}
                    {/* ★ زر التعطيل/التفعيل — مخفي للمدير العام */}
                    {u.role !== "superadmin" && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleToggleActive(u)} title={u.active ? "تعطيل" : "تفعيل"}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {/* ★ زر الحذف — مخفي للمدير العام (حساب محمي) */}
                    {u.role !== "superadmin" && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(u)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "تعديل مستخدم" : "إنشاء مستخدم جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">الاسم الكامل *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10" placeholder="محمد الأمين" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">البريد الإلكتروني *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10" dir="ltr" placeholder="user@rcs.dz" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                كلمة المرور {editingUser ? "(اتركها فارغة للإبقاء عليها)" : "*"}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-10 pl-10"
                  dir="ltr"
                  placeholder={editingUser ? "••••••" : "6 أحرف على الأقل"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">الدور *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })} disabled={editingUser?.role === "superadmin"}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.icon} {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingUser?.role === "superadmin" && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  ⚠ لا يمكن تغيير دور المدير العام (superadmin) — حساب محمي
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">رقم الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10" dir="ltr" placeholder="0550000000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 ml-1" />}
              {editingUser ? "حفظ" : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف حساب{" "}
              <span className="font-bold text-foreground">{deleteTarget?.name}</span>؟
              سيتم حذف جميع سجلات ساعات العمل المرتبطة به.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              نعم، احذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ★ نافذة كود الكاشير السريع */}
      <Dialog open={!!pinModal} onOpenChange={(o) => !o && setPinModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal-600" /> كود الكاشير السريع
            </DialogTitle>
            <DialogDescription>
              كود سريع من 4 أرقام لتسجيل الدخول السريع — {pinModal?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-300/50 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">الكود المُولَّد:</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-extrabold tracking-widest text-teal-700 dark:text-teal-400 font-mono">{pinValue}</span>
                <button onClick={copyPin} className="p-1.5 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900 transition" title="نسخ">
                  {copiedPin ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs">أدخل كوداً مخصصاً (اختياري — 4 أرقام):</Label>
              <Input
                type="text"
                maxLength={4}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-10 text-center text-lg font-bold tracking-widest font-mono"
                placeholder="0000"
              />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setPinValue(Math.floor(1000 + Math.random() * 9000).toString())}>
                توليد عشوائي
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              يمكن للمستخدم تسجيل الدخول بهذا الكود من صفحة تسجيل الدخول بدلاً من البريد وكلمة المرور.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinModal(null)}>إلغاء</Button>
            <Button onClick={handleSavePin} disabled={pinSaving || pinValue.length < 4} className="bg-teal-600 hover:bg-teal-700">
              {pinSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 ml-1" />}
              حفظ الكود
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
