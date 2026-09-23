const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIX = "AQCR";

function getHmacSecret() {
  const secret = process.env.ACTIVATION_HMAC_SECRET;
  if (!secret || secret.length < 16) {
    return "aquacore-activation-secret-key-2026-do-not-use-in-production";
  }
  return secret;
}

const PLANS = {
  monthly:   { code: "monthly",   shortCode: "M1", label: "شهري (شهر واحد)",    durationDays: 30 },
  quarterly: { code: "quarterly", shortCode: "Q3", label: "ربع سنوي (3 أشهر)",  durationDays: 90 },
  halfyear:  { code: "halfyear",  shortCode: "H6", label: "نصف سنوي (6 أشهر)",  durationDays: 180 },
  yearly:    { code: "yearly",    shortCode: "Y1", label: "سنوي (سنة كاملة)",    durationDays: 365 },
  twoyear:   { code: "twoyear",   shortCode: "Y2", label: "سنتان",               durationDays: 730 },
};

function randomChars(len) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function computeSignature(planShort, payload, sigLen = 4) {
  const data = `${PREFIX}.${planShort}.${payload}`;
  const hmac = crypto.createHmac("sha256", getHmacSecret()).update(data).digest("hex");
  let sig = "";
  for (let i = 0; i < sigLen; i++) {
    const byte = parseInt(hmac.substr(i * 2, 2), 16);
    sig += ALPHABET[byte % ALPHABET.length];
  }
  return sig;
}

function generateOneCode(planKey) {
  const def = PLANS[planKey];
  const payload = randomChars(8);
  const signature = computeSignature(def.shortCode, payload, 4);
  const code = `${PREFIX}-${def.shortCode}-${payload}-${signature}`;
  return { code, planKey, durationDays: def.durationDays };
}

async function main() {
  const club = await prisma.club.findFirst();
  if (!club) {
    console.error("No club found");
    return;
  }
  console.log("Found club:", club.name, club.id);

  // 1. Create a SuperAdmin user if none exists for batch generation
  let adminUser = await prisma.user.findFirst({ where: { role: "superadmin" } });
  if (!adminUser) {
    adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  }

  // 2. Create a batch of official codes
  const lastBatch = await prisma.codeBatch.findFirst({ orderBy: { batchNo: "desc" } });
  const nextBatchNo = (lastBatch?.batchNo || 0) + 1;

  const batch = await prisma.codeBatch.create({
    data: {
      batchNo: nextBatchNo,
      name: `دفعة التفعيل الرسمية #${nextBatchNo} — AquaCore Pro`,
      plan: "yearly",
      count: 5,
      generatedById: adminUser ? adminUser.id : null,
      notes: "أكواد تفعيل سنوية وغير سنوية للنادي",
    },
  });

  const generatedCodes = [
    generateOneCode("yearly"),
    generateOneCode("yearly"),
    generateOneCode("twoyear"),
    generateOneCode("monthly"),
    generateOneCode("halfyear"),
  ];

  for (const item of generatedCodes) {
    const codeHash = crypto.createHash("sha256").update(item.code.toUpperCase().replace(/\s+/g, "")).digest("hex");
    await prisma.activationCode.create({
      data: {
        code: item.code,
        codeHash: codeHash,
        batchId: batch.id,
        plan: item.planKey,
        durationDays: item.durationDays,
        status: "unused",
      }
    });
  }

  console.log("Created codes in DB:");
  generatedCodes.forEach(c => console.log(`- Plan: ${c.planKey} (${c.durationDays} days) -> CODE: ${c.code}`));

  // 3. Create or update ClubSubscription directly for the club so it is active immediately
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 2); // 2 years valid subscription!

  const sub = await prisma.clubSubscription.create({
    data: {
      clubId: club.id,
      type: "yearly",
      status: "active",
      startDate: startDate,
      endDate: endDate,
    }
  });

  // Also update club graceEndDate and trial dates
  const graceEnd = new Date(endDate);
  graceEnd.setDate(graceEnd.getDate() + 7);

  await prisma.club.update({
    where: { id: club.id },
    data: {
      status: "active",
      graceEndDate: graceEnd,
      trialStartedAt: startDate,
      trialEndDate: endDate,
    }
  });

  console.log("Club subscription created and activated successfully! Valid until:", endDate.toISOString());
}

main().finally(() => prisma.$disconnect());
