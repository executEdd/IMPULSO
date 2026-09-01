import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  ParseIntPipe,
  ForbiddenException,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AttendanceService } from "./attendance.service";
import {
  QrScanDto,
  ManualAttendanceDto,
  CreateAttendanceDto,
  CorrectAttendanceDto,
} from "./dto";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { IAuthenticatedUser, ITeacherProfileInfo } from "./interfaces";
import { Throttle } from "@nestjs/throttler";

@ApiTags("Asistencias")
@Controller("attendance")
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: "Token JWT no proporcionado o inválido.",
})
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post("scan-qr")
  @Roles(UserRole.TEACHER)
  @ApiOperation({
    summary: "Escanear QR para registrar asistencia (QR Smart-Check)",
    description:
      "Registra la asistencia de un alumno validando el token QR, horario, día y grupo.",
  })
  @ApiCreatedResponse({
    description: "Asistencia registrada con éxito (Smart-Check completado).",
  })
  @ApiBadRequestResponse({
    description:
      "QR inválido, expirado, día incorrecto o inconsistencia de horario.",
  })
  @ApiForbiddenResponse({
    description:
      "No autorizado: El docente no coincide con el horario asignado.",
  })
  @ApiNotFoundResponse({
    description: "Horario de clase o alumno no encontrado.",
  })
  async scanQr(
    @Body() qrScanDto: QrScanDto,
    @CurrentUser("teacherProfile") teacherProfile: ITeacherProfileInfo | null,
  ) {
    if (!teacherProfile?.id) {
      throw new ForbiddenException("Perfil de docente no encontrado");
    }
    return this.attendanceService.scanQr(qrScanDto, teacherProfile.id);
  }

  @Post("manual-present")
  @Throttle({ default: { limit: 7, ttl: 300000, blockDuration: 300000 } })
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Registrar asistencia manualmente con confirmación de contraseña",
    description:
      "Permite al docente o administrador registrar la asistencia de forma manual mediante validación de credenciales.",
  })
  @ApiCreatedResponse({
    description: "Asistencia manual registrada con éxito.",
  })
  @ApiBadRequestResponse({
    description:
      "Contraseña incorrecta, IDs inválidos o clase fuera de horario.",
  })
  @ApiForbiddenResponse({
    description: "No autorizado para registrar asistencia en esta clase.",
  })
  @ApiNotFoundResponse({
    description: "Usuario, horario o alumno no encontrado.",
  })
  async markPresentManual(
    @Body() dto: ManualAttendanceDto,
    @CurrentUser() user: IAuthenticatedUser,
  ) {
    if (!user || !user.id) {
      throw new ForbiddenException("Usuario no autenticado");
    }

    const profileId =
      user.role === UserRole.TEACHER ? user.teacherProfile?.id : undefined;

    return this.attendanceService.markPresentManual(
      dto,
      user.id,
      user.role,
      profileId,
    );
  }

  @Post("mark-absent/:studentId/:classScheduleId")
  @Roles(UserRole.TEACHER)
  @ApiOperation({
    summary: "Marcar falta manualmente",
    description:
      "Registra una inasistencia (ABSENT) manual para el alumno y horario indicados.",
  })
  @ApiParam({ name: "studentId", type: Number, description: "ID del alumno" })
  @ApiParam({
    name: "classScheduleId",
    type: Number,
    description: "ID del bloque de horario",
  })
  @ApiCreatedResponse({
    description: "Falta registrada manualmente con éxito.",
  })
  @ApiBadRequestResponse({
    description: "Día no coincide con horario o asistencia ya registrada hoy.",
  })
  @ApiForbiddenResponse({
    description:
      "No autorizado: El docente no coincide con el horario asignado.",
  })
  @ApiNotFoundResponse({
    description: "Alumno u horario de clase no encontrado.",
  })
  async markAbsent(
    @Param("studentId", ParseIntPipe) studentId: number,
    @Param("classScheduleId", ParseIntPipe) classScheduleId: number,
    @CurrentUser("teacherProfile") teacherProfile: ITeacherProfileInfo | null,
  ) {
    if (!teacherProfile?.id) {
      throw new ForbiddenException("Perfil de docente no encontrado");
    }
    return this.attendanceService.markAbsent(
      studentId,
      classScheduleId,
      teacherProfile.id,
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Crear un registro de asistencia",
    description:
      "Crea un registro de asistencia directo especificando clase, horario y estado.",
  })
  @ApiBody({ type: CreateAttendanceDto })
  @ApiCreatedResponse({
    description: "Registro de asistencia creado exitosamente.",
  })
  @ApiBadRequestResponse({
    description: "Datos de asistencia inválidos.",
  })
  @ApiForbiddenResponse({
    description: "No autorizado para registrar asistencia en esta clase.",
  })
  @ApiNotFoundResponse({
    description: "Horario de clase no encontrado.",
  })
  async create(
    @Body() dto: CreateAttendanceDto,
    @CurrentUser() user: IAuthenticatedUser,
  ) {
    if (!user || !user.id) {
      throw new ForbiddenException("Usuario no autenticado");
    }
    return this.attendanceService.create(dto, user);
  }

  @Patch(":id/correction")
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Corrección manual de asistencia con registro de auditoría",
    description:
      "Permite corregir el estado de una asistencia (ej. ABSENT -> JUSTIFIED o LATE -> PRESENT) exigiendo un motivo obligatorio, registrando en AttendanceLog y recalculando automáticamente el semáforo del alumno.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    description: "ID del registro de asistencia a corregir",
  })
  @ApiBody({ type: CorrectAttendanceDto })
  @ApiOkResponse({
    description: "Asistencia corregida exitosamente con log de auditoría.",
  })
  @ApiBadRequestResponse({
    description: "Datos de corrección inválidos o motivo obligatorio faltante.",
  })
  @ApiForbiddenResponse({
    description: "No autorizado para corregir la asistencia de esta clase.",
  })
  @ApiNotFoundResponse({
    description: "Registro de asistencia no encontrado.",
  })
  async correctAttendance(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() user: IAuthenticatedUser,
  ) {
    if (!user || !user.id) {
      throw new ForbiddenException("Usuario no autenticado");
    }
    return this.attendanceService.correctAttendance(id, dto, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Listar registros de asistencia con filtros",
    description:
      "Recupera asistencias filtradas por alumno, clase, horario o fecha.",
  })
  @ApiQuery({
    name: "studentId",
    required: false,
    type: Number,
    description: "Filtrar por ID de alumno",
  })
  @ApiQuery({
    name: "classId",
    required: false,
    type: Number,
    description: "Filtrar por ID de clase",
  })
  @ApiQuery({
    name: "classScheduleId",
    required: false,
    type: Number,
    description: "Filtrar por ID de horario de clase",
  })
  @ApiQuery({
    name: "date",
    required: false,
    type: String,
    description: "Filtrar por fecha específica (YYYY-MM-DD)",
  })
  @ApiOkResponse({
    description: "Listado de asistencias recuperado exitosamente.",
  })
  async findAll(
    @Query("studentId", new ParseIntPipe({ optional: true }))
    studentId?: number,
    @Query("classId", new ParseIntPipe({ optional: true }))
    classId?: number,
    @Query("classScheduleId", new ParseIntPipe({ optional: true }))
    classScheduleId?: number,
    @Query("date") date?: string,
  ) {
    return this.attendanceService.findAll({
      studentId,
      classId,
      classScheduleId,
      date: date ? new Date(date) : undefined,
    });
  }

  @Get("student/:studentId")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: "Obtener historial de asistencias de un alumno",
    description:
      "Devuelve el historial completo de asistencias incluyendo docente, bloque de horario, aula, materia y auditoría.",
  })
  @ApiParam({ name: "studentId", type: Number, description: "ID del alumno" })
  @ApiOkResponse({
    description: "Historial completo de asistencias del alumno recuperado.",
  })
  @ApiForbiddenResponse({
    description: "No autorizado para consultar las asistencias de este alumno.",
  })
  @ApiNotFoundResponse({
    description: "Alumno no encontrado.",
  })
  async findByStudent(
    @Param("studentId", ParseIntPipe) studentId: number,
    @CurrentUser() user: IAuthenticatedUser,
  ) {
    await this.attendanceService.verifyStudentAccess(user, studentId);
    return this.attendanceService.findByStudent(studentId);
  }

  @Get("stats/student/:studentId")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: "Obtener estadísticas y desglose de asistencia de un alumno",
    description:
      "Devuelve desglose completo: absences, present, late, justified, effectiveAbsences, totalClasses, attendanceRate numérico y periodo evaluado.",
  })
  @ApiParam({ name: "studentId", type: Number, description: "ID del alumno" })
  @ApiOkResponse({
    description: "Estadísticas detalladas del alumno recuperadas exitosamente.",
  })
  @ApiForbiddenResponse({
    description:
      "No autorizado para consultar las estadísticas de este alumno.",
  })
  @ApiNotFoundResponse({
    description: "Alumno no encontrado.",
  })
  async getStudentStats(
    @Param("studentId", ParseIntPipe) studentId: number,
    @CurrentUser() user: IAuthenticatedUser,
  ) {
    await this.attendanceService.verifyStudentAccess(user, studentId);
    return this.attendanceService.getStudentAbsenceCount(studentId);
  }

  @Get("semaphore/red")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Listar alumnos en Semáforo Rojo",
    description:
      "Listado de alumnos con estado crítico de faltas y sus detalles.",
  })
  @ApiOkResponse({
    description:
      "Listado de alumnos con estado crítico de faltas y sus detalles.",
  })
  async getRedSemaphoreStudents() {
    return this.attendanceService.getRedSemaphoreStudents();
  }

  @Get("semaphore/summary")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary:
      "Obtener resumen general y desglose por grupo de semáforos de riesgo",
    description: "Métricas globales y desglose por grupo de alumnos en riesgo.",
  })
  @ApiOkResponse({
    description: "Métricas globales y desglose por grupo de alumnos en riesgo.",
  })
  async getSemaphoreSummary() {
    return this.attendanceService.getSemaphoreSummary();
  }

  @Post("semaphore/reset/:studentId")
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Restablecer semáforo de un alumno a verde",
    description: "Restablece el semáforo del alumno a GREEN.",
  })
  @ApiParam({ name: "studentId", type: Number, description: "ID del alumno" })
  @ApiOkResponse({ description: "Semáforo restablecido exitosamente." })
  @ApiNotFoundResponse({ description: "Alumno no encontrado." })
  async resetSemaphore(@Param("studentId", ParseIntPipe) studentId: number) {
    return this.attendanceService.resetSemaphore(studentId);
  }

  @Get("export/csv")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Exportar reporte de asistencias a CSV",
    description:
      "Descarga un archivo CSV con las asistencias registradas según los filtros.",
  })
  @ApiQuery({
    name: "studentId",
    required: false,
    type: Number,
    description: "Filtrar por ID de alumno",
  })
  @ApiQuery({
    name: "classId",
    required: false,
    type: Number,
    description: "Filtrar por ID de clase",
  })
  @ApiOkResponse({
    description: "Archivo CSV generado exitosamente.",
  })
  async exportCsv(
    @Res() res: Response,
    @Query("studentId", new ParseIntPipe({ optional: true }))
    studentId?: number,
    @Query("classId", new ParseIntPipe({ optional: true })) classId?: number,
  ) {
    const csvContent = await this.attendanceService.exportCsv({
      studentId,
      classId,
    });
    res.setHeader("Content-Type", "text/csv; charset=latin1");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="reporte_asistencias_${Date.now()}.csv"`,
    );
    return res.end(csvContent);
  }
}
