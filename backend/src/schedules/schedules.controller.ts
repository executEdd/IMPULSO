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
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiQuery,
  ApiBadRequestResponse,
} from "@nestjs/swagger";
import { SchedulesService } from "./schedules.service";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("Horarios")
@Controller("schedules")
@ApiBearerAuth()
export class SchedulesController {
  constructor(private schedulesService: SchedulesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Crear horario (con validación de conflictos)" })
  @ApiCreatedResponse({ description: "Horario creado exitosamente." })
  @ApiBadRequestResponse({
    description: "Error en la validación de los datos enviados.",
  })
  @ApiConflictResponse({
    description:
      "Conflicto de horario: El docente o el grupo ya tienen una clase asignada en ese bloque.",
  })
  async create(@Body() createScheduleDto: CreateScheduleDto) {
    return this.schedulesService.create(createScheduleDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Listar todos los horarios" })
  @ApiOkResponse({
    description: "Listado completo de horarios de la institución.",
  })
  async findAll() {
    return this.schedulesService.findAll();
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Obtener horario por ID" })
  @ApiOkResponse({ description: "Horario encontrado." })
  @ApiNotFoundResponse({ description: "Horario no encontrado." })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.schedulesService.findOne(id);
  }

  @Get("teacher/:teacherId")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Obtener horarios de un docente" })
  @ApiOkResponse({ description: "Horarios asignados al docente recuperados." })
  async findByTeacher(@Param("teacherId", ParseIntPipe) teacherId: number) {
    return this.schedulesService.findByTeacher(teacherId);
  }

  @Get("group/:groupId")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Obtener horarios de un grupo" })
  @ApiOkResponse({
    description: "Horarios asignados al grupo de alumnos recuperados.",
  })
  async findByGroup(
    @Param("groupId", ParseIntPipe) groupId: number,
    @CurrentUser() user: any,
  ) {
    await this.schedulesService.verifyGroupAccess(user, groupId);
    return this.schedulesService.findByGroup(groupId);
  }

  @Put(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Actualizar horario (con validación de conflictos)",
  })
  @ApiOkResponse({ description: "Horario actualizado exitosamente." })
  @ApiNotFoundResponse({ description: "Horario no encontrado." })
  @ApiConflictResponse({
    description:
      "Conflicto de horario: La actualización colisiona con otra clase del docente o grupo.",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, updateScheduleDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar horario" })
  @ApiOkResponse({ description: "Horario eliminado correctamente." })
  @ApiNotFoundResponse({ description: "Horario no encontrado." })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.schedulesService.remove(id);
  }

  @Get("check-conflicts")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Verificar conflictos de horario antes de guardar" })
  @ApiQuery({ name: "teacherId", type: Number, description: "ID del docente" })
  @ApiQuery({ name: "groupId", type: Number, description: "ID del grupo" })
  @ApiQuery({
    name: "dayOfWeek",
    type: String,
    description: "Día de la semana (MONDAY, etc.)",
  })
  @ApiQuery({
    name: "startTime",
    type: String,
    description: "Hora de inicio en formato HH:mm",
  })
  @ApiQuery({
    name: "endTime",
    type: String,
    description: "Hora de fin en formato HH:mm",
  })
  @ApiOkResponse({
    description:
      "Verificación completada. Retorna información sobre si existe colisión.",
  })
  async checkConflicts(
    @Query("teacherId", ParseIntPipe) teacherId: number,
    @Query("groupId", ParseIntPipe) groupId: number,
    @Query("dayOfWeek") dayOfWeek: string,
    @Query("startTime") startTime: string,
    @Query("endTime") endTime: string,
  ) {
    return this.schedulesService.checkConflicts(
      teacherId,
      groupId,
      dayOfWeek,
      startTime,
      endTime,
    );
  }
}
