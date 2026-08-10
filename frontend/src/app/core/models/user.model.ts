export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
  studentProfile?: {
    id: number;
    enrollmentId: string;
    groupId?: number;
    group?: { id: number; name: string };
    semaphore?: string;
    parentId?: number;
  };
  parentProfile?: {
    id: number;
    phone?: string;
    children?: Array<{
      id: number;
      enrollmentId: string;
      user?: { firstName: string; lastName: string; email: string };
      group?: { id: number; name: string };
      semaphore?: string;
    }>;
  };
  teacherProfile?: { id: number; employeeId: string };
  adminProfile?: { id: number };
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}
