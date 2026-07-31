import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import {
  NotificationPayload,
  NotificationTransport,
  SendResult,
} from "./notification-transport.interface";

@Injectable()
export class InAppTransport implements NotificationTransport {
  readonly channel = "IN_APP";
  private readonly logger = new Logger(InAppTransport.name);

  constructor(private prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<SendResult> {
    try {
      await this.prisma.notification.update({
        where: { id: payload.notificationId },
        data: { status: "SENT", sentAt: new Date() },
      });

      return {
        success: true,
        channel: this.channel,
      };
    } catch (error) {
      this.logger.error(
        `Failed to mark in-app notification as sent`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        success: false,
        channel: this.channel,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
