import {
  matchPhotoFiles,
  CandidateSubscriber,
  MatchFileInput,
  generateMatchCsvReport,
} from "../src/lib/photo-filename-match";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

console.log("==================================================");
console.log("🧪 TESTING PHOTO FILENAME MATCHING LADDER (CRITERIA 1-8)");
console.log("==================================================\n");

// ─── Fixtures ───
const testSubscribers: CandidateSubscriber[] = [
  { id: "sub-1", fileNumber: "RCS001", firstName: "أحمد", lastName: "العربي", poolName: "المسبح الرئيسي" },
  { id: "sub-1-1", fileNumber: "RCS001-1", firstName: "أحمد", lastName: "الاحتياطي", poolName: "المسبح الرئيسي" },
  { id: "sub-2", fileNumber: "RCS002", firstName: "خالد", lastName: "بشير", poolName: "المسبح الرئيسي" },
  { id: "sub-p2-1", fileNumber: "P2-RCS001", firstName: "ياسين", lastName: "حمادي", poolName: "مسبح النصر" },
  { id: "sub-p2-2", fileNumber: "P2-RCS002", firstName: "فؤاد", lastName: "مراد", poolName: "مسبح النصر" },
  { id: "sub-7", fileNumber: "OPOW007", firstName: "عمر", lastName: "الخطاب", poolName: "المسبح الرئيسي" },
  { id: "sub-10", fileNumber: "RCS010", firstName: "سمير", lastName: "قادر", poolName: "المسبح الرئيسي" },
  { id: "sub-del", fileNumber: "RCS099", firstName: "محذوف", lastName: "سابق", deletedAt: new Date() },
  { id: "sub-photo", fileNumber: "RCS050", firstName: "نبيل", lastName: "سعيد", photoPath: "db://photo-50" },
];

// ─── Test 1: Exact, case-insensitive, normalized, Arabic digits ───
console.log("--- 1. Exact, Case-insensitive, Normalized, and Arabic Digits ---");
{
  const files: MatchFileInput[] = [
    { name: "RCS001.jpg", size: 1024 },
    { name: "rcs002.JPG", size: 2048 },
    { name: "p2rcs002.webp", size: 3000 },
    { name: "RCS_001.jpg", size: 1500 },
    { name: "RCS 002.jpeg", size: 1600 },
    { name: "RCS٠٠١.jpg", size: 1700 }, // Arabic Eastern digits ٠٠١
  ];

  const { results } = matchPhotoFiles(files, testSubscribers);

  assert(results[0].status === "matched" && results[0].confidence === "exact" && results[0].matchedSubscriber?.fileNumber === "RCS001", "RCS001.jpg exact match");
  assert(results[1].status === "matched" && results[1].confidence === "exact" && results[1].matchedSubscriber?.fileNumber === "RCS002", "rcs002.JPG exact match case-insensitive");
  assert(results[2].status === "matched" && results[2].confidence === "normalized" && results[2].matchedSubscriber?.fileNumber === "P2-RCS002", "p2rcs002.webp normalized match to P2-RCS002");
  assert(results[3].matchedSubscriber?.fileNumber === "RCS001", "RCS_001.jpg normalized match");
  assert(results[4].matchedSubscriber?.fileNumber === "RCS002", "RCS 002.jpeg normalized match");
  assert(results[5].matchedSubscriber?.fileNumber === "RCS001", "RCS٠٠١.jpg Arabic digits normalized match");
}

// ─── Test 2: Real fileNumber RCS001-1 takes absolute priority over RCS001 ───
console.log("\n--- 2. Real file number RCS001-1 exact match priority ---");
{
  const files: MatchFileInput[] = [
    { name: "RCS001-1.jpg", size: 2048 },
  ];
  const { results } = matchPhotoFiles(files, testSubscribers);
  assert(results[0].status === "matched", "RCS001-1.jpg is matched");
  assert(results[0].confidence === "exact", "RCS001-1.jpg has exact confidence");
  assert(results[0].matchedSubscriber?.fileNumber === "RCS001-1", "RCS001-1.jpg matched RCS001-1 and NOT RCS001");
}

// ─── Test 3: Copy suffixes ───
console.log("\n--- 3. Copy suffixes: (2), - Copy, _copy, نسخة ---");
{
  const files: MatchFileInput[] = [
    { name: "RCS010 (2).jpg", size: 2048 },
    { name: "OPOW007 - Copy.jpg", size: 3000 },
    { name: "RCS002_copy.jpg", size: 4000 },
    { name: "P2-RCS002 نسخة.png", size: 5000 },
  ];
  const { results } = matchPhotoFiles(files, testSubscribers);
  assert(results[0].status === "matched" && results[0].confidence === "copy" && results[0].matchedSubscriber?.fileNumber === "RCS010", "RCS010 (2).jpg matches RCS010 via copy");
  assert(results[1].status === "matched" && results[1].confidence === "copy" && results[1].matchedSubscriber?.fileNumber === "OPOW007", "OPOW007 - Copy.jpg matches OPOW007 via copy");
  assert(results[2].status === "matched" && results[2].confidence === "copy" && results[2].matchedSubscriber?.fileNumber === "RCS002", "RCS002_copy.jpg matches RCS002 via copy");
  assert(results[3].status === "matched" && results[3].confidence === "copy" && results[3].matchedSubscriber?.fileNumber === "P2-RCS002", "P2-RCS002 نسخة.png matches P2-RCS002 via copy");
}

