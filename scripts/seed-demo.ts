/**
 * seed-demo.ts — بيانات تجريبية كاملة ومتوافقة مع البنية متعددة النوادي
 * تنشئ: نادياً نشطاً + مستخدمين + أنواع اشتراك + أياماً وفترات + منخرطين
 *        + مدفوعات + حضور + تجديدات + معاملات مالية + قائمة انتظار + موظفين
 * الاستخدام: bun scripts/seed-demo.ts
 */
import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

const CLUB_EMAIL = "club@rcs.dz";

function daysAgo(n: number, hour = 10, min = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function chance(p: number): boolean {
  return Math.random() < p;
}

const FIRST_M = ["محمد الأمين", "ياسين", "فؤاد", "أحمد", "يوسف", "عبد الرحمن", "إبراهيم", "خالد", "عمر", "علي", "بلال", "حمزة", "زياد", "آدم", "مصعب", "أنس", "إياد", "وليد", "رضا", "طه"];
const FIRST_F = ["فاطمة", "سارة", "مريم", "خديجة", "عائشة", "نور الهدى", "هاجر", "أسماء", "زينب", "رقية", "أمينة", "ليلى", "ريان", "جنات", "إيمان", "رحمة"];
const LAST = ["بورقعة", "براهمي", "زيدان", "بوزيد", "حمداني", "مرابط", "بن عيسى", "شريف", "قاسمي", "بلقاسم", "عمراني", "حملاوي", "زروقي", "صحراوي", "موساوي", "لعمارة", "حداد", "بوضياف", "مهداوي", "قرين"];
const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const DAYS_COMBO = ["الأحد والأربعاء", "الاثنين والخميس", "الثلاثاء والجمعة"];
const SLOTS = ["09:00-10:00", "10:00-11:00", "19:00-20:00", "20:00-21:00"];

async function main() {
  console.log("🌱 بيانات تجريبية AquaCore — بدء التهيئة...");

  // ─── إعادة تهيئة آمنة: حذف النادي التجريبي القديم إن وجد ───
  const existing = await db.club.findUnique({ where: { email: CLUB_EMAIL } });
  if (existing) {
    console.log("♻️  حذف البيانات التجريبية القديمة...");
    await db.club.delete({ where: { id: existing.id } });
  }
  // حذف مستخدمي الحسابات الافتراضية القديمة (بدون نادي)
  for (const email of ["admin@rcs.dz", "coach@rcs.dz", "guard@rcs.dz"]) {
    await db.user.deleteMany({ where: { email } });
  }

  const now = new Date();

  // ─── 1) النادي ───
  const club = await db.club.create({
    data: {
      name: "النادي الهاوي متعدد الرياضات — الرائد سعيدة — فرع السباحة",
      city: "سعيدة",
      country: "الجزائر",
      managerName: "الأستاذ عبد القادر",
      phone: "0550123456",
      email: CLUB_EMAIL,
      status: "active",
      trialStartedAt: daysAgo(10),
      trialEndDate: new Date(now.getTime() + 20 * 86400000),
      graceEndDate: new Date(now.getTime() + 27 * 86400000),
    },
  });
  console.log("✓ النادي:", club.name);

  // ─── 2) اشتراك النادي ───
  const sub = await db.clubSubscription.create({
    data: {
      clubId: club.id,
      type: "monthly",
      startDate: daysAgo(10),
      endDate: new Date(now.getTime() + 20 * 86400000),
      status: "active",
      lastRenewalDate: daysAgo(10),
    },
  });
  await db.subscriptionHistory.create({
    data: {
      subscriptionId: sub.id,
      action: "created",
      newType: "monthly",
      newEndDate: sub.endDate,
      note: "إنشاء الاشتراك التجريبي للمعاينة",
    },
  });

  // ─── 3) المستخدمون ───
  const adminHash = await bcrypt.hash("admin123", 10);
  const coachHash = await bcrypt.hash("coach123", 10);
  const admin = await db.user.create({
    data: { clubId: club.id, email: "admin@rcs.dz", name: "المدير العام", passwordHash: adminHash, role: "admin", phone: "0550123456", active: true, pending: false },
  });
  const coach = await db.user.create({
    data: { clubId: club.id, email: "coach@rcs.dz", name: "المدرب يوسف", passwordHash: coachHash, role: "assistant", phone: "0661123456", active: true, pending: false },
  });
  const guard = await db.user.create({
    data: { clubId: club.id, email: "guard@rcs.dz", name: "الحارس كريم", passwordHash: coachHash, role: "lifeguard", phone: "0770123456", active: true, pending: false },
  });
  console.log("✓ المستخدمون: admin@rcs.dz / coach@rcs.dz / guard@rcs.dz");

  // ─── 4) أنواع الاشتراك ───
  const types = [
    { name: "اشتراك عادي", code: "RCS", color: "#0d9488", subscriptionFee: 1500, insuranceFee: 500, compoundRights: 1000, durationDays: 30, numberingGroup: "RCS", sortOrder: 0 },
    { name: "اشتراك تنافسي", code: "COMP", color: "#dc2626", subscriptionFee: 2500, insuranceFee: 500, compoundRights: 1000, durationDays: 30, numberingGroup: "RCS", sortOrder: 1 },
    { name: "درس خاص", code: "PRIV", color: "#7c3aed", subscriptionFee: 4000, insuranceFee: 0, compoundRights: 0, durationDays: 30, requiresInsurance: false, requiresCompoundFee: false, numberingGroup: "X", sortOrder: 2 },
    { name: "اشتراك مجاني (معفى)", code: "FREE", color: "#64748b", subscriptionFee: 0, insuranceFee: 0, compoundRights: 0, durationDays: 30, freeSubscription: true, requiresInsurance: false, requiresCompoundFee: false, numberingGroup: "M", sortOrder: 3 },
  ];
  for (const t of types) {
    await db.subscriptionType.create({ data: { clubId: club.id, ...t } });
  }
  console.log("✓ 4 أنواع اشتراك");

  // ─── 5) أيام وفترات السباحة ───
  const dayDefs = [["الأحد", "أح"], ["الاثنين", "اث"], ["الثلاثاء", "ثل"], ["الأربعاء", "أر"], ["الخميس", "خم"], ["الجمعة", "جم"], ["السبت", "سب"]];
  for (let i = 0; i < dayDefs.length; i++) {
    await db.swimmingDay.create({ data: { clubId: club.id, name: dayDefs[i][0], shortName: dayDefs[i][1], sortOrder: i, active: i < 6 } });
  }
  const slotDefs = [
    { name: "09:00-10:00", startTime: "09:00", endTime: "10:00", maxCapacity: 25, sortOrder: 0 },
    { name: "10:00-11:00", startTime: "10:00", endTime: "11:00", maxCapacity: 25, sortOrder: 1 },
    { name: "19:00-20:00", startTime: "19:00", endTime: "20:00", maxCapacity: 30, sortOrder: 2 },
    { name: "20:00-21:00", startTime: "20:00", endTime: "21:00", maxCapacity: 30, sortOrder: 3 },
  ];
  for (const s of slotDefs) {
    await db.swimmingTimeSlot.create({ data: { clubId: club.id, ...s } });
  }
  console.log("✓ أيام الأسبوع + 4 فترات زمنية");

  // ─── 6) الإعدادات ───
  const defaults: Record<string, string> = {
    clubName: club.name,
    clubPhone: "0550123456",
    clubAddress: "سعيدة - الجزائر",
    lateFee: "0",
    currency: "دج",
    whatsappEnabled: "true",
    whatsappNumber: "213550000000",
    whatsappTemplate: "مرحباً {name}، اشتراكك في النادي ينتهي في {date}. يرجى التجديد. شكراً.",
    absenceAlertWeeks: "3",
    expiryAlertDays: "7",
    workHourRate: "200",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.setting.create({ data: { clubId: club.id, key, value } });
  }
  console.log("✓ الإعدادات الافتراضية");

  // ─── 7) الموظفون + ساعات العمل ───
  await db.employee.create({ data: { clubId: club.id, userId: coach.id, firstName: "يوسف", lastName: "عمراني", position: "coach", phone: "0661123456", hourRate: 250, hireDate: daysAgo(400) } });
  await db.employee.create({ data: { clubId: club.id, userId: guard.id, firstName: "كريم", lastName: "حداد", position: "guard", phone: "0770123456", hourRate: 200, hireDate: daysAgo(200) } });
  for (const d of [3, 4, 5]) {
    const start = daysAgo(d, 9, 0);
    const end = daysAgo(d, 13, 0);
    await db.workHours.create({
      data: { clubId: club.id, userId: coach.id, date: daysAgo(d, 0, 0), startTime: start, endTime: end, status: "approved", approvedById: admin.id, approvedAt: daysAgo(d - 1, 12) },
    });
  }
  console.log("✓ موظفان + ساعات عمل معتمدة");

  // ─── 8) المنخرطون ───
  const N = 42;
  const feeByCode: Record<string, number> = { RCS: 1500, COMP: 2500, PRIV: 4000, FREE: 0 };
  const subscribers: { id: string; firstName: string; lastName: string; lastPaymentDate: Date | null; subCode: string }[] = [];
  let receipt = 1000;

  for (let i = 0; i < N; i++) {
    const gender = chance(0.62) ? "ذكر" : "أنثى";
    const firstName = gender === "ذكر" ? pick(FIRST_M) : pick(FIRST_F);
    const lastName = pick(LAST);
    const isChild = chance(0.55);
    const birthDate = isChild ? daysAgo(365 * (7 + Math.floor(Math.random() * 7))) : daysAgo(365 * (13 + Math.floor(Math.random() * 10)));
    const subCode = chance(0.6) ? "RCS" : chance(0.5) ? "COMP" : chance(0.6) ? "PRIV" : "FREE";
    const fee = feeByCode[subCode];

    // توزيع حالات الدفع: 65% مدفوع / 18% لم يدفع / 10% تأمين فقط / 7% معفى
    const r = Math.random();
    let paymentStatus: string;
    let lastPaymentDate: Date | null = null;
    if (subCode === "FREE" || r < 0.65) {
      paymentStatus = "مدفوع";
      // منهم 6 ينتهي اشتراكهم قريباً (25-29 يوماً) و4 منتهون (33-40 يوماً)
      if (i < 6) lastPaymentDate = daysAgo(25 + Math.floor(Math.random() * 5));
      else if (i < 10) lastPaymentDate = daysAgo(33 + Math.floor(Math.random() * 8));
      else lastPaymentDate = daysAgo(Math.floor(Math.random() * 21));
    } else if (r < 0.83) {
      paymentStatus = "لم يدفع";
    } else if (r < 0.93) {
      paymentStatus = "تأمين فقط";
      lastPaymentDate = daysAgo(Math.floor(Math.random() * 40));
    } else {
      paymentStatus = "معفى";
    }

    const s = await db.subscriber.create({
      data: {
        clubId: club.id,
        fileNumber: `RCS ${String(i + 1).padStart(3, "0")}`,
        lastName,
        firstName,
        birthDate,
        gender,
        bloodType: chance(0.85) ? pick(BLOOD) : null,
        subscriptionType: subCode,
        lastPaymentDate,
        paymentStatus,
        swimmingDays: chance(0.88) ? pick(DAYS_COMBO) : null,
        timeSlot: chance(0.88) ? pick(SLOTS) : null,
        phone: `05${String(50000000 + Math.floor(Math.random() * 9999999)).slice(0, 8)}`,
        createdAt: daysAgo(60 - Math.floor((i / N) * 55)),
      },
    });
    subscribers.push({ id: s.id, firstName, lastName, lastPaymentDate, subCode });

    // دفعة الاشتراك للمدفوع
    if (paymentStatus === "مدفوع" && lastPaymentDate && fee > 0) {
      await db.payment.create({
        data: {
          clubId: club.id,
          subscriberId: s.id,
          userId: admin.id,
          category: "subscription",
          amount: fee,
          method: "cash",
          receiptNumber: `REC-${++receipt}`,
          date: lastPaymentDate,
          status: "paid",
          note: `اشتراك ${types.find((t) => t.code === subCode)?.name}`,
        },
      });
      // تجديد مسجل
      await db.renewal.create({
        data: {
          clubId: club.id,
          subscriberId: s.id,
          renewalDate: lastPaymentDate,
          expiryDate: new Date(lastPaymentDate.getTime() + 30 * 86400000),
          months: 1,
          amount: fee,
          paymentStatus: "مدفوع",
        },
      });
    }
    // دفعة تأمين لحاملي "تأمين فقط"
    if (paymentStatus === "تأمين فقط" && lastPaymentDate) {
      await db.payment.create({
        data: { clubId: club.id, subscriberId: s.id, userId: admin.id, category: "insurance", amount: 500, method: "cash", receiptNumber: `REC-${++receipt}`, date: lastPaymentDate, status: "paid" },
      });
    }
  }
  console.log(`✓ ${N} منخرطاً + المدفوعات والتجديدات`);

  // ─── 9) الحضور (آخر 21 يوماً) ───
  let attCount = 0;
  for (let d = 0; d < 21; d++) {
    const day = daysAgo(d, 0, 0);
    const dow = day.getDay(); // 0=الأحد
    for (const s of subscribers) {
      // حضور ~60%: احترام تخطيطي مبسّط للأيام
      if (!chance(0.6)) continue;
      const hour = chance(0.5) ? 9 : chance(0.5) ? 10 : 19;
      const checkIn = daysAgo(d, hour, Math.floor(Math.random() * 30));
      const checkOut = new Date(checkIn.getTime() + (55 + Math.floor(Math.random() * 20)) * 60000);
      await db.attendance.create({
        data: {
          clubId: club.id,
          subscriberId: s.id,
          date: day,
          checkInTime: checkIn,
          checkOutTime: chance(0.9) ? checkOut : null,
          method: chance(0.75) ? "qr" : "manual",
        },
      });
      attCount++;
    }
  }
  console.log(`✓ ${attCount} سجل حضور (21 يوماً)`);

  // ─── 10) المعاملات المالية + الرصيد ───
  const incomeByCat: Record<string, number> = {};
  const expenseByCat: Record<string, number> = {};
  let lastTxId: string | null = null;
  let lastTxDate: Date | null = null;

  async function addTx(type: "income" | "expense", category: string, amount: number, date: Date, opts: Partial<{ payeeName: string; subscriberId: string; note: string; reference: string }> = {}) {
    const tx = await db.financialTransaction.create({
      data: { clubId: club.id, type, category, amount, date, paymentMethod: "cash", createdById: admin.id, ...opts },
    });
    if (type === "income") incomeByCat[category] = (incomeByCat[category] || 0) + amount;
    else expenseByCat[category] = (expenseByCat[category] || 0) + amount;
    lastTxId = tx.id;
    lastTxDate = date;
    return tx;
  }

  // مداخيل الاشتراكات من الدفعات المسجلة
  const payments = await db.payment.findMany({ where: { clubId: club.id } });
  const subByPay: Record<string, string> = {};
  for (const s of subscribers) subByPay[s.id] = `${s.firstName} ${s.lastName}`;
  for (const p of payments) {
    await addTx("income", p.category, p.amount, p.date, { subscriberId: p.subscriberId || undefined, payeeName: p.subscriberId ? subByPay[p.subscriberId] : undefined, reference: p.receiptNumber || undefined });
  }
  await addTx("income", "other_income", 20000, daysAgo(12), { payeeName: "الرعاية الموسمية — محل رياضي محلي", note: "رعاية بطولة صغيرة" });

  // مصاريف
  for (const d of [2, 9, 16, 23]) {
    await addTx("expense", "wages", 4800, daysAgo(d), { payeeName: d % 2 === 0 ? "يوسف عمراني (مدرب)" : "كريم حداد (حارس)" });
  }
  await addTx("expense", "office_supplies", 4500, daysAgo(8), { payeeName: "مكتبة القرن", note: "لوازم مكتبية وطباعة بطاقات" });
  await addTx("expense", "other_expense", 12000, daysAgo(15), { payeeName: "مؤسسة الصيانة", note: "صيانة مضخة الترشيح" });
  await addTx("expense", "other_expense", 3800, daysAgo(5), { payeeName: "سوق المواد الكيميائية", note: "كلور ومواد تعقيم" });

  const totalIncome = Object.values(incomeByCat).reduce((a, b) => a + b, 0);
  const totalExpense = Object.values(expenseByCat).reduce((a, b) => a + b, 0);
  await db.financialBalance.create({
    data: {
      clubId: club.id,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeByCategory: JSON.stringify(incomeByCat),
      expenseByCategory: JSON.stringify(expenseByCat),
      lastTransactionId: lastTxId || undefined,
      lastTransactionDate: lastTxDate || undefined,
    },
  });
  console.log(`✓ ${payments.length + 6} معاملة مالية — الرصيد: ${(totalIncome - totalExpense).toLocaleString("ar-DZ")} دج`);

  // ─── 11) قائمة الانتظار ───
  await db.waitlist.createMany({
    data: [
      { clubId: club.id, firstName: "رياض", lastName: "قاسمي", phone: "0555112233", desiredSwimmingDays: "الأحد والأربعاء", desiredTimeSlot: "09:00-10:00", status: "waiting", createdAt: daysAgo(4) },
      { clubId: club.id, firstName: "أمينة", lastName: "زروقي", phone: "0666445566", desiredSwimmingDays: "الاثنين والخميس", desiredTimeSlot: "19:00-20:00", status: "notified", notifiedAt: daysAgo(1), createdAt: daysAgo(9) },
      { clubId: club.id, firstName: "طارق", lastName: "مرابط", phone: "0777998877", desiredSwimmingDays: "الثلاثاء والجمعة", desiredTimeSlot: "10:00-11:00", status: "waiting", createdAt: daysAgo(2) },
    ],
  });
  console.log("✓ 3 طلبات قائمة انتظار");

  // ─── 12) إشعارات + أنشطة + PIN الكاشير ───
  await db.notification.createMany({
    data: [
      { clubId: club.id, type: "expiry", title: "اشتراكات قاربت الانتهاء", message: "لديك اشتراكات تنتهي خلال الأيام السبعة القادمة — راجع لوحة التجديدات.", link: "renewals" },
      { clubId: club.id, type: "waitlist", title: "قائمة الانتظار", message: "3 طلبات انتظار جديدة بحاجة إلى مراجعة.", link: "waitlist" },
    ],
  });
  await db.activity.createMany({
    data: [
      { clubId: club.id, userId: admin.id, type: "subscription_renewed", description: "تجديد دفعة اشتراكات RCS لشهر جديد", createdAt: daysAgo(1) },
      { clubId: club.id, userId: coach.id, type: "attendance_bulk", description: "تسجيل حضور جماعي للفترة المسائية", createdAt: daysAgo(2) },
    ],
  });
  await db.cashierPin.create({ data: { clubId: club.id, pin: "1234", label: "كاشير رئيسي", role: "assistant" } });
  console.log("✓ إشعارات + أنشطة + PIN كاشير (1234)");

  console.log("\n════════════════════════════════════════");
  console.log("🎉 تمت التهيئة بنجاح!");
  console.log("   المدير:      admin@rcs.dz / admin123");
  console.log("   المدرب:      coach@rcs.dz / coach123");
  console.log("   الحارس:      guard@rcs.dz / coach123");
  console.log("   PIN الكاشير: 1234");
  console.log("════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ فشل التهيئة:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
