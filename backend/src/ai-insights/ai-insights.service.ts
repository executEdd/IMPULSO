import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { InsightsService } from "../insights/insights.service";
import { UserRole } from "../common/enums/roles.enum";
import {
  AiStudentInsightResult,
  AiDashboardInsightResult,
  AnonymizedStudentInsight,
} from "./interfaces/ai-insight.interface";
import {
  StudentInsight,
  DashboardSummary,
} from "../insights/interfaces/insights.interface";

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);
  private readonly genAI?: GoogleGenerativeAI;
  private readonly model?: GenerativeModel;
  private readonly hasApiKey: boolean;

  constructor(
    private configService: ConfigService,
    private insightsService: InsightsService,
  ) {
    const apiKey = this.configService.get<string>("GEMINI_API_KEY");
    this.hasApiKey = !!apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
      });
    } else {
      this.logger.warn(
        "GEMINI_API_KEY no configurada. AiInsights devolverá resúmenes locales.",
      );
    }
  }

  async generateStudentInsight(
    studentId: number,
    currentUser: { id: number; role: UserRole },
    period?: string,
  ): Promise<AiStudentInsightResult> {
    const insight = await this.insightsService.getStudentInsight(
      studentId,
      currentUser,
      period,
    );

    if (!this.hasApiKey || !this.model) {
      return this.buildLocalStudentResult(insight);
    }

    try {
      const anonymized = this.anonymizeStudentInsight(insight);
      const prompt = this.buildStudentPrompt(anonymized);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const parsed = this.parseStudentJsonResponse(text);
      return {
        ...parsed,
        generatedAt: new Date().toISOString(),
        source: "ai",
      };
    } catch (error) {
      this.logger.error(
        "Error al generar insight con IA, usando resumen local",
        error instanceof Error ? error.message : String(error),
      );
      return this.buildLocalStudentResult(insight);
    }
  }

  async generateDashboardInsight(
    currentUser: { id: number; role: UserRole },
    period?: string,
    groupId?: number,
  ): Promise<AiDashboardInsightResult> {
    const dashboard = await this.insightsService.getDashboardSummary(
      currentUser,
      period,
      groupId,
    );

    if (!this.hasApiKey || !this.model) {
      return this.buildLocalDashboardResult(dashboard);
    }

    try {
      const prompt = this.buildDashboardPrompt(dashboard);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const parsed = this.parseDashboardJsonResponse(text);
      return {
        ...parsed,
        generatedAt: new Date().toISOString(),
        source: "ai",
      };
    } catch (error) {
      this.logger.error(
        "Error al generar insight de dashboard con IA, usando resumen local",
        error instanceof Error ? error.message : String(error),
      );
      return this.buildLocalDashboardResult(dashboard);
    }
  }

  private anonymizeStudentInsight(
    insight: StudentInsight,
  ): AnonymizedStudentInsight {
    return {
      period: insight.period,
      career: insight.career,
      semesterName: insight.semesterName,
      semaphore: insight.semaphore,
      attendance: insight.attendance,
      grades: {
        average: insight.grades.average,
        subjects: insight.grades.subjects.map((s) => ({
          subjectName: s.subjectName,
          subjectCode: s.subjectCode,
          partial1: s.partial1,
          partial2: s.partial2,
          partial3: s.partial3,
          finalGrade: s.finalGrade,
          status: s.status,
        })),
        bestSubject: insight.grades.bestSubject
          ? {
              subjectName: insight.grades.bestSubject.subjectName,
              finalGrade: insight.grades.bestSubject.finalGrade,
            }
          : null,
        worstSubject: insight.grades.worstSubject
          ? {
              subjectName: insight.grades.worstSubject.subjectName,
              finalGrade: insight.grades.worstSubject.finalGrade,
            }
          : null,
        atRiskSubjects: insight.grades.atRiskSubjects.map((s) => ({
          subjectName: s.subjectName,
          finalGrade: s.finalGrade,
        })),
      },
      groupComparison: insight.groupComparison,
      riskFactors: insight.riskFactors,
      recommendations: insight.recommendations,
    };
  }

  private buildStudentPrompt(anonymized: AnonymizedStudentInsight): string {
    return `Eres un asesor académico experto de un bachillerato técnico. Analiza el siguiente resumen anónimo de un alumno y genera un informe breve y útil en español.

Resumen académico (datos anonimizados):
${JSON.stringify(anonymized, null, 2)}

Instrucciones:
- No uses nombres, matrículas ni datos personales.
- Sé objetivo, profesional y motivador.
- Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "summary": "string",
  "strengths": ["string"],
  "concerns": ["string"],
  "actionPlan": ["string"]
}
`;
  }

  private buildDashboardPrompt(dashboard: DashboardSummary): string {
    return `Eres un director académico analizando el estado general de la institución. Genera un análisis breve y útil en español a partir de estos datos agregados.

Resumen del dashboard:
${JSON.stringify(dashboard, null, 2)}

Instrucciones:
- No uses nombres ni datos personales.
- Sé objetivo y profesional.
- Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "summary": "string",
  "highlights": ["string"],
  "concerns": ["string"],
  "recommendations": ["string"]
}
`;
  }

  private parseStudentJsonResponse(
    text: string,
  ): Omit<AiStudentInsightResult, "generatedAt" | "source"> {
    const cleaned = this.cleanJsonText(text);
    const parsed = JSON.parse(cleaned);
    return {
      summary: String(parsed.summary ?? ""),
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.map(String)
        : [],
      concerns: Array.isArray(parsed.concerns)
        ? parsed.concerns.map(String)
        : [],
      actionPlan: Array.isArray(parsed.actionPlan)
        ? parsed.actionPlan.map(String)
        : [],
    };
  }

  private parseDashboardJsonResponse(
    text: string,
  ): Omit<AiDashboardInsightResult, "generatedAt" | "source"> {
    const cleaned = this.cleanJsonText(text);
    const parsed = JSON.parse(cleaned);
    return {
      summary: String(parsed.summary ?? ""),
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.map(String)
        : [],
      concerns: Array.isArray(parsed.concerns)
        ? parsed.concerns.map(String)
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(String)
        : [],
    };
  }

  private cleanJsonText(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    return cleaned.trim();
  }

  private buildLocalStudentResult(
    insight: StudentInsight,
  ): AiStudentInsightResult {
    return {
      summary: `El alumno tiene un promedio de ${insight.grades.average} y una asistencia del ${insight.attendance.attendanceRate}%.`,
      strengths: insight.grades.bestSubject
        ? [`Buen desempeño en ${insight.grades.bestSubject.subjectName}.`]
        : [],
      concerns: insight.riskFactors,
      actionPlan: insight.recommendations,
      generatedAt: new Date().toISOString(),
      source: "local",
    };
  }

  private buildLocalDashboardResult(
    dashboard: DashboardSummary,
  ): AiDashboardInsightResult {
    return {
      summary: `El dashboard muestra ${dashboard.totalStudents} alumnos, ${dashboard.totalTeachers} docentes y ${dashboard.totalGroups} grupos. Promedio general: ${dashboard.averageGrade}. Asistencia general: ${dashboard.attendanceRate}%.`,
      highlights: [
        `Semáforo verde: ${dashboard.semaphoreCounts.green}, amarillo: ${dashboard.semaphoreCounts.yellow}, rojo: ${dashboard.semaphoreCounts.red}.`,
      ],
      concerns:
        dashboard.semaphoreCounts.red > 0
          ? [
              `Existen ${dashboard.semaphoreCounts.red} alumnos en semáforo rojo.`,
            ]
          : [],
      recommendations: [
        "Dar seguimiento a los alumnos en semáforo rojo.",
        "Revisar las materias con menor promedio.",
      ],
      generatedAt: new Date().toISOString(),
      source: "local",
    };
  }
}
