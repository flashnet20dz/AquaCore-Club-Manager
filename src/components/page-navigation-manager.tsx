"use client";

import { useState } from "react";
import {
  ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw,
  Sparkles, CheckCircle2, Search, SlidersHorizontal, Lock,
  Pencil, FileSpreadsheet, Download, RefreshCw, FileText, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { usePageNavigation } from "@/hooks/use-page-navigation";
import {
  NAVIGATION_GROUPS,
  DEFAULT_PAGE_ITEMS,
  type PageNavigationItem,
  type PageGroupId,
} from "@/lib/page-navigation-config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PageNavigationManager() {
  const {
    items,
    toggleVisibility,
    moveItem,
    updatePageTitle,
    resetPageTitle,
    resetAllTitles,
    resetToDefault,
  } = usePageNavigation();

  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // نافذة تعديل تسمية الصفحة
  const [editingItem, setEditingItem] = useState<PageNavigationItem | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editShortLabel, setEditShortLabel] = useState("");
  const [editExportTitle, setEditExportTitle] = useState("");

  const filteredItems = items.filter((it) => {
    const matchesSearch =
      it.label.includes(search) ||
      (it.shortLabel && it.shortLabel.includes(search)) ||
      it.description.includes(search);
    const matchesGroup = selectedGroup === "all" || it.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleToggle = (id: string, currentVisible: boolean, canHide: boolean) => {
    if (!canHide) {
      toast.error("هذه الصفحة أساسية ولا يمكن إخفاؤها من المنظومة");
      return;
    }
    toggleVisibility(id, !currentVisible);
    toast.success(
      !currentVisible
        ? "تم إظهار الصفحة في القائمة الجانبية"
        : "تم إخفاء الصفحة من القائمة الجانبية"
    );
  };

  const handleMove = (id: string, direction: "up" | "down") => {
    moveItem(id, direction);
  };

  const openEditModal = (item: PageNavigationItem) => {
    setEditingItem(item);
    setEditLabel(item.customLabel || item.label);
    setEditShortLabel(item.customShortLabel || item.shortLabel || "");
    setEditExportTitle(item.customExportTitle || item.customLabel || item.label);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    if (!editLabel.trim()) {
      toast.error("يرجى إدخال اسم للصفحة");
      return;
    }

    updatePageTitle(
      editingItem.id,
      editLabel.trim(),
      editShortLabel.trim() || undefined,
      editExportTitle.trim() || undefined
    );

    toast.success(`تم تحديث اسم صفحة (${editLabel.trim()}) وتزامنه مع التصدير بنجاح`);
    setEditingItem(null);
  };

  const handleRestoreItemDefault = () => {
    if (!editingItem) return;
    resetPageTitle(editingItem.id);
    const orig = DEFAULT_PAGE_ITEMS.find((it) => it.id === editingItem.id);
    toast.info(`تمت استعادة الاسم الافتراضي (${orig?.label})`);
    setEditingItem(null);
  };

  const handleResetAll = () => {
    resetToDefault();
    toast.success("تمت استعادة الترتيب والظهور والأسماء الافتراضية لكافة الصفحات");
  };

  const defaultDateStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4" dir="rtl">
      {/* ═══ Header Card ═══ */}
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-sky-500/5 to-transparent p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-base flex items-center gap-2 text-foreground">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              إدارة وترتيب وتسمية صفحات المنظومة
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              خصّص القائمة الجانبية بالكامل: رتّب الصفحات، عدّل أسماء الواجهات لتلائم مصطلحات ناديك (مثال: «السباحون»، «الخزينة»)، وسيتم <strong>تزامن الاسم المخصص فورياً مع أسماء الملفات وعناوين الوثائق في التصدير (Excel / PDF / Word)</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              className="text-xs font-semibold gap-1.5 border-dashed border-border/80 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors w-full sm:w-auto cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              إعادة ضبط الكل للافتراضي
            </Button>
          </div>
        </div>

        {/* ═══ Search & Group Filters ═══ */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن صفحة لتعديل تسميتها أو ترتيبها..."
              className="h-9 pr-9 text-xs bg-background/80"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedGroup("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                selectedGroup === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              الكل ({items.length})
            </button>
            {(Object.keys(NAVIGATION_GROUPS) as PageGroupId[]).map((grpKey) => {
              const grp = NAVIGATION_GROUPS[grpKey];
              const count = items.filter((it) => it.group === grpKey).length;
              return (
                <button
                  key={grpKey}
                  type="button"
                  onClick={() => setSelectedGroup(grpKey)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                    selectedGroup === grpKey
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {grp.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Reorderable and Renamable List ═══ */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-muted-foreground text-xs">
            لا توجد صفحات مطابقة للبحث
          </div>
        ) : (
          filteredItems.map((item) => {
            const Icon = item.icon;
            const globalIndex = items.findIndex((it) => it.id === item.id);
            const isFirst = globalIndex === 0;
            const isLast = globalIndex === items.length - 1;
            const defaultItem = DEFAULT_PAGE_ITEMS.find((it) => it.id === item.id);
            const isRenamed = Boolean(item.customLabel || item.customShortLabel || item.customExportTitle);

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200",
                  item.defaultVisible
                    ? "bg-card hover:border-primary/40 border-border/70 shadow-xs"
                    : "bg-muted/30 border-dashed border-border/50 opacity-65"
                )}
              >
                {/* Right side: Icon, Name, Custom Badge & Description */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center font-mono text-[11px] font-bold text-muted-foreground w-6 h-6 rounded-md bg-muted/60 shrink-0">
                    {globalIndex + 1}
                  </div>
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                      item.defaultVisible
                        ? "bg-primary/10 border-primary/25 text-primary"
                        : "bg-muted border-border/50 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {item.label}
                      </span>

                      {isRenamed && (
                        <span className="text-[10px] font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="h-2.5 w-2.5" />
                          <span>تسمية مخصصة</span>
                          {defaultItem && defaultItem.label !== item.label && (
                            <span className="text-muted-foreground font-normal">
                              (الأصل: {defaultItem.label})
                            </span>
                          )}
                        </span>
                      )}

                      <Badge variant="outline" className="hidden sm:inline-flex text-[10px] px-1.5 py-0 font-normal">
                        {NAVIGATION_GROUPS[item.group]?.label || item.group}
                      </Badge>

                      {item.adminOnly && (
                        <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          للمدير فقط
                        </span>
                      )}

                      {!item.canHide && (
                        <span className="text-[10px] text-muted-foreground hidden xs:inline-flex items-center gap-0.5" title="صفحة أساسية في المنظومة">
                          <Lock className="h-2.5 w-2.5" /> أساسية
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate max-w-md hidden sm:block mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Left side: Rename Button, Reorder Arrows & Toggle Switch */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* زر تعديل التسمية */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(item)}
                    className="h-8 gap-1.5 text-xs font-semibold px-2.5 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                    title="تعديل اسم الصفحة وتخصيص عنوان التصدير"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">تعديل التسمية</span>
                  </Button>

                  {/* أزرار التقديم والتأخير */}
                  <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/60">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isFirst}
                      onClick={() => handleMove(item.id, "up")}
                      className="h-7 w-7 rounded hover:bg-background disabled:opacity-30"
                      title="تقديم للأعلى"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isLast}
                      onClick={() => handleMove(item.id, "down")}
                      className="h-7 w-7 rounded hover:bg-background disabled:opacity-30"
                      title="تأخير للأسفل"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* مفتاح الإظهار / الإخفاء */}
                  <div className="flex items-center gap-2 pr-1 border-r border-border/60 mr-1">
                    <span className={cn("text-xs font-semibold hidden sm:inline", item.defaultVisible ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                      {item.defaultVisible ? "معروضة" : "مخفية"}
                    </span>
                    <Switch
                      checked={item.defaultVisible}
                      disabled={!item.canHide}
                      onCheckedChange={() => handleToggle(item.id, item.defaultVisible, item.canHide)}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ═══ Footer Note ═══ */}
      <div className="rounded-xl bg-card border border-border/60 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
        <span>
          <strong>التزامن التلقائي:</strong> عند تغيير اسم صفحة ما، يتم تحديث القائمة الجانبية فورياً، وتتزامن العناوين تلقائياً في صفحة التصدير وفي أسماء ملفات Excel و PDF و Word المستخرجة.
        </span>
      </div>

      {/* ═══ Modal: تعديل اسم الواجهة والصفحة والتصدير ═══ */}
      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-black text-base">
              <Pencil className="h-4 w-4 text-primary" />
              <span>تخصيص اسم الصفحة والواجهة</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              عدّل مسمى الصفحة بما يناسب إدارة ناديك. سيتزامن الاسم الجديد تلقائياً مع القائمة الجانبية وعناوين التصدير وأسماء الملفات بكل الصيغ.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2">
              {/* 1. حقل الاسم الكامل */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">
                    الاسم المعروض الكامل (في القائمة والترويسة)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    الافتراضي: {DEFAULT_PAGE_ITEMS.find((it) => it.id === editingItem.id)?.label}
                  </span>
                </div>
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="مثال: السباحون والمشتركون"
                  className="h-9 text-xs"
                />
              </div>

              {/* 2. حقل الاسم المختصر */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  الاسم المختصر (للشاشات الصغيرة والقائمة المطوية)
                </Label>
                <Input
                  value={editShortLabel}
                  onChange={(e) => setEditShortLabel(e.target.value)}
                  placeholder="مثال: السباحون"
                  className="h-9 text-xs"
                />
              </div>

              {/* 3. حقل اسم التصدير والملف */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5 text-teal-600" />
                  <span>اسم الوثيقة والملف عند التصدير والتحميل</span>
                </Label>
                <Input
                  value={editExportTitle}
                  onChange={(e) => setEditExportTitle(e.target.value)}
                  placeholder="مثال: قائمة السباحين الرسمية"
                  className="h-9 text-xs font-medium"
                />
                <p className="text-[10px] text-muted-foreground">
                  سيُكتب هذا الاسم كعنوان في أعلى صفحات PDF و Word و Excel، وسيُستخدم في اسم الملف المحمّل.
                </p>
              </div>

              {/* 4. المعاينة الحية الذكية */}
              <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-3 space-y-2 text-xs">
                <p className="font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  معاينة مباشرة للنتائج:
                </p>

                {/* معاينة القائمة الجانبية */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/60">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <editingItem.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">
                      {editLabel.trim() || editingItem.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      مظهر التبويب في القائمة الجانبية
                    </p>
                  </div>
                </div>

                {/* معاينة اسم الملف المحمّل */}
                <div className="p-2 rounded-lg bg-card border border-border/60 space-y-1">
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                    <span>اسم ملف الإكسل المحمّل:</span>
                  </p>
                  <code className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold block truncate" dir="ltr">
                    AquaCore_{(editExportTitle.trim() || editLabel.trim() || editingItem.label).replace(/\s+/g, "_")}_{defaultDateStr}.xlsx
                  </code>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRestoreItemDefault}
              className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              استعادة الاسم الأصلي
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingItem(null)}
                className="text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEdit}
                className="text-xs font-bold bg-primary text-primary-foreground gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                حفظ وتطبيق
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
