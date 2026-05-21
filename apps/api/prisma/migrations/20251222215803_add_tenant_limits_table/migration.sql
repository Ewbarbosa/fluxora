-- CreateEnum (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
        CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'CANCELLED', 'EXPIRED', 'SUSPENDED', 'PENDING');
    END IF;
END $$;

-- CreateTable (se não existir)
CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "limits" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable (se não existir)
CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable (se não existir)
CREATE TABLE IF NOT EXISTS "public"."subscription_history" (
    "id" SERIAL NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "oldPlanId" INTEGER,
    "newPlanId" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "changeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable (se não existir)
CREATE TABLE IF NOT EXISTS "public"."tenant_limits" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxContacts" INTEGER NOT NULL DEFAULT 100,
    "maxProcesses" INTEGER NOT NULL DEFAULT 50,
    "maxStorageMB" INTEGER NOT NULL DEFAULT 1024,
    "maxCustomFields" INTEGER NOT NULL DEFAULT 5,
    "currentUsers" INTEGER NOT NULL DEFAULT 0,
    "currentContacts" INTEGER NOT NULL DEFAULT 0,
    "currentProcesses" INTEGER NOT NULL DEFAULT 0,
    "currentStorageMB" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS "plans_name_key" ON "public"."plans"("name");

-- CreateIndex (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_tenantId_key" ON "public"."subscriptions"("tenantId");

-- CreateIndex (se não existir)
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_idx" ON "public"."subscriptions"("tenantId");

-- CreateIndex (se não existir)
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "public"."subscriptions"("status");

-- CreateIndex (se não existir)
CREATE INDEX IF NOT EXISTS "subscriptions_planId_idx" ON "public"."subscriptions"("planId");

-- CreateIndex (se não existir)
CREATE INDEX IF NOT EXISTS "subscription_history_subscriptionId_idx" ON "public"."subscription_history"("subscriptionId");

-- CreateIndex (se não existir)
CREATE INDEX IF NOT EXISTS "subscription_history_changeDate_idx" ON "public"."subscription_history"("changeDate");

-- CreateIndex (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_limits_tenantId_key" ON "public"."tenant_limits"("tenantId");

-- CreateIndex (se não existir)
CREATE INDEX IF NOT EXISTS "tenant_limits_tenantId_idx" ON "public"."tenant_limits"("tenantId");

-- AddForeignKey (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tenantId_fkey'
    ) THEN
        ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_planId_fkey'
    ) THEN
        ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'subscription_history_subscriptionId_fkey'
    ) THEN
        ALTER TABLE "public"."subscription_history" ADD CONSTRAINT "subscription_history_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_limits_tenantId_fkey'
    ) THEN
        ALTER TABLE "public"."tenant_limits" ADD CONSTRAINT "tenant_limits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- RenameIndex
ALTER INDEX "public"."idx_google_calendar_connections_sync_enabled" RENAME TO "google_calendar_connections_sync_enabled_idx";

-- RenameIndex
ALTER INDEX "public"."idx_google_calendar_connections_tenant_id" RENAME TO "google_calendar_connections_tenant_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_google_calendar_connections_user_id" RENAME TO "google_calendar_connections_user_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedule_contacts_contact_id" RENAME TO "schedule_contacts_contact_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedule_contacts_schedule_id" RENAME TO "schedule_contacts_schedule_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedule_participants_schedule_id" RENAME TO "schedule_participants_schedule_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedule_participants_status" RENAME TO "schedule_participants_status_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedule_participants_user_id" RENAME TO "schedule_participants_user_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedule_reminders_pending" RENAME TO "schedule_reminders_reminder_time_was_sent_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedule_reminders_reminder_time" RENAME TO "schedule_reminders_reminder_time_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedule_reminders_schedule_id" RENAME TO "schedule_reminders_schedule_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedule_reminders_was_sent" RENAME TO "schedule_reminders_was_sent_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_date_range" RENAME TO "schedules_start_date_end_date_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_deleted_at" RENAME TO "schedules_deleted_at_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_end_date" RENAME TO "schedules_end_date_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_event_type" RENAME TO "schedules_event_type_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_google_calendar_event_id" RENAME TO "schedules_google_calendar_event_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_parent_id" RENAME TO "schedules_parent_schedule_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_process_id" RENAME TO "schedules_process_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_start_date" RENAME TO "schedules_start_date_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_status" RENAME TO "schedules_status_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_tenant_id" RENAME TO "schedules_tenant_id_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_tenant_user_dates" RENAME TO "schedules_tenant_id_user_id_start_date_end_date_idx";

-- RenameIndex
ALTER INDEX "public"."idx_schedules_user_id" RENAME TO "schedules_user_id_idx";
