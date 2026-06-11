import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";
import { AttendanceService } from "./attendance.service";
import { QrScanDto } from "./dto/qr-scan.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";
import { CurrentUser } from "../common/decorators/current-user.decorator";

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

  @Post("mark-absent/:studentId/:scheduleId")
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
    @Param("scheduleId", ParseIntPipe) scheduleId: number,
    @CurrentUser("teacherProfile") teacherProfile: any,
  ) {
    if (!teacherProfile?.id) {
      throw new BadRequestException("Perfil de docente no encontrado");
    }
    return this.attendanceService.markAbsent(
      studentId,
      scheduleId,
      teacherProfile.id,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Listar registros de asistencia" })
  @ApiQuery({ name: "studentId", required: false, type: Number })
  @ApiQuery({ name: "scheduleId", required: false, type: Number })
  @ApiQuery({ name: "date", required: false, type: String })
  @ApiOkResponse({
    description: "Listado de asistencias recuperado exitosamente.",
  })
  async findAll(
    @Query("studentId", new ParseIntPipe({ optional: true }))
    studentId?: number,
    @Query("scheduleId", new ParseIntPipe({ optional: true }))
    scheduleId?: number,
    @Query("date") date?: string,
  ) {
    return this.attendanceService.findAll({
      studentId,
      scheduleId,
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

  @Get("student/:studentId/absences")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Contar faltas de un alumno (últimos 30 días)" })
  @ApiOkResponse({
    description: "Conteo numérico de faltas en los últimos 30 días.",
  })
  async getAbsenceCount(
    @Param("studentId", ParseIntPipe) studentId: number,
    @CurrentUser() user: any,
  ) {
    await this.attendanceService.verifyStudentAccess(user, studentId);
    return this.attendanceService.getStudentAbsenceCount(studentId);
  }

  @Get("red-semaphore")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Listar alumnos en Semáforo Rojo (3+ faltas)" })
  @ApiOkResponse({
    description:
      "Listado de estudiantes con estatus de semáforo en Rojo debido a inasistencias.",
  })
  async getRedSemaphoreStudents() {
    return this.attendanceService.getRedSemaphoreStudents();
  }

  @Post("student/:studentId/reset-semaphore")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Restablecer semáforo de un alumno a VERDE" })
  @ApiOkResponse({
    description: "Semáforo restablecido con éxito.",
  })
  async resetSemaphore(@Param("studentId", ParseIntPipe) studentId: number) {
    return this.attendanceService.resetSemaphore(studentId);
  }
}
