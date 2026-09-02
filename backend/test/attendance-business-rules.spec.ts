import { Test, TestingModule } from "@nestjs/testing";
import { AttendanceService } from "../src/attendance/attendance.service";
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

describe("AttendanceService — Core Business Rules & Semaphore Engine (Milestone 2)", () => {
  let service: AttendanceService;
  let prisma: {
    attendance: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    studentProfile: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    classSchedule: {
      findUnique: jest.Mock;
    };
    semester: {
      findFirst: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    alert: {
      create: jest.Mock;
    };
    notification: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notificationRouter: {
    dispatch: jest.Mock;
  };
  let qrService: {
    validateQrToken: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      attendance: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
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
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === "function") {
          return cb(prisma);
        }
        return cb;
      }),
    };

    notificationRouter = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    qrService = {
      validateQrToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationRouterService, useValue: notificationRouter },
        { provide: QrService, useValue: qrService },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("1. 3 LATE = 1 ABSENT Penalty Formula", () => {
    it("should calculate 0 effective absences for 0, 1, or 2 LATE records", () => {
      // 0 LATE
      const res0 = service.calculateAttendanceMetrics([
        ...Array(10).fill({ status: AttendanceStatus.PRESENT }),
      ]);
      expect(res0.effectiveAbsences).toBe(0);
      expect(res0.attendanceRate).toBe(100.0);
      expect(res0.semaphore).toBe(SemaphoreStatus.GREEN);

      // 1 LATE
      const res1 = service.calculateAttendanceMetrics([
        ...Array(9).fill({ status: AttendanceStatus.PRESENT }),
        { status: AttendanceStatus.LATE },
      ]);
      expect(res1.effectiveAbsences).toBe(0);
      expect(res1.late).toBe(1);
      expect(res1.attendanceRate).toBe(100.0);
      expect(res1.semaphore).toBe(SemaphoreStatus.GREEN);

      // 2 LATE
      const res2 = service.calculateAttendanceMetrics([
        ...Array(8).fill({ status: AttendanceStatus.PRESENT }),
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.LATE },
      ]);
      expect(res2.effectiveAbsences).toBe(0);
      expect(res2.late).toBe(2);
      expect(res2.attendanceRate).toBe(100.0);
      expect(res2.semaphore).toBe(SemaphoreStatus.GREEN);
    });

    it("should convert exactly 3 LATE into 1 effective absence (floor division)", () => {
      const res3 = service.calculateAttendanceMetrics([
        ...Array(7).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(3).fill({ status: AttendanceStatus.LATE }),
      ]);
      expect(res3.late).toBe(3);
      expect(res3.absences).toBe(0);
      expect(res3.effectiveAbsences).toBe(1);
      expect(res3.totalClasses).toBe(10);
      expect(res3.attendanceRate).toBe(90.0);
      expect(res3.semaphore).toBe(SemaphoreStatus.GREEN);
    });

    it("should maintain 1 effective absence for 4 and 5 LATE records", () => {
      const res4 = service.calculateAttendanceMetrics([
        ...Array(6).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(4).fill({ status: AttendanceStatus.LATE }),
      ]);
      expect(res4.effectiveAbsences).toBe(1);
      expect(res4.attendanceRate).toBe(90.0);

      const res5 = service.calculateAttendanceMetrics([
        ...Array(5).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(5).fill({ status: AttendanceStatus.LATE }),
      ]);
      expect(res5.effectiveAbsences).toBe(1);
      expect(res5.attendanceRate).toBe(90.0);
    });

    it("should convert 6 LATE into 2 effective absences", () => {
      const res6 = service.calculateAttendanceMetrics([
        ...Array(4).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(6).fill({ status: AttendanceStatus.LATE }),
      ]);
      expect(res6.effectiveAbsences).toBe(2);
      expect(res6.attendanceRate).toBe(80.0);
      expect(res6.semaphore).toBe(SemaphoreStatus.YELLOW);
    });

    it("should convert 9 LATE into 3 effective absences triggering RED semaphore", () => {
      const res9 = service.calculateAttendanceMetrics([
        { status: AttendanceStatus.PRESENT },
        ...Array(9).fill({ status: AttendanceStatus.LATE }),
      ]);
      expect(res9.effectiveAbsences).toBe(3);
      expect(res9.attendanceRate).toBe(70.0);
      expect(res9.semaphore).toBe(SemaphoreStatus.RED);
    });

    it("should combine raw ABSENT with LATE penalties correctly (2 ABSENT + 4 LATE = 3 effective)", () => {
      const mixed = service.calculateAttendanceMetrics([
        ...Array(4).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(2).fill({ status: AttendanceStatus.ABSENT }),
        ...Array(4).fill({ status: AttendanceStatus.LATE }),
      ]);
      expect(mixed.absences).toBe(2);
      expect(mixed.late).toBe(4);
      expect(mixed.effectiveAbsences).toBe(3);
      expect(mixed.totalClasses).toBe(10);
      expect(mixed.attendanceRate).toBe(70.0);
      expect(mixed.semaphore).toBe(SemaphoreStatus.RED);
    });
  });

  describe("2. JUSTIFIED Non-Penalty Behavior", () => {
    it("should exclude JUSTIFIED from denominator preserving 100% rate with clean record", () => {
      const res = service.calculateAttendanceMetrics([
        ...Array(9).fill({ status: AttendanceStatus.PRESENT }),
        { status: AttendanceStatus.JUSTIFIED },
      ]);
      expect(res.totalClasses).toBe(10);
      expect(res.justified).toBe(1);
      expect(res.effectiveAbsences).toBe(0);
      expect(res.attendanceRate).toBe(100.0);
      expect(res.semaphore).toBe(SemaphoreStatus.GREEN);
    });

    it("should not penalize attendance percentage with multiple JUSTIFIED and 1 ABSENT", () => {
      // 7 PRESENT, 2 JUSTIFIED, 1 ABSENT -> evaluable = 8, effectiveAbsences = 1 -> rate = 7/8 = 87.5%
      const res = service.calculateAttendanceMetrics([
        ...Array(7).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(2).fill({ status: AttendanceStatus.JUSTIFIED }),
        { status: AttendanceStatus.ABSENT },
      ]);
      expect(res.totalClasses).toBe(10);
      expect(res.justified).toBe(2);
      expect(res.absences).toBe(1);
      expect(res.effectiveAbsences).toBe(1);
      expect(res.attendanceRate).toBe(87.5);
      expect(res.semaphore).toBe(SemaphoreStatus.GREEN);
    });

    it("should prevent false RED threshold when absences are JUSTIFIED", () => {
      // 6 PRESENT, 2 ABSENT, 2 JUSTIFIED -> total = 10, evaluable = 8, effectiveAbsences = 2 (NOT 4) -> rate = 75% -> YELLOW
      const res = service.calculateAttendanceMetrics([
        ...Array(6).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(2).fill({ status: AttendanceStatus.ABSENT }),
        ...Array(2).fill({ status: AttendanceStatus.JUSTIFIED }),
      ]);
      expect(res.effectiveAbsences).toBe(2);
      expect(res.attendanceRate).toBe(75.0);
      expect(res.semaphore).toBe(SemaphoreStatus.YELLOW);
    });

    it("should return 100.0% rate and GREEN semaphore when all classes are JUSTIFIED", () => {
      const res = service.calculateAttendanceMetrics([
        ...Array(5).fill({ status: AttendanceStatus.JUSTIFIED }),
      ]);
      expect(res.totalClasses).toBe(5);
      expect(res.justified).toBe(5);
      expect(res.effectiveAbsences).toBe(0);
      expect(res.attendanceRate).toBe(100.0);
      expect(res.semaphore).toBe(SemaphoreStatus.GREEN);
    });
  });

  describe("3. Numeric attendanceRate Precision & Float Types", () => {
    it("should return attendanceRate as a float number rounded to 2 decimal places", () => {
      // 6 PRESENT, 1 ABSENT -> 6/7 * 100 = 85.7142857... -> 85.71
      const res = service.calculateAttendanceMetrics([
        ...Array(6).fill({ status: AttendanceStatus.PRESENT }),
        { status: AttendanceStatus.ABSENT },
      ]);
      expect(typeof res.attendanceRate).toBe("number");
      expect(Number.isNaN(res.attendanceRate)).toBe(false);
      expect(res.attendanceRate).toBe(85.71);
    });

    it("should handle 0 total classes gracefully with 100.0% clean baseline", () => {
      const res = service.calculateAttendanceMetrics([]);
      expect(typeof res.attendanceRate).toBe("number");
      expect(res.attendanceRate).toBe(100.0);
      expect(res.totalClasses).toBe(0);
      expect(res.effectiveAbsences).toBe(0);
      expect(res.semaphore).toBe(SemaphoreStatus.GREEN);
    });
  });

  describe("4. Semaphore State Transitions & Thresholds", () => {
    it("should classify 0-1 absence and >= 80% rate as GREEN", () => {
      const res0 = service.calculateAttendanceMetrics([
        ...Array(10).fill({ status: AttendanceStatus.PRESENT }),
      ]);
      expect(res0.semaphore).toBe(SemaphoreStatus.GREEN);

      const res1 = service.calculateAttendanceMetrics([
        ...Array(9).fill({ status: AttendanceStatus.PRESENT }),
        { status: AttendanceStatus.ABSENT },
      ]);
      expect(res1.attendanceRate).toBe(90.0);
      expect(res1.semaphore).toBe(SemaphoreStatus.GREEN);
    });

    it("should classify 2 absences or < 80% rate as YELLOW", () => {
      // Case 1: 2 absences with 80% rate
      const res2Abs = service.calculateAttendanceMetrics([
        ...Array(8).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(2).fill({ status: AttendanceStatus.ABSENT }),
      ]);
      expect(res2Abs.effectiveAbsences).toBe(2);
      expect(res2Abs.attendanceRate).toBe(80.0);
      expect(res2Abs.semaphore).toBe(SemaphoreStatus.YELLOW);

      // Case 2: 1 absence with low total classes (3 PRESENT, 1 ABSENT -> 75%)
      const resLowRate = service.calculateAttendanceMetrics([
        ...Array(3).fill({ status: AttendanceStatus.PRESENT }),
        { status: AttendanceStatus.ABSENT },
      ]);
      expect(resLowRate.effectiveAbsences).toBe(1);
      expect(resLowRate.attendanceRate).toBe(75.0);
      expect(resLowRate.semaphore).toBe(SemaphoreStatus.YELLOW);
    });

    it("should classify >= 3 effective absences as RED regardless of percentage", () => {
      const res3Abs = service.calculateAttendanceMetrics([
        ...Array(17).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(3).fill({ status: AttendanceStatus.ABSENT }),
      ]);
      expect(res3Abs.effectiveAbsences).toBe(3);
      expect(res3Abs.attendanceRate).toBe(85.0);
      expect(res3Abs.semaphore).toBe(SemaphoreStatus.RED);
    });
  });

  describe("5. Dynamic Semaphore Recalculation Engine (Escalation & Healing)", () => {
    const mockStudent = {
      id: 101,
      userId: 501,
      semaphore: SemaphoreStatus.GREEN,
      user: { id: 501, firstName: "Carlos", lastName: "García" },
      group: { id: 1, name: "6-A" },
      parent: {
        phone: "555-1234",
        user: { id: 601, email: "padre@ejemplo.com", firstName: "Pedro", lastName: "García" },
      },
    };

    const mockAdmin = {
      id: 999,
      email: "admin@cbtis61.edu.mx",
      role: UserRole.ADMIN,
      isActive: true,
    };

    it("should escalate GREEN -> RED, update profile, create critical Alert and dispatch notification", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(mockStudent);
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2026-2027A",
        startDate: new Date("2026-08-01"),
        finishDate: new Date("2026-12-15"),
      });
      // 3 ABSENT, 7 PRESENT -> effectiveAbsences = 3 -> RED
      prisma.attendance.findMany.mockResolvedValue([
        ...Array(7).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(3).fill({ status: AttendanceStatus.ABSENT }),
      ]);
      prisma.studentProfile.update.mockResolvedValue({
        ...mockStudent,
        semaphore: SemaphoreStatus.RED,
      });
      prisma.alert.create.mockResolvedValue({
        id: 77,
        studentId: 101,
        type: AlertType.ATTENDANCE,
        priority: AlertPriority.CRITICAL,
      });
      prisma.user.findMany.mockResolvedValue([mockAdmin]);

      const result = await service.recalculateStudentSemaphore(101, undefined, 42);

      expect(result).toBe(SemaphoreStatus.RED);
      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { semaphore: SemaphoreStatus.RED },
      });
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentId: 101,
          type: AlertType.ATTENDANCE,
          priority: AlertPriority.CRITICAL,
        }),
      });
      expect(notificationRouter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: 42,
          recipients: expect.arrayContaining([
            expect.objectContaining({ userId: 601, email: "padre@ejemplo.com" }),
            expect.objectContaining({ userId: 999, email: "admin@cbtis61.edu.mx" }),
          ]),
        }),
      );
    });

    it("should heal RED -> YELLOW when absence is justified (de-escalation)", async () => {
      const redStudent = {
        ...mockStudent,
        semaphore: SemaphoreStatus.RED,
      };
      prisma.studentProfile.findUnique.mockResolvedValue(redStudent);
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2026-2027A",
        startDate: new Date("2026-08-01"),
        finishDate: new Date("2026-12-15"),
      });
      // 1 ABSENT was justified -> now 2 ABSENT, 1 JUSTIFIED, 7 PRESENT
      prisma.attendance.findMany.mockResolvedValue([
        ...Array(7).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(2).fill({ status: AttendanceStatus.ABSENT }),
        { status: AttendanceStatus.JUSTIFIED },
      ]);
      prisma.studentProfile.update.mockResolvedValue({
        ...redStudent,
        semaphore: SemaphoreStatus.YELLOW,
      });

      const result = await service.recalculateStudentSemaphore(101);

      expect(result).toBe(SemaphoreStatus.YELLOW);
      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { semaphore: SemaphoreStatus.YELLOW },
      });
      // Should NOT create new critical alert on de-escalation
      expect(prisma.alert.create).not.toHaveBeenCalled();
      expect(notificationRouter.dispatch).not.toHaveBeenCalled();
    });

    it("should heal YELLOW -> GREEN when absence is justified (de-escalation)", async () => {
      const yellowStudent = {
        ...mockStudent,
        semaphore: SemaphoreStatus.YELLOW,
      };
      prisma.studentProfile.findUnique.mockResolvedValue(yellowStudent);
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2026-2027A",
        startDate: new Date("2026-08-01"),
        finishDate: new Date("2026-12-15"),
      });
      // Now 0 ABSENT, 2 JUSTIFIED, 8 PRESENT
      prisma.attendance.findMany.mockResolvedValue([
        ...Array(8).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(2).fill({ status: AttendanceStatus.JUSTIFIED }),
      ]);
      prisma.studentProfile.update.mockResolvedValue({
        ...yellowStudent,
        semaphore: SemaphoreStatus.GREEN,
      });

      const result = await service.recalculateStudentSemaphore(101);

      expect(result).toBe(SemaphoreStatus.GREEN);
      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { semaphore: SemaphoreStatus.GREEN },
      });
      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it("should suppress duplicate critical alert if student is already RED", async () => {
      const redStudent = {
        ...mockStudent,
        semaphore: SemaphoreStatus.RED,
      };
      prisma.studentProfile.findUnique.mockResolvedValue(redStudent);
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2026-2027A",
        startDate: new Date("2026-08-01"),
        finishDate: new Date("2026-12-15"),
      });
      // 4 ABSENT, 6 PRESENT -> effectiveAbsences = 4 -> still RED
      prisma.attendance.findMany.mockResolvedValue([
        ...Array(6).fill({ status: AttendanceStatus.PRESENT }),
        ...Array(4).fill({ status: AttendanceStatus.ABSENT }),
      ]);

      const result = await service.recalculateStudentSemaphore(101);

      expect(result).toBe(SemaphoreStatus.RED);
      // No status change -> no profile update, no duplicate alert
      expect(prisma.studentProfile.update).not.toHaveBeenCalled();
      expect(prisma.alert.create).not.toHaveBeenCalled();
      expect(notificationRouter.dispatch).not.toHaveBeenCalled();
    });

    it("should resolve dynamic admin sender when no senderId is provided", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(mockStudent);
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2026-2027A",
        startDate: new Date("2026-08-01"),
        finishDate: new Date("2026-12-15"),
      });
      prisma.attendance.findMany.mockResolvedValue([
        ...Array(3).fill({ status: AttendanceStatus.ABSENT }),
      ]);
      prisma.studentProfile.update.mockResolvedValue({
        ...mockStudent,
        semaphore: SemaphoreStatus.RED,
      });
      prisma.alert.create.mockResolvedValue({ id: 1, studentId: 101 });
      prisma.user.findMany.mockResolvedValue([mockAdmin]);
      prisma.user.findFirst.mockResolvedValue(mockAdmin);

      await service.recalculateStudentSemaphore(101); // No senderId passed

      expect(notificationRouter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: 999, // Dynamic admin ID resolved
        }),
      );
    });
  });

  describe("6. Active Semester Date Boundaries & Cutoff", () => {
    it("should filter attendances strictly between active semester startDate and todayEnd", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 101 });
      const semesterStart = new Date("2026-08-01T00:00:00Z");
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2026-2027A",
        startDate: semesterStart,
        finishDate: new Date("2026-12-15T23:59:59Z"),
      });
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
      ]);

      const stats = await service.getStudentAbsenceCount(101);

      expect(prisma.attendance.findMany).toHaveBeenCalledWith({
        where: {
          studentId: 101,
          date: {
            gte: semesterStart,
            lte: expect.any(Date),
          },
        },
        select: { status: true },
      });

      expect(stats.evaluatedPeriod.semesterId).toBe(1);
      expect(stats.evaluatedPeriod.semesterName).toBe("2026-2027A");
      expect(stats.evaluatedPeriod.startDate).toEqual(semesterStart);
      expect(stats.evaluatedPeriod.evaluatedUntil).toBeInstanceOf(Date);
    });

    it("should fallback to latest semester by finishDate desc if no currently active date range exists", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 101 });
      // First findFirst (active date range) returns null, second findFirst (fallback) returns latest semester
      prisma.semester.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 9,
          semesterName: "2025-2026B",
          startDate: new Date("2026-01-15"),
          finishDate: new Date("2026-06-30"),
        });
      prisma.attendance.findMany.mockResolvedValue([]);

      const stats = await service.getStudentAbsenceCount(101);

      expect(stats.evaluatedPeriod.semesterId).toBe(9);
      expect(stats.evaluatedPeriod.semesterName).toBe("2025-2026B");
    });

    it("should throw NotFoundException if student profile does not exist", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);

      await expect(service.getStudentAbsenceCount(9999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("7. Security Checks & 403 ForbiddenException", () => {
    it("should throw ForbiddenException in scanQr when teacher does not match class assignment", async () => {
      qrService.validateQrToken.mockResolvedValue({
        valid: true,
        studentId: 101,
      });

      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 101,
        groupId: 1,
        user: { firstName: "Juan", lastName: "López" },
        group: { name: "6-A" },
      });

      const { currentDay } = service.getMexicoCityTimeInfo(new Date());

      prisma.classSchedule.findUnique.mockResolvedValue({
        id: 200,
        dayOfWeek: currentDay,
        startTime: "00:00",
        endTime: "23:59",
        class: {
          id: 50,
          teacherId: 10, // Assigned to teacher 10
          groupId: 1,
          group: { name: "6-A" },
          teacher: { user: { id: 110, firstName: "Docente", lastName: "A" } },
        },
      });

      // Teacher 99 attempts to scan
      await expect(
        service.scanQr({ qrToken: "dummy-token", classScheduleId: 200 }, 99),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException in markAbsent when teacher does not match class assignment", async () => {
      const { currentDay } = service.getMexicoCityTimeInfo(new Date());

      prisma.classSchedule.findUnique.mockResolvedValue({
        id: 200,
        dayOfWeek: currentDay,
        class: {
          id: 50,
          teacherId: 10, // Assigned to teacher 10
          groupId: 1,
          group: { name: "6-A" },
        },
      });

      // Teacher 99 attempts to mark absent
      await expect(service.markAbsent(101, 200, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw ForbiddenException in markPresentManual when teacher does not match class assignment", async () => {
      const { currentDay } = service.getMexicoCityTimeInfo(new Date());

      prisma.user.findUnique.mockResolvedValue({
        id: 50,
        password: "$2a$10$hashedpassword",
      });

      prisma.classSchedule.findUnique.mockResolvedValue({
        id: 200,
        dayOfWeek: currentDay,
        class: {
          id: 50,
          teacherId: 10, // Assigned to teacher 10
          groupId: 1,
        },
      });

      // Mock bcrypt compare to succeed
      const bcrypt = require("bcryptjs");
      jest.spyOn(bcrypt, "compare").mockResolvedValue(true as never);

      await expect(
        service.markPresentManual(
          { studentId: 101, classScheduleId: 200, password: "password" },
          50,
          UserRole.TEACHER,
          99, // Teacher 99 attempts manual attendance
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should enforce role-based student access in verifyStudentAccess", async () => {
      // 1. ADMIN - allowed
      const adminUser: IAuthenticatedUser = {
        id: 1,
        email: "admin@cbtis61.edu.mx",
        firstName: "Admin",
        lastName: "User",
        role: UserRole.ADMIN,
        isActive: true,
      };
      await expect(service.verifyStudentAccess(adminUser, 101)).resolves.toBeUndefined();

      // 2. TEACHER - allowed
      const teacherUser: IAuthenticatedUser = {
        id: 2,
        email: "teacher@cbtis61.edu.mx",
        firstName: "Teacher",
        lastName: "User",
        role: UserRole.TEACHER,
        isActive: true,
      };
      await expect(service.verifyStudentAccess(teacherUser, 101)).resolves.toBeUndefined();

      // 3. STUDENT accessing own profile - allowed
      const studentOwnUser: IAuthenticatedUser = {
        id: 3,
        email: "student@cbtis61.edu.mx",
        firstName: "Student",
        lastName: "User",
        role: UserRole.STUDENT,
        isActive: true,
        studentProfile: {
          id: 101,
          userId: 3,
          enrollmentId: "ENR101",
          groupId: 1,
          parentId: 201,
        },
      };
      await expect(service.verifyStudentAccess(studentOwnUser, 101)).resolves.toBeUndefined();

      // 4. STUDENT accessing different profile - ForbiddenException
      await expect(service.verifyStudentAccess(studentOwnUser, 999)).rejects.toThrow(
        ForbiddenException,
      );

      // 5. PARENT accessing their child - allowed
      const parentUser: IAuthenticatedUser = {
        id: 4,
        email: "parent@cbtis61.edu.mx",
        firstName: "Parent",
        lastName: "User",
        role: UserRole.PARENT,
        isActive: true,
        parentProfile: {
          id: 201,
          userId: 4,
          phone: "555-4321",
        },
      };
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 101, parentId: 201 });
      await expect(service.verifyStudentAccess(parentUser, 101)).resolves.toBeUndefined();

      // 6. PARENT accessing non-child - ForbiddenException
      prisma.studentProfile.findFirst.mockResolvedValue(null);
      await expect(service.verifyStudentAccess(parentUser, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("8. Reset Semaphore", () => {
    it("should reset semaphore to GREEN for existing student", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 101,
        semaphore: SemaphoreStatus.RED,
      });
      prisma.studentProfile.update.mockResolvedValue({
        id: 101,
        semaphore: SemaphoreStatus.GREEN,
      });

      const result = await service.resetSemaphore(101);

      expect(result.success).toBe(true);
      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { semaphore: SemaphoreStatus.GREEN },
      });
    });

    it("should throw NotFoundException when resetting non-existent student", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);

      await expect(service.resetSemaphore(9999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
