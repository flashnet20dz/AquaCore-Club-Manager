# ═══════════════════════════════════════════════════════════
# RCS Club Management System — Complete Project Prompt
# ═══════════════════════════════════════════════════════════

## Project Overview

**Name:** RCS Club Management System (نادي RCS — منظومة إدارة الاشتراكات والسباحة)
**Version:** 1.0.0
**Type:** Multi-Tenant Hybrid Application (Web + Desktop)
**Repository:** https://github.com/flashnet20dz/rcs-swim
**Web URL:** https://aladine-pool-manager.vercel.app
**Description:** Professional swimming club management platform with subscriber management, attendance, renewals, cards, contracts, reports, and offline desktop support.

---

## Tech Stack

### Frontend
- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui components
- Framer Motion (animations)
- Lucide React (icons)

### Backend
- Next.js API Routes (App Router)
- Prisma ORM 6
- PostgreSQL (Neon) — Web production
- SQLite — Desktop offline

### Desktop
- Electron 43
- electron-builder 26
- NSIS Installer
- Hybrid mode: Offline (local SQLite) + Online (cloud fallback)

### Deployment
- Vercel (Web)
- Neon PostgreSQL (Database)
- GitHub (Source control)
- electron-builder (Desktop Setup.exe)

### Libraries
- xlsx (Excel import/export)
- jspdf + jspdf-autotable (PDF export)
- bcryptjs (password hashing)
- sonner (toast notifications)
- qrcode (QR generation)

---

## Database Schema (Prisma)

### Core Models

#### Club
```prisma
model Club {
  id              String   @id @default(cuid())
  name            String
  city            String
  country         String   @default("الجزائر")
  managerName     String
  phone           String
  email           String   @unique
  status          String   @default("pending") // pending/active/expired/disabled/suspended
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  // Relations
  users           User[]
  subscribers     Subscriber[]
  renewals        Renewal[]
  attendances     Attendance[]
  workHours       WorkHours[]
  payments        Payment[]
  activities      Activity[]
  notifications   Notification[]
  settings        Setting[]
  cashierPins     CashierPin[]
  subscriptionTypes SubscriptionType[]
  swimmingDays     SwimmingDay[]
  swimmingTimeSlots SwimmingTimeSlot[]
  subscriptions   ClubSubscription[]
  requests        ClubRequest[]
  employees       Employee[]
  contracts       EmploymentContract[]
  contractTemplates ContractTemplate[]
}
```

#### User
```prisma
model User {
  id              String   @id @default(cuid())
  clubId          String?
  email           String   @unique
  name            String
  passwordHash    String
  role            String   @default("lifeguard") // superadmin/admin/assistant/lifeguard/observer
  phone           String?
  active          Boolean  @default(true)
  pending         Boolean  @default(false)
}
```

#### Subscriber
```prisma
model Subscriber {
  id              String   @id @default(cuid())
  clubId          String
  fileNumber      String   // RCS001, X001, MJ, etc.
  lastName        String
  firstName       String
  birthDate       DateTime
  gender          String   // ذكر / أنثى
  bloodType       String?  // A+, A-, B+, etc.
  subscriptionType String  // /, DJS, **, etc.
  lastPaymentDate DateTime?
  paymentStatus   String   // مدفوع / لم يدفع / تأمين فقط / اشتراك 300
  swimmingDays    String?
  timeSlot        String?
  phone           String?
  @@unique([clubId, fileNumber])
}
```

