# Task: Multi-Tenant clubId Fix for API Routes

## Task ID: clubid-fix-001

## Summary
Fixed all 28 API routes in the Next.js multi-tenant application to properly scope database operations by `clubId`. The Prisma schema requires `clubId` on all tenant-scoped models, and the `Setting` model uses a composite unique `@@unique([clubId, key])`.

## Problem
14+ API routes were creating records without `clubId`, causing Prisma validation errors. Additionally, `findMany`/`findUnique`/`count`/`deleteMany` calls were not filtered by `clubId`, allowing cross-tenant data leakage. Setting model upserts used `where: { key }` which fails because `key` alone is no longer unique (the composite `clubId_key` is).

## Solution Pattern
For every route:
1. Call `getCurrentUser()` from `@/lib/session`
2. Compute a `clubFilter`: `const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };`
3. Add `clubId: currentUser.clubId!` (or `sub.clubId` where the subscriber is already resolved) to all `.create()` data payloads
4. Spread `...clubFilter` into all `.findMany()`, `.findFirst()`, `.count()`, `.deleteMany()` where clauses
5. Change `.findUnique({ where: { id } })` to `.findFirst({ where: { id, ...clubFilter } })` for ownership verification
6. For `Setting` model upserts: use `where: { clubId_key: { clubId, key } }` and include `clubId` in `create`
7. For `Setting` model `findUnique` by key: change to `findFirst({ where: { clubId, key } })`
8. Expand role checks from `role !== "admin"` to `role !== "admin" && role !== "superadmin"` so superadmin can access and bypass clubId filters

## Special Cases Handled

### Compound Unique Keys
- `Attendance` uses `@@unique([clubId, subscriberId, date])` → Prisma accessor is `clubId_subscriberId_date`
- `Subscriber` uses `@@unique([clubId, fileNumber])` → Prisma accessor is `clubId_fileNumber`
- `Setting` uses `@@unique([clubId, key])` → Prisma accessor is `clubId_key`

### Cashier-PIN Login Flow
The PIN login (`POST /api/cashier-pin` without `action: "create"`) has no user session yet. Since `pin` is globally `@unique`, we iterate all active PINs (no clubId filter). When a PIN matches, we include the PIN's `clubId` in the fake session user so downstream requests are properly scoped.

### Cron Notifications Route
`/api/cron/notifications` is called by a scheduled job (no user session). The route calls `getCurrentUser()` which returns `null` for cron calls. When null or superadmin, it processes all clubs; for regular users, it filters by their club. Notifications are created with `clubId` from the subscriber's record. Admins are looked up per-club using a cache map.

### Export Route
The `/api/export` route has many `findMany` calls across helper functions (`exportExcel`, `exportPdf`, `exportWord`, `loadEnteteConfig`). The `clubFilter` is computed in the `GET` handler and passed as a parameter to each helper. `loadEnteteConfig` was changed from `findUnique({ where: { key } })` to `findFirst({ where: { clubId, key } })`.

## Files Modified (28 total)
1. `src/app/api/payments/route.ts`
2. `src/app/api/workhours/route.ts`
3. `src/app/api/workhours/[id]/route.ts`
4. `src/app/api/users/route.ts`
5. `src/app/api/users/[id]/route.ts`
6. `src/app/api/attendance/route.ts`
7. `src/app/api/qr-checkin/route.ts`
8. `src/app/api/import/route.ts`
9. `src/app/api/cashier-pin/route.ts`
10. `src/app/api/cashier-pin/[id]/route.ts`
11. `src/app/api/subscribers/[id]/route.ts`
12. `src/app/api/subscribers/[id]/toggle-insurance/route.ts`
13. `src/app/api/subscribers/bulk-delete/route.ts`
14. `src/app/api/renewals/route.ts`
15. `src/app/api/entete/route.ts`
16. `src/app/api/settings/route.ts`
17. `src/app/api/backup/route.ts`
18. `src/app/api/whatsapp/remind/route.ts`
19. `src/app/api/cron/notifications/route.ts`
20. `src/app/api/notifications/route.ts`
21. `src/app/api/activities/route.ts`
22. `src/app/api/analytics/route.ts`
23. `src/app/api/stats/route.ts`
24. `src/app/api/age-categories/route.ts`
25. `src/app/api/attendance/live/route.ts`
26. `src/app/api/subscribers/alerts/route.ts`
27. `src/app/api/subscribers/[id]/record/route.ts`
28. `src/app/api/export/route.ts`

## Verification
Build passes successfully:
```
✓ Compiled successfully in 21.1s
```
No errors or warnings. All API routes compile with proper TypeScript type checking.
