export interface AiStudentInsightResult {
  summary: string;
  strengths: string[];
  concerns: string[];
  actionPlan: string[];
  generatedAt: string;
  source: "ai" | "local";
}

export interface AiDashboardInsightResult {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  generatedAt: string;
  source: "ai" | "local";
}

export interface AnonymizedStudentInsight {
  period: string;
  career: string;
  semesterName: string;
  semaphore: string;
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    justified: number;
    attendanceRate: number;
  };
  grades: {
    average: number;
    subjects: {
      subjectName: string;
      subjectCode: string;
      partial1: number | null;
      partial2: number | null;
      partial3: number | null;
      finalGrade: number | null;
      status: string;
    }[];
    bestSubject: { subjectName: string; finalGrade: number | null } | null;
    worstSubject: { subjectName: string; finalGrade: number | null } | null;
    atRiskSubjects: { subjectName: string; finalGrade: number | null }[];
  };
  groupComparison: {
    groupAverage: number;
    groupAttendanceRate: number;
    studentAverageDiff: number;
    studentAttendanceDiff: number;
  };
  riskFactors: string[];
  recommendations: string[];
}
