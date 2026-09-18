import * as XLSX from "xlsx";

const wb = XLSX.readFile("C:/Users/Aladine20Dz/Downloads/قائمة المنخرطين_2026-08-20.xlsx");
console.log("Sheets in قائمة المنخرطين:", wb.SheetNames);
for (const s of wb.SheetNames) {
  const ws = wb.Sheets[s];
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  console.log("Sheet:", s, "rows:", allRows.length);
  for (let i = 0; i < Math.min(5, allRows.length); i++) {
    console.log(`  Row ${i}:`, allRows[i]?.slice(0, 10));
  }
}
