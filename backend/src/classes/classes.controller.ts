import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ClassesService } from "./classes.service";
import { CreateClassDto } from "./dto/create-class.dto";
import { UpdateClassDto } from "./dto/update-class.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("Clases")
@Controller("classes")
@ApiBearerAuth()
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Crear una asignación de clase (Admin)" })
  create(@Body() createClassDto: CreateClassDto) {
    return this.classesService.create(createClassDto);
  }

  @Get()
  @ApiOperation({ summary: "Listar todas las clases asignadas (Filtrable)" })
  @ApiQuery({ name: "groupId", required: false, type: Number })
  @ApiQuery({ name: "teacherId", required: false, type: Number })
  @ApiQuery({ name: "semesterId", required: false, type: Number })
  findAll(
    @CurrentUser() user: any,
    @Query("groupId") groupId?: string,
    @Query("teacherId") teacherId?: string,
    @Query("semesterId") semesterId?: string,
  ) {
    return this.classesService.findAll(user, {
      groupId: groupId ? parseInt(groupId, 10) : undefined,
      teacherId: teacherId ? parseInt(teacherId, 10) : undefined,
      semesterId: semesterId ? parseInt(semesterId, 10) : undefined,
    });
  }

  @Get(":id")
  @ApiOperation({
    summary: "Obtener detalles de una clase asignada y sus horarios",
  })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.classesService.findOne(id);
  }

  @Put(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Actualizar una clase asignada (Admin)" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateClassDto: UpdateClassDto,
  ) {
    return this.classesService.update(id, updateClassDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar una clase asignada (Admin)" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.classesService.remove(id);
  }
}