// ─── Test 4: Directory path stripping (POSIX & Windows) ───
console.log("\n--- 4. Directory paths: POSIX and Windows backslash ---");
{
  const files: MatchFileInput[] = [
    { name: "photos/2026/RCS010.jpg", size: 2048 },
    { name: "C:\\pics\\RCS010.jpg", size: 3000 },
  ];
  const { results } = matchPhotoFiles(files, testSubscribers);
  assert(results[0].cleanFileName === "RCS010.jpg" && results[0].matchedSubscriber?.fileNumber === "RCS010", "photos/2026/RCS010.jpg stripped and matched");
  assert(results[1].cleanFileName === "RCS010.jpg" && results[1].matchedSubscriber?.fileNumber === "RCS010", "C:\\pics\\RCS010.jpg stripped and matched");
}

// ─── Test 5: Digits-only low confidence vs Ambiguity ───
console.log("\n--- 5. Digits-only (low confidence) and Ambiguous ---");
{
  const files: MatchFileInput[] = [
    { name: "7.jpg", size: 1024 },    // Only OPOW007 ends in 7
    { name: "002.jpg", size: 1024 },  // Matches RCS002 (P2-RCS002 doesn't end in 002 if prefix differs? Wait, P2-RCS002 ends in 2, but trailing integer is 2)
    { name: "1.jpg", size: 1024 },    // RCS001 and P2-RCS001 both end in 1 -> ambiguous!
  ];
  // Note: if 002 and 2 both end in 2, we check ambiguous if both RCS002 and P2-RCS002 end in 2!
  // In testSubscribers: sub-2 is RCS002, sub-p2-2 is P2-RCS002. Both end in integer 2!
  // So 002.jpg would be ambiguous between RCS002 and P2-RCS002!
  // But sub-10 is RCS010 (ends in 10). Nobody else ends in 10.
  // So 10.jpg or 010.jpg is unique!
  const filesUnique: MatchFileInput[] = [
    { name: "7.jpg", size: 1024 },    // Only OPOW007 ends in 7
    { name: "010.jpg", size: 1024 },  // Only RCS010 ends in 10
    { name: "1.jpg", size: 1024 },    // RCS001 and P2-RCS001 both end in 1 -> ambiguous!
  ];
  const { results } = matchPhotoFiles(filesUnique, testSubscribers);
  assert(results[0].status === "matched" && results[0].confidence === "digits" && results[0].matchedSubscriber?.fileNumber === "OPOW007", "7.jpg matches OPOW007 by digits");
  assert(results[0].selected === false, "7.jpg is digits confidence, so selected is FALSE by default");
  assert(results[1].status === "matched" && results[1].confidence === "digits" && results[1].matchedSubscriber?.fileNumber === "RCS010", "010.jpg matches RCS010 by digits");
  assert(results[1].selected === false, "010.jpg is digits confidence, so selected is FALSE by default");
  assert(results[2].status === "ambiguous", "1.jpg is ambiguous when RCS001 and P2-RCS001 both exist");
  assert(results[2].ambiguousCandidates?.length === 3, "1.jpg has 3 ambiguous candidates (RCS001, RCS001-1, P2-RCS001)");
}

// ─── Test 6: Unmatched and Invalid files ───
console.log("\n--- 6. Unmatched and Invalid Files ---");
{
  const files: MatchFileInput[] = [
    { name: "RCS999.jpg", size: 1024 },       // Non-existent subscriber
    { name: "RCS099.jpg", size: 1024 },       // Deleted subscriber
    { name: "RCS001.gif", size: 1024 },       // Unsupported format
    { name: "RCS001.jpg", size: 15 * 1024 * 1024 }, // File > 10MB
    { name: "RCS001.png", size: 0 },          // Empty file (0 bytes)
  ];
  const { results } = matchPhotoFiles(files, testSubscribers);
  assert(results[0].status === "unmatched", "RCS999.jpg is unmatched");
  assert(results[1].status === "unmatched", "RCS099.jpg (deleted subscriber) is unmatched");
  assert(results[2].status === "invalid" && Boolean(results[2].reason?.includes("غير مدعوم")), "RCS001.gif is invalid (format)");
  assert(results[3].status === "invalid" && Boolean(results[3].reason?.includes("10MB")), "15MB file is invalid (size)");
  assert(results[4].status === "invalid" && Boolean(results[4].reason?.includes("فارغ")), "0 byte file is invalid (empty)");
}

