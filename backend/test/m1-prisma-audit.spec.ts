import * as fs from 'fs';
import * as path from 'path';
import {
  AttendanceStatus,
  SemaphoreStatus,
} from '@prisma/client';
import { UserRole } from '../src/common/enums/roles.enum';
import {
  IAttendanceLog,
  ICreateAttendanceLogData,
  IAuthenticatedUser,
  AttendanceWithDetails,
  IStudentAttendanceStats,
  IEvaluatedPeriod,
} from '../src/attendance/interfaces';

describe('Milestone 1 — Prisma Schema, DDL Migration & Seed Challenge Verification', () => {
  const rootDir = path.resolve(__dirname, '..');
  const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
  const migrationPath = path.join(
    rootDir,
    'prisma',
    'migrations',
    '20260901170000_add_attendance_log',
    'migration.sql',
  );
  const seedPath = path.join(rootDir, 'prisma', 'seed.ts');

  describe('1. Migration SQL DDL Verification', () => {
    let migrationSql: string;

    beforeAll(() => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      migrationSql = fs.readFileSync(migrationPath, 'utf8');
    });

    it('should define CREATE TABLE "attendance_logs" with correct table and column names', () => {
      expect(migrationSql).toMatch(/CREATE TABLE "attendance_logs"/);
      expect(migrationSql).toMatch(/"id"\s+SERIAL\s+NOT\s+NULL/);
      expect(migrationSql).toMatch(/"attendanceId"\s+INTEGER\s+NOT\s+NULL/);
      expect(migrationSql).toMatch(/"userId"\s+INTEGER\s+NOT\s+NULL/);
      expect(migrationSql).toMatch(/"previousStatus"\s+"AttendanceStatus"\s+NOT\s+NULL/);
      expect(migrationSql).toMatch(/"newStatus"\s+"AttendanceStatus"\s+NOT\s+NULL/);
      expect(migrationSql).toMatch(/"reason"\s+TEXT\s+NOT\s+NULL/);
      expect(migrationSql).toMatch(/"timestamp"\s+TIMESTAMP\(3\)\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP/);
      expect(migrationSql).toMatch(/CONSTRAINT "attendance_logs_pkey" PRIMARY KEY \("id"\)/);
    });

    it('should define indexes on attendanceId and userId with standard naming', () => {
      expect(migrationSql).toMatch(
        /CREATE INDEX "attendance_logs_attendanceId_idx" ON "attendance_logs"\("attendanceId"\);/,
      );
      expect(migrationSql).toMatch(
        /CREATE INDEX "attendance_logs_userId_idx" ON "attendance_logs"\("userId"\);/,
      );
    });

    it('should define foreign key to attendances(id) with ON DELETE CASCADE ON UPDATE CASCADE', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_attendanceId_fkey" FOREIGN KEY \("attendanceId"\) REFERENCES "attendances"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE;/,
      );
    });

    it('should define foreign key to users(id) with ON DELETE RESTRICT ON UPDATE CASCADE', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_userId_fkey" FOREIGN KEY \("userId"\) REFERENCES "users"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE;/,
      );
    });
  });

  describe('2. Prisma Schema Verification', () => {
    let schemaContent: string;

    beforeAll(() => {
      expect(fs.existsSync(schemaPath)).toBe(true);
      schemaContent = fs.readFileSync(schemaPath, 'utf8');
    });

    it('should define model AttendanceLog with correct mappings and relations', () => {
      expect(schemaContent).toMatch(/model AttendanceLog \{/);
      expect(schemaContent).toMatch(/id\s+Int\s+@id\s+@default\(autoincrement\(\)\)/);
      expect(schemaContent).toMatch(/attendanceId\s+Int/);
      expect(schemaContent).toMatch(/userId\s+Int/);
      expect(schemaContent).toMatch(/previousStatus\s+AttendanceStatus/);
      expect(schemaContent).toMatch(/newStatus\s+AttendanceStatus/);
      expect(schemaContent).toMatch(/reason\s+String/);
      expect(schemaContent).toMatch(/timestamp\s+DateTime\s+@default\(now\(\)\)/);
      expect(schemaContent).toMatch(
        /attendance\s+Attendance\s+@relation\(fields:\s*\[attendanceId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
      expect(schemaContent).toMatch(
        /user\s+User\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\]\)/,
      );
      expect(schemaContent).toMatch(/@@index\(\[attendanceId\]\)/);
      expect(schemaContent).toMatch(/@@index\(\[userId\]\)/);
      expect(schemaContent).toMatch(/@@map\("attendance_logs"\)/);
    });

    it('should define inverse relations on User and Attendance models', () => {
      expect(schemaContent).toMatch(/attendanceLogs\s+AttendanceLog\[\]/);
      expect(schemaContent).toMatch(/logs\s+AttendanceLog\[\]/);
    });
  });

  describe('3. Seed Script Cleanup & Reseed Safety', () => {
    let seedContent: string;

    beforeAll(() => {
      expect(fs.existsSync(seedPath)).toBe(true);
      seedContent = fs.readFileSync(seedPath, 'utf8');
    });

    it('should delete attendanceLog before parent attendance and user records', () => {
      const attendanceLogDeleteIdx = seedContent.indexOf('tx.attendanceLog.deleteMany()');
      const attendanceDeleteIdx = seedContent.indexOf('tx.attendance.deleteMany()');
      const userDeleteIdx = seedContent.indexOf('tx.user.deleteMany()');

      expect(attendanceLogDeleteIdx).toBeGreaterThan(-1);
      expect(attendanceDeleteIdx).toBeGreaterThan(-1);
      expect(userDeleteIdx).toBeGreaterThan(-1);

      expect(attendanceLogDeleteIdx).toBeLessThan(attendanceDeleteIdx);
      expect(attendanceLogDeleteIdx).toBeLessThan(userDeleteIdx);
    });

    it('should reset sequence for attendance_logs_id_seq', () => {
      expect(seedContent).toMatch(
        /ALTER SEQUENCE IF EXISTS attendance_logs_id_seq RESTART WITH 1;/,
      );
    });

    it('should reset sequences for all 20 schema models with autoincrement PKs', () => {
      const expectedSequences = [
        'users_id_seq',
        'admin_profiles_id_seq',
        'teacher_profiles_id_seq',
        'student_profiles_id_seq',
        'parent_profiles_id_seq',
        'groups_id_seq',
        'subjects_id_seq',
        'school_cycle_id_seq',
        'semesters_id_seq',
        'attendances_id_seq',
        'attendance_logs_id_seq',
        'grades_id_seq',
        'grade_logs_id_seq',
        'alerts_id_seq',
        'notifications_id_seq',
        'classes_id_seq',
        'classrooms_id_seq',
        'classes_schedules_id_seq',
        'push_subscriptions_id_seq',
        'notification_preferences_id_seq',
      ];

      for (const seq of expectedSequences) {
        expect(seedContent).toContain(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1;`);
      }
    });
  });

  describe('4. TypeScript Interface Compatibility & Types', () => {
    it('should instantiate IAttendanceLog with strongly typed fields', () => {
      const sampleLog: IAttendanceLog = {
        id: 1,
        attendanceId: 10,
        userId: 2,
        previousStatus: AttendanceStatus.ABSENT,
        newStatus: AttendanceStatus.JUSTIFIED,
        reason: 'Valid medical excuse submitted',
        timestamp: new Date(),
      };

      expect(sampleLog.previousStatus).toBe(AttendanceStatus.ABSENT);
      expect(sampleLog.newStatus).toBe(AttendanceStatus.JUSTIFIED);
      expect(sampleLog.reason).toBe('Valid medical excuse submitted');
    });

    it('should instantiate ICreateAttendanceLogData correctly', () => {
      const createData: ICreateAttendanceLogData = {
        attendanceId: 5,
        userId: 3,
        previousStatus: AttendanceStatus.LATE,
        newStatus: AttendanceStatus.PRESENT,
        reason: 'Verified on-time arrival via CCTV',
      };

      expect(createData.attendanceId).toBe(5);
      expect(createData.newStatus).toBe(AttendanceStatus.PRESENT);
    });

    it('should instantiate IAuthenticatedUser correctly', () => {
      const authUser: IAuthenticatedUser = {
        id: 1,
        email: 'teacher@cbtis61.edu.mx',
        firstName: 'Juan',
        lastName: 'Pérez',
        role: UserRole.TEACHER,
        isActive: true,
        teacherProfile: {
          id: 1,
          userId: 1,
          employeeId: 'DOC-001',
          specialty: 'Matemáticas',
          phone: '555-0201',
        },
      };

      expect(authUser.role).toBe(UserRole.TEACHER);
      expect(authUser.teacherProfile?.employeeId).toBe('DOC-001');
    });

    it('should instantiate IStudentAttendanceStats with numeric rate', () => {
      const evaluatedPeriod: IEvaluatedPeriod = {
        semesterId: 1,
        semesterName: 'Semestre A',
        startDate: new Date('2025-08-18'),
        evaluatedUntil: new Date('2025-09-01'),
      };

      const stats: IStudentAttendanceStats = {
        absences: 1,
        present: 8,
        late: 2,
        justified: 1,
        effectiveAbsences: 1,
        totalClasses: 11,
        attendanceRate: 90.0,
        semaphore: SemaphoreStatus.GREEN,
        evaluatedPeriod,
      };

      expect(typeof stats.attendanceRate).toBe('number');
      expect(stats.attendanceRate).toBe(90.0);
      expect(stats.semaphore).toBe(SemaphoreStatus.GREEN);
    });

    it('should verify AttendanceWithDetails type structure', () => {
      const attendanceRecord: AttendanceWithDetails = {
        id: 100,
        studentId: 1,
        classId: 2,
        classScheduleId: 3,
        date: new Date(),
        status: AttendanceStatus.PRESENT,
        qrToken: null,
        notes: 'Normal attendance',
        createdAt: new Date(),
        logs: [
          {
            id: 1,
            attendanceId: 100,
            userId: 2,
            previousStatus: AttendanceStatus.ABSENT,
            newStatus: AttendanceStatus.PRESENT,
            reason: 'Correction by teacher',
            timestamp: new Date(),
          },
        ],
      };

      expect(attendanceRecord.logs).toBeDefined();
      expect(attendanceRecord.logs?.length).toBe(1);
      expect(attendanceRecord.logs?.[0].newStatus).toBe(AttendanceStatus.PRESENT);
    });
  });
});
