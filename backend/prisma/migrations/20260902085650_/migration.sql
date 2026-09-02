-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_alertId_fkey";

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "alertId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
