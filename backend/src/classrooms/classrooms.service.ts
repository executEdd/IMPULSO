import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateClassroomDto } from "./dto/create-classroom.dto";
import { UpdateClassroomDto } from "./dto/update-classroom.dto";

@Injectable()
export class ClassroomsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClassroomDto) {
    const existing = await this.prisma.classroom.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException("Ya existe un salón con ese nombre");
    }

    return this.prisma.classroom.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.classroom.findMany({
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: number) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
    });
    if (!classroom) throw new NotFoundException("Salón no encontrado");
    return classroom;
  }

  async update(id: number, dto: UpdateClassroomDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.classroom.findUnique({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException("Ya existe otro salón con ese nombre");
      }
    }

    return this.prisma.classroom.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.classroom.delete({ where: { id } });
  }
}