// ─── Test 7: Duplicate resolution across confidence levels and sizes ───
console.log("\n--- 7. Duplicate Resolution ---");
{
  // 3 files for RCS001:
  // - RCS001.jpg (exact, size 1000)
  // - RCS001 (2).jpg (copy, size 5000) -> larger, but lower confidence than exact!
  // - rcs_001.png (normalized, size 2000)
  const files: MatchFileInput[] = [
    { name: "RCS001.jpg", size: 1000 },
    { name: "RCS001 (2).jpg", size: 5000 },
    { name: "rcs_001.png", size: 2000 },
  ];
  const { results, summary } = matchPhotoFiles(files, testSubscribers);
  assert(results[0].status === "matched" && results[0].confidence === "exact", "RCS001.jpg wins because it has exact confidence");
  assert(results[1].status === "duplicate", "RCS001 (2).jpg marked as duplicate even though larger");
  assert(results[2].status === "duplicate", "rcs_001.png marked as duplicate");
  assert(results[1].winningFileName === "RCS001.jpg", "Duplicate references winner filename");
  assert(summary.matched === 1 && summary.duplicate === 2, "Summary: 1 matched, 2 duplicate");

  // Equal confidence: larger size wins
  const filesEqualConf: MatchFileInput[] = [
    { name: "photos/RCS010.jpg", size: 1000 },
    { name: "backup/RCS010.jpg", size: 4000 },
  ];
  const resEqual = matchPhotoFiles(filesEqualConf, testSubscribers).results;
  assert(resEqual[1].status === "matched", "Larger file wins on equal confidence");
  assert(resEqual[0].status === "duplicate", "Smaller file is duplicate on equal confidence");
}

// ─── Test 7b: Existing photo replace option ───
console.log("\n--- 7b. Existing photo & replaceExisting option ---");
{
  const files: MatchFileInput[] = [
    { name: "RCS050.jpg", size: 2048 },
  ];
  // Default: replaceExisting = false
  const resDefault = matchPhotoFiles(files, testSubscribers, { replaceExisting: false });
  assert(resDefault.results[0].hasExistingPhoto === true, "RCS050 hasExistingPhoto is true");
  assert(resDefault.results[0].selected === false, "RCS050 is NOT selected by default because it already has a photo");
  assert(resDefault.summary.hasPhoto === 1, "Summary hasPhoto is 1");

  // With replaceExisting = true
  const resReplace = matchPhotoFiles(files, testSubscribers, { replaceExisting: true });
  assert(resReplace.results[0].selected === true, "RCS050 IS selected when replaceExisting is true");
}

// ─── Test 7c: CSV Report BOM and escaping ───
console.log("\n--- 7c. CSV Report with UTF-8 BOM ---");
{
  const files: MatchFileInput[] = [
    { name: "RCS001.jpg", size: 1024 },
    { name: "RCS999.jpg", size: 1024 },
  ];
  const { results } = matchPhotoFiles(files, testSubscribers);
  const csv = generateMatchCsvReport(results);
  assert(csv.startsWith("\uFEFF"), "CSV starts with UTF-8 BOM");
  assert(csv.includes("RCS001"), "CSV contains matched subscriber code");
  assert(csv.includes("العربي"), "CSV contains Arabic subscriber name");
}

// ─── Test 8: Performance Benchmark (5000 files × 5000 subscribers < 1.5s) ───
console.log("\n--- 8. Performance Benchmark: 5000 files × 5000 subscribers ---");
{
  const benchmarkSubs: CandidateSubscriber[] = [];
  for (let i = 1; i <= 5000; i++) {
    const pad = String(i).padStart(4, "0");
    benchmarkSubs.push({
      id: `bench-sub-${i}`,
      fileNumber: `RCS${pad}`,
      firstName: `مشترك_${i}`,
      lastName: `تجريبي_${i}`,
      poolName: i % 2 === 0 ? "المسبح الرئيسي" : "مسبح النصر",
    });
  }

  const benchmarkFiles: MatchFileInput[] = [];
  for (let i = 1; i <= 5000; i++) {
    const pad = String(i).padStart(4, "0");
    // Mix of exact, normalized, copy, digits, and unmatched
    let name: string;
    if (i % 5 === 1) name = `photos/RCS${pad}.jpg`;
    else if (i % 5 === 2) name = `rcs_${pad}.png`;
    else if (i % 5 === 3) name = `RCS${pad} (2).webp`;
    else if (i % 5 === 4) name = `${i}.jpg`;
    else name = `UNKNOWN_${i}.jpg`;

    benchmarkFiles.push({
      name,
      size: 50000 + (i % 100) * 1000,
    });
  }

  const startTime = Date.now();
  const { results, summary } = matchPhotoFiles(benchmarkFiles, benchmarkSubs);
  const durationMs = Date.now() - startTime;

  console.log(`⏱️ Processed ${benchmarkFiles.length} files against ${benchmarkSubs.length} subscribers in ${durationMs}ms`);
  console.log(`   Summary: Total=${summary.total}, Matched=${summary.matched}, Digits=${summary.digitsOnly}, Unmatched=${summary.unmatched}, Duplicate=${summary.duplicate}`);

  assert(durationMs < 1500, `Benchmark duration (${durationMs}ms) is strictly less than 1500ms (1.5s)`);
  assert(results.length === 5000, "All 5000 results processed");
}

console.log("\n==================================================");
console.log("🎉 ALL TESTS (CRITERIA 1-8) PASSED SUCCESSFULLY!");
console.log("==================================================");
