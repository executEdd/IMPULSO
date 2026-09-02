import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateClassDto } from "./dto/create-class.dto";
import { UpdateClassDto } from "./dto/update-class.dto";
import { UserRole } from "../common/enums/roles.enum";

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  private async validateSchedules(
    schedules: any[],
    teacherId: number,
    groupId: number,
    classroomId?: number,
    excludeClassId?: number,
  ) {
    for (const s of schedules) {
      if (this.timeToMinutes(s.startTime) >= this.timeToMinutes(s.endTime)) {
        throw new BadRequestException(
          `La hora de inicio debe ser menor que la hora de fin (${s.startTime} - ${s.endTime})`,
        );
      }

      const teacherConflict = await this.prisma.classSchedule.findFirst({
        where: {
          dayOfWeek: s.dayOfWeek,
          class: {
            teacherId,
            id: excludeClassId ? { not: excludeClassId } : undefined,
          },
          id: excludeClassId ? { not: undefined } : undefined,
        },
      });
      if (teacherConflict) {
        const overlaps =
          s.startTime < teacherConflict.endTime &&
          teacherConflict.startTime < s.endTime;
        if (overlaps) {
          throw new BadRequestException(
            `El docente ya tiene clase ${s.dayOfWeek} ${teacherConflict.startTime}-${teacherConflict.endTime}`,
          );
        }
      }

      const groupConflict = await this.prisma.classSchedule.findFirst({
        where: {
          dayOfWeek: s.dayOfWeek,
          class: {
            groupId,
            id: excludeClassId ? { not: excludeClassId } : undefined,
          },
          id: excludeClassId ? { not: undefined } : undefined,
        },
      });
      if (groupConflict) {
        const overlaps =
          s.startTime < groupConflict.endTime &&
          groupConflict.startTime < s.endTime;
        if (overlaps) {
          throw new BadRequestException(
            `El grupo ya tiene clase ${s.dayOfWeek} ${groupConflict.startTime}-${groupConflict.endTime}`,
          );
        }
      }

      if (s.classroomId) {
        const roomConflict = await this.prisma.classSchedule.findFirst({
          where: {
            dayOfWeek: s.dayOfWeek,
            OR: [
              { classroomId: s.classroomId },
              { classroomId: null, class: { classroomId: s.classroomId } },
            ],
            id: excludeClassId ? { not: undefined } : undefined,
          },
        });
        if (roomConflict) {
          const overlaps =
            s.startTime < roomConflict.endTime &&
            roomConflict.startTime < s.endTime;
          if (overlaps) {
            throw new BadRequestException(
              `El aula ya está ocupada ${s.dayOfWeek} ${roomConflict.startTime}-${roomConflict.endTime}`,
            );
          }
        }
      }
    }
  }

  async create(dto: CreateClassDto) {
    const { schedules, ...classData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (schedules?.length) {
        await this.validateSchedules(
          schedules,
          classData.teacherId,
          classData.groupId,
          classData.classroomId,
        );
      }

      const cls = await tx.class.create({
        data: classData,
        include: {
          subject: true,
          group: true,
          teacher: { include: { user: true } },
          classroom: true,
          semester: true,
        },
      });

      if (schedules?.length) {
        await tx.classSchedule.createMany({
          data: schedules.map((s) => ({
            classId: cls.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            classroomId: s.classroomId ?? null,
          })),
        });
      }

      return tx.class.findUnique({
        where: { id: cls.id },
        include: {
          subject: true,
          group: true,
          teacher: { include: { user: true } },
          classroom: true,
          semester: true,
          schedules: true,
        },
      });
    });
  }

  async findAll(
    user: any,
    filters: { groupId?: number; teacherId?: number; semesterId?: number },
  ) {
    const where: any = {};

    switch (user.role) {
      case UserRole.STUDENT:
        where.groupId = user.studentProfile?.groupId;
        break;

      case UserRole.PARENT: {
        const childrenGroupIds = await this.prisma.studentProfile.findMany({
          where: { parentId: user.parentProfile?.id },
          select: { groupId: true },
        });
        const groupIds = childrenGroupIds.map((c) => c.groupId);

        if (filters.groupId) {
          if (!groupIds.includes(filters.groupId)) {
            throw new ForbiddenException(
              "No autorizado para acceder a este grupo",
            );
          }
          where.groupId = filters.groupId;
        } else {
          where.groupId = { in: groupIds };
        }
        break;
      }

      case UserRole.TEACHER:
        where.teacherId = user.teacherProfile?.id;
        if (filters.groupId) where.groupId = filters.groupId;
        if (filters.semesterId) where.semesterId = filters.semesterId;
        break;

      case UserRole.ADMIN:
      default:
        if (filters.groupId) where.groupId = filters.groupId;
        if (filters.teacherId) where.teacherId = filters.teacherId;
        if (filters.semesterId) where.semesterId = filters.semesterId;
        break;
    }

    return this.prisma.class.findMany({
      where,
      include: {
        subject: true,
        group: true,
        teacher: { include: { user: true } },
        classroom: true,
        semester: true,
        schedules: true,
      },
      orderBy: { id: "desc" },
    });
  }

  async findOne(id: number) {
    return this.prisma.class.findUniqueOrThrow({
      where: { id },
      include: {
        subject: true,
        group: true,
        teacher: { include: { user: true } },
        classroom: true,
        semester: true,
        schedules: true,
      },
    });
  }

  async update(id: number, dto: UpdateClassDto) {
    const { schedules, ...classData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.class.findUnique({
        where: { id },
        include: { schedules: true },
      });
      if (!existing) throw new BadRequestException("Clase no encontrada");

      const teacherId = classData.teacherId ?? existing.teacherId;
      const groupId = classData.groupId ?? existing.groupId;
      const classroomId =
        classData.classroomId ?? existing.classroomId ?? undefined;

      if (schedules) {
        await this.validateSchedules(
          schedules,
          teacherId,
          groupId,
          classroomId,
          id,
        );
        await tx.classSchedule.deleteMany({ where: { classId: id } });
        if (schedules.length > 0) {
          await tx.classSchedule.createMany({
            data: schedules.map((s) => ({
              classId: id,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              classroomId: s.classroomId ?? null,
            })),
          });
        }
      }

      return tx.class.update({
        where: { id },
        data: classData,
        include: {
          subject: true,
          group: true,
          teacher: { include: { user: true } },
          classroom: true,
          semester: true,
          schedules: true,
        },
      });
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({ where: { classId: id } });
      await tx.classSchedule.deleteMany({ where: { classId: id } });
      return tx.class.delete({ where: { id } });
    });
  }
}
