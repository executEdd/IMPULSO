import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ParseIntPipe,
} from "@nestjs/common";
import { SchoolCyclesService } from "./school-cycles.service";
import { CreateSchoolCycleDto } from "./dto/create-school-cycle.dto";
import { UpdateSchoolCycleDto } from "./dto/update-school-cycle.dto";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";

@ApiTags("Ciclos Escolares")
@Controller("school-cycles")
@ApiBearerAuth()
export class SchoolCyclesController {
  constructor(private readonly schoolCyclesService: SchoolCyclesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Crear un nuevo ciclo escolar (Admin)" })
  create(@Body() createSchoolCycleDto: CreateSchoolCycleDto) {
    return this.schoolCyclesService.create(createSchoolCycleDto);
  }

  @Get()
  @ApiOperation({ summary: "Listar todos los ciclos escolares" })
  findAll() {
    return this.schoolCyclesService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener detalle de un ciclo escolar" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.schoolCyclesService.findOne(id);
  }

  @Put(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Actualizar un ciclo escolar (Admin)" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateSchoolCycleDto: UpdateSchoolCycleDto,
  ) {
    return this.schoolCyclesService.update(id, updateSchoolCycleDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar un ciclo escolar (Admin)" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.schoolCyclesService.remove(id);
  }
}
