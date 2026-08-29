#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# AquaCore Club Manager — Build Setup.exe (Production Release)
# ═══════════════════════════════════════════════════════════

VERSION="1.0.0"
PRODUCT_NAME="AquaCore Club Manager"
APP_EXE="AquaCore Club Manager.exe"
SETUP_EXE="AquaCore Club Manager Setup ${VERSION}.exe"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  AquaCore Club Manager — Build Setup.exe                ║"
echo "║  Version: ${VERSION}                                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── Step 1: Install dependencies ───
echo "📦 Step 1: Installing dependencies..."
if [ ! -d "node_modules" ]; then
  npm install
fi
echo "✅ Dependencies ready"
echo ""

# ─── Step 2: Switch to SQLite schema + generate Prisma client ───
echo "🔧 Step 2: Preparing Prisma for SQLite (desktop)..."
npm run desktop:prepare
if [ $? -ne 0 ]; then
  echo "❌ Prisma prepare failed"
  exit 1
fi
echo "✅ Prisma client generated (SQLite)"
echo ""

# ─── Step 3: Build Next.js ───
echo "🏗️  Step 3: Building Next.js..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Next.js build failed"
  echo "Restoring schema..."
  npm run desktop:restore
  exit 1
fi
echo "✅ Next.js build successful"
echo ""

# ─── Step 4: Compile Electron TypeScript ───
echo "⚡ Step 4: Compiling Electron TypeScript..."
npx tsc electron/main.ts --outDir electron --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --lib es2020
npx tsc electron/preload.ts --outDir electron --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --lib es2020
echo "✅ Electron files compiled"
echo ""

# ─── Step 5: Generate Windows icon ───
echo "🎨 Step 5: Generating Windows icon..."
if [ ! -f "public/images/icon.ico" ]; then
  python3 -c "
from PIL import Image
img = Image.open('public/images/rcs-logo-official.png').convert('RGBA')
img_256 = img.resize((256, 256), Image.Resampling.LANCZOS)
img_256.save('public/images/icon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
img_256.save('public/images/icon-256.png', format='PNG')
print('  ✅ icon.ico created')
"
else
  echo "  ✅ icon.ico already exists"
fi
echo ""

# ─── Step 6: Build Windows app (electron-builder --dir) ───
echo "📦 Step 6: Building Windows app (electron-builder)..."
rm -rf dist/win-unpacked
npx electron-builder --win --dir
if [ $? -ne 0 ]; then
  echo "❌ electron-builder failed"
  echo "Restoring schema..."
  npm run desktop:restore
  exit 1
fi
echo "✅ Windows app built: dist/win-unpacked/${APP_EXE}"
echo ""

# ─── Step 7: Build Setup.exe with NSIS ───
echo "🎯 Step 7: Building Setup.exe with NSIS..."

MAKENSIS=""
if command -v makensis &> /dev/null; then
  MAKENSIS="makensis"
elif [ -f "/home/z/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n/linux/makensis" ]; then
  MAKENSIS="/home/z/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n/linux/makensis"
  if [ -f "scripts/nsis_redirect.so" ]; then
    export LD_PRELOAD="$(pwd)/scripts/nsis_redirect.so"
  fi
  export NSISDIR="/home/z/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n"
fi

if [ -z "$MAKENSIS" ]; then
  echo "❌ makensis not found"
  echo "   On Windows: install NSIS from https://nsis.sourceforge.io"
  echo "   On Linux: use the electron-builder cached version"
  echo "Restoring schema..."
  npm run desktop:restore
  exit 1
fi

echo "  Using: $MAKENSIS"
"$MAKENSIS" -V2 installer-simple.nsi
if [ $? -ne 0 ]; then
  echo "❌ NSIS build failed"
  echo "Restoring schema..."
  npm run desktop:restore
  exit 1
fi
echo ""

# ─── Step 8: Restore PostgreSQL schema ───
echo "🔄 Step 8: Restoring Prisma for PostgreSQL (web dev)..."
npm run desktop:restore
echo "✅ Schema restored"
echo ""

# ─── Verify ───
if [ -f "dist/${SETUP_EXE}" ]; then
  SIZE=$(stat -c%s "dist/${SETUP_EXE}" 2>/dev/null || stat -f%z "dist/${SETUP_EXE}")
  SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)

  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║                                                          ║"
  echo "║          🎉  BUILD SUCCESSFUL!  🎉                        ║"
  echo "║                                                          ║"
  echo "╠══════════════════════════════════════════════════════════╣"
  echo "║                                                          ║"
  echo "║  📁 File:      ${SETUP_EXE}            ║"
  echo "║  📂 Path:      dist/${SETUP_EXE}        ║"
  echo "║  📏 Size:      ${SIZE_MB} MB                            ║"
  echo "║  🏷️  Version:   ${VERSION}                                  ║"
  echo "║  🏢 Publisher:  AquaCore Club Manager                    ║"
  echo "║  🖼️  Icon:       icon.ico (256x256)                       ║"
  echo "║  📦 Type:       NSIS Installer (PE32)                    ║"
  echo "║                                                          ║"
  echo "║  ✅ Desktop shortcut       ║"
  echo "║  ✅ Start Menu shortcut    ║"
  echo "║  ✅ Uninstaller            ║"
  echo "║  ✅ Add/Remove Programs    ║"
  echo "║  ✅ Run after install      ║"
  echo "║                                                          ║"
  echo "╚══════════════════════════════════════════════════════════╝"
else
  echo "❌ Setup.exe was not created"
  exit 1
fi
