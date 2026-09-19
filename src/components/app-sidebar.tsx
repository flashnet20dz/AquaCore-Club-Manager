"use client";

import { useMemo } from "react";
import {
  ChevronRight, ChevronLeft, Sparkles, Layers,
  Activity, Users, QrCode, Clock, Waves, RefreshCcw,
  CalendarOff, ListPlus, ShieldCheck, Building2, Crown,
  TrendingUp, Inbox, Download, Landmark, Banknote, FileText,
  UserCog, Database, Settings as SettingsIcon, Menu, X, Dot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageNavigation } from "@/hooks/use-page-navigation";
import { NAVIGATION_GROUPS, type PageNavigationItem, type PageGroupId } from "@/lib/page-navigation-config";
import { hasPermission } from "@/lib/roles";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userRole: string;
  subscribersCount?: number;
  expiredRenewalsCount?: number;
  expiringContractsCount?: number;
  clubName?: string;
  clubLogo?: string;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

export function AppSidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  userRole,
  subscribersCount,
  expiredRenewalsCount,
  expiringContractsCount,
  clubName = "AquaCore",
  clubLogo,
  isMobile = false,
  onCloseMobile,
}: AppSidebarProps) {
  const { items } = usePageNavigation();

  // فلترة الصفحات المسموحة والمخصصة للعرض
  const allowedItems = useMemo(() => {
    return items.filter((item) => {
      // 1. فحص الصلاحية الإدارية
      if (item.adminOnly && userRole !== "admin" && userRole !== "superadmin") {
        return false;
      }
      // 2. فحص الصلاحيات الفرعية
      if (item.permission && !hasPermission(userRole, item.permission)) {
        return false;
      }
      // 3. فحص إخفاء الصفحة (إلا إذا كانت هي الصفحة النشطة حالياً)
      if (!item.defaultVisible && activeTab !== item.id) {
        return false;
      }
      return true;
    });
  }, [items, userRole, activeTab]);

  // تجميع الصفحات حسب المجموعات
  const groupedItems = useMemo(() => {
    const groups: { id: PageGroupId; label: string; items: PageNavigationItem[] }[] = [];
    const groupOrder: PageGroupId[] = ["core", "sports", "finance", "management", "system"];

    groupOrder.forEach((grpId) => {
      const inGroup = allowedItems.filter((it) => it.group === grpId);
      if (inGroup.length > 0) {
        groups.push({
          id: grpId,
          label: NAVIGATION_GROUPS[grpId]?.label || grpId,
          items: inGroup,
        });
      }
    });

    return groups;
  }, [allowedItems]);

  return (
    <aside
      aria-label="القائمة الجانبية الرئيسية"
      className={cn(
        "relative flex flex-col shrink-0 bg-card/95 dark:bg-card/90 backdrop-blur-xl transition-all duration-300 ease-in-out z-30 select-none shadow-xs",
        isMobile
          ? "w-full h-full border-none"
          : cn("border-l border-border/70", isCollapsed ? "w-[72px]" : "w-[245px] sm:w-[260px]")
      )}
    >
      {/* ═══ 1. Header & Branding ═══ */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-border/70 shrink-0">
        {!isCollapsed || isMobile ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-sky-500 text-white flex items-center justify-center font-black shadow-sm shrink-0">
              {clubLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clubLogo} alt={clubName} className="w-9 h-9 rounded-xl object-cover" />
              ) : (
                <Waves className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-xs sm:text-sm text-foreground truncate tracking-tight">
                {clubName}
              </h2>
              <span className="text-[10px] text-muted-foreground block truncate">
                منظومة إدارة الاشتراكات
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-sky-500 text-white flex items-center justify-center font-black shadow-sm">
              <Waves className="h-5 w-5" />
            </div>
          </div>
        )}

        {/* Toggle / Close Button */}
        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            title="إغلاق القائمة الجانبية"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
            className={cn(
              "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer shrink-0",
              isCollapsed && "hidden sm:flex absolute -left-3 top-5 w-6 h-6 bg-card border border-border/80 rounded-full shadow-md items-center justify-center text-foreground hover:bg-accent z-40"
            )}
          >
            {isCollapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* ═══ 2. Navigation Items List ═══ */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-4">
        {groupedItems.map((group) => (
          <div key={group.id} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/80 flex items-center justify-between">
                <span>{group.label}</span>
              </div>
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                // شارات خاصة بالعناصر
                let badgeContent: React.ReactNode = null;
                if (item.id === "subscribers" && typeof subscribersCount === "number" && subscribersCount > 0) {
                  badgeContent = (
                    <span className="h-4 min-w-4 px-1 rounded-full text-[9px] font-bold bg-primary/15 text-primary flex items-center justify-center">
                      {subscribersCount}
                    </span>
                  );
                } else if (item.id === "renewals" && typeof expiredRenewalsCount === "number" && expiredRenewalsCount > 0) {
                  badgeContent = (
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" title={`${expiredRenewalsCount} اشتراك منتهي`} />
                  );
                } else if (item.id === "contracts" && typeof expiringContractsCount === "number" && expiringContractsCount > 0) {
                  badgeContent = (
                    <span className="h-4 min-w-4 px-1 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      {expiringContractsCount}
                    </span>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onTabChange(item.id);
                      if (isMobile && onCloseMobile) {
                        onCloseMobile();
                      }
                    }}
                    title={isCollapsed && !isMobile ? item.label : undefined}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-xl transition-all duration-200 group relative text-right cursor-pointer",
                      isCollapsed && !isMobile ? "justify-center p-2.5" : "px-3 py-2",
                      isActive
                        ? "bg-primary text-primary-foreground font-bold shadow-xs shadow-primary/25"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/70 font-medium"
                    )}
                  >
                    <Icon
                      className={cn(
                        "shrink-0 transition-transform duration-200 group-hover:scale-105",
                        isCollapsed && !isMobile ? "h-5 w-5" : "h-4 w-4",
                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />

                    {(!isCollapsed || isMobile) && (
                      <span className="text-xs truncate flex-1 leading-normal">
                        {item.label}
                      </span>
                    )}

                    {(!isCollapsed || isMobile) && badgeContent}

                    {isCollapsed && !isMobile && badgeContent && (
                      <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ 3. Bottom Footer Quick Toggle ═══ */}
      <div className="p-2 border-t border-border/70 shrink-0">
        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span>إغلاق القائمة</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "w-full flex items-center gap-2 rounded-xl py-2 px-3 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer",
              isCollapsed && "justify-center px-0"
            )}
          >
            {isCollapsed ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                <span>طي القائمة الجانبية</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
