import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeSubscriberFields } from "@/lib/rcs";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const subscribers = await db.subscriber.findMany({
      where: clubFilter,
      orderBy: { createdAt: "asc" },
    });

    const computed = subscribers.map((s) => ({
      ...s,
      ...computeSubscriberFields(s),
    }));

    const categories = {
      malesUnder13: computed
        .filter((s) => s.gender === "ذكر" && s.age < 13)
        .map((s) => ({
          id: s.id,
          fileNumber: s.fileNumber,
          fullName: `${s.lastName} ${s.firstName}`,
          age: s.age,
        })),
      femalesUnder13: computed
        .filter((s) => s.gender === "أنثى" && s.age < 13)
        .map((s) => ({
          id: s.id,
          fileNumber: s.fileNumber,
          fullName: `${s.lastName} ${s.firstName}`,
          age: s.age,
        })),
      malesOver13: computed
        .filter((s) => s.gender === "ذكر" && s.age >= 13)
        .map((s) => ({
          id: s.id,
          fileNumber: s.fileNumber,
          fullName: `${s.lastName} ${s.firstName}`,
          age: s.age,
        })),
      femalesOver13: computed
        .filter((s) => s.gender === "أنثى" && s.age >= 13)
        .map((s) => ({
          id: s.id,
          fileNumber: s.fileNumber,
          fullName: `${s.lastName} ${s.firstName}`,
          age: s.age,
        })),
    };

    return NextResponse.json({
      counts: {
        malesUnder13: categories.malesUnder13.length,
        femalesUnder13: categories.femalesUnder13.length,
        malesOver13: categories.malesOver13.length,
        femalesOver13: categories.femalesOver13.length,
      },
      categories,
    });
  } catch (error) {
    console.error("GET /api/age-categories error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
