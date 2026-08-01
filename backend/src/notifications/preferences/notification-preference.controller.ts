import { Body, Controller, Get, Put } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { UpdateNotificationPreferenceDto } from "../dto/update-notification-preference.dto";
import { NotificationPreferenceService } from "./notification-preference.service";

@ApiTags("Preferencias de Notificaciones")
@Controller("notification-preferences")
@ApiBearerAuth()
export class NotificationPreferenceController {
  constructor(
    private notificationPreferenceService: NotificationPreferenceService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Obtener preferencias de notificación del usuario" })
  @ApiOkResponse({
    description: "Listado de preferencias de notificación del usuario.",
  })
  findByUser(@CurrentUser("id") userId: number) {
    return this.notificationPreferenceService.findByUser(userId);
  }

  @Put()
  @ApiOperation({ summary: "Actualizar preferencia de notificación" })
  @ApiBody({ type: UpdateNotificationPreferenceDto })
  @ApiOkResponse({
    description: "Preferencia de notificación actualizada correctamente.",
  })
  update(
    @Body() dto: UpdateNotificationPreferenceDto,
    @CurrentUser("id") userId: number,
  ) {
    return this.notificationPreferenceService.update(
      userId,
      dto.channel,
      dto.enabled,
    );
  }
}
