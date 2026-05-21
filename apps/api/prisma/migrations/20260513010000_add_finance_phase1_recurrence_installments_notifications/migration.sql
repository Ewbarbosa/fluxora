-- CreateEnum
CREATE TYPE "FinancialRecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "financial_transactions"
ADD COLUMN "installmentCount" INTEGER,
ADD COLUMN "installmentGroupId" TEXT,
ADD COLUMN "installmentNumber" INTEGER,
ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recurrenceCount" INTEGER,
ADD COLUMN "recurrenceFrequency" "FinancialRecurrenceFrequency",
ADD COLUMN "recurrenceGroupId" TEXT,
ADD COLUMN "recurrenceIndex" INTEGER,
ADD COLUMN "recurrenceInterval" INTEGER;

-- CreateIndex
CREATE INDEX "financial_transactions_recurrenceGroupId_idx" ON "financial_transactions"("recurrenceGroupId");

-- CreateIndex
CREATE INDEX "financial_transactions_installmentGroupId_idx" ON "financial_transactions"("installmentGroupId");
