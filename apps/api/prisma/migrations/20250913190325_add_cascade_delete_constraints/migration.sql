-- DropForeignKey
ALTER TABLE "public"."addresses" DROP CONSTRAINT "addresses_contactId_fkey";

-- DropForeignKey
ALTER TABLE "public"."bank_accounts" DROP CONSTRAINT "bank_accounts_contactId_fkey";

-- DropForeignKey
ALTER TABLE "public"."contact_process" DROP CONSTRAINT "contact_process_contactId_fkey";

-- DropForeignKey
ALTER TABLE "public"."contact_process" DROP CONSTRAINT "contact_process_processId_fkey";

-- AddForeignKey
ALTER TABLE "public"."contact_process" ADD CONSTRAINT "contact_process_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contact_process" ADD CONSTRAINT "contact_process_processId_fkey" FOREIGN KEY ("processId") REFERENCES "public"."processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bank_accounts" ADD CONSTRAINT "bank_accounts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
