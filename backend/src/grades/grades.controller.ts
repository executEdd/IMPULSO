import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
} from "@nestjs/swagger";
import { GradesService } from "./grades.service";
import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";
import { BulkUpsertGradesDto } from "./dto/bulk-upsert-grades.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("Calificaciones")
@Controller("grades")
@ApiBearerAuth()
export class GradesController {
  constructor(private gradesService: GradesService) {}

  @Post("bulk")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Capturar/Actualizar múltiples calificaciones en formato sábana" })
  async bulkUpsert(
    @Body() bulkDto: BulkUpsertGradesDto,
    @CurrentUser("id") userId: number,
  ) {
    return this.gradesService.bulkUpsert(bulkDto, userId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Crear calificación (con log de auditoría)" })
  async create(
    @Body() createGradeDto: CreateGradeDto,
    @CurrentUser("id") userId: number,
  ) {
    return this.gradesService.create(createGradeDto, userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Listar calificaciones" })
  @ApiQuery({ name: "studentId", required: false, type: Number })
  @ApiQuery({ name: "subjectId", required: false, type: Number })
  @ApiQuery({ name: "period", required: false, type: String })
  async findAll(
    @Query("studentId", new ParseIntPipe({ optional: true }))
    studentId?: number,
    @Query("subjectId", new ParseIntPipe({ optional: true }))
    subjectId?: number,
    @Query("period") period?: string,
    @CurrentUser() user?: any,
  ) {
    if (studentId) {
      await this.gradesService.verifyStudentAccess(user, studentId);
    } else if (
      user &&
      (user.role === UserRole.STUDENT || user.role === UserRole.PARENT)
    ) {
      throw new ForbiddenException("Debe especificar un studentId válido");
    }

    return this.gradesService.findAll({
      studentId,
      subjectId,
      period,
    });
  }

  @Get("logs/all")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Obtener todos los logs de auditoría" })
  async getAllLogs() {
    return this.gradesService.getAllLogs();
  }

  @Get("logs/:gradeId")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Obtener logs de auditoría de una calificación" })
  async getGradeLogs(@Param("gradeId", ParseIntPipe) gradeId: number) {
    return this.gradesService.getGradeLogs(gradeId);
  }

  @Get("student/:studentId")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Obtener calificaciones de un alumno" })
  async findByStudent(
    @Param("studentId", ParseIntPipe) studentId: number,
    @CurrentUser() user: any,
  ) {
    await this.gradesService.verifyStudentAccess(user, studentId);
    return this.gradesService.findByStudent(studentId);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Obtener calificación por ID" })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    const grade = await this.gradesService.findOne(id);
    await this.gradesService.verifyStudentAccess(user, grade.studentId);
    return grade;
  }

  @Put(":id")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Actualizar calificación (con log de auditoría automático)",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateGradeDto: UpdateGradeDto,
    @CurrentUser("id") userId: number,
  ) {
    return this.gradesService.update(id, updateGradeDto, userId);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar calificación" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.gradesService.remove(id);
  }

  @Get("export/csv")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Exportar reporte de calificaciones a CSV" })
  async exportCsv(
    @Res() res: Response,
    @Query("studentId", new ParseIntPipe({ optional: true }))
    studentId?: number,
    @Query("subjectId", new ParseIntPipe({ optional: true }))
    subjectId?: number,
    @Query("period") period?: string,
  ) {
    const csvContent = await this.gradesService.exportCsv({
      studentId,
      subjectId,
      period,
    });
    res.setHeader("Content-Type", "text/csv; charset=latin1");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="reporte_calificaciones_${Date.now()}.csv"`,
    );
    return res.end(csvContent);
  }
}
