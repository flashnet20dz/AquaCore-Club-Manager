"use client";

import { useState } from "react";
import { Waves, ChevronDown, Check, Plus, Settings2 } from "lucide-react";
import { usePools } from "@/hooks/use-pools";
import { PoolsManagementModal } from "@/components/pools-management-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function PoolSelector() {
  const { pools, currentPoolId, currentPool, isMultiPool, setCurrentPoolId } = usePools();
  const [showModal, setShowModal] = useState(false);

  const activePools = pools.filter((p) => p.active);

  // لا تعرض المحدد إذا لم تتوفر مسابح بعد (قبل تسجيل الدخول أو أثناء التحميل الأولي)
  if (activePools.length === 0) {
    return null;
  }

  // عند وجود مسبح واحد فقط: عرض زر مدمج للمسبح النشط يتيح فتح إدارة المسابح مباشرة من الشريط العلوي
  if (!isMultiPool) {
    const singlePool = activePools[0];
    const singleColor = singlePool.color || "#0284c7";
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowModal(true)}
          title="إدارة المسابح وإضافة مسبح جديد"
          className="h-9 px-2.5 sm:px-3 gap-2 bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-white rounded-xl shadow-sm text-xs font-semibold transition-all hover:border-sky-500/50"
        >
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: singleColor }}
          />
          <Waves className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="truncate max-w-[110px] sm:max-w-[150px]">
            {singlePool.name}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <Plus className="h-2.5 w-2.5" />
            <span>إدارة</span>
          </span>
          <Settings2 className="sm:hidden h-3.5 w-3.5 text-sky-300 shrink-0" />
        </Button>

        <PoolsManagementModal open={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  const activeColor = currentPool?.color || "#0284c7";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-2 bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-white rounded-xl shadow-sm text-xs font-semibold transition-all hover:border-slate-600"
          >
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0 animate-pulse"
              style={{ backgroundColor: currentPoolId === "all" ? "#38bdf8" : activeColor }}
            />
            <Waves className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-[160px]">
              {currentPoolId === "all" ? "جميع المسابح" : currentPool?.name || "المسبح"}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-56 p-1.5 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl shadow-2xl backdrop-blur-md"
        >
          <DropdownMenuLabel className="text-[11px] font-bold text-slate-400 px-2 py-1">
            اختر نطاق المسبح التشغيلي
          </DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => setCurrentPoolId("all")}
            className={`flex items-center justify-between text-xs px-2.5 py-2 rounded-lg cursor-pointer ${
              currentPoolId === "all" ? "bg-sky-500/20 text-sky-300 font-bold" : "hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span>جميع المسابح (عرض شامل)</span>
            </div>
            {currentPoolId === "all" && <Check className="h-3.5 w-3.5 text-sky-400" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-slate-800 my-1" />

          {activePools.map((p) => {
            const pColor = p.color || "#0284c7";
            const isSelected = currentPoolId === p.id;
            return (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setCurrentPoolId(p.id)}
                className={`flex items-center justify-between text-xs px-2.5 py-2 rounded-lg cursor-pointer ${
                  isSelected ? "bg-sky-500/20 text-sky-300 font-bold" : "hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: pColor }} />
                  <span className="truncate">{p.name}</span>
                  {p.fileNumberPrefix && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 font-mono text-amber-300">
                      {p.fileNumberPrefix}
                    </span>
                  )}
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator className="bg-slate-800 my-1" />

          <DropdownMenuItem
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg cursor-pointer hover:bg-slate-800 text-slate-300 hover:text-white"
          >
            <Settings2 className="h-3.5 w-3.5 text-slate-400" />
            <span>إدارة وضبط المسابح...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PoolsManagementModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
