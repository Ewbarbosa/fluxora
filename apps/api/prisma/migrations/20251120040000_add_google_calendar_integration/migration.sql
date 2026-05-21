-- Adicionar campo google_calendar_event_id na tabela schedules
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedules' AND column_name = 'google_calendar_event_id'
    ) THEN
        ALTER TABLE "schedules" ADD COLUMN "google_calendar_event_id" VARCHAR(255);
    END IF;
END $$;

-- Criar índice para google_calendar_event_id
CREATE INDEX IF NOT EXISTS "idx_schedules_google_calendar_event_id" ON "schedules"("google_calendar_event_id");

-- Criar tabela google_calendar_connections
CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3),
    "calendar_id" VARCHAR(255),
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- Criar índice único para user_id
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_connections_user_id_key" ON "google_calendar_connections"("user_id");

-- Criar índices
CREATE INDEX IF NOT EXISTS "idx_google_calendar_connections_user_id" ON "google_calendar_connections"("user_id");
CREATE INDEX IF NOT EXISTS "idx_google_calendar_connections_tenant_id" ON "google_calendar_connections"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_google_calendar_connections_sync_enabled" ON "google_calendar_connections"("sync_enabled");

-- Adicionar foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'google_calendar_connections_user_id_fkey'
    ) THEN
        ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'google_calendar_connections_tenant_id_fkey'
    ) THEN
        ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;


