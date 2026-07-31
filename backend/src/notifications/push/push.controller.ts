import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PushService } from "./push.service";

class RegisterPushTokenDto {
  token!: string;
  platform!: "WEB_PUSH" | "FCM_ANDROID" | "FCM_IOS";
  p256dh?: string;
  auth?: string;
  userAgent?: string;
}

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
  unregister(
    @Query("token") token: string,
    @CurrentUser("id") userId: number,
  ) {
    return this.pushService.unregister(userId, token);
  }

  @Get("subscriptions")
  @ApiOperation({ summary: "Listar suscripciones push del usuario" })
  findByUser(@CurrentUser("id") userId: number) {
    return this.pushService.findByUser(userId);
  }

  @Get("vapid-public-key")
  @ApiOperation({
    summary: "Obtener clave pública VAPID para suscripción Web Push",
  })
  getVapidPublicKey() {
    return { publicKey: this.config.get<string>("VAPID_PUBLIC_KEY") || "" };
  }
}