#### SubscriptionType (Dynamic — fully configurable)
```prisma
model SubscriptionType {
  id              String   @id @default(cuid())
  clubId          String
  name            String
  code            String   // /, DJS, **, etc.
  color           String   @default("#0d9488")
  description     String?
  // Fees
  subscriptionFee Int      @default(0)
  insuranceFee    Int      @default(500)
  compoundRights  Int      @default(1000)
  durationDays    Int      @default(30)
  // Dynamic properties
  givesMembershipNumber Boolean @default(true)
  requiresInsurance     Boolean @default(true)
  requiresCompoundFee   Boolean @default(true)
  renewableMonthly      Boolean @default(true)
  freeSubscription      Boolean @default(false)
  // Numbering
  numberingGroup  String   @default("RCS") // RCS, M, X, etc.
  active          Boolean  @default(true)
  sortOrder       Int      @default(0)
  @@unique([clubId, code])
}
```

#### Employee / EmploymentContract / ContractTemplate
```prisma
model Employee {
  id, clubId, userId?, firstName, lastName, birthDate?, birthPlace?,
  address?, phone?, nationalId?, position, hireDate, hourRate, active
}

model EmploymentContract {
  id, clubId, employeeId, templateId?, contractNumber, position,
  startDate, endDate?, hourRate, monthlySalary?, workSchedule?,
  content, status, version, notes?, createdBy?, createdAt, updatedAt
}

model ContractTemplate {
  id, clubId, name, code, description?, content, defaultDuration,
  active, createdAt, updatedAt
}
```

### Other Models
- Renewal (id, clubId, subscriberId, renewalDate, expiryDate, months, amount, paymentStatus, note)
- Attendance (id, clubId, subscriberId, date, checkInTime, checkOutTime, method, coachId)
- WorkHours (id, clubId, userId, date, startTime, endTime, status, note, approvedById, approvedAt)
- Payment (id, clubId, subscriberId?, userId?, category, amount, method, date, note)
- Activity (id, clubId, subscriberId?, type, description, createdAt)
- Notification (id, clubId, userId?, type, title, message, read, link, createdAt)
- Setting (id, clubId, key, value) — @@unique([clubId, key])
- Session (id, userId, data, expiresAt)
- CashierPin (id, clubId, pin, label, role, active)
- SwimmingDay (id, clubId, name, shortName, color, active, sortOrder)
- SwimmingTimeSlot (id, clubId, name, startTime, endTime, maxCapacity, active, sortOrder)
- ClubSubscription (id, clubId, type, startDate, endDate, status, lastRenewalDate)
- ClubRequest (id, clubId, type, data, status, createdAt)

---

## Subscription Types System (Dynamic)

### Current Configuration (matched to Excel file)

| Type | Code | numberingGroup | Fee | Insurance | Compound | Free | Membership# |
|------|------|---------------|-----|-----------|----------|------|-------------|
| عادي | / | RCS | 1300 | 500 | 1000 | ❌ | ✅ |
| DJS | DJS | RCS | 300 | 500 | 0 | ❌ | ✅ |
| ** | ** | X | 0 | 0 | 0 | ✅ | ✅ |

### Numbering System
- `/` and `DJS` share the same counter: RCS001, RCS002, RCS003...
- `**` has independent counter: X001, X002, X003...
- MJ (if added): numberingGroup = "M", givesMembershipNumber = false
- All properties configurable from Settings UI

### Dynamic Properties
- `givesMembershipNumber` — if false, fileNumber = type code (e.g., "MJ")
- `requiresInsurance` — if false, insuranceFee = 0
- `requiresCompoundFee` — if false, compoundRights = 0
- `freeSubscription` — if true, all fees = 0
- `renewableMonthly` — if false, hide renew button
- `numberingGroup` — determines file number prefix

---

## Authentication & Authorization

### Roles
- `superadmin` — manages all clubs, sees all data
- `admin` — manages one club, full access
- `assistant` — subscribers, renewals, import, export
- `lifeguard` — attendance, work hours
- `observer` — read-only

### Session
- Database-based sessions (Session table)
- `getCurrentUser()` in `src/lib/session.ts`
- `hasPermission(role, feature)` in `src/lib/roles.ts`
- Club isolation: all queries filter by `clubId`

