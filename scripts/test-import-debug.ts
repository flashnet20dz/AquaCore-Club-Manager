import * as XLSX from "xlsx";
import * as fs from "fs";
import { db } from "../src/lib/db";
import { computeSubscriberFieldsDynamic, DEFAULT_TYPES_MAP, normalizePaymentStatus, isExemptStatus } from "../src/lib/rcs";

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    if (value > 25569 && value < 60000) {
      const ms = (value - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  if (typeof value !== "string") return null;
  let str = value.trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
  if (!str) return null;
  if (/^\d{5}$/.test(str)) {
    const num = parseInt(str, 10);
    if (num > 25569 && num < 60000) {
      const ms = (num - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const dateOnly = str.split(/[T\s]/)[0].trim();
  const dmyMatch = dateOnly.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
      const date = new Date(year, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    }
  }
  const ymdMatch = dateOnly.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
      const date = new Date(year, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    }
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

async function testFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n======================================================`);
  console.log(`Testing: ${filePath}`);
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames.find((n) => n.includes("بيانات")) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.log("No sheet found"); return; }
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: "", raw: true, header: 1 });

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(5, allRows.length); i++) {
    const row = allRows[i].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
    if (row.some((c) => c === "اللقب") && row.some((c) => c === "الاسم")) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) {
    console.log("No header row with اللقب and الاسم found!");
    return;
  }
  const headerRow = allRows[headerRowIndex].map((c) =>
    String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " ")
  );

  const rows: Record<string, unknown>[] = [];
  for (let i = headerRowIndex + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.every((c) => !c || String(c).trim() === "")) continue;
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headerRow.length; j++) {
      if (headerRow[j]) obj[headerRow[j]] = row[j];
    }
    rows.push(obj);
  }

  const findKey = (row: Record<string, unknown>, candidates: string[]): string | null => {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
      const found = keys.find((k) => k.trim().replace(/\s+/g, " ") === candidate);
      if (found) return found;
    }
    for (const candidate of candidates) {
      if (candidate.length < 3) continue;
      const found = keys.find((k) => k.trim().replace(/\s+/g, " ").includes(candidate));
      if (found) return found;
    }
    return null;
  };

  const firstRow = rows[0];
  const lastNameKey = findKey(firstRow, ["اللقب"]);
  const firstNameKey = findKey(firstRow, ["الاسم"]);
  const birthDateKey = findKey(firstRow, ["تاريخ الميلاد", "الميلاد"]);
  const feeKey = findKey(firstRow, ["رسوم الاشتراك", "رسوم", "الرسوم"]);
  const insuranceFeeKey = findKey(firstRow, ["مصاريف التأمين", "التأمين", "مصاريف"]);
  const totalAmountKey = findKey(firstRow, ["المبلغ الإجمالي", "الإجمالي", "المبلغ"]);

  console.log(`Sheet: "${sheetName}", Total Non-Empty Rows: ${rows.length}`);

  let criticalCount = 0;
  const criticalSamples: any[] = [];

  const parsed = rows.map((row, idx) => {
    const ln = String(row[lastNameKey || ""] || "").trim();
    const fn = String(row[firstNameKey || ""] || "").trim();
    const errors: string[] = [];

    if (!ln || !fn) errors.push("الاسم أو اللقب فارغ");

    const bd = birthDateKey ? row[birthDateKey] : null;
    const pbd = parseDate(bd);
    if (!pbd) errors.push(`تاريخ الميلاد غير صالح أو فارغ: "${bd}"`);

    if (errors.length > 0) {
      criticalCount++;
      if (criticalSamples.length < 5) {
        criticalSamples.push({ row: idx + 2, ln, fn, bd, errors });
      }
    }
    return { row: idx + 2, ln, fn, pbd, errors };
  });

  const validRows = parsed.filter((r) => r.errors.length === 0);

  // Financial conflict check (Bug in route.ts):
  let conflictedCount = 0;
  validRows.forEach((r, vIdx) => {
    // Look at how route.ts does it:
    // const sourceFee = Number(rows[validRows.indexOf(r)]?.[feeKey] || 0);
    // const sourceIns = Number(rows[validRows.indexOf(r)]?.[insuranceFeeKey] || 0);
    // const sourceTotal = Number(rows[validRows.indexOf(r)]?.[totalAmountKey] || 0);
    // If sourceFee !== computedFee -> conflicted!
    const rowObj = rows[validRows.indexOf(r)];
    const sourceTotal = totalAmountKey ? Number(rowObj?.[totalAmountKey] || 0) : 0;
    // in RCS v5 computedTotal is 1800 (1300+500)
    if (sourceTotal > 0 && sourceTotal !== 1800) {
      conflictedCount++;
    }
  });

  console.log(`Summary for ${filePath}:`);
  console.log(`  Total Data Rows: ${rows.length}`);
  console.log(`  Valid Rows: ${validRows.length}`);
  console.log(`  Critical Error Rows: ${criticalCount}`);
  console.log(`  Rows with fee mismatch if checked: ${conflictedCount}`);
  if (criticalSamples.length > 0) {
    console.log(`  Sample errors:`, criticalSamples);
  }
}

async function main() {
  const dir = "C:/Users/Aladine20Dz/Downloads";
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".xlsx") || f.endsWith(".xlsm"));
  for (const f of files) {
    await testFile(`${dir}/${f}`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
