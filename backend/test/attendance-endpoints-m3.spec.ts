import { Test, TestingModule } from "@nestjs/testing";
import { AttendanceController } from "../src/attendance/attendance.controller";
import { AttendanceService } from "../src/attendance/attendance.service";
import { PrismaService } from "../src/prisma.service";
import { NotificationRouterService } from "../src/notifications/notification-router.service";
import { QrService } from "../src/qr/qr.service";
import { AttendanceStatus, SemaphoreStatus } from "@prisma/client";
import { UserRole } from "../src/common/enums/roles.enum";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { IAuthenticatedUser } from "../src/attendance/interfaces";
import {
  CreateAttendanceDto,
  CorrectAttendanceDto,
  ManualAttendanceDto,
  QrScanDto,
} from "../src/attendance/dto";

describe("Milestone 3 — Endpoints, DTOs, Manual Correction, Audit & Swagger", () => {
  let controller: AttendanceController;
  let service: AttendanceService;
  let prisma: {
    attendance: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    attendanceLog: {
      create: jest.Mock;
      findMany: jest.Mock;
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
    $transaction: jest.Mock;
  };

  const mockAdminUser: IAuthenticatedUser = {
    id: 1,
    email: "admin@cbtis61.edu.mx",
    firstName: "Admin",
    lastName: "Principal",
    role: UserRole.ADMIN,
    isActive: true,
  };

  const mockTeacherUser: IAuthenticatedUser = {
    id: 10,
    email: "profe@cbtis61.edu.mx",
    firstName: "Carlos",
    lastName: "Docente",
    role: UserRole.TEACHER,
    isActive: true,
    teacherProfile: {
      id: 5,
      userId: 10,
      employeeId: "EMP-005",
    },
  };

  const mockOtherTeacherUser: IAuthenticatedUser = {
    id: 20,
    email: "otro@cbtis61.edu.mx",
    firstName: "Laura",
    lastName: "Docente",
    role: UserRole.TEACHER,
    isActive: true,
    teacherProfile: {
      id: 99,
      userId: 20,
      employeeId: "EMP-099",
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationRouterService,
          useValue: { dispatch: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: QrService,
          useValue: { validateQrToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AttendanceController>(AttendanceController);
    service = module.get<AttendanceService>(AttendanceService);
  });

  describe("1. Manual Correction Endpoint (PATCH /attendance/:id/correction)", () => {
    it("should successfully correct an ABSENT record to JUSTIFIED with mandatory reason and create AttendanceLog", async () => {
      const existingAttendance = {
        id: 101,
        studentId: 42,
        classId: 7,
        classScheduleId: 3,
        status: AttendanceStatus.ABSENT,
        notes: "Falta previa",
        classes: {
          id: 7,
          teacherId: 5,
        },
      };

      prisma.attendance.findUnique.mockResolvedValue(existingAttendance);
      prisma.attendanceLog.create.mockResolvedValue({
        id: 1,
        attendanceId: 101,
        userId: mockTeacherUser.id,
        previousStatus: AttendanceStatus.ABSENT,
        newStatus: AttendanceStatus.JUSTIFIED,
        reason: "Justificante médico oficial presentado",
        timestamp: new Date(),
      });

      const updatedRecord = {
        ...existingAttendance,
        status: AttendanceStatus.JUSTIFIED,
        notes: "Falta previa | Corrección: Folio MED-99",
        logs: [
          {
            id: 1,
            userId: mockTeacherUser.id,
            previousStatus: AttendanceStatus.ABSENT,
            newStatus: AttendanceStatus.JUSTIFIED,
            reason: "Justificante médico oficial presentado",
          },
        ],
      };
      prisma.attendance.update.mockResolvedValue(updatedRecord);

      // Student mock for semaphore recalculation
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 42,
        semaphore: SemaphoreStatus.RED,
        user: { id: 100, firstName: "Juan", lastName: "Pérez" },
      });
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2026-A",
        startDate: new Date("2026-01-01"),
      });
      // After justification: 0 absences, 1 justified, 9 present
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.JUSTIFIED },
        ...Array(9).fill({ status: AttendanceStatus.PRESENT }),
      ]);
      prisma.studentProfile.update.mockResolvedValue({
        id: 42,
        semaphore: SemaphoreStatus.GREEN,
      });

      const dto: CorrectAttendanceDto = {
        status: AttendanceStatus.JUSTIFIED,
        reason: "Justificante médico oficial presentado",
        notes: "Folio MED-99",
      };

      const result = await controller.correctAttendance(101, dto, mockTeacherUser);

      expect(prisma.attendance.findUnique).toHaveBeenCalledWith({
        where: { id: 101 },
        include: { classes: { include: { teacher: true } } },
      });
      expect(prisma.attendanceLog.create).toHaveBeenCalledWith({
        data: {
          attendanceId: 101,
          userId: mockTeacherUser.id,
          previousStatus: AttendanceStatus.ABSENT,
          newStatus: AttendanceStatus.JUSTIFIED,
          reason: "Justificante médico oficial presentado",
        },
      });
      expect(prisma.attendance.update).toHaveBeenCalled();
      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { semaphore: SemaphoreStatus.GREEN },
      });
      expect(result.status).toBe(AttendanceStatus.JUSTIFIED);
    });

    it("should throw ForbiddenException (403) when a teacher tries to correct an attendance for another teacher's class", async () => {
      const existingAttendance = {
        id: 102,
        studentId: 42,
        classId: 7,
        status: AttendanceStatus.ABSENT,
        classes: {
          id: 7,
          teacherId: 5, // Assigned to teacher 5
        },
      };

      prisma.attendance.findUnique.mockResolvedValue(existingAttendance);

      const dto: CorrectAttendanceDto = {
        status: AttendanceStatus.PRESENT,
        reason: "Llegó a tiempo",
      };

      await expect(
        controller.correctAttendance(102, dto, mockOtherTeacherUser), // Teacher 99
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow ADMIN to correct attendance for any class", async () => {
      const existingAttendance = {
        id: 103,
        studentId: 42,
        classId: 7,
        status: AttendanceStatus.LATE,
        classes: {
          id: 7,
          teacherId: 5,
        },
      };

      prisma.attendance.findUnique.mockResolvedValue(existingAttendance);
      prisma.attendanceLog.create.mockResolvedValue({ id: 2 });
      prisma.attendance.update.mockResolvedValue({
        ...existingAttendance,
        status: AttendanceStatus.PRESENT,
      });
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 42,
        semaphore: SemaphoreStatus.GREEN,
        user: { id: 100, firstName: "Juan", lastName: "Pérez" },
      });
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        startDate: new Date("2026-01-01"),
      });
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
      ]);

      const dto: CorrectAttendanceDto = {
        status: AttendanceStatus.PRESENT,
        reason: "Aclaración por dirección escolar",
      };

      const result = await controller.correctAttendance(103, dto, mockAdminUser);
      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(prisma.attendanceLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockAdminUser.id,
          previousStatus: AttendanceStatus.LATE,
          newStatus: AttendanceStatus.PRESENT,
          reason: "Aclaración por dirección escolar",
        }),
      });
    });

    it("should throw NotFoundException (404) when attendance record does not exist", async () => {
      prisma.attendance.findUnique.mockResolvedValue(null);

      const dto: CorrectAttendanceDto = {
        status: AttendanceStatus.PRESENT,
        reason: "Algún motivo",
      };

      await expect(
        controller.correctAttendance(9999, dto, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("2. Create Attendance Endpoint (POST /attendance)", () => {
    it("should create attendance with classScheduleId and recalculate semaphore", async () => {
      const schedule = {
        id: 15,
        classId: 3,
        class: {
          id: 3,
          teacherId: 5,
        },
      };
      prisma.classSchedule.findUnique.mockResolvedValue(schedule);
      prisma.attendance.create.mockResolvedValue({
        id: 201,
        studentId: 42,
        classId: 3,
        classScheduleId: 15,
        status: AttendanceStatus.PRESENT,
        date: new Date(),
      });
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 42,
        semaphore: SemaphoreStatus.GREEN,
        user: { id: 100, firstName: "Juan", lastName: "Pérez" },
      });
      prisma.semester.findFirst.mockResolvedValue({
        id: 1,
        startDate: new Date("2026-01-01"),
      });
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
      ]);

      const dto: CreateAttendanceDto = {
        studentId: 42,
        classId: 3,
        classScheduleId: 15,
        status: AttendanceStatus.PRESENT,
        notes: "Registro directo",
      };

      const result = await controller.create(dto, mockTeacherUser);
      expect(result.id).toBe(201);
      expect(prisma.attendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            classScheduleId: 15,
            studentId: 42,
            status: AttendanceStatus.PRESENT,
          }),
        }),
      );
    });

    it("should throw ForbiddenException (403) when non-assigned teacher tries to create attendance", async () => {
      const schedule = {
        id: 15,
        classId: 3,
        class: {
          id: 3,
          teacherId: 5, // Assigned to teacher 5
        },
      };
      prisma.classSchedule.findUnique.mockResolvedValue(schedule);

      const dto: CreateAttendanceDto = {
        studentId: 42,
        classId: 3,
        classScheduleId: 15,
        status: AttendanceStatus.PRESENT,
      };

      await expect(
        controller.create(dto, mockOtherTeacherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException (404) when classSchedule does not exist", async () => {
      prisma.classSchedule.findUnique.mockResolvedValue(null);

      const dto: CreateAttendanceDto = {
        studentId: 42,
        classId: 3,
        classScheduleId: 999,
        status: AttendanceStatus.PRESENT,
      };

      await expect(controller.create(dto, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("3. Attendance Listing & Direct Filter (GET /attendance)", () => {
    it("should pass classScheduleId filter directly to where clause and include enriched relations", async () => {
      prisma.attendance.findMany.mockResolvedValue([
        {
          id: 301,
          studentId: 42,
          classId: 3,
          classScheduleId: 15,
          status: AttendanceStatus.PRESENT,
          logs: [],
        },
      ]);

      const result = await controller.findAll(undefined, undefined, 15, undefined);

      expect(prisma.attendance.findMany).toHaveBeenCalledWith({
        where: { classScheduleId: 15 },
        include: expect.objectContaining({
          student: expect.any(Object),
          classes: expect.any(Object),
          classSchedule: expect.any(Object),
          logs: expect.objectContaining({
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
            orderBy: { timestamp: "desc" },
          }),
        }),
        orderBy: { date: "desc" },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("4. Enriched Student History & Stats (GET /attendance/student/:studentId)", () => {
    it("should return enriched student attendance history with logs", async () => {
      prisma.attendance.findMany.mockResolvedValue([
        {
          id: 401,
          studentId: 42,
          status: AttendanceStatus.JUSTIFIED,
          logs: [
            {
              id: 1,
              userId: 1,
              previousStatus: AttendanceStatus.ABSENT,
              newStatus: AttendanceStatus.JUSTIFIED,
              reason: "Permiso",
              user: { firstName: "Admin", lastName: "User" },
            },
          ],
        },
      ]);

      const result = await controller.findByStudent(42, mockAdminUser);
      expect(result).toHaveLength(1);
      expect(result[0].logs).toBeDefined();
    });

    it("should return full breakdown in getStudentStats with numeric attendanceRate", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 42 });
      prisma.semester.findFirst.mockResolvedValue({
        id: 10,
        semesterName: "2026-A",
        startDate: new Date("2026-01-15"),
      });
      // 1 ABSENT, 3 LATE, 1 JUSTIFIED, 5 PRESENT => total 10
      // effective = 1 + floor(3/3) = 2
      // evaluable = 10 - 1 = 9
      // rate = (9 - 2) / 9 * 100 = 77.78%
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.JUSTIFIED },
        ...Array(5).fill({ status: AttendanceStatus.PRESENT }),
      ]);

      const stats = await controller.getStudentStats(42, mockAdminUser);

      expect(stats.absences).toBe(1);
      expect(stats.late).toBe(3);
      expect(stats.justified).toBe(1);
      expect(stats.present).toBe(5);
      expect(stats.effectiveAbsences).toBe(2);
      expect(stats.totalClasses).toBe(10);
      expect(stats.attendanceRate).toBe(77.78);
      expect(typeof stats.attendanceRate).toBe("number");
      expect(stats.semaphore).toBe(SemaphoreStatus.YELLOW);
      expect(stats.evaluatedPeriod.semesterName).toBe("2026-A");
    });
  });

  describe("5. Controller Auth Exceptions (403 ForbiddenException)", () => {
    it("should throw ForbiddenException in scanQr when teacherProfile is missing", async () => {
      const dto: QrScanDto = {
        qrToken: "test:token",
        classScheduleId: 1,
      };

      await expect(controller.scanQr(dto, null)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw ForbiddenException in markAbsent when teacherProfile is missing", async () => {
      await expect(controller.markAbsent(42, 1, null)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw ForbiddenException in markPresentManual when user is null or missing id", async () => {
      const dto: ManualAttendanceDto = {
        studentId: 42,
        classScheduleId: 1,
        password: "pass",
      };

      await expect(
        controller.markPresentManual(dto, null as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
