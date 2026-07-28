import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { UpdateSubjectDto } from "./dto/update-subject.dto";

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async create(createSubjectDto: CreateSubjectDto) {
    const existing = await this.prisma.subject.findUnique({
      where: { code: createSubjectDto.code },
    });
    if (existing) {
      throw new ConflictException("El código de la materia ya está registrado");
    }

    return this.prisma.subject.create({
      data: createSubjectDto,
      include: { teacher: { include: { user: true } } },
    });
  }

  async findAll() {
    return this.prisma.subject.findMany({
      include: { teacher: { include: { user: true } } },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: number) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: { teacher: { include: { user: true } } },
    });
    if (!subject) {
      throw new NotFoundException("Materia no encontrada");
    }
    return subject;
  }

  async update(id: number, updateSubjectDto: UpdateSubjectDto) {
    await this.findOne(id); // Verifica existencia

    if (updateSubjectDto.code) {
      const existing = await this.prisma.subject.findFirst({
        where: { code: updateSubjectDto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          "El código de la materia ya está en uso por otra materia",
        );
      }
    }

    return this.prisma.subject.update({
      where: { id },
      data: updateSubjectDto,
      include: { teacher: { include: { user: true } } },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.subject.delete({ where: { id } });
  }
}
