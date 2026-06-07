import { Controller, Get, Post, Put, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Notificaciones')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear notificación' })
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
    @CurrentUser('id') senderId: number,
  ) {
    return this.notificationsService.create(createNotificationDto, senderId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar todas las notificaciones' })
  async findAll() {
    return this.notificationsService.findAll();
  }

  @Get('my-notifications')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Obtener notificaciones del usuario autenticado' })
  async findByRecipient(
    @CurrentUser('id') recipientId: number,
    @CurrentUser('role') recipientType: string,
  ) {
    return this.notificationsService.findByRecipient(recipientId, recipientType);
  }

  @Get('unread-count')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Contar notificaciones no leídas' })
  async getUnreadCount(
    @CurrentUser('id') recipientId: number,
    @CurrentUser('role') recipientType: string,
  ) {
    return this.notificationsService.getUnreadCount(recipientId, recipientType);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Obtener notificación por ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.findOne(id);
  }

  @Put(':id/read')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  async markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('send-manual')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Enviar notificación manual a padre de familia' })
  async sendManualNotification(
    @Body() body: { studentId: number; recipientType: string; channel: string; content: string },
    @CurrentUser('id') senderId: number,
  ) {
    return this.notificationsService.sendManualNotification(
      body.studentId,
      body.recipientType,
      body.channel,
      body.content,
      senderId,
    );
  }
}
