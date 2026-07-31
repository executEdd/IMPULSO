import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import {
  NotificationPayload,
  NotificationTransport,
  SendResult,
} from "./notification-transport.interface";

@Injectable()
export class SmsTransport implements NotificationTransport {
  readonly channel = "SMS";
  private readonly logger = new Logger(SmsTransport.name);

  constructor(private prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<SendResult> {
    if (!payload.phone) {
      return {
        success: false,
        channel: this.channel,
        error: "No phone number available",
      };
    }

    // SMS is simulated until a provider (Twilio, Plivo, etc.) is configured.
    this.logger.log(
      `[SIMULATED SMS] To: ${payload.phone}\n${payload.title}\n${payload.body}`,
    );

    // Keep as PENDING so the UI shows it is queued for a real provider.
    return {
      success: true,
      channel: this.channel,
      messageId: "simulated",
    };
  }
}
