import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateSemesterDto } from "./dto/create-semester.dto";
import { UpdateSemesterDto } from "./dto/update-semester.dto";

@Injectable()
export class SemestersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSemesterDto) {
    return this.prisma.semester.create({
      data: {
        semesterName: dto.semesterName,
        startDate: new Date(dto.startDate),
        finishDate: new Date(dto.finishDate),
        schoolCycleId: dto.schoolCycleId,
      },
    });
  }

  async findAll(schoolCycleId?: number) {
    const where = schoolCycleId ? { schoolCycleId } : {};
    return this.prisma.semester.findMany({
      where,
      include: { cycle: true },
      orderBy: { startDate: "desc" },
    });
  }

  async findOne(id: number) {
    const semester = await this.prisma.semester.findUnique({
      where: { id },
      include: { cycle: true },
    });
    if (!semester) throw new NotFoundException("Semestre no encontrado");
    return semester;
  }

  async update(id: number, dto: UpdateSemesterDto) {
    await this.findOne(id);
    return this.prisma.semester.update({
      where: { id },
      data: {
        semesterName: dto.semesterName,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        finishDate: dto.finishDate ? new Date(dto.finishDate) : undefined,
        schoolCycleId: dto.schoolCycleId,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.semester.delete({ where: { id } });
  }
}
