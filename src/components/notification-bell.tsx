"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Check, CheckCheck, Trash2, RefreshCw, AlertCircle,
  Calendar, Wallet, QrCode, Info, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  renewal: { icon: RefreshCw, color: "bg-amber-500/15 text-amber-600" },
  payment: { icon: Wallet, color: "bg-emerald-500/15 text-emerald-600" },
  attendance: { icon: QrCode, color: "bg-violet-500/15 text-violet-600" },
  system: { icon: AlertCircle, color: "bg-rose-500/15 text-rose-600" },
  info: { icon: Info, color: "bg-sky-500/15 text-sky-600" },
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all"); // all | unread | renewal | payment | system | info
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  };

  // Initial fetch + polling for real-time notifications
  useEffect(() => {
    const poll = () => { void fetchNotifications(); };
    poll();
    intervalRef.current = setInterval(poll, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", id }),
      });
      fetchNotifications();
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      toast.success("تم تعليم الكل كمقروء");
      fetchNotifications();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      fetchNotifications();
    } catch {}
  };

  const handleClearRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearRead" }),
      });
      toast.success("تم مسح الإشعارات المقروءة");
      fetchNotifications();
    } catch {}
  };

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.type === filter;
  });

  const FILTERS: { id: string; label: string }[] = [
    { id: "all", label: "الكل" },
    { id: "unread", label: `غير مقروء${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
    { id: "renewal", label: "تجديد" },
    { id: "payment", label: "مالية" },
    { id: "system", label: "نظام" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 rounded-lg border border-border/60 bg-card hover:bg-accent transition flex items-center justify-center"
          title="الإشعارات"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b bg-gradient-to-l from-primary/10 to-transparent">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">الإشعارات</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 text-[10px]">{unreadCount} جديد</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleMarkAllRead}>
              <CheckCheck className="h-3 w-3 ml-1" /> تعليم الكل
            </Button>
          )}
        </div>

        {/* 🆕 تصفية الإشعارات + مسح المقروء */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="flex-1" />
          <button
            onClick={handleClearRead}
            title="مسح الإشعارات المقروءة"
            className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        <ScrollArea className="h-[400px]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y">
              <AnimatePresence initial={false}>
                {filtered.map((n) => {
                  const { icon: Icon, color } = TYPE_ICONS[n.type] || TYPE_ICONS.info;
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={cn(
                        "p-3 hover:bg-accent/40 transition group cursor-pointer",
                        !n.read && "bg-primary/5"
                      )}
                      onClick={() => {
                        if (!n.read) handleMarkRead(n.id);
                        if (n.link) window.location.href = n.link;
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm truncate">{n.title}</p>
                            {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {new Date(n.createdAt).toLocaleString("ar-DZ", {
                              hour: "2-digit", minute: "2-digit", day: "numeric", month: "short"
                            })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                          className="opacity-0 group-hover:opacity-100 transition p-1 text-muted-foreground hover:text-rose-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
