import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/roles.enum';

@ApiTags('Horarios')
@Controller('schedules')
@ApiBearerAuth()
export class SchedulesController {
  constructor(private schedulesService: SchedulesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear horario (con validación de conflictos)' })
  async create(@Body() createScheduleDto: CreateScheduleDto) {
    return this.schedulesService.create(createScheduleDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Listar todos los horarios' })
  async findAll() {
    return this.schedulesService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Obtener horario por ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.findOne(id);
  }

  @Get('teacher/:teacherId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Obtener horarios de un docente' })
  async findByTeacher(@Param('teacherId', ParseIntPipe) teacherId: number) {
    return this.schedulesService.findByTeacher(teacherId);
  }

  @Get('group/:groupId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Obtener horarios de un grupo' })
  async findByGroup(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.schedulesService.findByGroup(groupId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar horario (con validación de conflictos)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, updateScheduleDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar horario' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.remove(id);
  }

  @Get('check-conflicts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Verificar conflictos de horario antes de guardar' })
  async checkConflicts(
    @Query('teacherId') teacherId: string,
    @Query('groupId') groupId: string,
    @Query('dayOfWeek') dayOfWeek: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.schedulesService.checkConflicts(
      parseInt(teacherId),
      parseInt(groupId),
      dayOfWeek,
      startTime,
      endTime,
    );
  }
}