### Login Credentials
- Admin: `admin@rcs.dz` / `admin123`
- SuperAdmin: `super@rcs.dz` / `super123`

---

## API Routes

### Authentication
- `POST /api/auth/login` — login with email + password
- `POST /api/auth/logout` — destroy session
- `GET /api/auth/me` — current user info
- `POST /api/auth/register` — register new user

### Subscribers
- `GET /api/subscribers` — list (with filters: search, paymentStatus, subscriptionType, gender, renewalStatus)
- `POST /api/subscribers` — create (auto-generates fileNumber based on numberingGroup)
- `PUT /api/subscribers/[id]` — update (only changes fileNumber if type changes)
- `DELETE /api/subscribers/[id]` — delete
- `POST /api/subscribers/bulk-delete` — bulk delete
- `POST /api/subscribers/[id]/toggle-insurance` — toggle insurance
- `GET /api/subscribers/alerts` — alerts (expired, expiring soon)

### Subscription Types
- `GET /api/subscription-types` — list (auto-seeds defaults if empty, auto-migrates)
- `POST /api/subscription-types` — create
- `PATCH /api/subscription-types/[id]` — update (with clubId verification)
- `DELETE /api/subscription-types/[id]` — delete (with clubId verification)

### Import/Export
- `POST /api/import` — import Excel (dryRun for preview, actual import with deduplication)
  - Deduplication: lastName + firstName + birthDate
  - Supports selectedRows for partial import
  - Generates fileNumbers based on numberingGroup
  - Returns errorDetails with type/column/value/expected
- `GET /api/export` — export (type: subscribers/insurance/compound/incoming/attendance/renewals/financial)
  - Formats: xlsx, pdf, word

### Reports
- `GET /api/stats` — dashboard statistics (dynamic from DB)
- `GET /api/analytics` — analytics charts (dynamic from DB)
- `GET /api/age-categories` — age category breakdown
- `GET /api/reports/monthly` — monthly report

### Other APIs
- `GET/PUT /api/settings` — club settings (key-value store)
- `GET/PUT/DELETE /api/entete` — unified report header config
- `GET/POST /api/employees` — employee CRUD
- `GET/POST /api/contracts` — contract CRUD (auto-generates contractNumber, variable substitution)
- `GET/POST /api/contract-templates` — template CRUD (auto-seeds 6 defaults)
- `GET/POST /api/swimming-days` — swimming days CRUD
- `GET/POST /api/swimming-slots` — time slots CRUD
- `GET/POST /api/attendance` — attendance records
- `GET/POST /api/renewals` — renewal records
- `GET/POST /api/workhours` — work hours
- `GET/POST /api/payments` — payments
- `GET/POST /api/users` — user management (admin only, excludes superadmin)
- `GET/POST /api/cashier-pin` — cashier PIN management
- `GET/POST /api/notifications` — notifications
- `GET/POST /api/backup` — database backup
- `GET /api/clubs` — club management (superadmin only)
- `POST /api/clubs/register` — register new club

---

## Frontend Pages & Components

### Pages (src/app/)
- `/` — Main dashboard (tabs: dashboard, subscribers, attendance, renewals, workhours, insurance, categories, analytics, cards, cards-designer, import, export, contracts, charges, users, backup, settings)
- `/login` — Login page (dark theme)
- `/register-club` — Register new club
- `/super-admin` — SuperAdmin dashboard
- `/pin` — Cashier PIN login

### Key Components (src/components/)
- `subscriber-form.tsx` — Create/edit subscriber (ChipSelector for types from useSubscriptionTypes)
- `subscriber-card.tsx` — Subscriber display card (React.memo)
- `subscriber-record-modal.tsx` — Full subscriber record
- `import-panel.tsx` — Excel import with full review interface
  - 4 tabs: All / Valid / Warnings / Errors
  - Error details panel with type/column/value/expected
  - Drawer for editing rows before import
  - Highlight + scroll to row in table
  - Export errors: Excel / PDF / CSV / Copy
  - Progress bar during import
  - Deduplication on server side
