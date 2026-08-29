import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  ParseIntPipe,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from "@nestjs/swagger";
import { AttendanceService } from "./attendance.service";
import { QrScanDto } from "./dto/qr-scan.dto";
import { ManualAttendanceDto } from "./dto/manual-attendance.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";
import { CurrentUser } from "../common/decorators/current-user.decorator";

import { Throttle } from "@nestjs/throttler";

@ApiTags("Asistencias")
@Controller("attendance")
@ApiBearerAuth()
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post("scan-qr")
  @Roles(UserRole.TEACHER)
  @ApiOperation({
    summary: "Escanear QR para registrar asistencia (QR Smart-Check)",
  })
  @ApiCreatedResponse({
    description: "Asistencia registrada con éxito (Smart-Check completado).",
  })
  @ApiBadRequestResponse({
    description: "QR inválido, expirado o error al asociar el docente.",
  })
  async scanQr(
    @Body() qrScanDto: QrScanDto,
    @CurrentUser("teacherProfile") teacherProfile: any,
  ) {
    if (!teacherProfile?.id) {
      throw new BadRequestException("Perfil de docente no encontrado");
    }
    return this.attendanceService.scanQr(qrScanDto, teacherProfile.id);
  }

  @Post("manual-present")
  @Throttle({ default: { limit: 7, ttl: 300000, blockDuration: 300000 } })
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Registrar asistencia manualmente con confirmación de contraseña",
  })
  @ApiCreatedResponse({
    description: "Asistencia manual registrada con éxito.",
  })
  @ApiBadRequestResponse({
    description: "Contraseña incorrecta, IDs inválidos o clase incorrecta.",
  })
  async markPresentManual(
    @Body() dto: ManualAttendanceDto,
    @CurrentUser() user: any,
  ) {
    if (!user || !user.id) {
      throw new BadRequestException("Usuario no autenticado");
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
  @ApiOperation({ summary: "Marcar falta manualmente" })
  @ApiCreatedResponse({
    description: "Falta registrada manualmente con éxito.",
  })
  @ApiBadRequestResponse({
    description: "Error en la petición o IDs incorrectos.",
  })
  async markAbsent(
    @Param("studentId", ParseIntPipe) studentId: number,
    @Param("classScheduleId", ParseIntPipe) classScheduleId: number,
    @CurrentUser("teacherProfile") teacherProfile: any,
  ) {
    if (!teacherProfile?.id) {
      throw new BadRequestException("Perfil de docente no encontrado");
    }
    return this.attendanceService.markAbsent(
      studentId,
      classScheduleId,
      teacherProfile.id,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Listar registros de asistencia" })
  @ApiQuery({ name: "studentId", required: false, type: Number })
  @ApiQuery({ name: "classId", required: false, type: Number })
  @ApiQuery({ name: "classScheduleId", required: false, type: Number })
  @ApiQuery({ name: "date", required: false, type: String })
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
  @ApiOperation({ summary: "Obtener asistencias de un alumno" })
  @ApiOkResponse({
    description: "Historial completo de asistencias del alumno recuperado.",
  })
  async findByStudent(
    @Param("studentId", ParseIntPipe) studentId: number,
    @CurrentUser() user: any,
  ) {
    await this.attendanceService.verifyStudentAccess(user, studentId);
    return this.attendanceService.findByStudent(studentId);
  }

  @Get("stats/student/:studentId")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary:
      "Obtener estadísticas de asistencia de un alumno (últimos 30 días)",
  })
  @ApiOkResponse({
    description:
      "Estadísticas del alumno (total de clases, inasistencias, tasa de asistencia).",
  })
  async getStudentStats(
    @Param("studentId", ParseIntPipe) studentId: number,
    @CurrentUser() user: any,
  ) {
    await this.attendanceService.verifyStudentAccess(user, studentId);
    return this.attendanceService.getStudentAbsenceCount(studentId);
  }

  @Get("semaphore/red")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Listar alumnos en Semáforo Rojo" })
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
  })
  @ApiOkResponse({
    description: "Métricas globales y desglose por grupo de alumnos en riesgo.",
  })
  async getSemaphoreSummary() {
    return this.attendanceService.getSemaphoreSummary();
  }

  @Post("semaphore/reset/:studentId")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Restablecer semáforo de un alumno a verde" })
  @ApiOkResponse({ description: "Semáforo restablecido exitosamente." })
  @ApiNotFoundResponse({ description: "Alumno no encontrado." })
  async resetSemaphore(@Param("studentId", ParseIntPipe) studentId: number) {
    return this.attendanceService.resetSemaphore(studentId);
  }

  @Get("export/csv")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Exportar reporte de asistencias a CSV" })
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
