import { SemaphoreStatus } from "@prisma/client";

export interface IEvaluatedPeriod {
  semesterId: number;
  semesterName: string;
  startDate: Date;
  evaluatedUntil: Date;
}

export interface IStudentAttendanceStats {
  absences: number;
  present: number;
  late: number;
  justified: number;
  effectiveAbsences: number;
  totalClasses: number;
  attendanceRate: number;
  semaphore: SemaphoreStatus;
  evaluatedPeriod: IEvaluatedPeriod;
}