- `export-panel.tsx` — Reports Center (15 reports) + Quick Exports
- `reports/index.tsx` — 15 independent reports with UnifiedReportHeader
- `unified-report-header.tsx` — Single component for all reports (logo, club info, date, report number)
- `unified-header-settings.tsx` — Header editor (live preview, elements, format)
- `settings-panel.tsx` — 7 tabs: General, Subscribers, Work Hours, Header, Theme, Texts, WhatsApp, Desktop
- `cards-designer.tsx` — Card designer (4 columns: tools, canvas, properties, subscribers list)
- `cards-panel.tsx` — Card generation panel
- `contracts-panel.tsx` — 4 tabs: Employees, Contracts Archive, Templates, Create Contract
- `desktop-settings.tsx` — Desktop-only settings (file paths, backup, auto-start)
- `charges-panel.tsx` — Financial charges panel
- `attendance-panel.tsx` — Attendance with QR
- `renewal-panel.tsx` — Renewal management
- `insurance-panel.tsx` — Insurance management
- `analytics-charts.tsx` — Charts (Recharts)
- `stat-card.tsx` — Statistics card
- `notification-bell.tsx` — Notification bell
- `sync-indicator.tsx` — Offline sync indicator
- `pwa-installer.tsx` — PWA install prompt

### Hooks (src/hooks/)
- `use-subscription-types.ts` — Single Source of Truth for subscription types
  - 30-second cache
  - `invalidateSubscriptionTypesCache()` after mutations
  - Returns: types, activeTypes, selectOptions, filterOptions, chipOptions, refresh
- `use-breakpoint.ts` — Responsive breakpoint detection
- `use-scale-fit.ts` — Scale-to-fit for card designer
- `use-offline-mutation.ts` — Offline mutation queue (IndexedDB)

---

## Unified Report Header (UnifiedReportHeader)

### Component
- Used in ALL 15 reports + contracts
- Fetches from `/api/entete` + `/api/settings`
- Shows: club logo (left), club name + branch (center), logo (right), divider, reference number, date, season

### Settings
- Managed in: Settings → Unified Header (EN-TÊTE)
- Elements: text + logo, placed in 3 slots (left, center, right)
- Format: divider color/width, show/hide reference row
- Club info: name (ar/fr), branch, wilaya, address, phone, email, website, sport season

---

## Reports (15)

1. قائمة المنخرطين — 18 columns (matches Excel)
2. قائمة التأمين — status badges (insured/uninsured)
3. حقوق دخول المركب — compound rights ≥ 1300 دج
4. قائمة التجديدات — filter: today/week/month/all
5. سجل الحضور — filter: today/week/month/all
6. التقرير المالي — revenue, expenses, balance
7. الاشتراكات المنتهية — expired/7days/30days
8. تقرير الغياب — absence count, last attendance, rate
9. الفئات العمرية — 4 categories (M<13, F<13, M≥13, F≥13)
10. أنواع الاشتراك — count per type (dynamic from DB)
11. أيام السباحة — count per day
12. أوقات السباحة — count per time slot
13. فصائل الدم — count per blood type
14. تقرير الأعمار — count per age
15. تقرير المدربين — count per coach

Each report: UnifiedReportHeader + stats + filters + table (search/sort/paginate) + export (PDF/Word/Excel/Print)

---

## Excel Import System

### Features
- Full review interface (all rows, not just 10)
- 4 tabs: All / Valid / Warnings / Errors
- Error details: type (critical/warning), column, value, expected
- Row editing before import (Drawer with form)
- Highlight + scroll to row
- Export errors: Excel / PDF / CSV / Copy
- Progress bar during import
- Deduplication: lastName + firstName + birthDate
- Partial import: selected rows only
- Dynamic subscription type validation from DB
- File number generation based on numberingGroup

