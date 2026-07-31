import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { NotificationPreferenceService } from "./notification-preference.service";

class UpdatePreferenceDto {
  channel!: string;
  enabled!: boolean;
}

@ApiTags("Preferencias de Notificaciones")
@Controller("notification-preferences")
@ApiBearerAuth()
export class NotificationPreferenceController {
  constructor(
    private notificationPreferenceService: NotificationPreferenceService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Obtener preferencias de notificación del usuario" })
  findByUser(@CurrentUser("id") userId: number) {
    return this.notificationPreferenceService.findByUser(userId);
  }

  @Put()
  @ApiOperation({ summary: "Actualizar preferencia de notificación" })
  update(
    @Body() dto: UpdatePreferenceDto,
    @CurrentUser("id") userId: number,
  ) {
    return this.notificationPreferenceService.update(
      userId,
      dto.channel,
      dto.enabled,
    );
  }
}
