-- CreateEnum
CREATE TYPE "public"."FinancialTransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "public"."FinancialTransactionStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."financial_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."FinancialTransactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."financial_transactions" (
    "id" SERIAL NOT NULL,
    "type" "public"."FinancialTransactionType" NOT NULL,
    "status" "public"."FinancialTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "competenceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "processId" INTEGER,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_categories_tenantId_deletedAt_idx" ON "public"."financial_categories"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_tenantId_name_type_key" ON "public"."financial_categories"("tenantId", "name", "type");

-- CreateIndex
CREATE INDEX "financial_transactions_tenantId_deletedAt_idx" ON "public"."financial_transactions"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "financial_transactions_tenantId_type_status_idx" ON "public"."financial_transactions"("tenantId", "type", "status");

-- CreateIndex
CREATE INDEX "financial_transactions_tenantId_dueDate_idx" ON "public"."financial_transactions"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "financial_transactions_categoryId_idx" ON "public"."financial_transactions"("categoryId");

-- CreateIndex
CREATE INDEX "financial_transactions_contactId_idx" ON "public"."financial_transactions"("contactId");

-- CreateIndex
CREATE INDEX "financial_transactions_processId_idx" ON "public"."financial_transactions"("processId");

-- AddForeignKey
ALTER TABLE "public"."financial_categories" ADD CONSTRAINT "financial_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_processId_fkey" FOREIGN KEY ("processId") REFERENCES "public"."processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
