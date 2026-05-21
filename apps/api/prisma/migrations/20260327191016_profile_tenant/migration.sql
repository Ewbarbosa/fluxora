/*
  Warnings:

  - A unique constraint covering the columns `[name,tenantId]` on the table `profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,tenantId]` on the table `profiles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `profiles` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."users" DROP CONSTRAINT "users_profileId_fkey";

-- DropIndex
DROP INDEX "public"."profiles_name_key";

-- AlterTable
ALTER TABLE "public"."profiles" ADD COLUMN     "tenantId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "profiles_tenantId_deletedAt_idx" ON "public"."profiles"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_name_tenantId_key" ON "public"."profiles"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_id_tenantId_key" ON "public"."profiles"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_profileId_tenantId_fkey" FOREIGN KEY ("profileId", "tenantId") REFERENCES "public"."profiles"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
