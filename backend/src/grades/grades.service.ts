import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { GradeStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";

@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  async verifyStudentAccess(user: any, studentId: number) {
    if (user.role === "ADMIN" || user.role === "TEACHER") {
      return;
    }
    if (user.role === "STUDENT") {
      if (user.studentProfile?.id !== studentId) {
        throw new ForbiddenException(
          "No autorizado para acceder a este alumno",
        );
      }
      return;
    }
    if (user.role === "PARENT") {
      if (!user.parentProfile) {
        throw new ForbiddenException(
          "No autorizado: Perfil de tutor no encontrado",
        );
      }
      const child = await this.prisma.studentProfile.findFirst({
        where: {
          id: studentId,
          parentId: user.parentProfile.id,
        },
      });
      if (!child) {
        throw new ForbiddenException(
          "No autorizado para acceder a este alumno (no es su tutorado)",
        );
      }
      return;
    }
    throw new ForbiddenException("Rol no reconocido");
  }

  private calculateFinalGrade(
    partial1?: number,
    partial2?: number,
    partial3?: number,
  ): number | null {
    const grades = [partial1, partial2, partial3].filter(
      (g) => g !== undefined && g !== null,
    );
    if (grades.length === 0) return null;
    const sum = grades.reduce((acc, g) => acc + g, 0);
    return parseFloat((sum / grades.length).toFixed(2));
  }

  private determineStatus(finalGrade: number | null): GradeStatus {
    if (finalGrade === null) return GradeStatus.REGULAR;
    if (finalGrade >= 90) return GradeStatus.EXCELLENT;
    if (finalGrade >= 70) return GradeStatus.REGULAR;
    return GradeStatus.IRREGULAR;
  }

  private async createGradeLog(
    gradeId: number,
    userId: number,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    action: string,
    tx?: any,
  ) {
    const client = tx || this.prisma;
    await client.gradeLog.create({
      data: {
        gradeId,
        userId,
        field,
        oldValue,
        newValue,
        action,
      },
    });
  }

  async create(createGradeDto: CreateGradeDto, userId: number) {
    const { studentId, subjectId, partial1, partial2, partial3, period } =
      createGradeDto;

    // Verificar que no exista ya una calificación para este estudiante, materia y periodo
    const existing = await this.prisma.grade.findUnique({
      where: {
        studentId_subjectId_period: {
          studentId,
          subjectId,
          period,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        "Ya existe una calificación para este alumno, materia y periodo",
      );
    }

    const finalGrade = this.calculateFinalGrade(partial1, partial2, partial3);
    const status = this.determineStatus(finalGrade);

    return this.prisma.$transaction(async (tx) => {
      const grade = await tx.grade.create({
        data: {
          studentId,
          subjectId,
          partial1,
          partial2,
          partial3,
          finalGrade,
          status,
          period,
        },
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              group: true,
            },
          },
          subject: true,
        },
      });

      // AUDIT LOG: Registrar creación de calificación dentro de la transacción
      await this.createGradeLog(
        grade.id,
        userId,
        "ALL_FIELDS",
        null,
        JSON.stringify({ partial1, partial2, partial3, finalGrade, status }),
        "CREATE",
        tx,
      );

      return grade;
    });
  }

  async findAll(filters?: {
    studentId?: number;
    subjectId?: number;
    period?: string;
  }) {
    const where: any = {};
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.period) where.period = filters.period;

    return this.prisma.grade.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            group: true,
          },
        },
        subject: {
          include: {
            teacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        logs: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { timestamp: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: number) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            group: true,
          },
        },
        subject: {
          include: {
            teacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        logs: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!grade) {
      throw new NotFoundException("Calificación no encontrada");
    }

    return grade;
  }

  async findByStudent(studentId: number) {
    return this.prisma.grade.findMany({
      where: { studentId },
      include: {
        subject: {
          include: {
            teacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        logs: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { timestamp: "desc" },
        },
      },
      orderBy: { period: "desc" },
    });
  }

  async update(id: number, updateGradeDto: UpdateGradeDto, userId: number) {
    const existing = await this.prisma.grade.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Calificación no encontrada");
    }

    const updateData: any = {};

    return this.prisma.$transaction(async (tx) => {
      // Verificar cambios y registrar logs de auditoría dentro de la transacción
      if (
        updateGradeDto.partial1 !== undefined &&
        updateGradeDto.partial1 !== existing.partial1
      ) {
        await this.createGradeLog(
          id,
          userId,
          "partial1",
          existing.partial1?.toString() || null,
          updateGradeDto.partial1.toString(),
          "UPDATE",
          tx,
        );
        updateData.partial1 = updateGradeDto.partial1;
      }

      if (
        updateGradeDto.partial2 !== undefined &&
        updateGradeDto.partial2 !== existing.partial2
      ) {
        await this.createGradeLog(
          id,
          userId,
          "partial2",
          existing.partial2?.toString() || null,
          updateGradeDto.partial2.toString(),
          "UPDATE",
          tx,
        );
        updateData.partial2 = updateGradeDto.partial2;
      }

      if (
        updateGradeDto.partial3 !== undefined &&
        updateGradeDto.partial3 !== existing.partial3
      ) {
        await this.createGradeLog(
          id,
          userId,
          "partial3",
          existing.partial3?.toString() || null,
          updateGradeDto.partial3.toString(),
          "UPDATE",
          tx,
        );
        updateData.partial3 = updateGradeDto.partial3;
      }

      // Recalcular calificación final y estatus si hubo cambios
      if (Object.keys(updateData).length > 0) {
        const newPartial1 =
          updateData.partial1 !== undefined
            ? updateData.partial1
            : existing.partial1;
        const newPartial2 =
          updateData.partial2 !== undefined
            ? updateData.partial2
            : existing.partial2;
        const newPartial3 =
          updateData.partial3 !== undefined
            ? updateData.partial3
            : existing.partial3;

        const finalGrade = this.calculateFinalGrade(
          newPartial1,
          newPartial2,
          newPartial3,
        );
        const status = this.determineStatus(finalGrade);

        if (finalGrade !== existing.finalGrade) {
          await this.createGradeLog(
            id,
            userId,
            "finalGrade",
            existing.finalGrade?.toString() || null,
            finalGrade?.toString() || null,
            "UPDATE",
            tx,
          );
          updateData.finalGrade = finalGrade;
        }

        if (status !== existing.status) {
          await this.createGradeLog(
            id,
            userId,
            "status",
            existing.status,
            status,
            "UPDATE",
            tx,
          );
          updateData.status = status;
        }
      }

      return tx.grade.update({
        where: { id },
        data: updateData,
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              group: true,
            },
          },
          subject: true,
          logs: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
            orderBy: { timestamp: "desc" },
          },
        },
      });
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.grade.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Calificación no encontrada");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.gradeLog.deleteMany({ where: { gradeId: id } });
      await tx.grade.delete({ where: { id } });
    });
    return { message: "Calificación eliminada exitosamente" };
  }

  async getGradeLogs(gradeId: number) {
    return this.prisma.gradeLog.findMany({
      where: { gradeId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        grade: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            subject: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
    });
  }

  async getAllLogs() {
    return this.prisma.gradeLog.findMany({
      include: {
        user: { select: { firstName: true, lastName: true } },
        grade: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            subject: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: 100,
    });
  }

  async exportCsv(filters?: {
    studentId?: number;
    subjectId?: number;
    period?: string;
  }) {
    const grades = await this.findAll(filters);
    const sep = "sep=,\n";
    const header =
      "ID,Alumno,Matrícula,Grupo,Materia,Periodo,Parcial 1,Parcial 2,Parcial 3,Final,Estatus\n";
    const rows = grades.map((g: any) => {
      const studentName = `"${g.student?.user?.firstName || ""} ${g.student?.user?.lastName || ""}"`;
      const enrollmentId = `"${g.student?.enrollmentId || ""}"`;
      const groupName = `"${g.student?.group?.name || ""}"`;
      const subjectName = `"${g.subject?.name || ""}"`;
      const period = `"${g.period || ""}"`;
      const p1 = g.partial1 ?? "";
      const p2 = g.partial2 ?? "";
      const p3 = g.partial3 ?? "";
      const final = g.finalGrade ?? "";
      const status = `"${g.status || ""}"`;
      return `${g.id},${studentName},${enrollmentId},${groupName},${subjectName},${period},${p1},${p2},${p3},${final},${status}`;
    });

    const csvString = sep + header + rows.join("\n");
    return Buffer.from(csvString, "latin1");
  }
}
