-- Fix unique constraints to be tenant-scoped and add composite indexes for performance

-- Remove old unique constraints
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "contacts_cpfCnpj_key";
DROP INDEX IF EXISTS "processes_processNumber_key";

-- Remove old simple tenantId indexes (will be replaced by composite indexes)
DROP INDEX IF EXISTS "audit_logs_tenantId_idx";
DROP INDEX IF EXISTS "contacts_tenantId_idx";
DROP INDEX IF EXISTS "login_logs_tenantId_idx";
DROP INDEX IF EXISTS "processes_tenantId_idx";

-- Add new tenant-scoped unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_tenantId_key" ON "users"("email", "tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_cpfCnpj_tenantId_key" ON "contacts"("cpfCnpj", "tenantId");
-- Note: processes already has @@unique([processNumber, tenantId]) so no change needed

-- Add composite indexes for performance (tenantId + deletedAt)
CREATE INDEX IF NOT EXISTS "users_tenantId_deletedAt_idx" ON "users"("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "contacts_tenantId_deletedAt_idx" ON "contacts"("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "processes_tenantId_deletedAt_idx" ON "processes"("tenantId", "deletedAt");

-- Add composite indexes for performance (tenantId + createdAt) for sorting/filtering
CREATE INDEX IF NOT EXISTS "users_tenantId_createdAt_idx" ON "users"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "contacts_tenantId_createdAt_idx" ON "contacts"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "processes_tenantId_createdAt_idx" ON "processes"("tenantId", "createdAt");

-- Add composite indexes for audit_logs
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_tableName_idx" ON "audit_logs"("tenantId", "tableName");

-- Add composite indexes for login_logs
CREATE INDEX IF NOT EXISTS "login_logs_tenantId_createdAt_idx" ON "login_logs"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "login_logs_tenantId_success_idx" ON "login_logs"("tenantId", "success");

