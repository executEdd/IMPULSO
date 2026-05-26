export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  adminProfile?: AdminProfile;
  teacherProfile?: TeacherProfile;
  studentProfile?: StudentProfile;
  parentProfile?: ParentProfile;
}

export interface AdminProfile {
  id: number;
  position: string;
  phone?: string;
}

export interface TeacherProfile {
  id: number;
  employeeId: string;
  specialty?: string;
  phone?: string;
}

export interface StudentProfile {
  id: number;
  enrollmentId: string;
  groupId: number;
  parentId: number;
  qrToken?: string;
  qrExpiresAt?: string;
  semaphore: 'GREEN' | 'YELLOW' | 'RED';
  group?: Group;
  parent?: ParentProfile;
}

export interface ParentProfile {
  id: number;
  phone: string;
  email?: string;
  address?: string;
  children?: StudentProfile[];
}

export interface Group {
  id: number;
  name: string;
  gradeLevel: number;
  career: string;
  classroom?: string;
  maxStudents: number;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string;
  credits: number;
  teacherId?: number;
  teacher?: TeacherProfile;
}

export interface Schedule {
  id: number;
  subjectId: number;
  teacherId: number;
  groupId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  classroom?: string;
  subject?: Subject;
  teacher?: TeacherProfile & { user?: { firstName: string; lastName: string } };
  group?: Group;
}

export interface Attendance {
  id: number;
  studentId: number;
  scheduleId: number;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';
  qrToken?: string;
  notes?: string;
  student?: StudentProfile & { user?: { firstName: string; lastName: string } };
  schedule?: Schedule;
}

export interface Grade {
  id: number;
  studentId: number;
  subjectId: number;
  partial1?: number;
  partial2?: number;
  partial3?: number;
  finalGrade?: number;
  status: 'REGULAR' | 'IRREGULAR' | 'EXCELLENT';
  period: string;
  student?: StudentProfile & { user?: { firstName: string; lastName: string }; group?: Group };
  subject?: Subject;
  logs?: GradeLog[];
}

export interface GradeLog {
  id: number;
  gradeId: number;
  userId: number;
  field: string;
  oldValue?: string;
  newValue?: string;
  action: string;
  timestamp: string;
  user?: { firstName: string; lastName: string };
}

export interface Alert {
  id: number;
  studentId: number;
  type: string;
  priority: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  student?: StudentProfile & { user?: { firstName: string; lastName: string }; group?: Group };
}

export interface Notification {
  id: number;
  alertId: number;
  senderId: number;
  recipientType: string;
  recipientId: number;
  channel: string;
  status: string;
  content: string;
  sentAt?: string;
  createdAt: string;
  alert?: Alert;
  sender?: { firstName: string; lastName: string };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface QrData {
  qrToken: string | null;
  qrImage: string | null;
  expiresAt: string | null;
  isValid: boolean;
}
