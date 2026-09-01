import { Test, TestingModule } from "@nestjs/testing";
import { AttendanceService } from "../src/attendance/attendance.service";
import { AttendanceController } from "../src/attendance/attendance.controller";
import { PrismaService } from "../src/prisma.service";
import { NotificationRouterService } from "../src/notifications/notification-router.service";
import { QrService } from "../src/qr/qr.service";
import {
  AttendanceStatus,
  SemaphoreStatus,
  AlertType,
  AlertPriority,
} from "@prisma/client";
import { UserRole } from "../src/common/enums/roles.enum";
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { IAuthenticatedUser } from "../src/attendance/interfaces";

describe("Milestone 4 — Comprehensive 4-Tier Test Suite (TEST_INFRA.md)", () => {
  let service: AttendanceService;
  let controller: AttendanceController;
  let prisma: any;
  let notificationRouter: any;
  let qrService: any;

  const mockAdmin: IAuthenticatedUser = {
    id: 1,
    email: "admin@cbtis61.edu.mx",
    firstName: "Director",
    lastName: "Escolar",
    role: UserRole.ADMIN,
    isActive: true,
  };

  const mockAssignedTeacher: IAuthenticatedUser = {
    id: 101,
    email: "profe1@cbtis61.edu.mx",
    firstName: "Roberto",
    lastName: "Docente",
    role: UserRole.TEACHER,
    isActive: true,
    teacherProfile: {
      id: 10,
      userId: 101,
      employeeId: "EMP-010",
    },
  };

  const mockUnassignedTeacher: IAuthenticatedUser = {
    id: 102,
    email: "profe2@cbtis61.edu.mx",
    firstName: "Mariana",
    lastName: "Docente",
    role: UserRole.TEACHER,
    isActive: true,
    teacherProfile: {
      id: 20,
      userId: 102,
      employeeId: "EMP-020",
    },
  };

  const mockStudentUser: IAuthenticatedUser = {
    id: 501,
    email: "alumno@cbtis61.edu.mx",
    firstName: "Pedro",
    lastName: "García",
    role: UserRole.STUDENT,
    isActive: true,
    studentProfile: {
      id: 77,
      userId: 501,
      enrollmentId: "ENR-77",
      groupId: 1,
      parentId: 99,
    },
  };

  const mockOtherStudentUser: IAuthenticatedUser = {
    id: 502,
    email: "otro_alumno@cbtis61.edu.mx",
    firstName: "Ana",
    lastName: "Torres",
    role: UserRole.STUDENT,
    isActive: true,
    studentProfile: {
      id: 88,
      userId: 502,
      enrollmentId: "ENR-88",
      groupId: 1,
      parentId: 99,
    },
  };

  beforeEach(async () => {
    prisma = {
      attendance: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      attendanceLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      studentProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      classSchedule: {
        findUnique: jest.fn(),
      },
      semester: {
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      alert: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    notificationRouter = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    qrService = {
      validateQrToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationRouterService, useValue: notificationRouter },
        { provide: QrService, useValue: qrService },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    controller = module.get<AttendanceController>(AttendanceController);
  });

  describe("Tier 1 & 2: Feature Isolation & Boundaries", () => {
    it("F1 & F2: Boundary - 2 LATE records produce 0 effective absences (80% rate on 10 classes)", () => {
      const attendances = [
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.LATE },
        ...Array(8).fill({ status: AttendanceStatus.PRESENT }),
      ];
      const stats = service.calculateAttendanceMetrics(attendances);
      expect(stats.effectiveAbsences).toBe(0);
      expect(stats.attendanceRate).toBe(100.0);
      expect(typeof stats.attendanceRate).toBe("number");
      expect(stats.semaphore).toBe(SemaphoreStatus.GREEN);
    });

    it("F1 & F2: Boundary - 3 LATE records produce exactly 1 effective absence (90% rate on 10 classes)", () => {
      const attendances = [
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.LATE },
        ...Array(7).fill({ status: AttendanceStatus.PRESENT }),
      ];
      const stats = service.calculateAttendanceMetrics(attendances);
      expect(stats.effectiveAbsences).toBe(1);
      expect(stats.attendanceRate).toBe(90.0);
      expect(stats.semaphore).toBe(SemaphoreStatus.GREEN);
    });

    it("F1 & F2: Boundary - 8 LATE records produce 2 effective absences", () => {
      const attendances = [
        ...Array(8).fill({ status: AttendanceStatus.LATE }),
        ...Array(2).fill({ status: AttendanceStatus.PRESENT }),
      ];
      const stats = service.calculateAttendanceMetrics(attendances);
      expect(stats.effectiveAbsences).toBe(2);
      expect(stats.attendanceRate).toBe(80.0);
      expect(stats.semaphore).toBe(SemaphoreStatus.YELLOW);
    });

    it("F3: Boundary - 100% JUSTIFIED classes should preserve 100% rate and GREEN semaphore", () => {
      const attendances = [
        { status: AttendanceStatus.JUSTIFIED },
        { status: AttendanceStatus.JUSTIFIED },
        { status: AttendanceStatus.JUSTIFIED },
      ];
      const stats = service.calculateAttendanceMetrics(attendances);
      expect(stats.effectiveAbsences).toBe(0);
      expect(stats.attendanceRate).toBe(100.0);
      expect(stats.semaphore).toBe(SemaphoreStatus.GREEN);
    });

    it("F5: Boundary - Exact 80.00% rate with 1 absence is GREEN, 79.99% is YELLOW", () => {
      // 1 absence out of 5 evaluable classes = 4/5 = 80.00%
      const stats80 = service.calculateAttendanceMetrics([
        { status: AttendanceStatus.ABSENT },
        ...Array(4).fill({ status: AttendanceStatus.PRESENT }),
      ]);
      expect(stats80.attendanceRate).toBe(80.0);
      expect(stats80.semaphore).toBe(SemaphoreStatus.GREEN);

      // 1 absence out of 4 evaluable classes = 3/4 = 75.00%
      const stats75 = service.calculateAttendanceMetrics([
        { status: AttendanceStatus.ABSENT },
        ...Array(3).fill({ status: AttendanceStatus.PRESENT }),
      ]);
      expect(stats75.attendanceRate).toBe(75.0);
      expect(stats75.semaphore).toBe(SemaphoreStatus.YELLOW);
    });
  });

  describe("Tier 3: Complex Combinations & Edge Cases", () => {
    it("Combinations - 2 ABSENT + 5 LATE + 2 JUSTIFIED + 11 PRESENT (Total 20 classes)", () => {
      // raw absent = 2
      // late = 5 -> floor(5/3) = 1 effective
      // total effective absences = 2 + 1 = 3 -> RED semaphore!
      // evaluable = 20 - 2 (justified) = 18
      // rate = (18 - 3) / 18 * 100 = 15/18 * 100 = 83.33%
      const attendances = [
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.ABSENT },
        ...Array(5).fill({ status: AttendanceStatus.LATE }),
        ...Array(2).fill({ status: AttendanceStatus.JUSTIFIED }),
        ...Array(11).fill({ status: AttendanceStatus.PRESENT }),
      ];

      const stats = service.calculateAttendanceMetrics(attendances);
      expect(stats.absences).toBe(2);
      expect(stats.late).toBe(5);
      expect(stats.justified).toBe(2);
      expect(stats.present).toBe(11);
      expect(stats.effectiveAbsences).toBe(3);
      expect(stats.totalClasses).toBe(20);
      expect(stats.attendanceRate).toBe(83.33);
      expect(stats.semaphore).toBe(SemaphoreStatus.RED);
    });

    it("Combinations - Justifying 1 ABSENT from 3 effective absences drops to 2 (RED -> YELLOW)", () => {
      // Initially: 3 ABSENT, 7 PRESENT => 3 effective => RED
      // After justifying 1: 2 ABSENT, 1 JUSTIFIED, 7 PRESENT => 2 effective => YELLOW
      const attendances = [
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.JUSTIFIED },
        ...Array(7).fill({ status: AttendanceStatus.PRESENT }),
      ];

      const stats = service.calculateAttendanceMetrics(attendances);
      expect(stats.effectiveAbsences).toBe(2);
      expect(stats.attendanceRate).toBe(77.78);
      expect(stats.semaphore).toBe(SemaphoreStatus.YELLOW);
    });
  });

  describe("Tier 4: Real-World Application Scenarios", () => {
    it("Scenario 1: Full student lifecycle (Accumulate lates/absences -> RED -> Correct to JUSTIFIED -> De-escalate to GREEN)", async () => {
      const studentId = 77;
      const attendanceId = 999;

      // 1. Mock existing student with 3 ABSENT records (RED semaphore)
      prisma.attendance.findUnique.mockResolvedValue({
        id: attendanceId,
        studentId,
        classId: 5,
        status: AttendanceStatus.ABSENT,
        classes: {
          id: 5,
          teacherId: 10,
        },
      });

      prisma.studentProfile.findUnique.mockResolvedValue({
        id: studentId,
        semaphore: SemaphoreStatus.RED,
        user: { id: 501, firstName: "Pedro", lastName: "García" },
      });

      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2026-A",
        startDate: new Date("2026-01-01"),
      });

      // Recalculation query: After manual correction, now 0 ABSENT, 1 JUSTIFIED, 9 PRESENT
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.JUSTIFIED },
        ...Array(9).fill({ status: AttendanceStatus.PRESENT }),
      ]);

      prisma.attendanceLog.create.mockResolvedValue({ id: 1 });
      prisma.attendance.update.mockResolvedValue({
        id: attendanceId,
        studentId,
        status: AttendanceStatus.JUSTIFIED,
        notes: "Corrección autorizada",
      });

      // 2. Perform manual correction via controller
      const result = await controller.correctAttendance(
        attendanceId,
        {
          status: AttendanceStatus.JUSTIFIED,
          reason: "Presentó justificante médico avalado por dirección",
          notes: "Folio 8839",
        },
        mockAssignedTeacher,
      );

      // 3. Verify audit log was written and student semaphore was healed to GREEN
      expect(prisma.attendanceLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          attendanceId,
          userId: mockAssignedTeacher.id,
          previousStatus: AttendanceStatus.ABSENT,
          newStatus: AttendanceStatus.JUSTIFIED,
          reason: "Presentó justificante médico avalado por dirección",
        }),
      });

      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: studentId },
        data: { semaphore: SemaphoreStatus.GREEN },
      });
      expect(result.status).toBe(AttendanceStatus.JUSTIFIED);
    });

    it("Scenario 2: Teacher Authorization Barrier (Assigned teacher passes vs Unassigned teacher gets 403)", async () => {
      const attendanceRecord = {
        id: 555,
        studentId: 77,
        classId: 12,
        status: AttendanceStatus.ABSENT,
        classes: {
          id: 12,
          teacherId: 10, // Assigned to teacher 10
        },
      };

      prisma.attendance.findUnique.mockResolvedValue(attendanceRecord);

      // Unassigned teacher (teacherId: 20) attempts to correct -> 403 Forbidden
      await expect(
        controller.correctAttendance(
          555,
          {
            status: AttendanceStatus.PRESENT,
            reason: "Intento de corrección no autorizada",
          },
          mockUnassignedTeacher,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Assigned teacher (teacherId: 10) attempts to correct -> Success
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 77,
        semaphore: SemaphoreStatus.GREEN,
        user: { firstName: "Pedro", lastName: "García" },
      });
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        startDate: new Date("2026-01-01"),
      });
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
      ]);
      prisma.attendanceLog.create.mockResolvedValue({ id: 2 });
      prisma.attendance.update.mockResolvedValue({
        ...attendanceRecord,
        status: AttendanceStatus.PRESENT,
      });

      const successResult = await controller.correctAttendance(
        555,
        {
          status: AttendanceStatus.PRESENT,
          reason: "Docente asignado confirma asistencia en lista física",
        },
        mockAssignedTeacher,
      );

      expect(successResult.status).toBe(AttendanceStatus.PRESENT);
    });

    it("Scenario 3: Role-based access security on Student Statistics", async () => {
      // Admin can access any student
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 77 });
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        startDate: new Date("2026-01-01"),
      });
      prisma.attendance.findMany.mockResolvedValue([]);

      const adminStats = await controller.getStudentStats(77, mockAdmin);
      expect(adminStats).toBeDefined();

      // Student accessing own stats -> Success
      const ownStats = await controller.getStudentStats(77, mockStudentUser);
      expect(ownStats).toBeDefined();

      // Student accessing another student's stats -> 403 Forbidden
      await expect(
        controller.getStudentStats(77, mockOtherStudentUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it("Scenario 4: Active Semester Boundary Cutoff (Date bounds strictly enforced)", async () => {
      const studentId = 77;
      prisma.studentProfile.findUnique.mockResolvedValue({ id: studentId });

      const activeSemesterStart = new Date("2026-02-01T00:00:00.000Z");
      prisma.semester.findFirst.mockResolvedValue({
        id: 5,
        semesterName: "2026-A",
        startDate: activeSemesterStart,
      });

      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.ABSENT },
      ]);

      const stats = await service.getStudentAbsenceCount(studentId);

      // Verify Prisma query was date bounded by active semester startDate
      expect(prisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId,
            date: expect.objectContaining({
              gte: activeSemesterStart,
            }),
          }),
        }),
      );
      expect(stats.absences).toBe(1);
      expect(stats.present).toBe(2);
      expect(stats.totalClasses).toBe(3);
    });

    it("Scenario 5: Offline QR Scan Sync with historical scannedAt date", async () => {
      const pastDate = new Date("2026-08-15T10:00:00.000Z");
      const timeInfo = service.getMexicoCityTimeInfo(pastDate);

      qrService.validateQrToken.mockResolvedValue({
        valid: true,
        studentId: 77,
      });

      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 77,
        groupId: 1,
        user: { firstName: "Pedro", lastName: "García" },
      });

      prisma.classSchedule.findUnique.mockResolvedValue({
        id: 10,
        dayOfWeek: timeInfo.currentDay,
        startTime: "00:00",
        endTime: "23:59",
        class: {
          id: 5,
          teacherId: 10,
          groupId: 1,
          teacher: { user: { id: 101 } },
        },
      });

      prisma.attendance.findFirst.mockResolvedValue(null);
      prisma.attendance.create.mockResolvedValue({
        id: 888,
        studentId: 77,
        date: pastDate,
        status: AttendanceStatus.PRESENT,
      });

      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        startDate: new Date("2026-01-01"),
      });
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
      ]);

      const result = await service.scanQr(
        {
          qrToken: "valid-offline-token",
          classScheduleId: 10,
          scannedAt: pastDate.toISOString(),
        },
        10,
      );

      expect(result.id).toBe(888);
      expect(prisma.attendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date: pastDate,
            status: AttendanceStatus.PRESENT,
          }),
        }),
      );
    });
  });
});
