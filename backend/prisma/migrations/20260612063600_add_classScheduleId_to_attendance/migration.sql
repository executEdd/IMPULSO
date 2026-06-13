-- AddColumn
ALTER TABLE "attendances" ADD COLUMN "classScheduleId" INTEGER;

-- Backfill
UPDATE "attendances" a
SET "classScheduleId" = (
  SELECT cs.id 
  FROM "classes_schedules" cs 
  WHERE cs."classId" = a."classId" 
  ORDER BY cs.id ASC
  LIMIT 1
);

-- AlterColumn to NOT NULL
ALTER TABLE "attendances" ALTER COLUMN "classScheduleId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_classScheduleId_fkey" FOREIGN KEY ("classScheduleId") REFERENCES "classes_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex
DROP INDEX IF EXISTS "attendances_studentId_classId_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "attendances_studentId_classScheduleId_date_key" ON "attendances"("studentId", "classScheduleId", "date");
