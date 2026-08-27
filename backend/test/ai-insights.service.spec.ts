import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AiInsightsService } from "../src/ai-insights/ai-insights.service";
import { InsightsService } from "../src/insights/insights.service";
import { UserRole } from "../src/common/enums/roles.enum";
import { SemaphoreStatus } from "@prisma/client";

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe("AiInsightsService", () => {
  let service: AiInsightsService;
  let insightsService: jest.Mocked<InsightsService>;

  const baseStudentInsight = {
    studentId: 1,
    studentName: "Juan Pérez",
    enrollmentId: "12345",
    groupId: 1,
    groupName: "3A",
    career: "Programación",
    semesterName: "2025-2026A",
    period: "2025-2026A",
    semaphore: SemaphoreStatus.GREEN,
    attendance: {
      total: 10,
      present: 9,
      absent: 0,
      late: 1,
      justified: 0,
      attendanceRate: 90,
    },
    grades: {
      average: 8.5,
      subjects: [
        {
          subjectId: 1,
          subjectName: "Matemáticas",
          subjectCode: "MAT",
          partial1: 8,
          partial2: 9,
          partial3: 8,
          finalGrade: 8.5,
          status: "APROBADO",
        },
      ],
      bestSubject: {
        subjectId: 1,
        subjectName: "Matemáticas",
        subjectCode: "MAT",
        partial1: 8,
        partial2: 9,
        partial3: 8,
        finalGrade: 8.5,
        status: "APROBADO",
      },
      worstSubject: {
        subjectId: 1,
        subjectName: "Matemáticas",
        subjectCode: "MAT",
        partial1: 8,
        partial2: 9,
        partial3: 8,
        finalGrade: 8.5,
        status: "APROBADO",
      },
      atRiskSubjects: [],
    },
    groupComparison: {
      groupAverage: 8.2,
      groupAttendanceRate: 85,
      studentAverageDiff: 0.3,
      studentAttendanceDiff: 5,
    },
    riskFactors: [],
    recommendations: ["Mantener el ritmo de estudio."],
  };

  const baseDashboardSummary = {
    period: "2025-2026A",
    totalStudents: 10,
    totalTeachers: 2,
    totalGroups: 1,
    attendanceRate: 85,
    averageGrade: 8.2,
    semaphoreCounts: { green: 8, yellow: 2, red: 0 },
    topGroups: [],
    bottomGroups: [],
    topSubjects: [],
    bottomSubjects: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiInsightsService,
        {
          provide: InsightsService,
          useValue: {
            getStudentInsight: jest.fn().mockResolvedValue(baseStudentInsight),
            getDashboardSummary: jest
              .fn()
              .mockResolvedValue(baseDashboardSummary),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === "GEMINI_API_KEY") return "fake-api-key";
              if (key === "GEMINI_PRIMARY_MODEL") return "gemini-3.5-flash";
              if (key === "GEMINI_SECONDARY_MODEL")
                return "gemini-3.5-flash-lite";
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiInsightsService>(AiInsightsService);
    insightsService = module.get(InsightsService);
    mockGenerateContent.mockReset();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("generateStudentInsight", () => {
    it("should return AI-generated insight when API key is configured", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              summary: "El alumno tiene buen desempeño.",
              strengths: ["Asistencia regular."],
              concerns: [],
              actionPlan: ["Continuar así."],
            }),
        },
      });

      const result = await service.generateStudentInsight(1, {
        id: 1,
        role: UserRole.ADMIN,
      });

      expect(result.source).toBe("ai");
      expect(result.summary).toBe("El alumno tiene buen desempeño.");
      expect(insightsService.getStudentInsight).toHaveBeenCalledWith(
        1,
        { id: 1, role: UserRole.ADMIN },
        undefined,
      );
    });

    it("should retry primary model on temporary error and succeed on second attempt", async () => {
      mockGenerateContent
        .mockRejectedValueOnce(new Error("503 Service Unavailable"))
        .mockResolvedValueOnce({
          response: {
            text: () =>
              JSON.stringify({
                summary: "Recuperado tras reintento.",
                strengths: [],
                concerns: [],
                actionPlan: [],
              }),
          },
        });

      const result = await service.generateStudentInsight(1, {
        id: 1,
        role: UserRole.ADMIN,
      });

      expect(result.source).toBe("ai");
      expect(result.summary).toBe("Recuperado tras reintento.");
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it("should fallback to secondary model (gemini-3.5-flash-lite) when primary model fails 3 times", async () => {
      mockGenerateContent
        .mockRejectedValueOnce(new Error("429 Too Many Requests"))
        .mockRejectedValueOnce(new Error("429 Too Many Requests"))
        .mockRejectedValueOnce(new Error("429 Too Many Requests"))
        .mockResolvedValueOnce({
          response: {
            text: () =>
              JSON.stringify({
                summary: "Generado con modelo de respaldo.",
                strengths: [],
                concerns: [],
                actionPlan: [],
              }),
          },
        });

      const result = await service.generateStudentInsight(1, {
        id: 1,
        role: UserRole.ADMIN,
      });

      expect(result.source).toBe("ai");
      expect(result.summary).toBe("Generado con modelo de respaldo.");
      expect(mockGenerateContent).toHaveBeenCalledTimes(4);
    });

    it("should fallback to local insight when both primary and secondary models fail all attempts", async () => {
      mockGenerateContent.mockRejectedValue(new Error("Gemini error"));

      const result = await service.generateStudentInsight(1, {
        id: 1,
        role: UserRole.ADMIN,
      });

      expect(result.source).toBe("local");
      expect(result.actionPlan).toContain("Mantener el ritmo de estudio.");
    });

    it("should return local insight when API key is missing", async () => {
      const moduleWithoutKey: TestingModule = await Test.createTestingModule({
        providers: [
          AiInsightsService,
          {
            provide: InsightsService,
            useValue: {
              getStudentInsight: jest
                .fn()
                .mockResolvedValue(baseStudentInsight),
              getDashboardSummary: jest.fn(),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const localService =
        moduleWithoutKey.get<AiInsightsService>(AiInsightsService);
      const result = await localService.generateStudentInsight(1, {
        id: 1,
        role: UserRole.ADMIN,
      });

      expect(result.source).toBe("local");
    });
  });

  describe("generateDashboardInsight", () => {
    it("should return AI-generated dashboard insight", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              summary: "El grupo tiene buen rendimiento.",
              highlights: ["Alto promedio."],
              concerns: [],
              recommendations: ["Mantener estrategias."],
            }),
        },
      });

      const result = await service.generateDashboardInsight({
        id: 1,
        role: UserRole.ADMIN,
      });

      expect(result.source).toBe("ai");
      expect(result.summary).toBe("El grupo tiene buen rendimiento.");
    });

    it("should fallback to local dashboard insight when AI fails", async () => {
      mockGenerateContent.mockRejectedValue(new Error("Gemini error"));

      const result = await service.generateDashboardInsight({
        id: 1,
        role: UserRole.ADMIN,
      });

      expect(result.source).toBe("local");
      expect(result.summary).toContain("10 alumnos");
    });
  });
});