### Validation Rules
- Critical (blocks import):
  - Empty name/surname
  - Invalid birth date
  - Invalid gender (if provided)
  - Invalid payment status (if provided)
  - Subscription type not in DB
- Optional (no warnings):
  - Blood type, phone, swimming days, time slot — silently ignored if missing

---

## Card Designer

### Layout (4 columns on XL screens)
1. Tools (w-56) — elements, layers, add elements
2. Canvas (flex-1) — PVC card preview, drag & drop, front/back
3. Properties (w-64) — selected element properties
4. Subscribers (w-72) — vertical list with search, filter, sort

### Features
- Context menu (right-click): properties, rename, copy, paste, duplicate, lock, visibility, z-order, delete
- Double-click: open properties
- Element types: text, shape, logo, QR, photo, fullName, memberId, bloodType, dateOfBirth, paymentDate, swimmingDays, swimmingTime, subscriptionType, expiryDate, clubName, cardTitle
- Export: PDF (RECTO/VERSO), Word
- Import/export template (JSON)
- Settings: card dimensions, columns, rows, gap, colors, background image

---

## Contracts System

### Models
- Employee (linked to User optionally)
- EmploymentContract (linked to Employee + Template)
- ContractTemplate (6 defaults: guard, coach, admin, maintenance, cleaner, seasonal)

### Features
- 17 dynamic variables: {{club_name}}, {{worker_name}}, {{birth_date}}, {{position}}, {{contract_number}}, {{start_date}}, {{end_date}}, {{hour_rate}}, {{today}}, etc.
- Auto-generates contract number: CTR-YYYY-NNN
- Contract renewal (creates new version)
- Archive with: number, employee, position, date, version, download, print
- Export: PDF, Word, Print (all use UnifiedReportHeader)
- Template editor with live preview and variable helper

---

## Desktop Application (Electron)

### Architecture (Hybrid)
```
App starts
    │
    ├── Try local Next.js Standalone server (port 3872)
    │   ├── Success → load localhost:3872 (Offline + SQLite)
    │   └── Fail → load cloud URL (Online + PostgreSQL)
    │
    └── On close → kill local server
```

### Security
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- IPC: 33 handlers (print, files, backup, notifications, window, settings, database, updates)

### IPC Handlers
- App: getVersion, platform
- Print: print, printToPDF, silentPrint
- Files: saveFile, openFile, readFile, listFiles, deleteFile, ensureDir
- Backup: backupDatabase, restoreDatabase, exportDatabase, importDatabase, autoBackup
- Notifications: showNotification (Windows native)
- Window: minimize, maximize, close, isMaximized, setFullScreen, hideSplash
- Settings: getDesktopSettings, setDesktopSetting
- Database: getDatabaseInfo, getDatabasePath
- Updates: checkForUpdates, downloadUpdate, installUpdate (placeholders)
- External: openExternal, openPath

### Desktop Settings
- File paths (files, backups, exports)
- Print settings (silent, background)
- Auto-backup (daily/weekly/monthly)
- Auto-start with Windows
- Minimize to tray
- Language (ar/fr/en)
- Theme (dark/light/system)

### Build Configuration (electron-builder.yml)
- Next.js Standalone mode (output: "standalone" in next.config.ts)
- Standalone server.js + node_modules inside asar
- Static files (.next/static) inside asar
- Public files inside asar
- Prisma client + schema inside asar
- package.json at root of asar
- NSIS installer with desktop + start menu shortcuts
- Run after install
- License agreement

### Build Script (build-setup.ps1)
1. npm install
2. npx prisma generate
3. npm run build (Next.js standalone)
4. Verify .next/standalone/server.js exists
5. Compile Electron TypeScript (main.ts + preload.ts)
6. npx electron-builder --win nsis
7. Show results + open dist folder

---

## Service Worker

