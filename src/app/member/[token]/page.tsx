/**
 * ═══════════════════════════════════════════════════════════════
 *  بوابة المنخرط — البطاقة الرقمية العمومية /member/[token]
 * ═══════════════════════════════════════════════════════════════
 *
 *  صفحة عمومية (بدون تسجيل دخول) تصل إليها عبر رابط موقّع HMAC
 *  يولّده الموظف من /api/member-portal. تعرض بطاقة رقمية للمنخرط:
 *  الاسم، رقم الملف، نوع الاشتراك، حالة التجديد، تاريخ الانتهاء،
 *  رمز QR (يشيّر إلى هذه الصفحة نفسها للتحقق)، وآخر الحضور.
 *
 *  🔒 لا بيانات حساسة هنا: لا مبالغ، لا سجل دفعات، لا هاتف المنخرط.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-token";
import {
  computeSubscriberFields,
  computeSubscriberFieldsDynamic,
  RENEWAL_STATUS_COLORS,
  type SubscriptionTypeConfig,
  type SubscriptionType,
  type PaymentStatus,
} from "@/lib/rcs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Waves,
  QrCode,
  History,
  CalendarClock,
  CalendarDays,
  Hash,
  Phone,
  ShieldAlert,
  Clock,
  BadgeCheck,
  Fingerprint,
} from "lucide-react";

export const metadata: Metadata = {
  title: "البطاقة الرقمية للمنخرط | بوابة المنخرط",
  robots: { index: false, follow: false },
};

// ─── تنسيقات محلية ───────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat("ar-DZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("ar-DZ", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatArDate(d: Date | null | undefined): string {
  if (!d) return "—";
  try {
    return dateFmt.format(new Date(d));
  } catch {
    return "—";
  }
}

/** تسميات طريقة الحضور المعروفة (نفس قيم قاعدة البيانات: qr/manual) */
const METHOD_LABELS: Record<string, string> = {
  qr: "مسح QR",
  manual: "تسجيل يدوي",
  kiosk: "كشك ذاتي",
};

/** نمط الشارة الافتراضي (لحالة "" — لا يوجد اشتراك مدفوع بعد) */
const FALLBACK_STATUS_STYLE =
  "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";

/** بناء العنوان المطلق للصفحة (يُشفَّر داخل QR) من ترويسات الطلب */
async function buildOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("host") || "localhost:3000";
    const proto =
      h.get("x-forwarded-proto") ||
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "http://localhost:3000";
  }
}

// ─── شارة حالة التجديد ───────────────────────────────────────────

function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = RENEWAL_STATUS_COLORS[status] ?? FALLBACK_STATUS_STYLE;
  const label = status || "لا يوجد اشتراك مدفوع";
  return (
    <Badge variant="outline" className={`${style} text-xs sm:text-sm px-3 py-1.5 rounded-full font-semibold ${className || ""}`}>
      {label}
    </Badge>
  );
}

// ─── صفحة رابط غير صالح ──────────────────────────────────────────

