import { Injectable, Logger } from "@nestjs/common";
import {
  NotificationPayload,
  NotificationTransport,
  SendResult,
} from "./notification-transport.interface";

@Injectable()
export class WhatsAppTransport implements NotificationTransport {
  readonly channel = "WHATSAPP";
  private readonly logger = new Logger(WhatsAppTransport.name);

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

    return {
      success: true,
      channel: this.channel,
      messageId: "simulated",
    };
  }
}
