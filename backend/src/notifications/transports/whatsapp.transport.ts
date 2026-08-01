import { NotificationStatus } from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import {
  NotificationPayload,
  NotificationTransport,
  SendResult,
} from "./notification-transport.interface";
import {
  buildSimulationResult,
  updateNotificationStatus,
} from "./transport-utils";

@Injectable()
export class WhatsAppTransport implements NotificationTransport {
  readonly channel = "WHATSAPP";
  private readonly logger = new Logger(WhatsAppTransport.name);

  constructor(private prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<SendResult> {
    if (!payload.phone) {
      return {
        success: false,
        channel: this.channel,
        error: "No phone number available",
      };
    }

    // WhatsApp is simulated until a provider (WhatsApp Business API) is configured.
    this.logger.log(
      `[SIMULATED WHATSAPP] To: ${payload.phone}\n${payload.title}\n${payload.body}`,
    );

    await updateNotificationStatus(this.prisma, payload.notificationId, {
      status: NotificationStatus.SIMULATED,
      metadata: {
        simulated: true,
        reason: "WhatsApp provider not configured",
        retryable: true,
      },
    });

    return buildSimulationResult(
      this.channel,
      "WhatsApp provider not configured",
    );
  }
}
