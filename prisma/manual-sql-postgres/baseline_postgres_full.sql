-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'الجزائر',
    "managerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "syncApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trialStartedAt" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "graceEndDate" TIMESTAMP(3),
    "hardwareFingerprint" TEXT,
    "themePreset" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "logoUrl" TEXT,
    "borderRadius" TEXT,
    "density" TEXT,
    "fontFamily" TEXT,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubSubscription" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastRenewalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldType" TEXT,
    "newType" TEXT,
    "oldEndDate" TIMESTAMP(3),
    "newEndDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeBatch" (
    "id" TEXT NOT NULL,
    "batchNo" INTEGER NOT NULL,
    "name" TEXT,
    "plan" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "CodeBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unused',
    "clubId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "hardwareFingerprint" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "ActivationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubRequest" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "fileNumber" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "bloodType" TEXT,
    "subscriptionType" TEXT NOT NULL,
    "lastPaymentDate" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL,
    "swimmingDays" TEXT,
    "timeSlot" TEXT,
    "phone" TEXT,
    "photoPath" TEXT,
    "photoThumb" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renewal" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 1,
    "amount" INTEGER NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Renewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkInTime" TIMESTAMP(3) NOT NULL,
    "checkOutTime" TIMESTAMP(3),
    "method" TEXT NOT NULL,
    "coachId" TEXT,
    "note" TEXT,
    "isCompensation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clubId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'lifeguard',
    "phone" TEXT,
    "avatar" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkHours" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rateSnapshot" INTEGER,
    "rejectionReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slotId" TEXT,

    CONSTRAINT "WorkHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "userId" TEXT,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "receiptNumber" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "clubId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierPin" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'كاشير',
    "role" TEXT NOT NULL DEFAULT 'assistant',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashierPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionType" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "description" TEXT,
    "subscriptionFee" INTEGER NOT NULL DEFAULT 0,
    "insuranceFee" INTEGER NOT NULL DEFAULT 500,
    "compoundRights" INTEGER NOT NULL DEFAULT 1000,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "givesMembershipNumber" BOOLEAN NOT NULL DEFAULT true,
    "requiresInsurance" BOOLEAN NOT NULL DEFAULT true,
    "requiresCompoundFee" BOOLEAN NOT NULL DEFAULT true,
    "renewableMonthly" BOOLEAN NOT NULL DEFAULT true,
    "freeSubscription" BOOLEAN NOT NULL DEFAULT false,
    "numberingGroup" TEXT NOT NULL DEFAULT 'RCS',
    "requiresInsuranceLegacy" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwimmingDay" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwimmingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwimmingTimeSlot" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxCapacity" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dayOfWeek" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwimmingTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "nationalId" TEXT,
    "email" TEXT,
    "firstNameFr" TEXT,
    "lastNameFr" TEXT,
    "position" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hourRate" INTEGER NOT NULL DEFAULT 200,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardAssignment" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "groupName" TEXT,
    "slotId" TEXT,
    "assignmentType" TEXT NOT NULL DEFAULT 'primary',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "attendanceStatus" TEXT NOT NULL DEFAULT 'scheduled',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentContract" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT,
    "contractNumber" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "hourRate" INTEGER NOT NULL DEFAULT 200,
    "monthlySalary" INTEGER,
    "workSchedule" TEXT,
    "contractType" TEXT NOT NULL DEFAULT 'HOURLY',
    "title" TEXT,
    "weeklyHours" INTEGER,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "terminatedAt" TIMESTAMP(3),
    "terminatedById" TEXT,
    "terminatedReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "defaultDuration" INTEGER NOT NULL DEFAULT 365,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolClosure" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "swimmingDays" TEXT,
    "timeSlot" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "subscriptionTypesFilter" TEXT,
    "paymentStatusesFilter" TEXT,
    "registeredOnOrAfter" TIMESTAMP(3),
    "registeredOnOrBefore" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compensation" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "closureId" TEXT,
    "subscriberId" TEXT NOT NULL,
    "originalDate" TIMESTAMP(3) NOT NULL,
    "originalSwimmingDays" TEXT,
    "originalTimeSlot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cancelledSessionsCount" INTEGER NOT NULL DEFAULT 1,
    "compensatedCount" INTEGER NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3),
    "compensationDate" TIMESTAMP(3),
    "compensationSwimmingDays" TEXT,
    "compensationTimeSlot" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "attendanceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationHistory" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "compensationId" TEXT,
    "closureId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompensationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOutbox" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SyncOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncMeta" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastPullAt" TIMESTAMP(3),
    "deviceId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "desiredSwimmingDays" TEXT NOT NULL,
    "desiredTimeSlot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "note" TEXT,
    "convertedSubscriberId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriberContract" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "contractText" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signatureImage" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'signed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriberContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "clubId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubSettings" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'ar',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'DZD',
    "subscriptionModel" TEXT NOT NULL DEFAULT 'monthly',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "primaryColor" TEXT NOT NULL DEFAULT '#0F4C81',
    "secondaryColor" TEXT NOT NULL DEFAULT '#00B4D8',
    "accentColor" TEXT NOT NULL DEFAULT '#10B981',
    "backgroundColor" TEXT,
    "cardColor" TEXT,
    "sidebarColor" TEXT,
    "textColor" TEXT,
    "borderColor" TEXT,
    "successColor" TEXT NOT NULL DEFAULT '#22C55E',
    "warningColor" TEXT NOT NULL DEFAULT '#F59E0B',
    "dangerColor" TEXT NOT NULL DEFAULT '#EF4444',
    "infoColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "borderRadius" TEXT NOT NULL DEFAULT '0.625rem',
    "fontFamily" TEXT NOT NULL DEFAULT 'Cairo',
    "themeMode" TEXT NOT NULL DEFAULT 'light',
    "themeName" TEXT NOT NULL DEFAULT 'Ocean Blue',
    "features" TEXT,
    "appliedTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UIConfiguration" (
    "id" TEXT NOT NULL,
    "interfaceKey" TEXT NOT NULL,
    "interfaceName" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL_CLUBS',
    "clubId" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "settings" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UIConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UITemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UITemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'module',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "allowEdit" BOOLEAN NOT NULL DEFAULT true,
    "allowDelete" BOOLEAN NOT NULL DEFAULT true,
    "allowPrint" BOOLEAN NOT NULL DEFAULT true,
    "allowExport" BOOLEAN NOT NULL DEFAULT true,
    "isBeta" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "minVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "platforms" TEXT NOT NULL DEFAULT 'all',
    "countries" TEXT,
    "plans" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureAccess" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL_CLUBS',
    "clubId" TEXT,
    "clubGroupId" TEXT,
    "enabled" BOOLEAN,
    "visible" BOOLEAN,
    "readOnly" BOOLEAN,
    "allowEdit" BOOLEAN,
    "allowDelete" BOOLEAN,
    "allowPrint" BOOLEAN,
    "allowExport" BOOLEAN,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0f766e',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefaultClubConfig" (
    "id" TEXT NOT NULL,
    "clubName" TEXT NOT NULL DEFAULT 'نادي السباحة',
    "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0369a1',
    "logoUrl" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "currencySymbol" TEXT NOT NULL DEFAULT 'دج',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Algiers',
    "calendar" TEXT NOT NULL DEFAULT 'gregorian',
    "defaultPlan" TEXT NOT NULL DEFAULT 'monthly',
    "trialDays" INTEGER NOT NULL DEFAULT 7,
    "enabledFeatures" TEXT NOT NULL DEFAULT '[]',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "DefaultClubConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriberPhoto" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "cropped" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "faceDetected" BOOLEAN NOT NULL DEFAULT false,
    "cloudinaryPublicId" TEXT,
    "cloudinaryUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriberPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTemplate" (
    "id" TEXT NOT NULL,
    "clubId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cardSize" TEXT NOT NULL DEFAULT 'CR80',
    "orientation" TEXT NOT NULL DEFAULT 'landscape',
    "width" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 6.5,
    "layout" TEXT NOT NULL DEFAULT '{}',
    "thumbnail" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCompensation" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "employeeId" TEXT,
    "userId" TEXT,
    "personName" TEXT NOT NULL,
    "personPosition" TEXT NOT NULL DEFAULT 'guard',
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "periodLabel" TEXT,
    "workHours" INTEGER NOT NULL DEFAULT 0,
    "hourRate" INTEGER NOT NULL DEFAULT 200,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "overtimeHours" INTEGER NOT NULL DEFAULT 0,
    "overtimeAmount" INTEGER NOT NULL DEFAULT 0,
    "bonusAmount" INTEGER NOT NULL DEFAULT 0,
    "deductions" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "compensationType" TEXT NOT NULL DEFAULT 'monthly',
    "note" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCompensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "payeeName" TEXT,
    "payeeId" TEXT,
    "subscriberId" TEXT,
    "employeeId" TEXT,
    "staffCompensationId" TEXT,
    "closureId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "seq" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WagePayment" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hourRate" INTEGER NOT NULL DEFAULT 0,
    "grossAmount" INTEGER NOT NULL DEFAULT 0,
    "prevPaid" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "employeeId" TEXT,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "transactionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,

    CONSTRAINT "WagePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialBalance" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "totalIncome" INTEGER NOT NULL DEFAULT 0,
    "totalExpense" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "incomeByCategory" TEXT NOT NULL DEFAULT '{}',
    "expenseByCategory" TEXT NOT NULL DEFAULT '{}',
    "lastTransactionId" TEXT,
    "lastTransactionDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_email_key" ON "Club"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Club_syncApiKey_key" ON "Club"("syncApiKey");

-- CreateIndex
CREATE INDEX "ClubSubscription_clubId_idx" ON "ClubSubscription"("clubId");

-- CreateIndex
CREATE INDEX "ClubSubscription_status_idx" ON "ClubSubscription"("status");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_subscriptionId_idx" ON "SubscriptionHistory"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeBatch_batchNo_key" ON "CodeBatch"("batchNo");

-- CreateIndex
CREATE INDEX "CodeBatch_plan_idx" ON "CodeBatch"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_code_key" ON "ActivationCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_codeHash_key" ON "ActivationCode"("codeHash");

-- CreateIndex
CREATE INDEX "ActivationCode_batchId_idx" ON "ActivationCode"("batchId");

-- CreateIndex
CREATE INDEX "ActivationCode_status_idx" ON "ActivationCode"("status");

-- CreateIndex
CREATE INDEX "ActivationCode_clubId_idx" ON "ActivationCode"("clubId");

-- CreateIndex
CREATE INDEX "ActivationCode_plan_idx" ON "ActivationCode"("plan");

-- CreateIndex
CREATE INDEX "ClubRequest_clubId_idx" ON "ClubRequest"("clubId");

-- CreateIndex
CREATE INDEX "ClubRequest_status_idx" ON "ClubRequest"("status");

-- CreateIndex
CREATE INDEX "Subscriber_clubId_idx" ON "Subscriber"("clubId");

-- CreateIndex
CREATE INDEX "Subscriber_clubId_paymentStatus_idx" ON "Subscriber"("clubId", "paymentStatus");

-- CreateIndex
CREATE INDEX "Subscriber_clubId_subscriptionType_idx" ON "Subscriber"("clubId", "subscriptionType");

-- CreateIndex
CREATE INDEX "Subscriber_clubId_gender_idx" ON "Subscriber"("clubId", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_clubId_fileNumber_key" ON "Subscriber"("clubId", "fileNumber");

-- CreateIndex
CREATE INDEX "Renewal_clubId_idx" ON "Renewal"("clubId");

-- CreateIndex
CREATE INDEX "Renewal_clubId_subscriberId_idx" ON "Renewal"("clubId", "subscriberId");

-- CreateIndex
CREATE INDEX "Attendance_clubId_date_idx" ON "Attendance"("clubId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_clubId_subscriberId_date_key" ON "Attendance"("clubId", "subscriberId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WorkHours_clubId_userId_date_idx" ON "WorkHours"("clubId", "userId", "date");

-- CreateIndex
CREATE INDEX "WorkHours_clubId_status_idx" ON "WorkHours"("clubId", "status");

-- CreateIndex
CREATE INDEX "WorkHours_clubId_slotId_idx" ON "WorkHours"("clubId", "slotId");

-- CreateIndex
CREATE INDEX "Payment_clubId_idx" ON "Payment"("clubId");

-- CreateIndex
CREATE INDEX "Payment_clubId_subscriberId_idx" ON "Payment"("clubId", "subscriberId");

-- CreateIndex
CREATE INDEX "Payment_clubId_category_idx" ON "Payment"("clubId", "category");

-- CreateIndex
CREATE INDEX "Payment_clubId_date_idx" ON "Payment"("clubId", "date");

-- CreateIndex
CREATE INDEX "Activity_clubId_createdAt_idx" ON "Activity"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_clubId_userId_read_idx" ON "Notification"("clubId", "userId", "read");

-- CreateIndex
CREATE INDEX "Setting_clubId_idx" ON "Setting"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_clubId_key_key" ON "Setting"("clubId", "key");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashierPin_pin_key" ON "CashierPin"("pin");

-- CreateIndex
CREATE INDEX "CashierPin_clubId_idx" ON "CashierPin"("clubId");

-- CreateIndex
CREATE INDEX "CashierPin_clubId_active_idx" ON "CashierPin"("clubId", "active");

-- CreateIndex
CREATE INDEX "CashierPin_active_idx" ON "CashierPin"("active");

-- CreateIndex
CREATE INDEX "SubscriptionType_clubId_idx" ON "SubscriptionType"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionType_clubId_code_key" ON "SubscriptionType"("clubId", "code");

-- CreateIndex
CREATE INDEX "SwimmingDay_clubId_idx" ON "SwimmingDay"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "SwimmingDay_clubId_name_key" ON "SwimmingDay"("clubId", "name");

-- CreateIndex
CREATE INDEX "SwimmingTimeSlot_clubId_idx" ON "SwimmingTimeSlot"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "SwimmingTimeSlot_clubId_name_key" ON "SwimmingTimeSlot"("clubId", "name");

-- CreateIndex
CREATE INDEX "Employee_clubId_idx" ON "Employee"("clubId");

-- CreateIndex
CREATE INDEX "Employee_clubId_position_idx" ON "Employee"("clubId", "position");

-- CreateIndex
CREATE INDEX "Employee_clubId_status_idx" ON "Employee"("clubId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_clubId_nationalId_key" ON "Employee"("clubId", "nationalId");

-- CreateIndex
CREATE INDEX "GuardAssignment_clubId_userId_idx" ON "GuardAssignment"("clubId", "userId");

-- CreateIndex
CREATE INDEX "GuardAssignment_clubId_dayOfWeek_timeSlot_idx" ON "GuardAssignment"("clubId", "dayOfWeek", "timeSlot");

-- CreateIndex
CREATE INDEX "GuardAssignment_clubId_attendanceStatus_idx" ON "GuardAssignment"("clubId", "attendanceStatus");

-- CreateIndex
CREATE INDEX "GuardAssignment_clubId_slotId_idx" ON "GuardAssignment"("clubId", "slotId");

-- CreateIndex
CREATE INDEX "EmploymentContract_clubId_employeeId_idx" ON "EmploymentContract"("clubId", "employeeId");

-- CreateIndex
CREATE INDEX "EmploymentContract_clubId_status_idx" ON "EmploymentContract"("clubId", "status");

-- CreateIndex
CREATE INDEX "EmploymentContract_clubId_endDate_idx" ON "EmploymentContract"("clubId", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentContract_clubId_contractNumber_key" ON "EmploymentContract"("clubId", "contractNumber");

-- CreateIndex
CREATE INDEX "ContractTemplate_clubId_idx" ON "ContractTemplate"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_clubId_code_key" ON "ContractTemplate"("clubId", "code");

-- CreateIndex
CREATE INDEX "PoolClosure_clubId_date_idx" ON "PoolClosure"("clubId", "date");

-- CreateIndex
CREATE INDEX "PoolClosure_clubId_startDate_endDate_idx" ON "PoolClosure"("clubId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Compensation_attendanceId_key" ON "Compensation"("attendanceId");

-- CreateIndex
CREATE INDEX "Compensation_clubId_status_idx" ON "Compensation"("clubId", "status");

-- CreateIndex
CREATE INDEX "Compensation_clubId_subscriberId_idx" ON "Compensation"("clubId", "subscriberId");

-- CreateIndex
CREATE INDEX "Compensation_closureId_idx" ON "Compensation"("closureId");

-- CreateIndex
CREATE INDEX "Compensation_expiryDate_idx" ON "Compensation"("expiryDate");

-- CreateIndex
CREATE INDEX "CompensationHistory_clubId_createdAt_idx" ON "CompensationHistory"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "CompensationHistory_compensationId_idx" ON "CompensationHistory"("compensationId");

-- CreateIndex
CREATE INDEX "CompensationHistory_closureId_idx" ON "CompensationHistory"("closureId");

-- CreateIndex
CREATE INDEX "SyncOutbox_clubId_synced_idx" ON "SyncOutbox"("clubId", "synced");

-- CreateIndex
CREATE INDEX "Waitlist_clubId_status_idx" ON "Waitlist"("clubId", "status");

-- CreateIndex
CREATE INDEX "Waitlist_clubId_desiredSwimmingDays_desiredTimeSlot_idx" ON "Waitlist"("clubId", "desiredSwimmingDays", "desiredTimeSlot");

-- CreateIndex
CREATE INDEX "SubscriberContract_clubId_subscriberId_idx" ON "SubscriberContract"("clubId", "subscriberId");

-- CreateIndex
CREATE INDEX "AuditLog_clubId_createdAt_idx" ON "AuditLog"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "ClubSettings_clubId_key" ON "ClubSettings"("clubId");

-- CreateIndex
CREATE INDEX "ClubSettings_clubId_idx" ON "ClubSettings"("clubId");

-- CreateIndex
CREATE INDEX "UIConfiguration_scope_idx" ON "UIConfiguration"("scope");

-- CreateIndex
CREATE INDEX "UIConfiguration_clubId_idx" ON "UIConfiguration"("clubId");

-- CreateIndex
CREATE INDEX "UIConfiguration_isVisible_idx" ON "UIConfiguration"("isVisible");

-- CreateIndex
CREATE UNIQUE INDEX "UIConfiguration_interfaceKey_clubId_key" ON "UIConfiguration"("interfaceKey", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "UITemplate_name_key" ON "UITemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_category_idx" ON "FeatureFlag"("category");

-- CreateIndex
CREATE INDEX "FeatureFlag_enabled_idx" ON "FeatureFlag"("enabled");

-- CreateIndex
CREATE INDEX "FeatureFlag_isPremium_idx" ON "FeatureFlag"("isPremium");

-- CreateIndex
CREATE INDEX "FeatureAccess_featureId_idx" ON "FeatureAccess"("featureId");

-- CreateIndex
CREATE INDEX "FeatureAccess_clubId_idx" ON "FeatureAccess"("clubId");

-- CreateIndex
CREATE INDEX "FeatureAccess_clubGroupId_idx" ON "FeatureAccess"("clubGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureAccess_featureId_scope_clubId_clubGroupId_key" ON "FeatureAccess"("featureId", "scope", "clubId", "clubGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubGroup_name_key" ON "ClubGroup"("name");

-- CreateIndex
CREATE INDEX "ClubGroup_name_idx" ON "ClubGroup"("name");

-- CreateIndex
CREATE INDEX "ClubGroupMember_groupId_idx" ON "ClubGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "ClubGroupMember_clubId_idx" ON "ClubGroupMember"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubGroupMember_groupId_clubId_key" ON "ClubGroupMember"("groupId", "clubId");

-- CreateIndex
CREATE INDEX "DefaultClubConfig_id_idx" ON "DefaultClubConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriberPhoto_subscriberId_key" ON "SubscriberPhoto"("subscriberId");

-- CreateIndex
CREATE INDEX "SubscriberPhoto_subscriberId_idx" ON "SubscriberPhoto"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "CardTemplate_name_key" ON "CardTemplate"("name");

-- CreateIndex
CREATE INDEX "CardTemplate_clubId_idx" ON "CardTemplate"("clubId");

-- CreateIndex
CREATE INDEX "CardTemplate_isShared_idx" ON "CardTemplate"("isShared");

-- CreateIndex
CREATE INDEX "CardTemplate_isDefault_idx" ON "CardTemplate"("isDefault");

-- CreateIndex
CREATE INDEX "StaffCompensation_clubId_year_month_idx" ON "StaffCompensation"("clubId", "year", "month");

-- CreateIndex
CREATE INDEX "StaffCompensation_clubId_paymentStatus_idx" ON "StaffCompensation"("clubId", "paymentStatus");

-- CreateIndex
CREATE INDEX "StaffCompensation_clubId_employeeId_idx" ON "StaffCompensation"("clubId", "employeeId");

-- CreateIndex
CREATE INDEX "StaffCompensation_clubId_userId_idx" ON "StaffCompensation"("clubId", "userId");

-- CreateIndex
CREATE INDEX "FinancialTransaction_clubId_type_category_idx" ON "FinancialTransaction"("clubId", "type", "category");

-- CreateIndex
CREATE INDEX "FinancialTransaction_clubId_date_idx" ON "FinancialTransaction"("clubId", "date");

-- CreateIndex
CREATE INDEX "FinancialTransaction_clubId_payeeName_idx" ON "FinancialTransaction"("clubId", "payeeName");

-- CreateIndex
CREATE INDEX "FinancialTransaction_clubId_status_idx" ON "FinancialTransaction"("clubId", "status");

-- CreateIndex
CREATE INDEX "FinancialTransaction_clubId_reference_idx" ON "FinancialTransaction"("clubId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTransaction_clubId_seq_key" ON "FinancialTransaction"("clubId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "WagePayment_idempotencyKey_key" ON "WagePayment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WagePayment_clubId_userId_periodStart_idx" ON "WagePayment"("clubId", "userId", "periodStart");

-- CreateIndex
CREATE INDEX "WagePayment_clubId_paidAt_idx" ON "WagePayment"("clubId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "WagePayment_transactionId_key" ON "WagePayment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialBalance_clubId_key" ON "FinancialBalance"("clubId");

-- AddForeignKey
ALTER TABLE "ClubSubscription" ADD CONSTRAINT "ClubSubscription_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ClubSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBatch" ADD CONSTRAINT "CodeBatch_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CodeBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubRequest" ADD CONSTRAINT "ClubRequest_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHours" ADD CONSTRAINT "WorkHours_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHours" ADD CONSTRAINT "WorkHours_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHours" ADD CONSTRAINT "WorkHours_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SwimmingTimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierPin" ADD CONSTRAINT "CashierPin_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionType" ADD CONSTRAINT "SubscriptionType_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwimmingDay" ADD CONSTRAINT "SwimmingDay_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwimmingTimeSlot" ADD CONSTRAINT "SwimmingTimeSlot_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardAssignment" ADD CONSTRAINT "GuardAssignment_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardAssignment" ADD CONSTRAINT "GuardAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardAssignment" ADD CONSTRAINT "GuardAssignment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SwimmingTimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractTemplate" ADD CONSTRAINT "ContractTemplate_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolClosure" ADD CONSTRAINT "PoolClosure_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "PoolClosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationHistory" ADD CONSTRAINT "CompensationHistory_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationHistory" ADD CONSTRAINT "CompensationHistory_compensationId_fkey" FOREIGN KEY ("compensationId") REFERENCES "Compensation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationHistory" ADD CONSTRAINT "CompensationHistory_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "PoolClosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationHistory" ADD CONSTRAINT "CompensationHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOutbox" ADD CONSTRAINT "SyncOutbox_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waitlist" ADD CONSTRAINT "Waitlist_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriberContract" ADD CONSTRAINT "SubscriberContract_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriberContract" ADD CONSTRAINT "SubscriberContract_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubSettings" ADD CONSTRAINT "ClubSettings_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UIConfiguration" ADD CONSTRAINT "UIConfiguration_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureAccess" ADD CONSTRAINT "FeatureAccess_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureAccess" ADD CONSTRAINT "FeatureAccess_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureAccess" ADD CONSTRAINT "FeatureAccess_clubGroupId_fkey" FOREIGN KEY ("clubGroupId") REFERENCES "ClubGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubGroupMember" ADD CONSTRAINT "ClubGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ClubGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubGroupMember" ADD CONSTRAINT "ClubGroupMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriberPhoto" ADD CONSTRAINT "SubscriberPhoto_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTemplate" ADD CONSTRAINT "CardTemplate_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompensation" ADD CONSTRAINT "StaffCompensation_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompensation" ADD CONSTRAINT "StaffCompensation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompensation" ADD CONSTRAINT "StaffCompensation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WagePayment" ADD CONSTRAINT "WagePayment_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WagePayment" ADD CONSTRAINT "WagePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WagePayment" ADD CONSTRAINT "WagePayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialBalance" ADD CONSTRAINT "FinancialBalance_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

