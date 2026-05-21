-- CreateEnum (com verificação de existência)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventType') THEN
        CREATE TYPE "EventType" AS ENUM ('AUDIENCIA', 'REUNIAO', 'PRAZO', 'TAREFA', 'DILIGENCIA', 'OUTRO');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScheduleStatus') THEN
        CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'POSTPONED');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Priority') THEN
        CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderType') THEN
        CREATE TYPE "ReminderType" AS ENUM ('EMAIL', 'NOTIFICATION', 'SMS', 'WHATSAPP');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParticipantRole') THEN
        CREATE TYPE "ParticipantRole" AS ENUM ('ORGANIZER', 'PARTICIPANT', 'OPTIONAL');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParticipantStatus') THEN
        CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE');
    END IF;
END $$;

-- CreateTable (com verificação de existência)
CREATE TABLE IF NOT EXISTS "schedules" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "event_type" "EventType" NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "location" VARCHAR(255),
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "meeting_link" VARCHAR(500),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" TEXT,
    "recurrence_end_date" TIMESTAMP(3),
    "parent_schedule_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "process_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable (com verificação de existência)
CREATE TABLE IF NOT EXISTS "schedule_contacts" (
    "id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable (com verificação de existência)
CREATE TABLE IF NOT EXISTS "schedule_participants" (
    "id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
    "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING',
    "notify_on_change" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable (com verificação de existência)
CREATE TABLE IF NOT EXISTS "schedule_reminders" (
    "id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "reminder_time" TIMESTAMP(3) NOT NULL,
    "reminder_type" "ReminderType" NOT NULL,
    "minutes_before" INTEGER NOT NULL,
    "was_sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (com verificação de existência)
CREATE INDEX IF NOT EXISTS "idx_schedules_user_id" ON "schedules"("user_id");

CREATE INDEX IF NOT EXISTS "idx_schedules_tenant_id" ON "schedules"("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_schedules_process_id" ON "schedules"("process_id");

CREATE INDEX IF NOT EXISTS "idx_schedules_start_date" ON "schedules"("start_date");

CREATE INDEX IF NOT EXISTS "idx_schedules_end_date" ON "schedules"("end_date");

CREATE INDEX IF NOT EXISTS "idx_schedules_date_range" ON "schedules"("start_date", "end_date");

CREATE INDEX IF NOT EXISTS "idx_schedules_status" ON "schedules"("status");

CREATE INDEX IF NOT EXISTS "idx_schedules_event_type" ON "schedules"("event_type");

CREATE INDEX IF NOT EXISTS "idx_schedules_deleted_at" ON "schedules"("deleted_at");

CREATE INDEX IF NOT EXISTS "idx_schedules_parent_id" ON "schedules"("parent_schedule_id");

CREATE INDEX IF NOT EXISTS "idx_schedules_tenant_user_dates" ON "schedules"("tenant_id", "user_id", "start_date", "end_date");

CREATE INDEX IF NOT EXISTS "idx_schedule_contacts_schedule_id" ON "schedule_contacts"("schedule_id");

CREATE INDEX IF NOT EXISTS "idx_schedule_contacts_contact_id" ON "schedule_contacts"("contact_id");

CREATE INDEX IF NOT EXISTS "idx_schedule_participants_schedule_id" ON "schedule_participants"("schedule_id");

CREATE INDEX IF NOT EXISTS "idx_schedule_participants_user_id" ON "schedule_participants"("user_id");

CREATE INDEX IF NOT EXISTS "idx_schedule_participants_status" ON "schedule_participants"("status");

CREATE INDEX IF NOT EXISTS "idx_schedule_reminders_schedule_id" ON "schedule_reminders"("schedule_id");

CREATE INDEX IF NOT EXISTS "idx_schedule_reminders_was_sent" ON "schedule_reminders"("was_sent");

CREATE INDEX IF NOT EXISTS "idx_schedule_reminders_reminder_time" ON "schedule_reminders"("reminder_time");

CREATE INDEX IF NOT EXISTS "idx_schedule_reminders_pending" ON "schedule_reminders"("reminder_time", "was_sent");

CREATE UNIQUE INDEX IF NOT EXISTS "schedule_contacts_schedule_id_contact_id_key" ON "schedule_contacts"("schedule_id", "contact_id");

CREATE UNIQUE INDEX IF NOT EXISTS "schedule_participants_schedule_id_user_id_key" ON "schedule_participants"("schedule_id", "user_id");

-- AddForeignKey (com verificação de existência)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedules_parent_schedule_id_fkey'
    ) THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_parent_schedule_id_fkey" FOREIGN KEY ("parent_schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedules_user_id_fkey'
    ) THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedules_tenant_id_fkey'
    ) THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedules_process_id_fkey'
    ) THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedule_contacts_schedule_id_fkey'
    ) THEN
        ALTER TABLE "schedule_contacts" ADD CONSTRAINT "schedule_contacts_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedule_contacts_contact_id_fkey'
    ) THEN
        ALTER TABLE "schedule_contacts" ADD CONSTRAINT "schedule_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedule_participants_schedule_id_fkey'
    ) THEN
        ALTER TABLE "schedule_participants" ADD CONSTRAINT "schedule_participants_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedule_participants_user_id_fkey'
    ) THEN
        ALTER TABLE "schedule_participants" ADD CONSTRAINT "schedule_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedule_reminders_schedule_id_fkey'
    ) THEN
        ALTER TABLE "schedule_reminders" ADD CONSTRAINT "schedule_reminders_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddCheckConstraint (com verificação de existência)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedules_end_date_gte_start_date'
    ) THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_end_date_gte_start_date" CHECK ("end_date" >= "start_date");
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedules_online_link_check'
    ) THEN
        ALTER TABLE "schedules" ADD CONSTRAINT "schedules_online_link_check" CHECK (("is_online" = false) OR (("is_online" = true) AND ("meeting_link" IS NOT NULL)));
    END IF;
END $$;

-- CreatePartialIndex (índice parcial para schedules não deletados)
CREATE INDEX IF NOT EXISTS "idx_schedules_tenant_user_dates_partial" ON "schedules"("tenant_id", "user_id", "start_date", "end_date") WHERE "deleted_at" IS NULL;

-- CreatePartialIndex (índice parcial para lembretes pendentes)
CREATE INDEX IF NOT EXISTS "idx_schedule_reminders_pending_partial" ON "schedule_reminders"("reminder_time", "was_sent") WHERE "was_sent" = false;

