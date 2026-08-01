import { NotificationStatus } from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as firebaseAdmin from "firebase-admin";
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
export class MobilePushTransport implements NotificationTransport {
  readonly channel = "PUSH";
  private readonly logger = new Logger(MobilePushTransport.name);
  private firebaseApp: any = null;
  private firebaseInitialized = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private initializeFirebase(): boolean {
    if (this.firebaseInitialized) return this.firebaseApp !== null;

    const projectId = this.config.get<string>("FIREBASE_PROJECT_ID");
    const clientEmail = this.config.get<string>("FIREBASE_CLIENT_EMAIL");
    const privateKey = this.config.get<string>("FIREBASE_PRIVATE_KEY");

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        "Firebase not configured. Mobile push notifications will be simulated.",
      );
      this.firebaseInitialized = true;
      return false;
    }

    try {
      this.firebaseApp = firebaseAdmin.apps.length
        ? firebaseAdmin.app()
        : firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert({
              projectId,
              clientEmail,
              privateKey: privateKey.replace(/\\n/g, "\n"),
            }),
          });
      this.firebaseInitialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        "Failed to initialize Firebase",
        error instanceof Error ? error.stack : undefined,
      );
      this.firebaseInitialized = true;
      return false;
    }
  }

  async send(payload: NotificationPayload): Promise<SendResult> {
    const tokens = await this.prisma.pushSubscription.findMany({
      where: {
        userId: payload.userId,
        OR: [{ platform: "FCM_ANDROID" }, { platform: "FCM_IOS" }],
      },
    });

    if (tokens.length === 0) {
      this.logger.debug(`No FCM tokens for user ${payload.userId}`);
      return {
        success: true,
        channel: this.channel,
        messageId: "no-tokens",
      };
    }

    const firebaseReady = this.initializeFirebase();

    if (!firebaseReady) {
      this.logger.log(
        `[SIMULATED FCM PUSH] To user ${payload.userId} (${tokens.length} tokens)`,
      );

      await updateNotificationStatus(this.prisma, payload.notificationId, {
        status: NotificationStatus.SIMULATED,
        metadata: {
          simulated: true,
          reason: "Firebase not configured",
          retryable: true,
        },
      });

      return buildSimulationResult(this.channel, "Firebase not configured");
    }

    let anySuccess = false;
    let anyFailure = false;
    let anyConnectionError = false;
    const messageIds: string[] = [];

    await Promise.all(
      tokens.map(async (token) => {
        try {
          const messaging = firebaseAdmin.messaging();
          const response = await messaging.sendEachForMulticast({
            tokens: [token.token],
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: payload.data,
          });

          if (response.failureCount > 0 && response.responses[0]?.error) {
            throw response.responses[0].error;
          }

          anySuccess = true;
          messageIds.push(response.responses[0]?.messageId || "fcm");
        } catch (error) {
          this.logger.error(
            `Failed to send FCM push to token ${token.id}`,
            error instanceof Error ? error.stack : undefined,
          );

          const anyError = error as any;
          if (
            anyError?.code === "messaging/registration-token-not-registered" ||
            anyError?.code === "messaging/invalid-registration-token"
          ) {
            await this.prisma.pushSubscription.delete({
              where: { id: token.id },
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
          reason: "FCM connection failed",
          retryable: true,
        },
      });

      return buildSimulationResult(this.channel, "FCM connection failed");
    }

    if (anyFailure) {
      await updateNotificationStatus(this.prisma, payload.notificationId, {
        status: NotificationStatus.FAILED,
      });

      return {
        success: false,
        channel: this.channel,
        error: "One or more FCM tokens failed",
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
