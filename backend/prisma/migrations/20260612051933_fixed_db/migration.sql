-- ==========================================
-- STEP 1: Schema Extension (Additive Changes)
-- ==========================================

-- CreateTable school_cycle
CREATE TABLE "school_cycle" (
    "id" SERIAL NOT NULL,
    "cycleName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "finishDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable semesters
CREATE TABLE "semesters" (
    "id" SERIAL NOT NULL,
    "semesterName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "finishDate" TIMESTAMP(3) NOT NULL,
    "schoolCycleId" INTEGER NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable classrooms
CREATE TABLE "classrooms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "description" TEXT,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable classes
CREATE TABLE "classes" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "semesterId" INTEGER NOT NULL,
    "classroomId" INTEGER,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable classes_schedules
CREATE TABLE "classes_schedules" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "classroomId" INTEGER,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "classes_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex classrooms_name_key
CREATE UNIQUE INDEX "classrooms_name_key" ON "classrooms"("name");

-- AddForeignKey semesters -> school_cycle
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_schoolCycleId_fkey" FOREIGN KEY ("schoolCycleId") REFERENCES "school_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey classes -> subjects
ALTER TABLE "classes" ADD CONSTRAINT "classes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey classes -> classrooms
ALTER TABLE "classes" ADD CONSTRAINT "classes_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey classes -> groups
ALTER TABLE "classes" ADD CONSTRAINT "classes_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey classes -> teacher_profiles
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey classes -> semesters
ALTER TABLE "classes" ADD CONSTRAINT "classes_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey classes_schedules -> classes
ALTER TABLE "classes_schedules" ADD CONSTRAINT "classes_schedules_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey classes_schedules -> classrooms
ALTER TABLE "classes_schedules" ADD CONSTRAINT "classes_schedules_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddColumn classId to attendances (Nullable)
ALTER TABLE "attendances" ADD COLUMN "classId" INTEGER;

-- AddForeignKey attendances -> classes
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ==========================================
-- STEP 2: Data Backfill
-- ==========================================

-- 1. Insert default SchoolCycle (if not exists)
INSERT INTO "school_cycle" ("cycleName", "startDate", "finishDate")
SELECT 'Ciclo Escolar Default', '2025-08-01 00:00:00'::timestamp, '2026-07-31 00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "school_cycle");

-- 2. Insert default Semester referencing the cycle (if not exists)
INSERT INTO "semesters" ("semesterName", "startDate", "finishDate", "schoolCycleId")
SELECT 'Semestre Default', '2025-08-18 00:00:00'::timestamp, '2026-01-23 00:00:00'::timestamp, "id"
FROM "school_cycle"
LIMIT 1
ON CONFLICT DO NOTHING;

-- 3. Populate Classrooms from unique classroom strings in schedules
INSERT INTO "classrooms" ("name")
SELECT DISTINCT "classroom"
FROM "schedules"
WHERE "classroom" IS NOT NULL AND "classroom" <> ''
ON CONFLICT ("name") DO NOTHING;

-- 4. Populate Classes from unique combinations of subjectId, groupId, teacherId in schedules
INSERT INTO "classes" ("subjectId", "groupId", "teacherId", "semesterId", "classroomId")
SELECT DISTINCT ON (s."subjectId", s."groupId", s."teacherId")
       s."subjectId", s."groupId", s."teacherId", sem.id, cr.id
FROM "schedules" s
CROSS JOIN (SELECT id FROM "semesters" LIMIT 1) sem
LEFT JOIN "classrooms" cr ON s."classroom" = cr."name"
ORDER BY s."subjectId", s."groupId", s."teacherId";

-- 5. Populate ClassSchedules from schedules
INSERT INTO "classes_schedules" ("classId", "classroomId", "dayOfWeek", "startTime", "endTime")
SELECT c.id, cr.id, s."dayOfWeek", s."startTime", s."endTime"
FROM "schedules" s
JOIN "classes" c ON s."subjectId" = c."subjectId" AND s."groupId" = c."groupId" AND s."teacherId" = c."teacherId"
LEFT JOIN "classrooms" cr ON s."classroom" = cr."name";

-- 6. Backfill classId in attendances from the mapped schedules
UPDATE "attendances" a
SET "classId" = c.id
FROM "schedules" s
JOIN "classes" c ON s."subjectId" = c."subjectId" AND s."groupId" = c."groupId" AND s."teacherId" = c."teacherId"
WHERE a."scheduleId" = s.id;

-- 7. Deduplicate any duplicate attendances that would violate the new unique constraint
DELETE FROM "attendances" a
WHERE a.id NOT IN (
  SELECT MIN(sub.id)
  FROM "attendances" sub
  GROUP BY sub."studentId", sub."classId", sub."date"
);


-- ==========================================
-- STEP 3: Schema Cleanup and Constraints
-- ==========================================

-- 1. Drop the old foreign key constraint
ALTER TABLE "attendances" DROP CONSTRAINT "attendances_scheduleId_fkey";

-- 2. Drop the old unique index
DROP INDEX IF EXISTS "attendances_studentId_scheduleId_date_key";

-- 3. Drop the old column
ALTER TABLE "attendances" DROP COLUMN "scheduleId";

-- 4. Drop the old schedules table
DROP TABLE "schedules";

-- 5. Drop the temporary nullable foreign key constraint on classId
ALTER TABLE "attendances" DROP CONSTRAINT "attendances_classId_fkey";

-- 6. Make classId NOT NULL
ALTER TABLE "attendances" ALTER COLUMN "classId" SET NOT NULL;

-- 7. Add the final RESTRICT foreign key constraint on classId
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Create the new unique index
CREATE UNIQUE INDEX "attendances_studentId_classId_date_key" ON "attendances"("studentId", "classId", "date");
