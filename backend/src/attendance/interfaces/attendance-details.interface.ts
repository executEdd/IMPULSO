import {
  Attendance,
  AttendanceLog,
  Class,
  ClassSchedule,
  Subject,
  Classroom,
  Group,
  TeacherProfile,
  User,
  StudentProfile,
} from "@prisma/client";

export type AttendanceWithDetails = Attendance & {
  student?: StudentProfile & {
    user?: Pick<User, "firstName" | "lastName">;
    group?: Group;
  };
  classes?: Class & {
    subject?: Subject;
    teacher?: TeacherProfile & {
      user?: Pick<User, "firstName" | "lastName">;
    };
    group?: Group;
    classroom?: Classroom | null;
    schedules?: ClassSchedule[];
  };
  classSchedule?: ClassSchedule & {
    classroom?: Classroom | null;
  };
  logs?: (AttendanceLog & {
    user?: Pick<User, "id" | "firstName" | "lastName" | "email">;
  })[];
};
