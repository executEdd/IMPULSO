import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateClassDto } from "./dto/create-class.dto";
import { UpdateClassDto } from "./dto/update-class.dto";
import { UserRole } from "../common/enums/roles.enum";

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async create(createClassDto: CreateClassDto) {
    return this.prisma.class.create({
      data: createClassDto,
      include: {
        subject: true,
        group: true,
        teacher: { include: { user: true } },
        classroom: true,
        semester: true,
      },
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

  async update(id: number, updateClassDto: UpdateClassDto) {
    return this.prisma.class.update({
      where: { id },
      data: updateClassDto,
      include: {
        subject: true,
        group: true,
        teacher: { include: { user: true } },
        classroom: true,
        semester: true,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({
        where: { classId: id },
      });

      await tx.classSchedule.deleteMany({
        where: { classId: id },
      });

      return tx.class.delete({
        where: { id },
      });
    });
  }
}
