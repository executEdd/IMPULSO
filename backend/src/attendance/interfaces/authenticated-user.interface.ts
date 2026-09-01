import { UserRole } from "../../common/enums/roles.enum";

export interface IAdminProfileInfo {
  id: number;
  userId: number;
  position: string;
  phone?: string | null;
}

export interface ITeacherProfileInfo {
  id: number;
  userId: number;
  employeeId: string;
  specialty?: string | null;
  phone?: string | null;
}

export interface IStudentProfileInfo {
  id: number;
  userId: number;
  enrollmentId: string;
  groupId: number;
  parentId: number;
  phone?: string | null;
  qrToken?: string | null;
  qrExpiresAt?: Date | null;
}

export interface IParentProfileInfo {
  id: number;
  userId: number;
  phone: string;
  email?: string | null;
  address?: string | null;
}

export interface IAuthenticatedUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  adminProfile?: IAdminProfileInfo | null;
  teacherProfile?: ITeacherProfileInfo | null;
  studentProfile?: IStudentProfileInfo | null;
  parentProfile?: IParentProfileInfo | null;
}
