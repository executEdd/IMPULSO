import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateSchoolCycleDto } from "./dto/create-school-cycle.dto";
import { UpdateSchoolCycleDto } from "./dto/update-school-cycle.dto";

@Injectable()
export class SchoolCyclesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSchoolCycleDto) {
    const start = new Date(dto.startDate);
    const finish = new Date(dto.finishDate);

    if (start >= finish) {
      throw new ConflictException(
        "La fecha de inicio debe ser anterior a la fecha de fin",
      );
    }

    return this.prisma.schoolCycle.create({
      data: {
        cycleName: dto.cycleName,
        startDate: start,
        finishDate: finish,
      },
    });
  }

  async findAll() {
    return this.prisma.schoolCycle.findMany({
      orderBy: { startDate: "desc" },
    });
  }

  async findOne(id: number) {
    const cycle = await this.prisma.schoolCycle.findUnique({
      where: { id },
    });
    if (!cycle) throw new NotFoundException("Ciclo escolar no encontrado");
    return cycle;
  }

  async update(id: number, dto: UpdateSchoolCycleDto) {
    const cycle = await this.findOne(id);

    let start = cycle.startDate;
    let finish = cycle.finishDate;

    if (dto.startDate) start = new Date(dto.startDate);
    if (dto.finishDate) finish = new Date(dto.finishDate);

    if (start >= finish) {
      throw new ConflictException(
        "La fecha de inicio debe ser anterior a la fecha de fin",
      );
    }

    return this.prisma.schoolCycle.update({
      where: { id },
      data: {
        ...(dto.cycleName && { cycleName: dto.cycleName }),
        ...(dto.startDate && { startDate: start }),
        ...(dto.finishDate && { finishDate: finish }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.schoolCycle.delete({ where: { id } });
  }
}
