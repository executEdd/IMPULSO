import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

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

  async findAll(groupId?: number, teacherId?: number, semesterId?: number) {
    const where: any = {};
    if (groupId) where.groupId = groupId;
    if (teacherId) where.teacherId = teacherId;
    if (semesterId) where.semesterId = semesterId;

    return this.prisma.class.findMany({
      where,
      include: {
        subject: true,
        group: true,
        teacher: { include: { user: true } },
        classroom: true,
        semester: true,
      },
      orderBy: { id: 'desc' },
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
      // 1. Eliminar asistencias vinculadas a esta clase
      await tx.attendance.deleteMany({
        where: { classId: id },
      });

      // 2. Eliminar horarios vinculados a esta clase
      await tx.classSchedule.deleteMany({
        where: { classId: id },
      });

      // 3. Eliminar la clase propiamente dicha
      return tx.class.delete({
        where: { id },
      });
    });
  }
}
