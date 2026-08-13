# Task ID: financial-components
# Agent: full-stack-developer
# Task: بناء 4 مكوّنات محاسب مالي لـ AquaCore Club Manager

## Context loaded
- قرأت `/home/z/my-project/worklog.md` (آخر المهام: نظام الصور، نظام الثيمات، تنظيف الإعدادات، فلتر تاريخ التسجيل، إصلاح ألوان الوضع الداكن).
- فحصت APIs المالية الموجودة:
  - `GET /api/financial/dashboard` → balance + lastTransactions + monthlyComparison + topExpenses + periodIncome + chartData
  - `GET /api/financial/transactions?type=&category=&dateFrom=&dateTo=&payeeName=&paymentMethod=&page=&limit=` → transactions + pagination + stats
  - `POST /api/financial/transactions` → إنشاء معادِل للرصيد
  - `PUT /api/financial/transactions/[id]` → تعديل (المحاسب يعدّل ما سجّله فقط)
  - `DELETE /api/financial/transactions/[id]` → حذف يتطلب سبب (>=3 أحرف) + إعادة حساب الرصيد
- فحصت APIs مساعدة: `/api/employees` ترجع `{ employees: [{ id, firstName, lastName, position, hourRate, ... }] }` و`/api/subscribers?limit=50` ترجع `{ subscribers: [{ id, fileNumber, firstName, lastName }] }`.
- فحصت `/api/workhours` للوصول إلى ساعات العمل لكل موظف (يحتوي user.hourlyRate و user.position).
- الـ Prisma schema يحدّد: type="income"|"expense", categories معروفة, paymentMethod="cash"|"bank"|"cheque", payeeName/payeeId/subscriberId/employeeId اختيارية, reference, note.
- shadcn/ui المتاح: button, card, input, label, select, badge, table, dialog, alert-dialog, tabs, scroll-area, separator, skeleton, tooltip, checkbox, dropdown-menu, sheet, popover.
- Recharts v3 مثبت. Framer Motion مثبت. Sonner مثبت. lucide-react مثبت.
- المكوّنات يجب أن تستخدم CSS variables (bg-card, text-foreground, border-border) لدعم الوضع الداكن والثيمات الديناميكية.

## Files to build
1. `src/components/financial-dashboard.tsx` — لوحة المعلومات الرئيسية
2. `src/components/financial-payments.tsx` — تبويب الدفعات (الفلاتر + الجدول + الإجراءات الجماعية)
3. `src/components/financial-reports.tsx` — تبويب التقارير (ملخص شهري / أجور / تفصيل المداخيل + تصدير)
4. `src/components/financial-transaction-dialog.tsx` — حوار إنشاء/تعديل عملية مع معاينة الرصيد الحية

## Status
- [in_progress] بناء الملفات الأربعة بالترتيب: dialog → dashboard → payments → reports
