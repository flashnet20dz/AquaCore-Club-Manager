# ═══════════════════════════════════════════════════════════════
# AquaCore Club Manager — Clean Source Code Packager (ZIP)
# ═══════════════════════════════════════════════════════════════

param(
    [string]$ArtifactDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$staging = Join-Path $root "temp_zip_staging\AquaCore-Club-Manager"
$zipName = "AquaCore-Club-Manager-latest.zip"
$destZipRoot = Join-Path $root $zipName
$destZipDownload = Join-Path $root "download\$zipName"

Write-Host "Creating clean staging directory..." -ForegroundColor Cyan
$stagingRoot = Join-Path $root "temp_zip_staging"
if (Test-Path $stagingRoot) {
    Remove-Item -Path $stagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null

# 1. Folders to copy
$folders = @("src", "prisma", "public", "scripts", "electron")

foreach ($f in $folders) {
    $srcPath = Join-Path $root $f
    if (Test-Path $srcPath) {
        Write-Host "  -> Copying folder $f..."
        Copy-Item -Path $srcPath -Destination (Join-Path $staging $f) -Recurse -Force
    }
}

# Remove any SQLite database files, backups, or nested zip archives from staging
Get-ChildItem -Path $staging -Include "*.db", "*.db-journal", "*.db-wal", "*.db-shm", "*.zip", "*.bak" -Recurse | Remove-Item -Force

# 2. Files to copy
$files = @(
    "worklog.md",
    "PROJECT-PROMPT.md",
    "README.md",
    "DEPLOYMENT.md",
    "INSTALLATION.md",
    "RELEASE-NOTES.md",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "next-env.d.ts",
    "tailwind.config.ts",
    "postcss.config.mjs",
    "components.json",
    "eslint.config.mjs",
    "vercel.json",
    "capacitor.config.ts",
    "electron-builder.yml",
    ".env.example",
    ".gitignore",
    "start-server.bat",
    "build-setup.bat"
)

foreach ($file in $files) {
    $filePath = Join-Path $root $file
    if (Test-Path $filePath) {
        Write-Host "  -> Copying file $file..."
        Copy-Item -Path $filePath -Destination (Join-Path $staging $file) -Force
    }
}

Write-Host "`nCompressing archive using .NET ZipFile (Optimal Compression)..." -ForegroundColor Cyan
Add-Type -AssemblyName "System.IO.Compression.FileSystem"

if (Test-Path $destZipRoot) { Remove-Item $destZipRoot -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $destZipRoot, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$sizeMB = [math]::Round((Get-Item $destZipRoot).Length / 1MB, 2)
Write-Host "✅ Created: $destZipRoot ($sizeMB MB)" -ForegroundColor Green

# Copy to download and public folders
if (Test-Path (Join-Path $root "download")) {
    Copy-Item $destZipRoot -Destination $destZipDownload -Force
    Write-Host "✅ Copied to: $destZipDownload" -ForegroundColor Green
}

if (Test-Path (Join-Path $root "public")) {
    $destZipPublic = Join-Path $root "public\$zipName"
    Copy-Item $destZipRoot -Destination $destZipPublic -Force
    Write-Host "✅ Copied to: $destZipPublic" -ForegroundColor Green
}

if ($ArtifactDir -and (Test-Path $ArtifactDir)) {
    $destZipArtifact = Join-Path $ArtifactDir $zipName
    Copy-Item $destZipRoot -Destination $destZipArtifact -Force
    Write-Host "✅ Copied to: $destZipArtifact" -ForegroundColor Green
}

# Cleanup staging
Remove-Item -Path $stagingRoot -Recurse -Force
Write-Host "`n🎉 Packaging completed successfully!" -ForegroundColor Green
