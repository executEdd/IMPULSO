import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async create(createGroupDto: CreateGroupDto) {
    return this.prisma.group.create({
      data: createGroupDto,
    });
  }

  async findAll() {
    return this.prisma.group.findMany({
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        _count: {
          select: { students: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    return group;
  }

  async update(id: number, updateGroupDto: UpdateGroupDto) {
    await this.findOne(id);

    return this.prisma.group.update({
      where: { id },
      data: updateGroupDto,
    });
  }

  async remove(id: number) {
    const group = await this.findOne(id);

    if (group._count.students > 0) {
      throw new ConflictException(
        `No se puede eliminar el grupo porque tiene ${group._count.students} alumno(s) inscrito(s)`
      );
    }

    return this.prisma.group.delete({
      where: { id },
    });
  }
}
