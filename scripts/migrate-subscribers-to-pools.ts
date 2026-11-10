import { db } from "../src/lib/db";
import { ensureDefaultPool, generateSecureCardUid } from "../src/lib/multi-pool";

interface MigrationStats {
  clubsProcessed: number;
  subscribersProcessed: number;
  enrollmentsCreated: number;
  cardsCreated: number;
  renewalsBackfilled: number;
  countersSynchronized: number;
  errors: string[];
}

export async function runMultiPoolBackfill(): Promise<MigrationStats> {
  console.log("=================================================");
  console.log("  AQUACORE MULTI-POOL ARCHITECTURE — PHASE 5    ");
  console.log("    IDEMPOTENT DATA BACKFILL & MIGRATION        ");
  console.log("=================================================");

  const stats: MigrationStats = {
    clubsProcessed: 0,
    subscribersProcessed: 0,
    enrollmentsCreated: 0,
    cardsCreated: 0,
    renewalsBackfilled: 0,
    countersSynchronized: 0,
    errors: [],
  };

  const clubs = await db.club.findMany();
  console.log(`Found ${clubs.length} club(s) to inspect for multi-pool backfill.`);

  for (const club of clubs) {
    stats.clubsProcessed++;
    console.log(`\n--- Processing Club: ${club.name} (${club.id}) ---`);

    // 1. Ensure Default Pool exists
    const defaultPool = await ensureDefaultPool(club.id);
    console.log(`Default Pool: "${defaultPool.name}" (ID: ${defaultPool.id}, prefix: "${defaultPool.fileNumberPrefix || ''}")`);

    // 2. Fetch all subscribers for this club
    const subscribers = await db.subscriber.findMany({
      where: { clubId: club.id },
      include: {
        enrollments: true,
        cards: true,
        renewals: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    console.log(`Found ${subscribers.length} subscriber(s) for this club.`);

    let maxSeqFound = 0;

    for (const sub of subscribers) {
      stats.subscribersProcessed++;

      // Track max sequence from fileNumber (e.g., RCS 042, RCS-005, 42)
      const numMatches = sub.fileNumber.match(/\d+/g);
      if (numMatches) {
        const lastNum = parseInt(numMatches[numMatches.length - 1], 10);
        if (!isNaN(lastNum) && lastNum > maxSeqFound && lastNum < 1000000) {
          maxSeqFound = lastNum;
        }
      }

      // Check if subscriber already has active enrollment in default pool
      let defaultEnrollment = sub.enrollments.find(
        (e) => e.poolId === defaultPool.id && (e.status === "active" || !e.archivedAt)
      );

      // Compute expiry date from latest renewal, or lastPaymentDate, or createdAt
      let expiryDate: Date | null = null;
      if (sub.renewals.length > 0 && sub.renewals[0].expiryDate) {
        expiryDate = new Date(sub.renewals[0].expiryDate);
      } else if (sub.lastPaymentDate) {
        expiryDate = new Date(sub.lastPaymentDate);
        expiryDate.setDate(expiryDate.getDate() + 30);
      }

      if (!defaultEnrollment) {
        // Create PoolEnrollment in default pool
        defaultEnrollment = await db.poolEnrollment.create({
          data: {
            clubId: club.id,
            subscriberId: sub.id,
            poolId: defaultPool.id,
            fileNumber: sub.fileNumber,
            subscriptionType: sub.subscriptionType || "monthly",
            paymentStatus: sub.paymentStatus || "paid",
            lastPaymentDate: sub.lastPaymentDate,
            swimmingDays: sub.swimmingDays,
            timeSlot: sub.timeSlot,
            startDate: sub.createdAt || new Date(),
            expiryDate: expiryDate,
            status: "active",
          },
        });
        stats.enrollmentsCreated++;
      }

      // Ensure Subscriber.poolId strictly points to default pool
      if (sub.poolId !== defaultPool.id) {
        await db.subscriber.update({
          where: { id: sub.id },
          data: { poolId: defaultPool.id },
        });
      }

      // Check for active MembershipCard for this enrollment
      const activeCard = sub.cards.find(
        (c) => c.enrollmentId === defaultEnrollment!.id && c.status === "active"
      );

      if (!activeCard) {
        const cardUid = generateSecureCardUid(defaultPool.id, sub.id);
        await db.membershipCard.create({
          data: {
            clubId: club.id,
            poolId: defaultPool.id,
            subscriberId: sub.id,
            enrollmentId: defaultEnrollment.id,
            cardUid,
            cardNumber: defaultEnrollment.fileNumber,
            status: "active",
            issueDate: defaultEnrollment.startDate || new Date(),
            expiryDate: defaultEnrollment.expiryDate,
          },
        });
        stats.cardsCreated++;
      }

      // Backfill historical renewals into PoolEnrollmentRenewal
      for (const ren of sub.renewals) {
        const targetRenewedAt = ren.renewalDate || ren.createdAt;
        const existingBackfill = await db.poolEnrollmentRenewal.findFirst({
          where: {
            clubId: club.id,
            subscriberId: sub.id,
            enrollmentId: defaultEnrollment.id,
            renewedAt: targetRenewedAt,
            newExpiryDate: ren.expiryDate,
          },
        });

        if (!existingBackfill) {
          await db.poolEnrollmentRenewal.create({
            data: {
              clubId: club.id,
              poolId: defaultPool.id,
              subscriberId: sub.id,
              enrollmentId: defaultEnrollment.id,
              previousExpiryDate: null,
              newExpiryDate: ren.expiryDate,
              renewedAt: targetRenewedAt,
              renewedById: null,
              subscriptionType: sub.subscriptionType || "monthly",
              months: ren.months || 1,
              amount: ren.amount || 0,
              paymentMethod: "نقداً",
              notes: ren.note || "ترحيل تاريخي تلقائي من Renewal القديم",
            },
          });
          stats.renewalsBackfilled++;
        }
      }
    }

    // 3. Synchronize PoolNumberCounter for default pool
    if (maxSeqFound > 0) {
      const existingCounter = await db.poolNumberCounter.findUnique({
        where: {
          clubId_poolId_numberingGroup: {
            clubId: club.id,
            poolId: defaultPool.id,
            numberingGroup: "RCS",
          },
        },
      });

      if (!existingCounter) {
        await db.poolNumberCounter.create({
          data: {
            clubId: club.id,
            poolId: defaultPool.id,
            numberingGroup: "RCS",
            lastValue: maxSeqFound,
          },
        });
        stats.countersSynchronized++;
        console.log(`Initialized PoolNumberCounter at sequence ${maxSeqFound}`);
      } else if (existingCounter.lastValue < maxSeqFound) {
        await db.poolNumberCounter.update({
          where: { id: existingCounter.id },
          data: { lastValue: maxSeqFound },
        });
        stats.countersSynchronized++;
        console.log(`Updated PoolNumberCounter from ${existingCounter.lastValue} to ${maxSeqFound}`);
      } else {
        console.log(`PoolNumberCounter is already at sequence ${existingCounter.lastValue} >= ${maxSeqFound}`);
      }
    }
  }

  console.log("\n=================================================");
  console.log("            BACKFILL SUMMARY REPORT             ");
  console.log("=================================================");
  console.log(`Clubs Processed:         ${stats.clubsProcessed}`);
  console.log(`Subscribers Processed:   ${stats.subscribersProcessed}`);
  console.log(`Enrollments Created:     ${stats.enrollmentsCreated}`);
  console.log(`Cards Created:           ${stats.cardsCreated}`);
  console.log(`Renewals Backfilled:     ${stats.renewalsBackfilled}`);
  console.log(`Counters Synchronized:   ${stats.countersSynchronized}`);
  console.log(`Errors Encountered:      ${stats.errors.length}`);
  console.log("=================================================");

  return stats;
}

if (require.main === module) {
  runMultiPoolBackfill()
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    })
    .finally(() => process.exit(0));
}
