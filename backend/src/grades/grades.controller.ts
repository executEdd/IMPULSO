import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Calificaciones')
@Controller('grades')
@ApiBearerAuth()
export class GradesController {
  constructor(private gradesService: GradesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Crear calificación (con log de auditoría)' })
  async create(
    @Body() createGradeDto: CreateGradeDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.gradesService.create(createGradeDto, userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Listar calificaciones' })
  @ApiQuery({ name: 'studentId', required: false, type: Number })
  @ApiQuery({ name: 'subjectId', required: false, type: Number })
  @ApiQuery({ name: 'period', required: false, type: String })
  async findAll(
    @Query('studentId', new ParseIntPipe({ optional: true })) studentId?: number,
    @Query('subjectId', new ParseIntPipe({ optional: true })) subjectId?: number,
    @Query('period') period?: string,
  ) {
    return this.gradesService.findAll({
      studentId,
      subjectId,
      period,
    });
  }

  @Get('logs/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtener todos los logs de auditoría' })
  async getAllLogs() {
    return this.gradesService.getAllLogs();
  }

  @Get('logs/:gradeId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtener logs de auditoría de una calificación' })
  async getGradeLogs(@Param('gradeId', ParseIntPipe) gradeId: number) {
    return this.gradesService.getGradeLogs(gradeId);
  }

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Obtener calificaciones de un alumno' })
  async findByStudent(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.gradesService.findByStudent(studentId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Obtener calificación por ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.gradesService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Actualizar calificación (con log de auditoría automático)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateGradeDto: UpdateGradeDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.gradesService.update(id, updateGradeDto, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar calificación' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.gradesService.remove(id);
  }
}
