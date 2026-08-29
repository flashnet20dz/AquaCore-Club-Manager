import { db } from "../src/lib/db";
async function main() {
  console.log("=== Count subscribers ===");
  const c = await db.subscriber.count();
  console.log("count:", c);
  console.log("\n=== Find first subscriber (raw) ===");
  const first = await db.subscriber.findFirst();
  console.log("first:", first);
  console.log("\n=== computeSubscriberFields import test ===");
  const { computeSubscriberFields } = await import("../src/lib/rcs");
  console.log("type:", typeof computeSubscriberFields);
  if (first) {
    try {
      const computed = computeSubscriberFields(first as any);
      console.log("computed OK:", Object.keys(computed).length, "keys");
    } catch (e) {
      console.error("computeSubscriberFields ERROR:", e);
    }
  } else {
    console.log("(no subscribers to test compute)");
  }
}
main().catch(e=>{console.error("FATAL:",e);process.exit(1);}).finally(()=>db.$disconnect());
