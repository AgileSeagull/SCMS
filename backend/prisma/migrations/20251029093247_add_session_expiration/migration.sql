-- AlterTable
ALTER TABLE "EntryExitLog" ADD COLUMN "expirationTime" DATETIME;

-- CreateIndex
CREATE INDEX "EntryExitLog_expirationTime_idx" ON "EntryExitLog"("expirationTime");
