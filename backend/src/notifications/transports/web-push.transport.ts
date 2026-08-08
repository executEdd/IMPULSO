import { NotificationStatus } from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as webPush from "web-push";
import { PrismaService } from "../../prisma.service";
import {
  NotificationPayload,
  NotificationTransport,
  SendResult,
} from "./notification-transport.interface";
import {
  buildSimulationResult,
  isConnectionError,
  updateNotificationStatus,
} from "./transport-utils";

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

    if (!vapidReady) {
      this.logger.log(
        `[SIMULATED WEB PUSH] To user ${payload.userId}\n${pushPayload}`,
      );

      await updateNotificationStatus(this.prisma, payload.notificationId, {
        status: NotificationStatus.SIMULATED,
        metadata: {
          simulated: true,
          reason: "VAPID keys not configured",
          retryable: true,
        },
      });

      return buildSimulationResult(this.channel, "VAPID keys not configured");
    }

    let anySuccess = false;
    let anyFailure = false;
    let anyConnectionError = false;
    const messageIds: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription: webPush.PushSubscription = {
          endpoint: sub.token,
          keys: {
            p256dh: sub.p256dh || "",
            auth: sub.auth || "",
          },
        };

        try {
          const info = await webPush.sendNotification(
            pushSubscription,
            pushPayload,
          );
          anySuccess = true;
          messageIds.push(info.statusCode.toString());
        } catch (error) {
          this.logger.error(
            `Failed to send web push to subscription ${sub.id}`,
            error instanceof Error ? error.stack : undefined,
          );

          const anyError = error as any;
          if (anyError.statusCode === 404 || anyError.statusCode === 410) {
            await this.prisma.pushSubscription.delete({
              where: { id: sub.id },
            });
          }

          if (isConnectionError(error)) {
            anyConnectionError = true;
          } else {
            anyFailure = true;
          }
        }
      }),
    );

    if (anyConnectionError && !anySuccess && !anyFailure) {
      await updateNotificationStatus(this.prisma, payload.notificationId, {
        status: NotificationStatus.SIMULATED,
        metadata: {
          simulated: true,
          reason: "Web push connection failed",
          retryable: true,
        },
      });

      return buildSimulationResult(this.channel, "Web push connection failed");
    }

    if (anyFailure) {
      await updateNotificationStatus(this.prisma, payload.notificationId, {
        status: NotificationStatus.FAILED,
      });

      return {
        success: false,
        channel: this.channel,
        error: "One or more web push subscriptions failed",
      };
    }

    await updateNotificationStatus(this.prisma, payload.notificationId, {
      status: NotificationStatus.SENT,
    });

    return {
      success: true,
      channel: this.channel,
      messageId: messageIds.join(","),
    };
  }
}
