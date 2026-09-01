import { AttendanceStatus } from "@prisma/client";

export interface IAttendanceLog {
  id: number;
  attendanceId: number;
  userId: number;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  timestamp: Date;
}

export interface ICreateAttendanceLogData {
  attendanceId: number;
  userId: number;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
}
