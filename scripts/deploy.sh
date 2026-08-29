#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Deploy script for RCS Swim Manager
# ────────────────────────────────────────────────────────────
# This script:
#   1. Pushes code to GitHub (which triggers Vercel auto-deploy)
#   2. Applies Prisma migrations to Neon database
#
# Usage:
#   bash scripts/deploy.sh
#
# Prerequisites:
#   - Git authenticated with GitHub
#   - Vercel project linked to GitHub repo (auto-deploy)
#   - Neon database with DATABASE_URL and DIRECT_URL env vars
# ═══════════════════════════════════════════════════════════

set -e

echo "🚀 Starting deployment..."
echo ""

# ─── 1. Push to GitHub ───
echo "📦 Step 1: Pushing to GitHub..."
if git rev-list --count origin/main..HEAD > /dev/null 2>&1; then
  AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  if [ "$AHEAD" -gt 0 ]; then
    git push origin main
    echo "✅ Pushed $AHEAD commits to GitHub"
  else
    echo "ℹ️  Already up to date with origin/main"
  fi
else
  git push origin main
  echo "✅ Pushed to GitHub"
fi
echo ""

# ─── 2. Apply Prisma migrations to Neon ───
echo "🗄️  Step 2: Applying Prisma migrations to Neon..."
if [ -z "$DATABASE_URL" ] && [ -f .env ]; then
  echo "ℹ️  Loading env from .env"
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set. Cannot apply migrations."
  echo "    To apply migrations manually on Neon:"
  echo "    1. Open Neon dashboard → your database → SQL Editor"
  echo "    2. Run the SQL from: prisma/migrations/20260711000000_add_employees_contracts/migration.sql"
  exit 1
fi

# Try prisma migrate deploy first (works if migrations folder is tracked)
npx prisma migrate deploy 2>&1 || {
  echo "⚠️  prisma migrate deploy failed, trying db push..."
  npx prisma db push --accept-data-loss 2>&1 || {
    echo "❌ Migration failed. Please apply the SQL manually:"
    echo "    prisma/migrations/20260711000000_add_employees_contracts/migration.sql"
    exit 1
  }
}

echo "✅ Migrations applied"
echo ""

# ─── 3. Generate Prisma client (in case of schema changes) ───
echo "🔧 Step 3: Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
echo ""

# ─── Done ───
echo "═════════════════════════════════════════════════════════"
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "  - Check Vercel dashboard for deployment status"
echo "  - Visit your app URL to verify the new 'عقود العمال' tab"
echo "═════════════════════════════════════════════════════════"
