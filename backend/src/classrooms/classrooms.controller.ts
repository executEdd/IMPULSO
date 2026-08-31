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
import { ClassroomsService } from "./classrooms.service";
import { CreateClassroomDto } from "./dto/create-classroom.dto";
import { UpdateClassroomDto } from "./dto/update-classroom.dto";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";

@ApiTags("Salones (Aulas)")
@Controller("classrooms")
@ApiBearerAuth()
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Crear un nuevo salón (Admin)" })
  create(@Body() createClassroomDto: CreateClassroomDto) {
    return this.classroomsService.create(createClassroomDto);
  }

  @Get()
  @ApiOperation({ summary: "Listar todos los salones" })
  findAll() {
    return this.classroomsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener detalle de un salón" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.classroomsService.findOne(id);
  }

  @Put(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Actualizar un salón (Admin)" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateClassroomDto: UpdateClassroomDto,
  ) {
    return this.classroomsService.update(id, updateClassroomDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar un salón (Admin)" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.classroomsService.remove(id);
  }
}
