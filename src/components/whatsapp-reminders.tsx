"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle, Loader2, RefreshCw, Send, AlertCircle, Phone, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { notifyClick, notifySuccess } from "@/lib/sounds";

interface Reminder {
  subscriberId: string;
  fileNumber: string;
  name: string;
  phone: string;
  expiryDate: string;
  daysLeft: number;
  url: string;
  message: string;
}

interface WhatsAppRemindersProps {
  refreshKey?: number;
}

export function WhatsAppReminders({ refreshKey }: WhatsAppRemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/remind", { cache: "no-store" });
      const data = await res.json();
      setReminders(data.reminders || []);
      setEnabled(data.enabled !== false);
    } catch {
      toast.error("تعذر تحميل التذكيرات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders, refreshKey]);

  const handleSendAll = async () => {
    notifyClick();
    // Open each wa.me link in sequence (browser will block multiple popups, so we open one at a time)
    for (const r of reminders) {
      setSending(r.subscriberId);
      window.open(r.url, "_blank");
      await new Promise((res) => setTimeout(res, 800));
    }
    setSending(null);
    notifySuccess();
    toast.success(`تم فتح ${reminders.length} محادثة WhatsApp`);
  };

  const handleSendOne = (r: Reminder) => {
    notifyClick();
    window.open(r.url, "_blank");
    toast.success(`فتح محادثة مع ${r.name}`);
  };

  const handleToggleEnabled = async (val: boolean) => {
    setEnabled(val);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { whatsappEnabled: val ? "true" : "false" } }),
      });
      toast.success(val ? "تم تفعيل WhatsApp" : "تم تعطيل WhatsApp");
      if (val) fetchReminders();
    } catch {
      toast.error("فشل الحفظ");
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">تذكيرات WhatsApp التلقائية</h3>
            <p className="text-xs text-muted-foreground">منخرطون تنتهي اشتراكاتهم خلال 7 أيام</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">تفعيل</span>
          <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !enabled ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-amber-700 dark:text-amber-300 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>إشعارات WhatsApp معطّلة. فعّلها من الإعدادات لإرسال التذكيرات.</span>
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
          لا توجد تذكيرات مستحقة الآن — كل الاشتراكات سارية
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
              {reminders.length} تذكير مستحق
            </Badge>
            <Button size="sm" onClick={handleSendAll} disabled={!!sending}>
              <Send className="h-3.5 w-3.5 ml-1" /> إرسال الكل
            </Button>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 -mr-1">
            {reminders.map((r) => (
              <motion.div
                key={r.subscriberId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/60 hover:border-emerald-500/40 transition group"
              >
                <Avatar className="h-8 w-8 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700">
                    {r.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span className="font-mono" dir="ltr">{r.phone}</span>
                    <span>•</span>
                    <span className={r.daysLeft <= 3 ? "text-rose-600 font-bold" : "text-amber-600"}>
                      {r.daysLeft === 0 ? "ينتهي اليوم!" : `${r.daysLeft} أيام`}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-500/10"
                  onClick={() => handleSendOne(r)}
                  title="فتح WhatsApp"
                >
                  {sending === r.subscriberId ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                </Button>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
