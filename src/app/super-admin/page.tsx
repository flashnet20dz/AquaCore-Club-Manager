"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Shield, Building, Users, AlertCircle, CheckCircle2, XCircle, Clock,
  Calendar, Wallet, Loader2, RefreshCw, Eye, Power, Ban, Trash2,
  Plus, KeyRound, Settings, LogOut, TrendingUp, UserCog,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ActivationCodesPanel } from "@/components/activation-codes-panel";
import { SuperAdminDashboard } from "@/components/super-admin-dashboard";
import { SuperAdminControlCenter } from "@/components/super-admin-control-center";

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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  expired: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  disabled: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  suspended: "bg-violet-500/15 text-violet-700 border-violet-500/30",
};

function formatDate(d: string | Date): string {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subAction, setSubAction] = useState("renew");
  const [subType, setSubType] = useState("monthly");
  const [subMonths, setSubMonths] = useState(1);
  const [codesPanelOpen, setCodesPanelOpen] = useState(false);
  // ★ حسابي: تعديل بيانات المدير العام
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", password: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const fetchClubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clubs");
      const data = await res.json();
      if (res.ok) setClubs(data.clubs || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.user || data.user.role !== "superadmin") {
          window.location.href = "/login";
        } else {
          // ★ املأ بيانات الحساب
          setMyUserId(data.user.id);
          setProfile({
            name: data.user.name || "",
            email: data.user.email || "",
            phone: data.user.phone || "",
            password: "",
          });
        }
      })
      .catch(() => { window.location.href = "/login"; });
    fetchClubs();
  }, [fetchClubs]);

  // ★ حفظ تعديلات حساب المدير العام
  const handleSaveProfile = async () => {
    if (!myUserId) return;
    if (!profile.name.trim()) {
      toast.error("الاسم مطلوب");
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
        phone: profile.phone.trim() || null,
      };
      if (profile.password) body.password = profile.password;
      const res = await fetch(`/api/users/${myUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "فشل التحديث");
      }
      toast.success("تم تحديث بياناتك بنجاح");
      setProfileOpen(false);
      setProfile((p) => ({ ...p, password: "" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAction = async (club: Club, action: string) => {
    try {
      const res = await fetch(`/api/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action: "approve" } : action === "reject" ? { action: "reject" } : { status: action }),
      });
      if (!res.ok) throw new Error();
      toast.success(`تم ${action === "approve" ? "قبول" : action === "reject" ? "رفض" : "تحديث"} النادي`);
      fetchClubs();
    } catch { toast.error("فشل"); }
  };

  const handleDelete = async (club: Club) => {
    if (!confirm(`حذف نادي "${club.name}"؟ لا يمكن التراجع.`)) return;
    try {
      await fetch(`/api/clubs/${club.id}`, { method: "DELETE" });
      toast.success("تم حذف النادي");
      fetchClubs();
    } catch { toast.error("فشل الحذف"); }
  };

  const handleSubscription = async () => {
    if (!selectedClub) return;
    try {
      const res = await fetch(`/api/clubs/${selectedClub.id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: subAction, type: subType, months: parseInt(String(subMonths)) }),
      });
      if (!res.ok) throw new Error();
      toast.success("تم تحديث الاشتراك");
      setSubModalOpen(false);
      fetchClubs();
    } catch { toast.error("فشل"); }
  };

  // Stats
  const stats = {
    total: clubs.length,
    active: clubs.filter((c) => c.status === "active").length,
    pending: clubs.filter((c) => c.status === "pending").length,
    expired: clubs.filter((c) => c.status === "expired").length,
    suspended: clubs.filter((c) => c.status === "suspended").length,
    expiringSoon: clubs.filter((c) => c.daysRemaining > 0 && c.daysRemaining <= 7).length,
    expiring30: clubs.filter((c) => c.daysRemaining > 7 && c.daysRemaining <= 30).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/40">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-extrabold text-sm sm:text-base">لوحة تحكم المدير العام</h1>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">SuperAdmin</Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* ★ زر حسابي — تعديل بيانات المدير العام */}
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)} className="h-9 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
              <UserCog className="h-4 w-4 ml-1" /> حسابي
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCodesPanelOpen(true)} className="h-9 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
              <KeyRound className="h-4 w-4 ml-1" /> أكواد التفعيل
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchClubs} className="h-9 w-9">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>
              <LogOut className="h-4 w-4 ml-1" /> خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <StatCard icon={Building} label="إجمالي النوادي" value={stats.total} color="text-teal-700 bg-teal-500/10" />
          <StatCard icon={CheckCircle2} label="نشطة" value={stats.active} color="text-emerald-700 bg-emerald-500/10" />
          <StatCard icon={Clock} label="بانتظار الموافقة" value={stats.pending} color="text-amber-700 bg-amber-500/10" />
          <StatCard icon={XCircle} label="منتهية" value={stats.expired} color="text-rose-700 bg-rose-500/10" />
          <StatCard icon={Ban} label="موقوفة" value={stats.suspended} color="text-violet-700 bg-violet-500/10" />
          <StatCard icon={AlertCircle} label="تنتهي خلال 7 أيام" value={stats.expiringSoon} color="text-orange-700 bg-orange-500/10" />
          <StatCard icon={Calendar} label="تنتهي خلال 30 يوم" value={stats.expiring30} color="text-blue-700 bg-blue-500/10" />
        </div>

        {/* Alerts — تنبيهات النوادي */}
        <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-bold text-sm text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> التنبيهات
            </h3>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
              مهلة قفل الحساب بعد انتهاء الاشتراك: 24 ساعة
            </Badge>
          </div>
          {stats.pending === 0 && stats.expiringSoon === 0 && stats.expired === 0 && stats.suspended === 0 ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> لا توجد تنبيهات حالياً — كل النوادي نشطة وسارية
            </p>
          ) : (
            <ul className="space-y-1">
              {stats.pending > 0 && (
                <li className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  {stats.pending} طلب تسجيل نادٍ جديد بانتظار المراجعة
                </li>
              )}
              {stats.expiringSoon > 0 && (
                <li className="text-xs text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                  {stats.expiringSoon} نادٍ ينتهي اشتراكه خلال 7 أيام
                </li>
              )}
              {stats.expiring30 > 0 && (
                <li className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  {stats.expiring30} نادٍ ينتهي اشتراكه خلال 30 يوم
                </li>
              )}
              {stats.expired > 0 && (
                <li className="text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                  {stats.expired} نادٍ منتهي الاشتراك (مهلة 24 ساعة قبل القفل)
                </li>
              )}
              {stats.suspended > 0 && (
                <li className="text-xs text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                  {stats.suspended} نادٍ موقوف
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Clubs table */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" /> إدارة النوادي
            </h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : clubs.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">لا توجد نوادي مسجلة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-right">
                    <th className="p-2 font-semibold">النادي</th>
                    <th className="p-2 font-semibold">المسؤول</th>
                    <th className="p-2 font-semibold">المدينة</th>
                    <th className="p-2 font-semibold">التسجيل</th>
                    <th className="p-2 font-semibold">الاشتراك</th>
                    <th className="p-2 font-semibold">البداية</th>
                    <th className="p-2 font-semibold">النهاية</th>
                    <th className="p-2 font-semibold">متبقي</th>
                    <th className="p-2 font-semibold">الحالة</th>
                    <th className="p-2 font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {clubs.map((club) => (
                    <tr key={club.id} className="border-b hover:bg-accent/30">
                      <td className="p-2 font-semibold">{club.name}</td>
                      <td className="p-2">{club.managerName}<br /><span className="text-muted-foreground" dir="ltr">{club.email}</span></td>
                      <td className="p-2">{club.city}</td>
                      <td className="p-2 whitespace-nowrap">{formatDate(club.createdAt)}</td>
                      <td className="p-2">{club.subscription ? (club.subscription.type === "monthly" ? "شهري" : "سنوي") : "—"}</td>
                      <td className="p-2 whitespace-nowrap">{club.subscription ? formatDate(club.subscription.startDate) : "—"}</td>
                      <td className="p-2 whitespace-nowrap">{club.subscription ? formatDate(club.subscription.endDate) : "—"}</td>
                      <td className="p-2 font-bold tabular-nums">{club.daysRemaining > 0 ? `${club.daysRemaining} يوم` : "—"}</td>
                      <td className="p-2"><Badge variant="outline" className={cn("text-[9px]", STATUS_COLORS[club.status])}>{STATUS_LABELS[club.status]}</Badge></td>
                      <td className="p-2">
                        <div className="flex gap-0.5 flex-wrap">
                          {club.status === "pending" && (
                            <>
                              <ActionBtn icon={CheckCircle2} color="text-emerald-600" onClick={() => handleAction(club, "approve")} title="قبول" />
                              <ActionBtn icon={XCircle} color="text-rose-600" onClick={() => handleAction(club, "reject")} title="رفض" />
                            </>
                          )}
                          {club.status === "active" && (
                            <>
                              <ActionBtn icon={KeyRound} color="text-blue-600" onClick={() => { setSelectedClub(club); setSubModalOpen(true); }} title="إدارة الاشتراك" />
                              <ActionBtn icon={Ban} color="text-violet-600" onClick={() => handleAction(club, "suspended")} title="إيقاف" />
                            </>
                          )}
                          {(club.status === "suspended" || club.status === "expired") && (
                            <ActionBtn icon={Power} color="text-emerald-600" onClick={() => handleAction(club, "active")} title="تفعيل" />
                          )}
                          <ActionBtn icon={Trash2} color="text-rose-600" onClick={() => handleDelete(club)} title="حذف" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Super Admin Control Dashboard */}
        <SuperAdminDashboard />

        {/* Super Admin Control Center — مركز التحكم الشامل */}
        <SuperAdminControlCenter />
      </main>

      {/* Subscription management modal */}
      <Dialog open={subModalOpen} onOpenChange={setSubModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> إدارة اشتراك: {selectedClub?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold">الإجراء</label>
              <Select value={subAction} onValueChange={setSubAction}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="renew">تجديد الاشتراك</SelectItem>
                  <SelectItem value="change">تغيير النوع (شهري↔سنوي)</SelectItem>
                  <SelectItem value="extend">تمديد الاشتراك</SelectItem>
                  <SelectItem value="suspend">إيقاف الاشتراك</SelectItem>
                  <SelectItem value="reactivate">إعادة تفعيل</SelectItem>
                  <SelectItem value="end">إنهاء الاشتراك</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(subAction === "renew" || subAction === "create") && (
              <div className="space-y-1">
                <label className="text-sm font-semibold">نوع الاشتراك</label>
                <Select value={subType} onValueChange={setSubType}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">شهري</SelectItem>
                    <SelectItem value="yearly">سنوي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {subAction === "extend" && (
              <div className="space-y-1">
                <label className="text-sm font-semibold">عدد الأشهر</label>
                <Input type="number" min={1} max={12} value={subMonths} onChange={(e) => setSubMonths(parseInt(e.target.value) || 1)} className="h-10" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubscription}>تنفيذ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activation Codes Management Panel */}
      <ActivationCodesPanel open={codesPanelOpen} onClose={() => setCodesPanelOpen(false)} />

      {/* ★ Modal حسابي — تعديل بيانات المدير العام */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" /> حسابي — المدير العام
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 flex items-center gap-2">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">حساب المدير العام (SuperAdmin)</p>
                <p className="text-[11px] text-muted-foreground">يمكنك تعديل اسمك وهاتفك وكلمة المرور. الدور محمي ولا يمكن تغييره.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">الاسم الكامل *</Label>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="h-10"
                placeholder="المدير العام"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">البريد الإلكتروني (غير قابل للتعديل)</Label>
              <Input
                type="email"
                value={profile.email}
                disabled
                className="h-10 bg-muted/40"
                dir="ltr"
              />
              <p className="text-[10px] text-muted-foreground">لتغيير البريد، تواصل مع الدعم.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">رقم الهاتف</Label>
              <Input
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="h-10"
                dir="ltr"
                placeholder="0550000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                كلمة المرور <span className="text-muted-foreground font-normal">(اتركها فارغة للإبقاء عليها)</span>
              </Label>
              <Input
                type="password"
                value={profile.password}
                onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                className="h-10"
                dir="ltr"
                placeholder="••••••"
              />
              <p className="text-[10px] text-muted-foreground">6 أحرف على الأقل.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveProfile} disabled={profileSaving || !profile.name.trim()}>
              {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4 ml-1" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg mb-2", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-extrabold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function ActionBtn({ icon: Icon, color, onClick, title }: { icon: React.ComponentType<{ className?: string }>; color: string; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className={cn("p-1.5 rounded-lg hover:bg-accent transition", color)}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
