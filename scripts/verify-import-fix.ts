import * as XLSX from "xlsx";
import * as fs from "fs";

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

function testWorkbook(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n======================================================`);
  console.log(`Testing File: ${filePath}`);
  const wb = XLSX.readFile(filePath, { cellDates: true });

  const priorityKeywords = ["منخرط", "مشترك", "بيانات", "سجل", "قائمة", "adherent", "membre", "donnee", "data"];
  const sortedSheetNames = [...wb.SheetNames].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aPrio = priorityKeywords.some((k) => aLower.includes(k)) ? 1 : 0;
    const bPrio = priorityKeywords.some((k) => bLower.includes(k)) ? 1 : 0;
    return bPrio - aPrio;
  });

  let chosenSheetName = "";
  let chosenHeaderRowIndex = -1;
  let chosenHeaders: string[] = [];
  let chosenRows: Record<string, unknown>[] = [];
  let maxSubscribersFound = -1;

  for (const name of sortedSheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: "", raw: true, header: 1 });
    if (allRows.length < 2) continue;

    let hIdx = -1;
    for (let i = 0; i < Math.min(10, allRows.length); i++) {
      const row = allRows[i].map((c) => String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " "));
      const hasLastName = row.some((c) => ["اللقب", "لقب", "Nom", "nom"].includes(c));
      const hasFirstName = row.some((c) => ["الاسم", "اسم", "Prénom", "prenom", "Prenom"].includes(c));
      const hasFullName = row.some((c) => ["الاسم واللقب", "اللقب والاسم", "الاسم الكامل", "Nom et Prénom", "Nom Prénom"].some((k) => c.includes(k)));
      if ((hasLastName && hasFirstName) || hasFullName) {
        hIdx = i;
        break;
      }
    }

    if (hIdx !== -1) {
      const headerRow = allRows[hIdx].map((c) =>
        String(c || "").trim().replace(/\r?\n/g, " ").replace(/\s+/g, " ")
      );
      const dataRows: Record<string, unknown>[] = [];
      for (let i = hIdx + 1; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row || row.every((c) => !c || String(c).trim() === "")) continue;
        const obj: Record<string, unknown> = {};
        for (let j = 0; j < headerRow.length; j++) {
          if (headerRow[j]) obj[headerRow[j]] = row[j];
        }
        dataRows.push(obj);
      }

      if (dataRows.length > maxSubscribersFound) {
        maxSubscribersFound = dataRows.length;
        chosenSheetName = name;
        chosenHeaderRowIndex = hIdx;
        chosenHeaders = headerRow;
        chosenRows = dataRows;
      }
    }
  }

  const findKey = (row: Record<string, unknown>, candidates: string[]): string | null => {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
      const found = keys.find((k) => k.trim().replace(/\s+/g, " ").toLowerCase() === candidate.toLowerCase());
      if (found) return found;
    }
    for (const candidate of candidates) {
      if (candidate.length < 3) continue;
      const found = keys.find((k) => k.trim().replace(/\s+/g, " ").toLowerCase().includes(candidate.toLowerCase()));
      if (found) return found;
    }
    return null;
  };

  const firstRow = chosenRows[0] || {};
  const lastNameKey = findKey(firstRow, ["اللقب", "لقب", "Nom", "nom"]);
  const firstNameKey = findKey(firstRow, ["الاسم", "اسم", "Prénom", "prenom", "Prenom"]);
  const fullNameKey = findKey(firstRow, ["الاسم واللقب", "اللقب والاسم", "الاسم الكامل", "Nom et Prénom", "Nom Prénom"]);
  const birthDateKey = findKey(firstRow, ["تاريخ الميلاد", "الميلاد", "تاريخ الازدياد", "الازدياد", "تاريخ الولادة", "الولادة", "ت.الميلاد", "ت.الازدياد", "Date de naissance", "Date naissance", "dnaiss", "Date Naiss"]);
  const ageKey = findKey(firstRow, ["العمر", "السن", "age", "Age"]);

  let validCount = 0;
  let criticalCount = 0;
  let inferredBirthDates = 0;
  let fallbackBirthDates = 0;

  chosenRows.forEach((row, idx) => {
    let lastName = lastNameKey ? String(row[lastNameKey] || "").trim() : "";
    let firstName = firstNameKey ? String(row[firstNameKey] || "").trim() : "";

    if ((!lastName || !firstName) && fullNameKey && row[fullNameKey]) {
      const full = String(row[fullNameKey]).trim();
      const parts = full.split(/\s+/);
      if (parts.length > 1) {
        if (!lastName) lastName = parts[0];
        if (!firstName) firstName = parts.slice(1).join(" ");
      } else if (parts.length === 1 && parts[0]) {
        if (!lastName) lastName = parts[0];
        if (!firstName) firstName = "—";
      }
    }
    if (!lastName && firstName) lastName = "—";
    if (!firstName && lastName) firstName = "—";

    if (!lastName && !firstName) {
      criticalCount++;
      return;
    }

    let birthDate: Date | null = null;
    if (birthDateKey && row[birthDateKey]) {
      birthDate = parseDate(row[birthDateKey]);
    }
    if (!birthDate && ageKey && row[ageKey]) {
      const rawAge = String(row[ageKey]).replace(/[^\d]/g, "");
      const ageNum = parseInt(rawAge, 10);
      if (!isNaN(ageNum) && ageNum > 0 && ageNum < 120) {
        const currentYear = new Date().getFullYear();
        birthDate = new Date(currentYear - ageNum, 0, 1);
        inferredBirthDates++;
      }
    }
    if (!birthDate) {
      birthDate = new Date(2000, 0, 1);
      fallbackBirthDates++;
    }

    validCount++;
  });

  console.log(`Results:`);
  console.log(`  Chosen Sheet: "${chosenSheetName}" (Header row: ${chosenHeaderRowIndex + 1})`);
  console.log(`  Total Data Rows in Sheet: ${chosenRows.length}`);
  console.log(`  Valid Subscribers to Import: ${validCount} / ${chosenRows.length} (${((validCount / chosenRows.length) * 100).toFixed(1)}%)`);
  console.log(`  Critical Errors (Dropped): ${criticalCount}`);
  console.log(`  Inferred BirthDates from Age: ${inferredBirthDates}`);
  console.log(`  Default Fallback BirthDates: ${fallbackBirthDates}`);
}

function main() {
  const dir = "C:/Users/Aladine20Dz/Downloads";
  const files = [
    "AquaCore_سجل_المنخرطين_2026_8.xlsx",
    "قائمة المنخرطين_2026-08-20.xlsx",
    "منظومة_اشتراكات_RCS_v5_1.xlsm",
    "منظومة_اشتراكات_RCS_v7.xlsm",
    "منظومة_اشتراكات_RCS_v10.xlsm",
  ];
  for (const f of files) {
    testWorkbook(`${dir}/${f}`);
  }
}

main();