function InvalidLinkPage({ deleted }: { deleted?: boolean }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-background to-background dark:from-teal-950/30 dark:via-background dark:to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl overflow-hidden text-center">
        <div className="bg-gradient-to-l from-teal-600 to-emerald-500 px-6 py-8">
          <Waves className="w-10 h-10 text-white/90 mx-auto" aria-hidden="true" />
          <p className="mt-2 text-white/90 text-sm font-medium">بوابة المنخرط — AquaCore</p>
        </div>
        <div className="p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-rose-500" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-foreground">
            {deleted ? "هذا الرابط لم يعد صالحاً" : "رابط غير صالح أو منتهي"}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {deleted
              ? "المنخرط المرتبط بهذا الرابط غير موجود أو تم حذفه من المنظومة."
              : "الرابط الذي فتحته غير صحيح أو تم تعطيله. اطلب من إدارة النادي رابط بطاقتك الرقمية الجديد."}
          </p>
          <div className="mt-6 rounded-2xl bg-teal-500/10 border border-teal-500/20 p-4 text-xs leading-6 text-teal-800 dark:text-teal-200">
            إذا كنت منخرطاً لدى النادي، تواصل مع الإدارة للحصول على رابطك الشخصي
            أو لتجديد اشتراكك.
          </div>
        </div>
        <div className="px-6 py-4 bg-muted/40 border-t border-border text-[11px] text-muted-foreground">
          AquaCore Club Manager — منظومة إدارة الاشتراكات والسباحة
        </div>
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ─────────────────────────────────────────────

export default async function MemberPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // 1) التحقق من التوقيع
  const verified = verifyPortalToken(token);
  if (!verified) return <InvalidLinkPage />;

  // 2) جلب المنخرط (غير المحذوف) مع اسم النادي
  const subscriber = await db.subscriber.findFirst({
    where: { id: verified.subscriberId, deletedAt: null },
    include: { club: { select: { name: true, phone: true, logoUrl: true, primaryColor: true, secondaryColor: true, accentColor: true, borderRadius: true } } },
  });
  if (!subscriber) return <InvalidLinkPage deleted />;

  // 3) إعدادات النادي + آخر 12 حضوراً + إعدادات نوع الاشتراك (لتقفيل مدة الصلاحية الصحيحة durationDays)
  const [settings, attendances, dbType] = await Promise.all([
    db.setting.findMany({
      where: { clubId: subscriber.clubId, key: { in: ["clubName", "clubPhone"] } },
      select: { key: true, value: true },
    }),
    db.attendance.findMany({
      where: { subscriberId: subscriber.id, clubId: subscriber.clubId },
      orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
      take: 12,
      select: { id: true, date: true, checkInTime: true, method: true },
    }),
    db.subscriptionType.findFirst({
      where: { clubId: subscriber.clubId, code: subscriber.subscriptionType },
      select: {
        code: true,
        subscriptionFee: true,
        insuranceFee: true,
        compoundRights: true,
        durationDays: true,
        requiresInsurance: true,
        requiresCompoundFee: true,
        freeSubscription: true,
        givesMembershipNumber: true,
        renewableMonthly: true,
      },
    }),
  ]);

  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const clubName = settingMap.clubName || subscriber.club?.name || "النادي";
  const clubPhone = settingMap.clubPhone || subscriber.club?.phone || "";

  // 🎨 هوية النادي من إعدادات المظهر (الإعدادات ← المظهر والشعار) — تنعكس تلقائياً على البطاقة
  const clubLogo = subscriber.club?.logoUrl || null;
  const rawPrimary = subscriber.club?.primaryColor || null;
  const rawAccent = subscriber.club?.accentColor || null;
  const isCssColor = (c: string | null | undefined) =>
    Boolean(c && (c.startsWith("#") || c.startsWith("oklch") || c.startsWith("rgb") || c.startsWith("hsl")));
  const primary = isCssColor(rawPrimary) ? rawPrimary! : "#0d9488";
  const accent = isCssColor(rawAccent) ? rawAccent! : "#10b981";
  const headerStyle = { backgroundImage: `linear-gradient(to left, ${primary}, ${accent})` };
  const radiusMap: Record<string, string> = {
    none: "rounded-none",
    small: "rounded-xl",
    medium: "rounded-3xl",
    large: "rounded-[2rem]",
  };
  const cardRadius = radiusMap[subscriber.club?.borderRadius || "medium"] || "rounded-3xl";
  const innerRadius =
    cardRadius === "rounded-none" ? "rounded-none"
    : cardRadius === "rounded-xl" ? "rounded-lg"
    : cardRadius === "rounded-[2rem]" ? "rounded-3xl"
    : "rounded-2xl";
  const qrColor = rawPrimary && rawPrimary.startsWith("#") ? rawPrimary : "#0f766e";

  // 4) حساب حالة الاشتراك — إعادة استخدام منطق lib/rcs (لا تكرار)
  const typeConfig: SubscriptionTypeConfig | undefined = dbType ? { ...dbType } : undefined;
  const subForCompute = {
    birthDate: subscriber.birthDate,
    paymentStatus: subscriber.paymentStatus as PaymentStatus,
    subscriptionType: subscriber.subscriptionType as SubscriptionType,
    lastPaymentDate: subscriber.lastPaymentDate,
  };
  const computed = typeConfig
    ? computeSubscriberFieldsDynamic(subForCompute, typeConfig)
    : computeSubscriberFields(subForCompute);

  const expiryDate = computed.expiryDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = expiryDate
    ? Math.round(
        (new Date(new Date(expiryDate).setHours(0, 0, 0, 0)).getTime() - today.getTime()) /
          86_400_000
      )
    : null;

  // 5) توليد QR على الخادم — يشيّر إلى عنوان هذه الصفحة الحالي
  const origin = await buildOrigin();
  const verificationUrl = `${origin}/member/${token}`;
  let qrDataUrl: string | null = null;
  try {
    const QRCode = (await import("qrcode")).default;
    qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: qrColor, light: "#ffffff" },
    });
  } catch (e) {
    console.error("QR generation failed:", e);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-background to-background dark:from-teal-950/30 dark:via-background dark:to-background">
      <main className="mx-auto w-full max-w-md px-3 py-6 sm:py-10">
        {/* البطاقة الرقمية */}
        <article className={`${cardRadius} border border-border bg-card shadow-xl overflow-hidden`}>
          {/* الترويسة المتدرجة — بألوان النادي من إعدادات المظهر */}
          <header style={headerStyle} className="relative px-5 pt-6 pb-12 text-white">
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/25 overflow-hidden">
                {clubLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clubLogo} alt={`شعار ${clubName}`} className="w-full h-full object-contain p-1" />
                ) : (
                  <Waves className="w-6 h-6" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs font-medium text-white/80 tracking-wide">
                  البطاقة الرقمية للمنخرط
                </p>
                <h1 className="mt-0.5 text-[15px] sm:text-lg font-bold leading-6 break-words">
                  {clubName}
                </h1>
              </div>
            </div>
            <span
              className="pointer-events-none absolute -bottom-2 left-3 opacity-10 select-none"
              aria-hidden="true"
            >
              <Waves className="w-28 h-28" />
            </span>
          </header>

          {/* جسم البطاقة — relative ليرسم فوق الترويسة الممتدة خلفه (لا قصّ للسطر الأول) */}
          <div className="relative px-5 pb-6 -mt-8">
            <div className={`${innerRadius} border border-border bg-background dark:bg-card shadow-lg p-5`}>
              {/* الاسم ثم الحالة — صفوف مستقلة بلا تداخل حتى مع الأسماء والشارات الطويلة */}
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-foreground leading-7 break-words">
                  {subscriber.lastName} {subscriber.firstName}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {subscriber.gender} · نوع الاشتراك:{" "}
                  <span className="font-semibold text-teal-700 dark:text-teal-300">
                    {subscriber.subscriptionType}
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={computed.renewalStatus} />
                  {daysRemaining !== null && (
                    <span
                      className={`text-xs font-semibold rounded-full px-3 py-1.5 border ${
                        daysRemaining >= 0
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                      }`}
                    >
                      {daysRemaining >= 0
                        ? `متبقي ${daysRemaining} يوماً`
                        : `انتهى منذ ${Math.abs(daysRemaining)} يوماً`}
                    </span>
                  )}
                </div>
              </div>

              {/* رقم الملف + الانتهاء */}
              <div className="mt-4 grid grid-cols-1 gap-2.5">
                <div className="flex items-center gap-2.5 rounded-2xl bg-muted/60 border border-border px-3.5 py-2.5">
                  <Hash className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">رقم الملف</span>
                  <span className="ms-auto font-mono font-bold text-sm text-foreground" dir="ltr">
                    {subscriber.fileNumber}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-2xl bg-muted/60 border border-border px-3.5 py-2.5">
                  <CalendarClock className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">ينتهي في</span>
                  <span className="ms-auto text-sm font-semibold text-foreground">
                    {formatArDate(expiryDate)}
                  </span>
                </div>
              </div>

              {/* أيام وتوقيت السباحة — من قاعدة البيانات مباشرة */}
              {(subscriber.swimmingDays || subscriber.timeSlot) && (
                <div className="mt-3 grid gap-2">
                  {subscriber.swimmingDays && (
                    <div className="flex items-center gap-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 px-3.5 py-2.5">
                      <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
                      <span className="text-xs text-muted-foreground">أيام السباحة</span>
                      <span className="ms-auto text-sm font-bold text-teal-800 dark:text-teal-200">
                        {subscriber.swimmingDays}
                      </span>
                    </div>
                  )}
                  {subscriber.timeSlot && (
                    <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5">
                      <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                      <span className="text-xs text-muted-foreground">التوقيت</span>
                      <span className="ms-auto text-sm font-bold font-mono text-emerald-800 dark:text-emerald-200" dir="ltr">
                        {subscriber.timeSlot}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Separator className="my-5" />

              {/* رمز QR للتحقق */}
              <section aria-label="رمز التحقق">
                <div className="mx-auto w-fit rounded-3xl bg-white p-3 shadow-inner border border-teal-500/20">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`رمز QR للتحقق من بطاقة المنخرط ${subscriber.fileNumber}`}
                      className="w-44 h-44 sm:w-52 sm:h-52 block"
                      width={208}
                      height={208}
                    />
                  ) : (
                    <div className="w-44 h-44 sm:w-52 sm:h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <QrCode className="w-10 h-10" aria-hidden="true" />
                      <span className="text-[11px]">تعذر توليد الرمز</span>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-center text-[11px] sm:text-xs text-muted-foreground leading-5">
                  يتحقق الحارس من صلاحية الاشتراك بمسح هذا الرمز
                  <span className="mx-1 font-mono" dir="ltr">
                    ({subscriber.fileNumber})
                  </span>
                </p>
              </section>
            </div>
          </div>

          {/* سجل آخر الحضور */}
          <section aria-label="آخر الحضور" className="border-t border-border bg-muted/30 px-5 py-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <History className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              آخر الحضور
            </h3>

            {attendances.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground leading-6 rounded-2xl bg-background border border-dashed border-border p-4 text-center">
                لا يوجد حضور مسجّل بعد — نتمنى لك سباحة ممتعة قريباً! 🏊
              </p>
            ) : (
              <ul className="mt-3 max-h-80 overflow-y-auto space-y-2 pe-1 [scrollbar-width:thin]">
                {attendances.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-2xl bg-background border border-border px-3.5 py-2.5"
                  >
                    <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                      <BadgeCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-foreground leading-5">
                        {formatArDate(a.date)}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {timeFmt.format(new Date(a.checkInTime))}
                        {" · "}
                        {METHOD_LABELS[a.method] || a.method}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* التذييل — تواصل للتجديد */}
          <footer className="border-t border-border bg-card px-5 py-4">
            {clubPhone ? (
              <a
                href={`tel:${clubPhone}`}
                style={headerStyle}
                className="flex items-center justify-center gap-2.5 w-full px-4 py-3 text-white text-sm font-bold shadow-md hover:opacity-90 active:scale-[0.99] transition min-h-[44px] rounded-2xl"
              >
                <Phone className="w-4 h-4" aria-hidden="true" />
                تواصل للتجديد
                <span className="font-mono tracking-wide" dir="ltr">
                  {clubPhone}
                </span>
              </a>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                لتجديد الاشتراك، تواصل مع إدارة النادي.
              </p>
            )}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[10px] text-muted-foreground">
              <Fingerprint className="w-3 h-3" aria-hidden="true" />
              رابط شخصي آمن — لا تشاركه إلا مع إدارة النادي
            </p>
          </footer>
        </article>

        <p className="mt-4 text-center text-[10px] text-muted-foreground/70">
          مدعوم بواسطة AquaCore Club Manager
        </p>
      </main>
    </div>
  );
}
