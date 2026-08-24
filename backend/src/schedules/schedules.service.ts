import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";
import { UserRole } from "../common/enums/roles.enum";

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

  async verifyGroupAccess(user: any, groupId: number) {
    if (user.role === "ADMIN" || user.role === "TEACHER") {
      return;
    }
    if (user.role === "STUDENT") {
      if (!user.studentProfile || user.studentProfile.groupId !== groupId) {
        throw new ForbiddenException("No autorizado para acceder a este grupo");
      }
      return;
    }
    if (user.role === "PARENT") {
      if (!user.parentProfile) {
        throw new ForbiddenException(
          "No autorizado: Perfil de tutor no encontrado",
        );
      }
      const childInGroup = await this.prisma.studentProfile.findFirst({
        where: {
          parentId: user.parentProfile.id,
          groupId: groupId,
        },
      });
      if (!childInGroup) {
        throw new ForbiddenException(
          "No autorizado para acceder a los horarios de este grupo",
        );
      }
      return;
    }
    throw new ForbiddenException("Rol no reconocido");
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const s1 = this.timeToMinutes(start1);
    const e1 = this.timeToMinutes(end1);
    const s2 = this.timeToMinutes(start2);
    const e2 = this.timeToMinutes(end2);
    return s1 < e2 && s2 < e1;
  }

  private async checkTeacherConflict(
    teacherId: number,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    excludeId?: number,
    tx?: any,
  ): Promise<boolean> {
    const client = tx || this.prisma;
    const existing = await client.classSchedule.findMany({
      where: {
        dayOfWeek: dayOfWeek as any,
        class: {
          teacherId,
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return existing.some((schedule: any) =>
      this.timesOverlap(
        startTime,
        endTime,
        schedule.startTime,
        schedule.endTime,
      ),
    );
  }

  private async checkGroupConflict(
    groupId: number,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    excludeId?: number,
    tx?: any,
  ): Promise<boolean> {
    const client = tx || this.prisma;
    const existing = await client.classSchedule.findMany({
      where: {
        dayOfWeek: dayOfWeek as any,
        class: {
          groupId,
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return existing.some((schedule: any) =>
      this.timesOverlap(
        startTime,
        endTime,
        schedule.startTime,
        schedule.endTime,
      ),
    );
  }

  private async checkClassroomConflict(
    classroomId: number,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    excludeId?: number,
    tx?: any,
  ): Promise<boolean> {
    const client = tx || this.prisma;
    const existing = await client.classSchedule.findMany({
      where: {
        dayOfWeek: dayOfWeek as any,
        OR: [{ classroomId }, { classroomId: null, class: { classroomId } }],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return existing.some((schedule: any) =>
      this.timesOverlap(
        startTime,
        endTime,
        schedule.startTime,
        schedule.endTime,
      ),
    );
  }

  async create(createScheduleDto: CreateScheduleDto) {
    const { classId, classroomId, dayOfWeek, startTime, endTime } =
      createScheduleDto;

    if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
      throw new BadRequestException(
        "La hora de inicio debe ser menor que la hora de fin",
      );
    }

    const targetClass = await this.prisma.class.findUnique({
      where: { id: classId },
    });
    if (!targetClass) {
      throw new NotFoundException("Clase no encontrada");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "LOCK TABLE classes_schedules IN EXCLUSIVE MODE",
      );

      const teacherConflict = await this.checkTeacherConflict(
        targetClass.teacherId,
        dayOfWeek,
        startTime,
        endTime,
        undefined,
        tx,
      );
      if (teacherConflict) {
        throw new BadRequestException(
          `CONFLICTO DE HORARIO: El docente ya tiene una clase asignada el ${dayOfWeek} de ${startTime} a ${endTime}`,
        );
      }

      const groupConflict = await this.checkGroupConflict(
        targetClass.groupId,
        dayOfWeek,
        startTime,
        endTime,
        undefined,
        tx,
      );
      if (groupConflict) {
        throw new BadRequestException(
          `CONFLICTO DE HORARIO: El grupo ya tiene una clase asignada el ${dayOfWeek} de ${startTime} a ${endTime}`,
        );
      }

      if (classroomId) {
        const classroomConflict = await this.checkClassroomConflict(
          classroomId,
          dayOfWeek,
          startTime,
          endTime,
          undefined,
          tx,
        );
        if (classroomConflict) {
          throw new BadRequestException(
            `CONFLICTO DE AULA: El aula seleccionada ya está ocupada el ${dayOfWeek} de ${startTime} a ${endTime}`,
          );
        }
      }

      return tx.classSchedule.create({
        data: {
          classId,
          classroomId,
          dayOfWeek,
          startTime,
          endTime,
        },
        include: {
          class: {
            include: {
              subject: true,
              teacher: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
              group: true,
              semester: true,
              classroom: true,
            },
          },
          classroom: true,
        },
      });
    });
  }

  async findAll(user: any, groupId?: number) {
    const include = {
      class: {
        include: {
          subject: true,
          teacher: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          group: true,
          semester: true,
          classroom: true,
        },
      },
      classroom: true,
    };

    switch (user.role) {
      case UserRole.STUDENT:
        return this.findByGroup(user.studentProfile?.groupId);

      case UserRole.PARENT: {
        const childrenGroupIds = await this.prisma.studentProfile.findMany({
          where: { parentId: user.parentProfile?.id },
          select: { groupId: true },
        });
        const groupIds = childrenGroupIds.map((c) => c.groupId);

        if (groupId) {
          if (!groupIds.includes(groupId)) {
            throw new ForbiddenException(
              "No autorizado para acceder a este grupo",
            );
          }
          return this.findByGroup(groupId);
        }

        return this.prisma.classSchedule.findMany({
          where: { class: { groupId: { in: groupIds } } },
          include,
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        });
      }

      case UserRole.TEACHER:
        return this.findByTeacher(user.teacherProfile?.id);

      case UserRole.ADMIN:
      default:
        if (groupId) {
          return this.findByGroup(groupId);
        }
        return this.prisma.classSchedule.findMany({
          include,
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        });
    }
  }

  async findOne(id: number) {
    const cs = await this.prisma.classSchedule.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            group: true,
            semester: true,
            classroom: true,
          },
        },
        classroom: true,
      },
    });

    if (!cs) {
      throw new NotFoundException("Horario no encontrado");
    }

    return cs;
  }

  async findByTeacher(teacherId: number) {
    return this.prisma.classSchedule.findMany({
      where: {
        class: {
          teacherId,
        },
      },
      include: {
        class: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            group: true,
            semester: true,
            classroom: true,
          },
        },
        classroom: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async findByGroup(groupId: number) {
    return this.prisma.classSchedule.findMany({
      where: {
        class: {
          groupId,
        },
      },
      include: {
        class: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            group: true,
            semester: true,
            classroom: true,
          },
        },
        classroom: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  // --- NUEVO MÉTODO AGREGADO ---
  async findByStudent(studentId: number, user: any) {
    if (user.role === "STUDENT") {
      if (user.studentProfile?.id !== studentId) {
        throw new ForbiddenException(
          "No autorizado para acceder a este horario",
        );
      }
    }

    if (user.role === "PARENT") {
      const child = await this.prisma.studentProfile.findFirst({
        where: {
          id: studentId,
          parentId: user.parentProfile.id,
        },
      });

      if (!child) {
        throw new ForbiddenException(
          "No autorizado para acceder a este horario",
        );
      }
    }

    const student = await this.prisma.studentProfile.findUnique({
      where: {
        id: studentId,
      },
      include: {
        group: true,
      },
    });

    if (!student) {
      throw new NotFoundException("Alumno no encontrado");
    }

    return this.prisma.classSchedule.findMany({
      where: {
        class: {
          groupId: student.groupId,
        },
      },
      include: {
        class: {
          include: {
            subject: {
              include: {
                teacher: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
            classroom: true,
            group: true,
          },
        },
      },
      orderBy: [
        {
          dayOfWeek: "asc",
        },
        {
          startTime: "asc",
        },
      ],
    });
  }

  async update(id: number, updateScheduleDto: UpdateScheduleDto) {
    const existing = await this.prisma.classSchedule.findUnique({
      where: { id },
      include: { class: true },
    });
    if (!existing) {
      throw new NotFoundException("Horario no encontrado");
    }

    const classId = updateScheduleDto.classId ?? existing.classId;
    const classroomId =
      updateScheduleDto.classroomId !== undefined
        ? updateScheduleDto.classroomId
        : existing.classroomId;
    const dayOfWeek = updateScheduleDto.dayOfWeek ?? existing.dayOfWeek;
    const startTime = updateScheduleDto.startTime ?? existing.startTime;
    const endTime = updateScheduleDto.endTime ?? existing.endTime;

    if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
      throw new BadRequestException(
        "La hora de inicio debe ser menor que la hora de fin",
      );
    }

    const targetClass = await this.prisma.class.findUnique({
      where: { id: classId },
    });
    if (!targetClass) {
      throw new NotFoundException("Clase no encontrada");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "LOCK TABLE classes_schedules IN EXCLUSIVE MODE",
      );

      const teacherConflict = await this.checkTeacherConflict(
        targetClass.teacherId,
        dayOfWeek,
        startTime,
        endTime,
        id,
        tx,
      );
      if (teacherConflict) {
        throw new BadRequestException(
          `CONFLICTO DE HORARIO: El docente ya tiene una clase asignada el ${dayOfWeek} de ${startTime} a ${endTime}`,
        );
      }

      const groupConflict = await this.checkGroupConflict(
        targetClass.groupId,
        dayOfWeek,
        startTime,
        endTime,
        id,
        tx,
      );
      if (groupConflict) {
        throw new BadRequestException(
          `CONFLICTO DE HORARIO: El grupo ya tiene una clase asignada el ${dayOfWeek} de ${startTime} a ${endTime}`,
        );
      }

      if (classroomId) {
        const classroomConflict = await this.checkClassroomConflict(
          classroomId,
          dayOfWeek,
          startTime,
          endTime,
          id,
          tx,
        );
        if (classroomConflict) {
          throw new BadRequestException(
            `CONFLICTO DE AULA: El aula seleccionada ya está ocupada el ${dayOfWeek} de ${startTime} a ${endTime}`,
          );
        }
      }

      return tx.classSchedule.update({
        where: { id },
        data: {
          classId,
          classroomId,
          dayOfWeek: dayOfWeek as any,
          startTime,
          endTime,
        },
        include: {
          class: {
            include: {
              subject: true,
              teacher: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
              group: true,
              semester: true,
              classroom: true,
            },
          },
          classroom: true,
        },
      });
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.classSchedule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Horario no encontrado");
    }

    await this.prisma.classSchedule.delete({ where: { id } });
    return { message: "Horario eliminado exitosamente" };
  }

  async checkConflicts(
    classId: number,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    classroomId?: number,
  ) {
    const targetClass = await this.prisma.class.findUnique({
      where: { id: classId },
    });
    if (!targetClass) {
      throw new NotFoundException("Clase no encontrada");
    }

    const teacherConflict = await this.checkTeacherConflict(
      targetClass.teacherId,
      dayOfWeek,
      startTime,
      endTime,
    );
    const groupConflict = await this.checkGroupConflict(
      targetClass.groupId,
      dayOfWeek,
      startTime,
      endTime,
    );
    const classroomConflict = classroomId
      ? await this.checkClassroomConflict(
          classroomId,
          dayOfWeek,
          startTime,
          endTime,
        )
      : false;

    return {
      hasConflicts: teacherConflict || groupConflict || classroomConflict,
      teacherConflict,
      groupConflict,
      classroomConflict,
    };
  }
}
