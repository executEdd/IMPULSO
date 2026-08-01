import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RegisterPushTokenDto } from "../dto/register-push-token.dto";
import { PushService } from "./push.service";

@ApiTags("Push Notifications")
@Controller("push")
@ApiBearerAuth()
export class PushController {
  constructor(
    private pushService: PushService,
    private config: ConfigService,
  ) {}

  @Post("register")
  @ApiOperation({
    summary: "Registrar token FCM o suscripción Web Push",
    description:
      "Usado por la app móvil (FCM) o el navegador (Web Push VAPID) para recibir notificaciones.",
  })
  @ApiBody({ type: RegisterPushTokenDto })
  @ApiOkResponse({
    description: "Token o suscripción registrada correctamente.",
  })
  register(
    @Body() dto: RegisterPushTokenDto,
    @CurrentUser("id") userId: number,
  ) {
    return this.pushService.register({
      userId,
      token: dto.token,
      platform: dto.platform,
      p256dh: dto.p256dh,
      auth: dto.auth,
      userAgent: dto.userAgent,
    });
  }

  @Delete("unregister")
  @ApiOperation({ summary: "Eliminar token/suscripción de push" })
  @ApiQuery({
    name: "token",
    description: "Token FCM o endpoint Web Push a eliminar",
    example: "https://fcm.googleapis.com/fcm/send/...",
  })
  @ApiOkResponse({
    description: "Token o suscripción eliminada correctamente.",
  })
  unregister(@Query("token") token: string, @CurrentUser("id") userId: number) {
    return this.pushService.unregister(userId, token);
  }

  @Get("subscriptions")
  @ApiOperation({ summary: "Listar suscripciones push del usuario" })
  @ApiOkResponse({
    description: "Listado de suscripciones push del usuario autenticado.",
  })
  findByUser(@CurrentUser("id") userId: number) {
    return this.pushService.findByUser(userId);
  }

  @Get("vapid-public-key")
  @ApiOperation({
    summary: "Obtener clave pública VAPID para suscripción Web Push",
  })
  @ApiOkResponse({
    description: "Clave pública VAPID disponible para Web Push.",
  })
  getVapidPublicKey() {
    return { publicKey: this.config.get<string>("VAPID_PUBLIC_KEY") || "" };
  }
}
