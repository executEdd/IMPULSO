import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { UserRole } from "../common/enums/roles.enum";
import {
  StudentInsight,
  DashboardSummary,
  GradeSummary,
} from "./interfaces/insights.interface";
import { AttendanceStatus, SemaphoreStatus } from "@prisma/client";

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async getStudentInsight(
    studentId: number,
    currentUser: { id: number; role: UserRole },
    period?: string,
  ): Promise<StudentInsight> {
    await this.verifyStudentAccess(studentId, currentUser);

    const resolvedPeriod = await this.resolvePeriod(period);

    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        group: true,
        attendances: {
          where: {
            classes: {
              semester: { semesterName: resolvedPeriod },
            },
          },
          select: { status: true },
        },
        grades: {
          where: { period: resolvedPeriod },
          include: { subject: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException("Alumno no encontrado");
    }

    const attendanceSummary = this.calculateAttendanceSummary(student.attendances);
    const gradeSummary = this.calculateGradeSummary(student.grades);
    const groupComparison = await this.calculateGroupComparison(
      student.groupId,
      resolvedPeriod,
      attendanceSummary.attendanceRate,
      gradeSummary.average,
    );
    const riskFactors = this.buildRiskFactors(
      student.semaphore,
      attendanceSummary,
      gradeSummary,
    );
    const recommendations = this.buildRecommendations(
      riskFactors,
      gradeSummary.atRiskSubjects,
    );

    return {
      studentId: student.id,
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      enrollmentId: student.enrollmentId,
      groupId: student.groupId,
      groupName: student.group.name,
      career: student.group.career,
      semesterName: resolvedPeriod,
      period: resolvedPeriod,
      semaphore: student.semaphore,
      attendance: attendanceSummary,
      grades: gradeSummary,
      groupComparison,
      riskFactors,
      recommendations,
    };
  }

  async getDashboardSummary(
    currentUser: { id: number; role: UserRole },
    period?: string,
    groupId?: number,
  ): Promise<DashboardSummary> {
    const resolvedPeriod = await this.resolvePeriod(period);

    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.TEACHER
    ) {
      throw new ForbiddenException("No tienes permiso para ver este dashboard");
    }

    const baseWhere: any = {
      isActive: true,
      role: UserRole.STUDENT,
    };

    if (groupId !== undefined) {
      baseWhere.studentProfile = { groupId };
    } else if (currentUser.role === UserRole.TEACHER) {
      const teacher = await this.prisma.teacherProfile.findUnique({
        where: { userId: currentUser.id },
      });
      if (!teacher) {
        return this.buildEmptyDashboard(resolvedPeriod);
      }
      const classes = await this.prisma.class.findMany({
        where: { teacherId: teacher.id },
        select: { groupId: true },
        distinct: ["groupId"],
      });
      const groupIds = classes.map((c) => c.groupId);
      if (groupIds.length === 0) {
        return this.buildEmptyDashboard(resolvedPeriod);
      }
      baseWhere.studentProfile = { groupId: { in: groupIds } };
    }

    const students = await this.prisma.user.findMany({
      where: baseWhere,
      include: {
        studentProfile: {
          include: {
            group: true,
            attendances: {
              where: {
                classes: {
                  semester: { semesterName: resolvedPeriod },
                },
              },
              select: { status: true },
            },
            grades: {
              where: { period: resolvedPeriod },
              select: { finalGrade: true, subjectId: true },
            },
          },
        },
      },
    });

    return this.aggregateDashboard(students, resolvedPeriod, groupId);
  }

  private async verifyStudentAccess(
    studentId: number,
    currentUser: { id: number; role: UserRole },
  ): Promise<void> {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.STUDENT) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { userId: currentUser.id },
      });
      if (!student || student.id !== studentId) {
        throw new ForbiddenException("No puedes ver insights de otro alumno");
      }
      return;
    }

    if (currentUser.role === UserRole.PARENT) {
      const parent = await this.prisma.parentProfile.findUnique({
        where: { userId: currentUser.id },
      });
      if (!parent) {
        throw new ForbiddenException("Perfil de tutor no encontrado");
      }
      const child = await this.prisma.studentProfile.findFirst({
        where: { id: studentId, parentId: parent.id },
      });
      if (!child) {
        throw new ForbiddenException("No puedes ver insights de este alumno");
      }
      return;
    }

    if (currentUser.role === UserRole.TEACHER) {
      const teacher = await this.prisma.teacherProfile.findUnique({
        where: { userId: currentUser.id },
      });
      if (!teacher) {
        throw new ForbiddenException("Perfil de docente no encontrado");
      }
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: studentId },
      });
      if (!student) {
        throw new NotFoundException("Alumno no encontrado");
      }
      const classes = await this.prisma.class.findMany({
        where: { teacherId: teacher.id, groupId: student.groupId },
        take: 1,
      });
      if (classes.length === 0) {
        throw new ForbiddenException(
          "No impartes clases en el grupo de este alumno",
        );
      }
      return;
    }

    throw new ForbiddenException("Rol no autorizado");
  }

  private async resolvePeriod(period?: string): Promise<string> {
    if (period) {
      return period;
    }

    const now = new Date();
    const semester = await this.prisma.semester.findFirst({
      where: {
        startDate: { lte: now },
        finishDate: { gte: now },
      },
      orderBy: { startDate: "desc" },
    });

    if (semester) {
      return semester.semesterName;
    }

    const lastSemester = await this.prisma.semester.findFirst({
      orderBy: { finishDate: "desc" },
    });

    return lastSemester?.semesterName ?? "2025-2026A";
  }

  private calculateAttendanceSummary(attendances: { status: AttendanceStatus }[]) {
    const total = attendances.length;
    const present = attendances.filter(
      (a) => a.status === AttendanceStatus.PRESENT,
    ).length;
    const absent = attendances.filter(
      (a) => a.status === AttendanceStatus.ABSENT,
    ).length;
    const late = attendances.filter(
      (a) => a.status === AttendanceStatus.LATE,
    ).length;
    const justified = attendances.filter(
      (a) => a.status === AttendanceStatus.JUSTIFIED,
    ).length;
    const presentOrLate = present + late;
    const attendanceRate = total ? (presentOrLate / total) * 100 : 0;

    return {
      total,
      present,
      absent,
      late,
      justified,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
    };
  }

  private calculateGradeSummary(grades: any[]): {
    average: number;
    subjects: GradeSummary[];
    bestSubject: GradeSummary | null;
    worstSubject: GradeSummary | null;
    atRiskSubjects: GradeSummary[];
  } {
    const subjects: GradeSummary[] = grades.map((g) => ({
      subjectId: g.subject.id,
      subjectName: g.subject.name,
      subjectCode: g.subject.code,
      partial1: g.partial1 ?? null,
      partial2: g.partial2 ?? null,
      partial3: g.partial3 ?? null,
      finalGrade: g.finalGrade ?? null,
      status: g.status,
    }));

    const validFinals = subjects.filter((s) => s.finalGrade != null);
    const average = validFinals.length
      ? validFinals.reduce((sum, s) => sum + (s.finalGrade as number), 0) /
        validFinals.length
      : 0;

    const sorted = [...validFinals].sort(
      (a, b) => (b.finalGrade as number) - (a.finalGrade as number),
    );

    const bestSubject = sorted[0] ?? null;
    const worstSubject = sorted[sorted.length - 1] ?? null;
    const atRiskSubjects = validFinals.filter(
      (s) => (s.finalGrade as number) < 7,
    );

    return {
      average: Math.round(average * 100) / 100,
      subjects,
      bestSubject,
      worstSubject,
      atRiskSubjects,
    };
  }

  private async calculateGroupComparison(
    groupId: number,
    period: string,
    studentAttendanceRate: number,
    studentAverage: number,
  ) {
    const groupStudents = await this.prisma.studentProfile.findMany({
      where: { groupId },
      include: {
        attendances: {
          where: {
            classes: {
              semester: { semesterName: period },
            },
          },
          select: { status: true },
        },
        grades: {
          where: { period },
          select: { finalGrade: true },
        },
      },
    });

    let totalAttendanceRecords = 0;
    let presentAttendanceRecords = 0;
    let gradeSum = 0;
    let gradeCount = 0;

    for (const s of groupStudents) {
      for (const a of s.attendances) {
        totalAttendanceRecords++;
        if (
          a.status === AttendanceStatus.PRESENT ||
          a.status === AttendanceStatus.LATE
        ) {
          presentAttendanceRecords++;
        }
      }
      for (const g of s.grades) {
        if (g.finalGrade != null) {
          gradeSum += g.finalGrade;
          gradeCount++;
        }
      }
    }

    const groupAttendanceRate = totalAttendanceRecords
      ? (presentAttendanceRecords / totalAttendanceRecords) * 100
      : 0;
    const groupAverage = gradeCount ? gradeSum / gradeCount : 0;

    return {
      groupAverage: Math.round(groupAverage * 100) / 100,
      groupAttendanceRate: Math.round(groupAttendanceRate * 100) / 100,
      studentAverageDiff: Math.round((studentAverage - groupAverage) * 100) / 100,
      studentAttendanceDiff:
        Math.round((studentAttendanceRate - groupAttendanceRate) * 100) / 100,
    };
  }

  private buildRiskFactors(
    semaphore: SemaphoreStatus,
    attendance: { attendanceRate: number; absent: number },
    grades: { average: number; atRiskSubjects: GradeSummary[] },
  ): string[] {
    const factors: string[] = [];

    if (semaphore === SemaphoreStatus.RED) {
      factors.push("Semáforo académico en rojo");
    } else if (semaphore === SemaphoreStatus.YELLOW) {
      factors.push("Semáforo académico en amarillo");
    }

    if (attendance.attendanceRate < 80) {
      factors.push(`Asistencia baja: ${attendance.attendanceRate}%`);
    }

    if (attendance.absent >= 3) {
      factors.push(`${attendance.absent} faltas acumuladas`);
    }

    if (grades.average < 7) {
      factors.push(`Promedio general reprobatorio: ${grades.average}`);
    }

    if (grades.atRiskSubjects.length > 0) {
      const names = grades.atRiskSubjects.map((s) => s.subjectName).join(", ");
      factors.push(`Materias en riesgo: ${names}`);
    }

    return factors;
  }

  private buildRecommendations(
    riskFactors: string[],
    atRiskSubjects: GradeSummary[],
  ): string[] {
    const recommendations: string[] = [];

    if (riskFactors.length === 0) {
      recommendations.push(
        "El alumno se encuentra en buen estado académico. Mantener el ritmo de estudio.",
      );
      return recommendations;
    }

    if (riskFactors.some((f) => f.includes("Asistencia"))) {
      recommendations.push(
        "Reforzar la puntualidad y asistencia a clases para no afectar la evaluación continua.",
      );
    }

    if (atRiskSubjects.length > 0) {
      const names = atRiskSubjects.map((s) => s.subjectName).join(", ");
      recommendations.push(
        `Solicitar apoyo adicional o tutorias en: ${names}.`,
      );
    }

    if (riskFactors.some((f) => f.includes("Promedio"))) {
      recommendations.push(
        "Establecer un plan de recuperación con el docente y el tutor para mejorar el promedio general.",
      );
    }

    recommendations.push(
      "Programar una reunion con el tutor y los docentes para dar seguimiento al plan de accion.",
    );

    return recommendations;
  }

  private async aggregateDashboard(
    students: any[],
    period: string,
    groupId?: number,
  ) {
    const totalStudents = students.length;
    const totalTeachers = await this.prisma.user.count({
      where: { role: UserRole.TEACHER, isActive: true },
    });

    const groupWhere: any = groupId !== undefined ? { id: groupId } : {};
    if (groupId === undefined && students.length > 0) {
      const groupIds = [
        ...new Set(students.map((s) => s.studentProfile.groupId)),
      ];
      groupWhere.id = { in: groupIds };
    }
    const totalGroups = await this.prisma.group.count({ where: groupWhere });

    const semaphoreCounts = { green: 0, yellow: 0, red: 0 };
    let totalAttendanceRecords = 0;
    let presentAttendanceRecords = 0;
    let gradeSum = 0;
    let gradeCount = 0;

    const groupMap = new Map<number, { group: any; students: any[] }>();
    const subjectMap = new Map<number, { subject: any; grades: number[] }>();

    for (const student of students) {
      const profile = student.studentProfile;
      if (profile.semaphore === SemaphoreStatus.GREEN) semaphoreCounts.green++;
      if (profile.semaphore === SemaphoreStatus.YELLOW) semaphoreCounts.yellow++;
      if (profile.semaphore === SemaphoreStatus.RED) semaphoreCounts.red++;

      for (const att of profile.attendances) {
        totalAttendanceRecords++;
        if (
          att.status === AttendanceStatus.PRESENT ||
          att.status === AttendanceStatus.LATE
        ) {
          presentAttendanceRecords++;
        }
      }

      for (const grade of profile.grades) {
        if (grade.finalGrade != null) {
          gradeSum += grade.finalGrade;
          gradeCount++;
        }
      }

      if (!groupMap.has(profile.groupId)) {
        groupMap.set(profile.groupId, { group: profile.group, students: [] });
      }
      groupMap.get(profile.groupId)!.students.push(profile);

      for (const grade of profile.grades) {
        if (grade.finalGrade != null) {
          if (!subjectMap.has(grade.subjectId)) {
            const subject = await this.prisma.subject.findUnique({
              where: { id: grade.subjectId },
            });
            if (subject) {
              subjectMap.set(grade.subjectId, { subject, grades: [] });
            }
          }
          const entry = subjectMap.get(grade.subjectId);
          if (entry) {
            entry.grades.push(grade.finalGrade);
          }
        }
      }
    }

    const attendanceRate = totalAttendanceRecords
      ? (presentAttendanceRecords / totalAttendanceRecords) * 100
      : 0;
    const averageGrade = gradeCount ? gradeSum / gradeCount : 0;

    const groupSummaries = Array.from(groupMap.values()).map(
      ({ group, students: groupStudents }) => {
        let gGradeSum = 0;
        let gGradeCount = 0;
        let gAttendanceTotal = 0;
        let gAttendancePresent = 0;

        for (const s of groupStudents) {
          for (const g of s.grades) {
            if (g.finalGrade != null) {
              gGradeSum += g.finalGrade;
              gGradeCount++;
            }
          }
          for (const a of s.attendances) {
            gAttendanceTotal++;
            if (
              a.status === AttendanceStatus.PRESENT ||
              a.status === AttendanceStatus.LATE
            ) {
              gAttendancePresent++;
            }
          }
        }

        return {
          id: group.id,
          name: group.name,
          career: group.career,
          averageGrade: gGradeCount ? gGradeSum / gGradeCount : 0,
          attendanceRate: gAttendanceTotal
            ? (gAttendancePresent / gAttendanceTotal) * 100
            : 0,
          studentCount: groupStudents.length,
        };
      },
    );

    const sortedGroups = [...groupSummaries].sort(
      (a, b) => b.averageGrade - a.averageGrade,
    );

    const subjectSummaries = Array.from(subjectMap.values()).map(
      ({ subject, grades: subjectGrades }) => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        averageGrade: subjectGrades.length
          ? subjectGrades.reduce((a, b) => a + b, 0) / subjectGrades.length
          : 0,
        studentCount: subjectGrades.length,
      }),
    );

    const sortedSubjects = [...subjectSummaries].sort(
      (a, b) => b.averageGrade - a.averageGrade,
    );

    return {
      period,
      totalStudents,
      totalTeachers,
      totalGroups,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      averageGrade: Math.round(averageGrade * 100) / 100,
      semaphoreCounts,
      topGroups: sortedGroups.slice(0, 3),
      bottomGroups: sortedGroups.slice(-3).reverse(),
      topSubjects: sortedSubjects.slice(0, 3),
      bottomSubjects: sortedSubjects.slice(-3).reverse(),
    };
  }

  private buildEmptyDashboard(period: string): DashboardSummary {
    return {
      period,
      totalStudents: 0,
      totalTeachers: 0,
      totalGroups: 0,
      attendanceRate: 0,
      averageGrade: 0,
      semaphoreCounts: { green: 0, yellow: 0, red: 0 },
      topGroups: [],
      bottomGroups: [],
      topSubjects: [],
      bottomSubjects: [],
    };
  }
}
