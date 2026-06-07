import { Controller, Get, Post, Param, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QrService } from './qr.service';
import { Roles } from './common/decorators/roles.decorator';
import { UserRole } from './common/enums/roles.enum';
import { CurrentUser } from './common/decorators/current-user.decorator';

@ApiTags('QR Digital')
@Controller('qr')
@ApiBearerAuth()
export class QrController {
  constructor(private qrService: QrService) {}

  @Get('my-qr')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Obtener QR actual del alumno autenticado' })
  async getMyQr(@CurrentUser('studentProfile') studentProfile: any) {
    if (!studentProfile?.id) {
      throw new BadRequestException('Perfil de estudiante no encontrado');
    }
    return this.qrService.getStudentQr(studentProfile.id);
  }

  @Post('refresh')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Generar nuevo QR para el alumno autenticado' })
  async refreshMyQr(@CurrentUser('studentProfile') studentProfile: any) {
    if (!studentProfile?.id) {
      throw new BadRequestException('Perfil de estudiante no encontrado');
    }
    return this.qrService.refreshStudentQr(studentProfile.id);
  }

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Obtener QR de un alumno específico (Admin/Docente)' })
  async getStudentQr(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.qrService.getStudentQr(studentId);
  }

  @Post('refresh/:studentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Forzar regeneración de QR de un alumno' })
  async refreshStudentQr(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.qrService.refreshStudentQr(studentId);
  }
}
