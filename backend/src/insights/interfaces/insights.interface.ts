import { AttendanceStatus, SemaphoreStatus } from "@prisma/client";

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  justified: number;
  attendanceRate: number;
}

export interface GradeSummary {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  partial1: number | null;
  partial2: number | null;
  partial3: number | null;
  finalGrade: number | null;
  status: string;
}

export interface StudentInsight {
  studentId: number;
  studentName: string;
  enrollmentId: string;
  groupId: number;
  groupName: string;
  career: string;
  semesterName: string;
  period: string;
  semaphore: SemaphoreStatus;
  attendance: AttendanceSummary;
  grades: {
    average: number;
    subjects: GradeSummary[];
    bestSubject: GradeSummary | null;
    worstSubject: GradeSummary | null;
    atRiskSubjects: GradeSummary[];
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

export interface DashboardSummary {
  period: string;
  totalStudents: number;
  totalTeachers: number;
  totalGroups: number;
  attendanceRate: number;
  averageGrade: number;
  semaphoreCounts: {
    green: number;
    yellow: number;
    red: number;
  };
  topGroups: GroupSummary[];
  bottomGroups: GroupSummary[];
  topSubjects: SubjectSummary[];
  bottomSubjects: SubjectSummary[];
}

export interface GroupSummary {
  id: number;
  name: string;
  career: string;
  averageGrade: number;
  attendanceRate: number;
  studentCount: number;
}

export interface SubjectSummary {
  id: number;
  name: string;
  code: string;
  averageGrade: number;
  studentCount: number;
}

export interface AttendanceStatusCount {
  status: AttendanceStatus;
  count: number;
}
