import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import { SemestersService } from "./semesters.service";
import { CreateSemesterDto } from "./dto/create-semester.dto";
import { UpdateSemesterDto } from "./dto/update-semester.dto";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";

@ApiTags("Semestres")
@Controller("semesters")
@ApiBearerAuth()
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Crear un nuevo semestre (Admin)" })
  create(@Body() createSemesterDto: CreateSemesterDto) {
    return this.semestersService.create(createSemesterDto);
  }

  @Get()
  @ApiOperation({ summary: "Listar semestres" })
  @ApiQuery({ name: "schoolCycleId", required: false, type: Number })
  findAll(
    @Query("schoolCycleId", new ParseIntPipe({ optional: true }))
    schoolCycleId?: number,
  ) {
    return this.semestersService.findAll(schoolCycleId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener detalle de un semestre" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.semestersService.findOne(id);
  }

  @Put(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Actualizar un semestre (Admin)" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateSemesterDto: UpdateSemesterDto,
  ) {
    return this.semestersService.update(id, updateSemesterDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar un semestre (Admin)" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.semestersService.remove(id);
  }
}
