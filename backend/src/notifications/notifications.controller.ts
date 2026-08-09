import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  ForbiddenException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { NotificationResponseDto } from "./dto/notification-response.dto";
import { SendManualNotificationDto } from "./dto/send-manual-notification.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("Notificaciones")
@Controller("notifications")
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Crear notificación" })
  @ApiBody({ type: CreateNotificationDto })
  @ApiCreatedResponse({
    description: "Notificación creada y registrada exitosamente.",
    type: NotificationResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Error al validar los parámetros de la notificación.",
  })
  @ApiUnauthorizedResponse({
    description: "Usuario no autenticado.",
  })
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
    @CurrentUser("id") senderId: number,
  ) {
    return this.notificationsService.create(createNotificationDto, senderId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Listar todas las notificaciones" })
  @ApiOkResponse({
    description: "Listado completo de todas las notificaciones registradas.",
    type: [NotificationResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: "Usuario no autenticado.",
  })
  async findAll() {
    return this.notificationsService.findAll();
  }

  @Get("my-notifications")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Obtener notificaciones del usuario autenticado" })
  @ApiOkResponse({
    description:
      "Listado de notificaciones dirigidas al usuario autenticado actual.",
    type: [NotificationResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: "Usuario no autenticado.",
  })
  async findByRecipient(
    @CurrentUser("id") recipientId: number,
    @CurrentUser("role") recipientType: string,
  ) {
    return this.notificationsService.findByRecipient(
      recipientId,
      recipientType,
    );
  }

  @Get("unread-count")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Contar notificaciones no leídas" })
  @ApiOkResponse({
    description: "Número total de notificaciones pendientes de leer.",
  })
  @ApiUnauthorizedResponse({
    description: "Usuario no autenticado.",
  })
  async getUnreadCount(
    @CurrentUser("id") recipientId: number,
    @CurrentUser("role") recipientType: string,
  ) {
    return this.notificationsService.getUnreadCount(recipientId, recipientType);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Obtener notificación por ID" })
  @ApiOkResponse({
    description: "Notificación encontrada.",
    type: NotificationResponseDto,
  })
  @ApiNotFoundResponse({ description: "Notificación no encontrada." })
  @ApiForbiddenResponse({
    description: "No tiene permisos para ver esta notificación.",
  })
  @ApiUnauthorizedResponse({
    description: "Usuario no autenticado.",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    const notification = await this.notificationsService.findOne(id);
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.TEACHER) {
      if (
        notification.recipientId !== user.id ||
        notification.recipientType !== user.role
      ) {
        throw new ForbiddenException(
          "No tiene permisos para ver esta notificación",
        );
      }
    }
    return notification;
  }

  @Put(":id/read")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Marcar notificación como leída" })
  @ApiOkResponse({
    description: "Notificación marcada como leída exitosamente.",
    type: NotificationResponseDto,
  })
  @ApiNotFoundResponse({ description: "Notificación no encontrada." })
  @ApiForbiddenResponse({
    description: "No tiene permisos para modificar esta notificación.",
  })
  @ApiUnauthorizedResponse({
    description: "Usuario no autenticado.",
  })
  async markAsRead(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    const notification = await this.notificationsService.findOne(id);
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.TEACHER) {
      if (
        notification.recipientId !== user.id ||
        notification.recipientType !== user.role
      ) {
        throw new ForbiddenException(
          "No tiene permisos para modificar esta notificación",
        );
      }
    }
    return this.notificationsService.markAsRead(id);
  }

  @Post("send-manual")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Enviar notificación manual a padre de familia" })
  @ApiBody({ type: SendManualNotificationDto })
  @ApiCreatedResponse({
    description: "Notificación manual encolada y enviada correctamente.",
    type: NotificationResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Datos de envío incorrectos o canal inválido.",
  })
  @ApiUnauthorizedResponse({
    description: "Usuario no autenticado.",
  })
  async sendManualNotification(
    @Body() sendManualNotificationDto: SendManualNotificationDto,
    @CurrentUser("id") senderId: number,
  ) {
    const targetId =
      sendManualNotificationDto.recipientId ?? sendManualNotificationDto.studentId;

    if (!targetId) {
      throw new BadRequestException(
        "Se requiere recipientId o studentId para enviar la notificación",
      );
    }

    return this.notificationsService.sendManualNotification(
      targetId,
      sendManualNotificationDto.recipientType,
      sendManualNotificationDto.channel,
      sendManualNotificationDto.content,
      senderId,
    );
  }
}