### Version: v6
- HTML pages: NETWORK-ONLY (never cache)
- JS chunks: NETWORK-ONLY (browser HTTP cache handles)
- API GET: network-first, cache fallback, empty-JSON fallback
- Images/static: stale-while-revalidate
- On activate: delete ALL old caches (v5 and earlier)
- Force all clients to navigate to fresh URL

### Offline Fetch Interceptor (in layout.tsx)
- Wraps window.fetch
- When offline: returns synthetic empty JSON (200) instead of throwing
- Queues mutations in IndexedDB for later sync
- Auto-reload on chunk load failure

---

## Multi-Tenant Architecture

### Isolation
- Every model has `clubId`
- Every API route filters by `currentUser.clubId`
- SuperAdmin bypasses clubId filter
- Session-based authentication

### Club Management
- SuperAdmin can create/suspend/expire clubs
- Each club has its own: users, subscribers, settings, subscription types, etc.
- Club registration flow: register → pending → admin approves → active

---

## Configuration Files

### next.config.ts
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*"],
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};
```

### vercel.json
```json
{
  "crons": [{ "path": "/api/cron/notifications", "schedule": "0 8 * * *" }],
  "functions": {
    "src/app/api/export/route.ts": { "maxDuration": 60 },
    "src/app/api/import/route.ts": { "maxDuration": 60 },
    "src/app/api/backup/route.ts": { "maxDuration": 60 }
  }
}
```

### Environment Variables
- `DATABASE_URL` — PostgreSQL (Neon) or SQLite (file:)
- `DIRECT_URL` — Direct connection for migrations
- `NEXTAUTH_SECRET` — Session encryption key
- `NEXTAUTH_URL` — App URL (localhost:3872 for desktop)

---

## File Structure

```
src/
├── app/
│   ├── api/                    # API Routes (40+ endpoints)
│   │   ├── auth/               # Authentication
│   │   ├── subscribers/        # Subscriber CRUD + bulk + alerts
│   │   ├── subscription-types/ # Type CRUD
│   │   ├── import/             # Excel import
│   │   ├── export/             # Export (xlsx/pdf/word)
│   │   ├── employees/          # Employee CRUD
│   │   ├── contracts/          # Contract CRUD
│   │   ├── contract-templates/ # Template CRUD
│   │   ├── settings/           # Settings key-value
│   │   ├── entete/             # Unified header config
│   │   ├── stats/              # Dashboard stats
│   │   ├── analytics/          # Charts data
│   │   └── ...                 # Other APIs
│   ├── login/                  # Login page
│   ├── register-club/          # Club registration
│   ├── super-admin/            # SuperAdmin dashboard
│   ├── pin/                    # Cashier PIN login
│   ├── layout.tsx              # Root layout (offline interceptor + fonts)
│   ├── page.tsx                # Main app (tabs)
│   └── globals.css             # Global styles
├── components/
│   ├── reports/                # 15 reports
│   ├── ui/                     # shadcn/ui components
│   ├── subscriber-form.tsx     # Create/edit form
│   ├── import-panel.tsx        # Excel import UI
│   ├── export-panel.tsx        # Reports center + quick exports
│   ├── cards-designer.tsx      # Card designer
│   ├── contracts-panel.tsx     # Contracts management
│   ├── settings-panel.tsx      # Settings (7 tabs)
│   ├── unified-report-header.tsx
│   ├── unified-header-settings.tsx
│   ├── desktop-settings.tsx
│   └── ...                     # Other components
├── hooks/
│   ├── use-subscription-types.ts  # Single Source of Truth
│   ├── use-breakpoint.ts
│   ├── use-scale-fit.ts
│   └── use-offline-mutation.ts
├── lib/
│   ├── db.ts                   # Prisma client (auto-detect SQLite/PostgreSQL)
│   ├── db-adapter.ts           # Database adapter
│   ├── session.ts              # Authentication + ensureDefaultSettings
│   ├── roles.ts                # Role definitions + permissions
│   ├── rcs.ts                  # Business logic (dynamic subscription types)
│   ├── contract-variables.ts   # Contract variable substitution
│   └── utils.ts                # Utilities
└── types/
    └── ...                     # TypeScript types

