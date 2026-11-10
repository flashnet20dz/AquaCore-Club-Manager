"use client";

import { useState } from "react";
import {
  Waves, Plus, Edit2, Archive, Check, ShieldAlert,
  Users, Calendar, Sparkles, Building2, MapPin, Hash, Loader2, X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePools, type PoolData } from "@/hooks/use-pools";
import { toast } from "sonner";

interface PoolsManagementModalProps {
  open: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  { name: "أزرق بحري", hex: "#0284c7" },
  { name: "زمردي مائي", hex: "#0d9488" },
  { name: "بنفسجي ملكي", hex: "#7c3aed" },
  { name: "برتقالي حيوي", hex: "#ea580c" },
  { name: "كهرماني دافئ", hex: "#d97706" },
  { name: "وردي أنيق", hex: "#db2777" },
];

export function PoolsManagementModal({ open, onClose }: PoolsManagementModalProps) {
  const { pools, refreshPools, loading } = usePools();
  const [editingPool, setEditingPool] = useState<PoolData | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [fileNumberPrefix, setFileNumberPrefix] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [lanesCount, setLanesCount] = useState("6");
  const [lengthMeters, setLengthMeters] = useState("25");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [color, setColor] = useState("#0284c7");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setCode("");
    setFileNumberPrefix("");
    setCapacity("40");
    setLanesCount("6");
    setLengthMeters("25");
    setAddress("");
    setPhone("");
    setColor("#0284c7");
    setEditingPool(null);
    setIsCreating(false);
  };

  const handleStartEdit = (pool: PoolData) => {
    setEditingPool(pool);
    setName(pool.name);
    setCode(pool.code);
    setFileNumberPrefix(pool.fileNumberPrefix || "");
    setCapacity(pool.capacity ? String(pool.capacity) : "40");
    setLanesCount(pool.lanesCount ? String(pool.lanesCount) : "6");
    setLengthMeters(pool.lengthMeters ? String(pool.lengthMeters) : "25");
    setAddress(pool.address || "");
    setPhone(pool.phone || "");
    setColor(pool.color || "#0284c7");
    setIsCreating(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("يرجى إدخال اسم المسبح");
      return;
    }

    const isTargetDefault = editingPool ? editingPool.isDefault : false;
    const cleanPrefix = fileNumberPrefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

    if (!isTargetDefault && !cleanPrefix) {
      toast.error("البادئة إلزامية لأي مسبح إضافي (1 إلى 4 حروف وأرقام إنجليزية A-Z, 0-9)");
      return;
    }

    setSubmitting(true);
    try {
      if (editingPool) {
        // Update pool
        const res = await fetch(`/api/pools/${editingPool.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            fileNumberPrefix: fileNumberPrefix.trim() || null,
            capacity: capacity ? parseInt(capacity, 10) : null,
            lanesCount: lanesCount ? parseInt(lanesCount, 10) : null,
            lengthMeters: lengthMeters ? parseFloat(lengthMeters) : null,
            address: address.trim() || null,
            phone: phone.trim() || null,
            color,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل تعديل المسبح");
        toast.success(`تم تحديث بيانات ${name} بنجاح`);
      } else {
        // Create pool
        const res = await fetch("/api/pools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim(),
            fileNumberPrefix: fileNumberPrefix.trim() || null,
            capacity: capacity ? parseInt(capacity, 10) : null,
            lanesCount: lanesCount ? parseInt(lanesCount, 10) : null,
            lengthMeters: lengthMeters ? parseFloat(lengthMeters) : null,
            address: address.trim() || null,
            phone: phone.trim() || null,
            color,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل إضافة المسبح");
        toast.success(`تمت إضافة المسبح ${name} بنجاح`);
      }

      await refreshPools();
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (pool: PoolData) => {
    if (pool.isDefault) {
      toast.error("لا يمكن أرشفة أو حذف المسبح الافتراضي الرئيسي للنادي");
      return;
    }

    if (!confirm(`هل أنت متأكد من أرشفة وتعطيل "${pool.name}"؟\nسيتم الاحتفاظ بكافة بيانات المنخرطين والبطاقات والحضور التاريخية دون حذف.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/pools/${pool.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر إتمام العملية");

      toast.success(data.archived ? `تم أرشفة المسبح ${pool.name} بنجاح` : `تم حذف المسبح ${pool.name}`);
      await refreshPools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تعطيل المسبح");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border border-slate-700/60 bg-slate-900 text-slate-100 rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Waves className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  إدارة المسابح والمنشآت المائية
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-normal">
                    Multi-Pool Architecture
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-1">
                  إدارة المسابح المتعددة التابعة للنادي مع استقلالية الترقيم والاشتراكات والحضور
                </DialogDescription>
              </div>
            </div>
            {!isCreating && (
              <Button
                onClick={() => { resetForm(); setIsCreating(true); }}
                className="bg-sky-600 hover:bg-sky-500 text-white gap-2 font-bold text-xs h-9"
              >
                <Plus className="h-4 w-4" /> إضافة مسبح جديد
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* نموذج الإضافة والتعديل */}
          {isCreating && (
            <form onSubmit={handleSubmit} className="p-5 rounded-xl border border-sky-500/30 bg-sky-950/20 space-y-4">
              <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
                <h3 className="font-bold text-sm text-sky-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-400" />
                  {editingPool ? `تعديل مسبح: ${editingPool.name}` : "إضافة مسبح تشغيلي جديد"}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="h-7 text-xs text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" /> إلغاء
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">اسم المسبح *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: المسبح الأولمبي 50م، مسبح تدريب B..."
                    required
                    className="bg-slate-800/80 border-slate-700 text-sm"
                  />
                </div>

                {!editingPool && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-300">الرمز البرمجي الفريد (Code) *</Label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="مثال: POOL_B, OLYMPIC_50"
                      required
                      className="bg-slate-800/80 border-slate-700 text-sm font-mono"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    بادئة أرقام الملفات (Prefix) {editingPool?.isDefault ? "— المسبح الافتراضي (فارغة حصراً)" : "*"}
                  </Label>
                  <Input
                    value={editingPool?.isDefault ? "" : fileNumberPrefix}
                    disabled={editingPool?.isDefault}
                    maxLength={4}
                    onChange={(e) => setFileNumberPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                    placeholder={editingPool?.isDefault ? "المسبح الافتراضي بدون بادئة" : "مثال: B أو OLY (1-4 حروف وأرقام)"}
                    className="bg-slate-800/80 border-slate-700 text-sm font-mono"
                  />
                  <p className="text-[11px] text-slate-400">
                    {editingPool?.isDefault
                      ? "المسبح الافتراضي للنادي لا يحمل بادئة (أرقام قياسية مثل RCS001)."
                      : "إلزامية للمسابح الإضافية: من 1 إلى 4 حروف وأرقام إنجليزية (A-Z, 0-9) فقط بدون مسافات."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">الطاقة الاستيعابية القصوى (سبّاح)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="bg-slate-800/80 border-slate-700 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">طول الحوض (بالمتر)</Label>
                  <Input
                    type="number"
                    value={lengthMeters}
                    onChange={(e) => setLengthMeters(e.target.value)}
                    className="bg-slate-800/80 border-slate-700 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">عدد الأروقة (Lanes)</Label>
                  <Input
                    type="number"
                    value={lanesCount}
                    onChange={(e) => setLanesCount(e.target.value)}
                    className="bg-slate-800/80 border-slate-700 text-sm"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-300">العنوان أو موقع المسبح</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="الموقع الجغرافي أو رقم القاعة..."
                    className="bg-slate-800/80 border-slate-700 text-sm"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-300">لون المسبح المميز في الواجهة</Label>
                  <div className="flex items-center gap-2 pt-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setColor(c.hex)}
                        className={`h-7 w-7 rounded-full border-2 transition-all flex items-center justify-center ${
                          color === c.hex ? "border-white scale-110 shadow-lg" : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {color === c.hex && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-7 w-8 rounded cursor-pointer bg-transparent border-0 ml-2"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sky-500/20">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-slate-700 text-slate-300 text-xs h-9"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs h-9 font-bold gap-2"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editingPool ? "حفظ التعديلات" : "تأكيد إضافة المسبح"}
                </Button>
              </div>
            </form>
          )}

          {/* قائمة المسابح الحالية */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              المسابح والمنشآت الحالية ({pools.length})
            </h4>

            {pools.length === 0 && !loading && (
              <div className="text-center p-8 rounded-xl border border-slate-800 bg-slate-800/40 text-slate-400">
                لا يوجد مسابح مسجلة حالياً
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pools.map((p) => {
                const poolColor = p.color || "#0284c7";
                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border transition-all relative overflow-hidden ${
                      p.active
                        ? "border-slate-800 bg-slate-800/50 hover:border-slate-700"
                        : "border-slate-800/50 bg-slate-900/60 opacity-60"
                    }`}
                  >
                    <div
                      className="absolute top-0 right-0 left-0 h-1"
                      style={{ backgroundColor: poolColor }}
                    />

                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: poolColor }}
                          />
                          <h5 className="font-bold text-sm text-white flex items-center gap-1.5">
                            {p.name}
                            {p.isDefault && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                المسبح الرئيسي الافتراضي
                              </span>
                            )}
                          </h5>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                          <span>كود: {p.code}</span>
                          {p.fileNumberPrefix && (
                            <span className="bg-slate-700/60 px-1.5 py-0.5 rounded text-amber-300">
                              بادئة: {p.fileNumberPrefix}-
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(p)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                          title="تعديل"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        {!p.isDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchive(p)}
                            className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
                            title="أرشفة / تعطيل"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* إحصائيات سريعة */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-700/40 text-[11px]">
                      <div className="flex items-center gap-1 text-slate-300">
                        <Users className="h-3 w-3 text-sky-400" />
                        <span>{p.activeSubscribersCount || 0} منخرط</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-300">
                        <Calendar className="h-3 w-3 text-emerald-400" />
                        <span>{p.todayAttendancesCount || 0} حضور اليوم</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-300">
                        <Building2 className="h-3 w-3 text-amber-400" />
                        <span>سعة {p.capacity || "—"}</span>
                      </div>
                    </div>

                    {p.address && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-2">
                        <MapPin className="h-3 w-3 text-slate-500" /> {p.address}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
