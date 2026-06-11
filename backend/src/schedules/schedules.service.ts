import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";

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
    const existingSchedules = await client.schedule.findMany({
      where: {
        teacherId,
        dayOfWeek: dayOfWeek as any,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return existingSchedules.some((schedule: any) =>
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
    const existingSchedules = await client.schedule.findMany({
      where: {
        groupId,
        dayOfWeek: dayOfWeek as any,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return existingSchedules.some((schedule: any) =>
      this.timesOverlap(
        startTime,
        endTime,
        schedule.startTime,
        schedule.endTime,
      ),
    );
  }

  private async checkClassroomConflict(
    classroom: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    excludeId?: number,
    tx?: any,
  ): Promise<boolean> {
    if (!classroom) return false;

    const client = tx || this.prisma;
    const existingSchedules = await client.schedule.findMany({
      where: {
        classroom,
        dayOfWeek: dayOfWeek as any,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return existingSchedules.some((schedule: any) =>
      this.timesOverlap(
        startTime,
        endTime,
        schedule.startTime,
        schedule.endTime,
      ),
    );
  }

  async create(createScheduleDto: CreateScheduleDto) {
    const { teacherId, groupId, dayOfWeek, startTime, endTime, classroom } =
      createScheduleDto;

    // Validar que la hora de inicio sea menor que la de fin
    if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
      throw new BadRequestException(
        "La hora de inicio debe ser menor que la hora de fin",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Adquirir un bloqueo exclusivo para evitar concurrencia
      await tx.$executeRawUnsafe("LOCK TABLE schedules IN EXCLUSIVE MODE");

      // Verificar conflictos de docente
      const teacherConflict = await this.checkTeacherConflict(
        teacherId,
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

      // Verificar conflictos de grupo
      const groupConflict = await this.checkGroupConflict(
        groupId,
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

      // Verificar conflictos de aula
      if (classroom) {
        const classroomConflict = await this.checkClassroomConflict(
          classroom,
          dayOfWeek,
          startTime,
          endTime,
          undefined,
          tx,
        );
        if (classroomConflict) {
          throw new BadRequestException(
            `CONFLICTO DE AULA: El aula ${classroom} ya está ocupada el ${dayOfWeek} de ${startTime} a ${endTime}`,
          );
        }
      }

      return tx.schedule.create({
        data: createScheduleDto,
        include: {
          subject: true,
          teacher: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          group: true,
        },
      });
    });
  }

  async findAll() {
    return this.prisma.schedule.findMany({
      include: {
        subject: true,
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        group: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async findOne(id: number) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        subject: true,
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        group: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException("Horario no encontrado");
    }

    return schedule;
  }

  async findByTeacher(teacherId: number) {
    return this.prisma.schedule.findMany({
      where: { teacherId },
      include: {
        subject: true,
        group: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async findByGroup(groupId: number) {
    return this.prisma.schedule.findMany({
      where: { groupId },
      include: {
        subject: true,
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async update(id: number, updateScheduleDto: UpdateScheduleDto) {
    const existing = await this.prisma.schedule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Horario no encontrado");
    }

    const newData = {
      subjectId: updateScheduleDto.subjectId ?? existing.subjectId,
      teacherId: updateScheduleDto.teacherId ?? existing.teacherId,
      groupId: updateScheduleDto.groupId ?? existing.groupId,
      dayOfWeek: updateScheduleDto.dayOfWeek ?? existing.dayOfWeek,
      startTime: updateScheduleDto.startTime ?? existing.startTime,
      endTime: updateScheduleDto.endTime ?? existing.endTime,
      classroom: updateScheduleDto.classroom ?? existing.classroom,
    };

    // Validar horas
    if (
      this.timeToMinutes(newData.startTime) >=
      this.timeToMinutes(newData.endTime)
    ) {
      throw new BadRequestException(
        "La hora de inicio debe ser menor que la hora de fin",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Adquirir un bloqueo exclusivo para evitar concurrencia
      await tx.$executeRawUnsafe("LOCK TABLE schedules IN EXCLUSIVE MODE");

      // Verificar conflictos solo si cambió algo relevante
      const teacherConflict = await this.checkTeacherConflict(
        newData.teacherId,
        newData.dayOfWeek,
        newData.startTime,
        newData.endTime,
        id,
        tx,
      );
      if (teacherConflict) {
        throw new BadRequestException(
          `CONFLICTO DE HORARIO: El docente ya tiene una clase asignada el ${newData.dayOfWeek} de ${newData.startTime} a ${newData.endTime}`,
        );
      }

      const groupConflict = await this.checkGroupConflict(
        newData.groupId,
        newData.dayOfWeek,
        newData.startTime,
        newData.endTime,
        id,
        tx,
      );
      if (groupConflict) {
        throw new BadRequestException(
          `CONFLICTO DE HORARIO: El grupo ya tiene una clase asignada el ${newData.dayOfWeek} de ${newData.startTime} a ${newData.endTime}`,
        );
      }

      if (newData.classroom) {
        const classroomConflict = await this.checkClassroomConflict(
          newData.classroom,
          newData.dayOfWeek,
          newData.startTime,
          newData.endTime,
          id,
          tx,
        );
        if (classroomConflict) {
          throw new BadRequestException(
            `CONFLICTO DE AULA: El aula ${newData.classroom} ya está ocupada el ${newData.dayOfWeek} de ${newData.startTime} a ${newData.endTime}`,
          );
        }
      }

      return tx.schedule.update({
        where: { id },
        data: updateScheduleDto,
        include: {
          subject: true,
          teacher: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          group: true,
        },
      });
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.schedule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Horario no encontrado");
    }

    await this.prisma.schedule.delete({ where: { id } });
    return { message: "Horario eliminado exitosamente" };
  }

  async checkConflicts(
    teacherId: number,
    groupId: number,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
  ) {
    const teacherConflict = await this.checkTeacherConflict(
      teacherId,
      dayOfWeek,
      startTime,
      endTime,
    );
    const groupConflict = await this.checkGroupConflict(
      groupId,
      dayOfWeek,
      startTime,
      endTime,
    );

    return {
      hasConflicts: teacherConflict || groupConflict,
      teacherConflict,
      groupConflict,
    };
  }
}
