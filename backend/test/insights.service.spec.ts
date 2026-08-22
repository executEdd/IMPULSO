import { Test, TestingModule } from "@nestjs/testing";
import { InsightsService } from "./insights.service";
import { PrismaService } from "../prisma.service";
import { UserRole } from "../common/enums/roles.enum";
import { SemaphoreStatus, AttendanceStatus } from "@prisma/client";

describe("InsightsService", () => {
  let service: InsightsService;

  const mockPrisma = {
    studentProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    semester: {
      findFirst: jest.fn(),
    },
    group: {
      count: jest.fn(),
    },
    class: {
      findMany: jest.fn(),
    },
    teacherProfile: {
      findUnique: jest.fn(),
    },
    parentProfile: {
      findUnique: jest.fn(),
    },
    subject: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);

    jest.clearAllMocks();
  });

  describe("calculateAttendanceSummary", () => {
    it("should calculate attendance rate correctly", () => {
      const attendances = [
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.LATE },
      ];
      const result = (service as any).calculateAttendanceSummary(attendances);
      expect(result.total).toBe(4);
      expect(result.present).toBe(2);
      expect(result.attendanceRate).toBe(75);
    });

    it("should return zeros for empty attendances", () => {
      const result = (service as any).calculateAttendanceSummary([]);
      expect(result.total).toBe(0);
      expect(result.attendanceRate).toBe(0);
    });
  });

  describe("calculateGradeSummary", () => {
    it("should identify best, worst and at-risk subjects", () => {
      const grades = [
        {
          subject: { id: 1, name: "Math", code: "MAT" },
          partial1: 8,
          partial2: 9,
          partial3: null,
          finalGrade: 8.5,
          status: "REGULAR",
        },
        {
          subject: { id: 2, name: "Physics", code: "PHY" },
          partial1: 5,
          partial2: 6,
          partial3: null,
          finalGrade: 5.5,
          status: "IRREGULAR",
        },
      ];
      const result = (service as any).calculateGradeSummary(grades);
      expect(result.average).toBe(7);
      expect(result.bestSubject?.subjectName).toBe("Math");
      expect(result.worstSubject?.subjectName).toBe("Physics");
      expect(result.atRiskSubjects).toHaveLength(1);
    });
  });

  describe("buildRiskFactors", () => {
    it("should return risk factors for low attendance and grades", () => {
      const attendance = { attendanceRate: 70, absent: 4 };
      const grades = {
        average: 6.5,
        atRiskSubjects: [{ subjectName: "Physics" } as any],
      };
      const result = (service as any).buildRiskFactors(
        SemaphoreStatus.RED,
        attendance,
        grades,
      );
      expect(result).toContain("Semáforo académico en rojo");
      expect(result.some((f: string) => f.includes("Asistencia baja"))).toBe(
        true,
      );
    });

    it("should return empty array when student is doing well", () => {
      const attendance = { attendanceRate: 95, absent: 0 };
      const grades = { average: 9, atRiskSubjects: [] };
      const result = (service as any).buildRiskFactors(
        SemaphoreStatus.GREEN,
        attendance,
        grades,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("getStudentInsight", () => {
    it("should return student insight for admin", async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 1,
        enrollmentId: "ENR-001",
        groupId: 1,
        semaphore: SemaphoreStatus.GREEN,
        user: { firstName: "Luis", lastName: "Martinez" },
        group: { id: 1, name: "3A", career: "Programación" },
        attendances: [{ status: AttendanceStatus.PRESENT }],
        grades: [
          {
            subject: { id: 1, name: "Math", code: "MAT" },
            partial1: 9,
            partial2: null,
            partial3: null,
            finalGrade: 9,
            status: "EXCELLENT",
          },
        ],
      });

      mockPrisma.studentProfile.findMany.mockResolvedValue([
        {
          attendances: [{ status: AttendanceStatus.PRESENT }],
          grades: [{ finalGrade: 9 }],
        },
      ]);

      mockPrisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2025-2026A",
      });

      const result = await service.getStudentInsight(
        1,
        { id: 1, role: UserRole.ADMIN },
        "2025-2026A",
      );

      expect(result.studentId).toBe(1);
      expect(result.attendance.total).toBe(1);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should forbid student from viewing other students", async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({ id: 2 });

      await expect(
        service.getStudentInsight(
          1,
          { id: 1, role: UserRole.STUDENT },
          "2025-2026A",
        ),
      ).rejects.toThrow("No puedes ver insights de otro alumno");
    });
  });

  describe("getDashboardSummary", () => {
    it("should forbid students and parents", async () => {
      mockPrisma.semester.findFirst.mockResolvedValue({
        id: 1,
        semesterName: "2025-2026A",
      });

      await expect(
        service.getDashboardSummary(
          { id: 1, role: UserRole.STUDENT },
          "2025-2026A",
        ),
      ).rejects.toThrow("No tienes permiso para ver este dashboard");
    });
  });
});
