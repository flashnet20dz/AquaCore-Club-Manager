import { db } from "../src/lib/db";

const FIRST_NAMES_M = [
  "محمد الأمين", "ياسين صلاح الدين", "فؤاد عبد القادر", "أحمد", "يوسف", "عبد الرحمن",
  "إبراهيم", "خالد", "عمر", "علي", "بلال", "حمزة", "زياد", "آدم", "مصعب",
  "أنس", "إياد", "وليد", "رضا", "حسن", "حسين", "طه", "صهيب", "معاذ",
];

const FIRST_NAMES_F = [
  "فاطمة", "سارة", "مريم", "خديجة", "عائشة", "نور الهدى", "هاجر", "أسماء",
  "زينب", "رقية", "أمينة", "ليلى", "ريان", "جنات", "إيمان", "رحمة",
];

const LAST_NAMES = [
  "بورقعة", "براهمي", "زيدان", "علي", "بوزيد", "حمداني", "مرابط", "بن عيسى",
  "شريف", "قاسمي", "بلقاسم", "عمراني", "حملاوي", "زروقي", "بوزيد", "صحراوي",
  "تاج الدين", "بشير", "موساوي", "لعمارة", "حداد", "بوضياف", "مهداوي", "قرين",
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const SUBSCRIPTION_TYPES = ["/", "OPOW", "DJS", "FCS", "RCS", "POLICE"];
const PAYMENT_STATUSES = ["مدفوع", "لم يدفع", "تأمين فقط", "اشتراك 300"];
const SWIMMING_DAYS = ["الأحد والأربعاء", "الاثنين والخميس", "الثلاثاء والجمعة", "كل الأيام"];
const TIME_SLOTS = ["09:00-10:00", "10:00-11:00", "19:00-20:00", "20:00-21:00"];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(startYear: number, endYear: number): Date {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
}

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing
  await db.subscriber.deleteMany();

  const subscriberCount = 48;
  const today = new Date();

  for (let i = 0; i < subscriberCount; i++) {
    const gender = Math.random() < 0.6 ? "ذكر" : "أنثى";
    const firstName = gender === "ذكر" ? randomChoice(FIRST_NAMES_M) : randomChoice(FIRST_NAMES_F);
    const lastName = randomChoice(LAST_NAMES);
    // Age distribution: 50% under 14, 50% over 14
    const isChild = Math.random() < 0.55;
    const birthDate = isChild
      ? randomDate(2014, 2021)
      : randomDate(2005, 2013);

    const subscriptionType = randomChoice(SUBSCRIPTION_TYPES);
    const paymentStatus = (() => {
      const r = Math.random();
      if (r < 0.7) return "مدفوع";
      if (r < 0.82) return "لم يدفع";
      if (r < 0.92) return "تأمين فقط";
      return "اشتراك 300";
    })();

    // Most paid subscribers have a last payment date in the last 60 days
    let lastPaymentDate: Date | null = null;
    if (paymentStatus !== "لم يدفع") {
      const daysAgo = Math.floor(Math.random() * 60);
      lastPaymentDate = new Date(today);
      lastPaymentDate.setDate(lastPaymentDate.getDate() - daysAgo);
    }

    const fileNumber = `RCS ${String(i + 1).padStart(3, "0")}`;

    await db.subscriber.create({
      data: {
        fileNumber,
        lastName,
        firstName,
        birthDate,
        gender,
        bloodType: Math.random() < 0.85 ? randomChoice(BLOOD_TYPES) : null,
        subscriptionType,
        lastPaymentDate,
        paymentStatus,
        swimmingDays: Math.random() < 0.85 ? randomChoice(SWIMMING_DAYS) : null,
        timeSlot: Math.random() < 0.85 ? randomChoice(TIME_SLOTS) : null,
        createdAt: new Date(today.getTime() - (subscriberCount - i) * 86400000),
      },
    });

    process.stdout.write(`  ✓ ${fileNumber} - ${lastName} ${firstName}\n`);
  }

  console.log(`\n✅ Seeded ${subscriberCount} subscribers successfully!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