electron/
├── main.ts                     # Main process (Hybrid: offline + online)
├── preload.ts                  # Secure IPC bridge
├── desktop-settings.js         # Persistent settings
├── splash.html                 # Loading splash
├── auto-updater.js             # Auto-update (placeholder)
└── package.json                # Electron package

prisma/
├── schema.prisma               # Full schema (PostgreSQL)
├── schema.sqlite.prisma        # SQLite variant
└── migrations/                 # SQL migrations

public/
├── sw.js                       # Service Worker v6
├── manifest.json               # PWA manifest
└── images/                     # Logos, icons
```

---

## Deployment

### Web (Vercel)
1. Push to GitHub main branch
2. Vercel auto-deploys (or manual deploy via API)
3. Neon PostgreSQL database
4. Environment variables set in Vercel dashboard

### Desktop (Windows)
1. Clone repo on Windows
2. Run `.\build-setup.ps1`
3. Get `dist\RCS Club Setup v1.0.0.exe`
4. Install on any Windows 10/11 PC
5. App works offline (SQLite) + online (cloud fallback)

### Database (Neon)
1. `npx prisma db push --accept-data-loss` for schema changes
2. `npx prisma generate` to update client
3. Auto-seeding in API routes (subscription types, contract templates)

---

## Key Business Rules

### Subscription Fee Calculation (Dynamic)
1. If `freeSubscription = true` → all fees = 0
2. If `requiresInsurance = false` → insuranceFee = 0
3. If `requiresCompoundFee = false` → compoundRights = 0
4. Otherwise → use values from SubscriptionType table
5. Total = subscriptionFee + insuranceFee (compoundRights excluded per Excel formula)

### File Number Generation
1. If `givesMembershipNumber = false` → fileNumber = type code (e.g., "MJ")
2. If `givesMembershipNumber = true`:
   - Find max number in same `numberingGroup` from existing subscribers
   - Generate: `{numberingGroup}{number:03d}` (e.g., "RCS001", "X001")
   - Conflict check: try up to 100 numbers until unused
3. On type change: regenerate fileNumber only if type actually changed
4. On edit without type change: never touch fileNumber

### Import Deduplication
- Key: `lastName.trim().toLowerCase() + "|" + firstName.trim().toLowerCase() + "|" + birthDate(ISO)`
- Check against existing subscribers AND within same file
- Duplicates are skipped, not imported
- Response includes duplicate count and details

### Expiry Date
- `expiryDate = lastPaymentDate + durationDays` (default 30 days)
- Renewal status: ✅ ساري / ⚠️ قريب الانتهاء (5 days) / ⛔ منتهي / 🔒 مجمدة

---

## Acceptance Test Results (24/24 Passed)

1. ✅ App starts without internet
2. ✅ SQLite database created automatically (21 tables)
3. ✅ Create subscriber
4. ✅ Edit subscriber
5. ✅ Delete subscriber
6. ✅ Renewal
7. ✅ Attendance (QR)
8. ✅ Insurance
9. ✅ Card design
10. ✅ Card creation
11. ✅ Excel import (batch insert)
12. ✅ Excel export
13. ✅ PDF export (jsPDF)
14. ✅ Word export (HTML-based)
15. ✅ Print (Electron IPC)
16. ✅ Settings save
17. ✅ Unified header
18. ✅ Reports (15 reports)
19. ✅ Contracts (Employee + Contract + Template)
20. ✅ Backup
21. ✅ Restore
22. ✅ Restart + data persistence
23. ✅ Database adapter (SQLite + PostgreSQL)
24. ✅ Offline mode
