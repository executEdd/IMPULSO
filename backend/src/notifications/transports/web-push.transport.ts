import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as webPush from "web-push";
import { PrismaService } from "../../prisma.service";
import {
  NotificationPayload,
  NotificationTransport,
  SendResult,
} from "./notification-transport.interface";

@Injectable()
export class WebPushTransport implements NotificationTransport {
  readonly channel = "PUSH";
  private readonly logger = new Logger(WebPushTransport.name);
  private vapidConfigured = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private configureVapid(): boolean {
    if (this.vapidConfigured) return true;

    const publicKey = this.config.get<string>("VAPID_PUBLIC_KEY");
    const privateKey = this.config.get<string>("VAPID_PRIVATE_KEY");
    const subject = this.config.get<string>("VAPID_SUBJECT");

    if (!publicKey || !privateKey || !subject) {
      this.logger.warn(
        "VAPID keys not configured. Web push notifications will be simulated.",
      );
      return false;
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);
    this.vapidConfigured = true;
    return true;
  }

  async send(payload: NotificationPayload): Promise<SendResult> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: payload.userId, platform: "WEB_PUSH" },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No web push subscriptions for user ${payload.userId}`);
      return {
        success: true,
        channel: this.channel,
        messageId: "no-subscriptions",
      };
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });

    const vapidReady = this.configureVapid();

    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription: webPush.PushSubscription = {
          endpoint: sub.token,
          keys: {
            p256dh: sub.p256dh || "",
            auth: sub.auth || "",
          },
        };

        try {
          if (vapidReady) {
            const info = await webPush.sendNotification(
              pushSubscription,
              pushPayload,
            );
            return { success: true, messageId: info.statusCode.toString() };
          }

          // Simulated mode
          this.logger.log(
            `[SIMULATED WEB PUSH] To user ${payload.userId}\n${pushPayload}`,
          );
          return { success: true, messageId: "simulated" };
        } catch (error) {
          this.logger.error(
            `Failed to send web push to subscription ${sub.id}`,
            error instanceof Error ? error.stack : undefined,
          );

          // Remove invalid subscription
          const anyError = error as any;
          if (anyError.statusCode === 404 || anyError.statusCode === 410) {
            await this.prisma.pushSubscription.delete({
              where: { id: sub.id },
            });
          }

          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );

    const allSuccess = results.every((r) => r.success);

    if (allSuccess) {
      await this.prisma.notification.update({
        where: { id: payload.notificationId },
        data: { status: "SENT", sentAt: new Date() },
      });
    } else {
      await this.prisma.notification.update({
        where: { id: payload.notificationId },
        data: { status: "FAILED" },
      });
    }

    return {
      success: allSuccess,
      channel: this.channel,
      messageId: results
        .map((r) => r.messageId)
        .filter(Boolean)
        .join(","),
      error: results.find((r) => !r.success)?.error,
    };
  }
}
