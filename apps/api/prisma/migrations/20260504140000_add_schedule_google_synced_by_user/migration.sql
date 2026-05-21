-- AlterTable
ALTER TABLE "schedules" ADD COLUMN "google_synced_by_user_id" INTEGER;

-- CreateIndex
CREATE INDEX "schedules_google_synced_by_user_id_idx" ON "schedules"("google_synced_by_user_id");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_google_synced_by_user_id_fkey" FOREIGN KEY ("google_synced_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
