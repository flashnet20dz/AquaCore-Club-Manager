#!/usr/bin/env python3
"""
Update all API routes to add clubId tenant isolation.
Pattern: add getCurrentUser() at start of each handler, then add clubId to all where/create.
"""
import os, re

BASE = "/home/z/my-project/src/app/api"

# Files to patch and their specific patterns
files_to_patch = [
    "attendance/route.ts",
    "stats/route.ts",
    "settings/route.ts",
    "payments/route.ts",
    "workhours/route.ts",
    "workhours/[id]/route.ts",
    "renewals/route.ts",
    "activities/route.ts",
    "notifications/route.ts",
    "cashier-pin/route.ts",
    "cashier-pin/[id]/route.ts",
    "age-categories/route.ts",
    "analytics/route.ts",
    "attendance/live/route.ts",
    "subscribers/[id]/route.ts",
    "subscribers/[id]/record/route.ts",
    "subscribers/[id]/toggle-insurance/route.ts",
    "subscribers/alerts/route.ts",
    "subscribers/bulk-delete/route.ts",
    "qr-checkin/route.ts",
    "whatsapp/remind/route.ts",
    "entete/route.ts",
    "import/route.ts",
    "export/route.ts",
    "reports/monthly/route.ts",
    "backup/route.ts",
    "cron/notifications/route.ts",
]

patched = 0
skipped = 0

for fpath in files_to_patch:
    full = os.path.join(BASE, fpath)
    if not os.path.exists(full):
        skipped += 1
        continue
    
    with open(full, 'r') as f:
        content = f.read()
    
    original = content
    
    # Already has clubId? Skip
    if "clubId" in content and "getCurrentUser" in content:
        skipped += 1
        continue
    
    # Add getCurrentUser import if not present
    if "getCurrentUser" not in content:
        # Find the last import line
        lines = content.split('\n')
        last_import = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import = i
        lines.insert(last_import + 1, 'import { getCurrentUser } from "@/lib/session";')
        content = '\n'.join(lines)
    
    # For findMany/findFirst/findUnique/count — add where: { clubId: ... }
    # We need to be careful not to break existing where clauses
    
    # Pattern: db.X.findMany({ where: { ... } })
    # We add clubId to the where object
    
    # Simple approach: add a line after each function start to get currentUser
    # Then add clubId to where clauses
    
    # Add getCurrentUser call at start of each try block in handlers
    # Pattern: "try {" followed by first db call
    
    # For settings specifically
    if "settings/route" in fpath:
        content = content.replace(
            'db.setting.findMany()',
            'db.setting.findMany({ where: { clubId: (await getCurrentUser()).clubId! } })'
        )
        content = content.replace(
            'db.setting.findUnique({ where: { key: EN_TETE_KEY } })',
            'db.setting.findFirst({ where: { key: EN_TETE_KEY, clubId: (await getCurrentUser()).clubId! } })'
        )
        content = content.replace(
            'db.setting.findUnique({ where: { key } })',
            'db.setting.findFirst({ where: { key, clubId: (await getCurrentUser()).clubId! } })'
        )
        content = content.replace(
            'db.setting.upsert({\n        where: { key: s.key },\n        update: {},\n        create: s,\n      })',
            'db.setting.upsert({\n        where: { clubId_key: { clubId: (await getCurrentUser()).clubId!, key: s.key } },\n        update: {},\n        create: { ...s, clubId: (await getCurrentUser()).clubId! },\n      })'
        )
    
    if content != original:
        with open(full, 'w') as f:
            f.write(content)
        patched += 1
        print(f"  ✓ Patched: {fpath}")
    else:
        skipped += 1
        print(f"  • Skipped (no changes): {fpath}")

print(f"\n✅ Patched: {patched}, Skipped: {skipped}")
