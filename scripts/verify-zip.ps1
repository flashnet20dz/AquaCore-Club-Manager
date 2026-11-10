Add-Type -AssemblyName "System.IO.Compression.FileSystem"
$root = Split-Path -Parent $PSScriptRoot
$zipPath = Join-Path $root "AquaCore-Club-Manager-latest.zip"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
Write-Host "Total entries in zip: $($zip.Entries.Count)"
$mustHave = @(
    "worklog.md",
    "PROJECT-PROMPT.md",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "prisma/schema.prisma",
    "prisma/schema.sqlite.prisma",
    "src/app/page.tsx",
    "src/hooks/use-pools.tsx",
    "src/components/pools-management-modal.tsx",
    "src/components/pool-selector.tsx",
    "src/lib/multi-pool.ts"
)

foreach ($item in $mustHave) {
    $found = $zip.Entries | Where-Object { ($_.FullName -replace '\\','/') -eq $item }
    if ($found) {
        $bytes = ($found | Measure-Object -Property Length -Sum).Sum
        Write-Host "  ✅ $item : FOUND ($bytes bytes)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $item : MISSING" -ForegroundColor Red
    }
}
$zip.Dispose()
