import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { EmailTransport } from "./transports/email.transport";
import { InAppTransport } from "./transports/in-app.transport";
import { MobilePushTransport } from "./transports/mobile-push.transport";
import { NotificationRouterService } from "./notification-router.service";
import { SmsTransport } from "./transports/sms.transport";
import { WebPushTransport } from "./transports/web-push.transport";
import { WhatsAppTransport } from "./transports/whatsapp.transport";
import { PushController } from "./push/push.controller";
import { PushService } from "./push/push.service";
import { NotificationPreferenceController } from "./preferences/notification-preference.controller";
import { NotificationPreferenceService } from "./preferences/notification-preference.service";

@Module({
  providers: [
    NotificationsService,
    InAppTransport,
    EmailTransport,
    SmsTransport,
    WhatsAppTransport,
    WebPushTransport,
    MobilePushTransport,
    NotificationRouterService,
    PushService,
    NotificationPreferenceService,
  ],
  controllers: [
    NotificationsController,
    PushController,
    NotificationPreferenceController,
  ],
  exports: [NotificationsService, NotificationRouterService, PushService],
})
export class NotificationsModule {}
