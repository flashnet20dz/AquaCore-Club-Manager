"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  KeyRound, Plus, Trash2, Loader2, Lock, ExternalLink, Copy, CheckCircle2, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Pin {
  id: string;
  label: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "👑 مدير",
  assistant: "💼 مساعد",
  lifeguard: "🏊 حارس",
  observer: "👁️ مراقب",
};

export function CashierPinManagement() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pin | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [form, setForm] = useState({ pin: "", confirmPin: "", label: "كاشير", role: "assistant" });
  const [saving, setSaving] = useState(false);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);

  const fetchPins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cashier-pin");
      const data = await res.json();
      if (res.ok) setPins(data.pins || []);
      else toast.error(data.error || "تعذر تحميل أكواد PIN");
    } catch {
      toast.error("تعذر تحميل أكواد PIN");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  const handleOpenAdd = () => {
    setForm({ pin: "", confirmPin: "", label: "كاشير", role: "assistant" });
    setShowPin(false);
    setRevealedPin(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!/^\d{4}$/.test(form.pin)) {
      toast.error("رمز PIN يجب أن يكون 4 أرقام بالضبط");
      return;
    }
    if (form.pin !== form.confirmPin) {
      toast.error("رمزا PIN غير متطابقين");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/cashier-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          pin: form.pin,
          label: form.label || "كاشير",
          role: form.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل");
      toast.success(`تم إنشاء رمز PIN لـ ${form.label}`);
      setRevealedPin(form.pin); // show the PIN one more time so admin can share it
      setModalOpen(false);
      fetchPins();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/cashier-pin/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("تم حذف رمز PIN");
      setDeleteTarget(null);
      fetchPins();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const copyPinUrl = () => {
    const url = `${window.location.origin}/pin`;
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط صفحة PIN");
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              أكواد الكاشير السريعة (PIN)
              <Badge variant="secondary" className="text-[10px]">{pins.length}</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">رمز 4 أرقام للدخول السريع من تابلت الكاشير</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/pin" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> فتح صفحة PIN
          </a>
          <Button variant="outline" size="sm" onClick={copyPinUrl}>
            <Copy className="h-3.5 w-3.5 ml-1" /> نسخ الرابط
          </Button>
          <Button onClick={handleOpenAdd} size="sm">
            <Plus className="h-4 w-4 ml-1" /> رمز جديد
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pins.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground rounded-lg bg-card border border-dashed border-emerald-500/30">
          <Lock className="h-8 w-8 mx-auto mb-2 opacity-40 text-emerald-600" />
          <p className="font-semibold text-emerald-700 mb-1">لا توجد أكواد PIN بعد</p>
          <p>أنشئ رمزاً واحداً على الأقل لتفعيل الدخول السريع من التابلت</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pins.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`rounded-xl border p-3 transition ${p.active ? "bg-card border-emerald-500/30 hover:shadow-md" : "opacity-60 bg-muted/30 border-border"}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 shrink-0">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[p.role] || p.role}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    أنشئ في {new Date(p.createdAt).toLocaleDateString("ar-DZ")}
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30 shrink-0">
                  ● • • •
                </Badge>
              </div>
              <div className="flex gap-1 mt-2 pt-2 border-t">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs flex-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)}>
                  <Trash2 className="h-3 w-3 ml-1" /> حذف
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info banner */}
      <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div>
          <strong>كيف يعمل؟</strong> ادخل إلى <code className="bg-emerald-500/20 px-1 rounded">/pin</code> على التابلت، اضغط 4 أرقام، وسيتم تسجيل الدخول تلقائياً بصلاحيات الدور المحدد. الرمز نفسه يفتح جلسة واحدة — لا حاجة لاسم مستخدم أو كلمة مرور.
        </div>
      </div>

      {/* Create PIN Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600" /> إنشاء رمز PIN للكاشير
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">اسم الكاشير / الوصف *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="h-10" placeholder="كاشير المساء، مدخل الباب، ..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">الدور (الصلاحيات) *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assistant">💼 مساعد إداري (تسجيل حضور/دفع)</SelectItem>
                  <SelectItem value="lifeguard">🏊 حارس سباحة (حضور فقط)</SelectItem>
                  <SelectItem value="admin">👑 مدير (كل الصلاحيات)</SelectItem>
                  <SelectItem value="observer">👁️ مراقب (عرض فقط)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">رمز PIN (4 أرقام) *</Label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  className="h-12 pl-10 text-center text-2xl font-bold tracking-[0.5em]"
                  dir="ltr"
                  placeholder="••••"
                  inputMode="numeric"
                  maxLength={4}
                />
                <button type="button" onClick={() => setShowPin(!showPin)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* PIN strength dots */}
              <div className="flex justify-center gap-2 mt-1">
                {[0,1,2,3].map((i) => (
                  <div key={i} className={`h-2 w-2 rounded-full transition ${i < form.pin.length ? "bg-emerald-500" : "bg-muted"}`} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">تأكيد الرمز *</Label>
              <Input
                type={showPin ? "text" : "password"}
                value={form.confirmPin}
                onChange={(e) => setForm({ ...form, confirmPin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                className="h-12 text-center text-2xl font-bold tracking-[0.5em]"
                dir="ltr"
                placeholder="••••"
                inputMode="numeric"
                maxLength={4}
              />
              {form.confirmPin.length > 0 && form.pin !== form.confirmPin && (
                <p className="text-xs text-rose-600">الرمزان غير متطابقين</p>
              )}
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-800 dark:text-amber-200">
              ⚠️ <strong>تنبيه:</strong> احفظ الرمز بمكان آمن — لن تتمكن من رؤيته مرة أخرى بعد الإنشاء (يُخزَّن مشفّراً).
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving || !/^\d{4}$/.test(form.pin) || form.pin !== form.confirmPin}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 ml-1" />}
              إنشاء الرمز
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal-once banner (shown after creating a PIN) */}
      {revealedPin && (
        <Dialog open={!!revealedPin} onOpenChange={(o) => !o && setRevealedPin(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" /> تم إنشاء الرمز
              </DialogTitle>
            </DialogHeader>
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-3">احفظ هذا الرمز الآن — لن يظهر مرة أخرى:</p>
              <div className="inline-block bg-emerald-500/10 border-2 border-dashed border-emerald-500/40 rounded-xl px-6 py-3">
                <span className="text-3xl font-bold tracking-[0.4em] text-emerald-700" dir="ltr">{revealedPin}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                صفحة الدخول: <code className="bg-muted px-1 rounded">{window.location.origin}/pin</code>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => { navigator.clipboard.writeText(revealedPin); toast.success("تم نسخ الرمز"); }}
              >
                <Copy className="h-3.5 w-3.5 ml-1" /> نسخ الرمز
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setRevealedPin(null)}>تم، فهمت</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف رمز PIN</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف رمز PIN لـ{" "}
              <span className="font-bold text-foreground">{deleteTarget?.label}</span>؟
              لن يستطيع الكاشير الدخول بهذا الرمز بعد الآن.
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
    </div>
  );
}
