import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { EmailTransport } from "./transports/email.transport";
import { InAppTransport } from "./transports/in-app.transport";
import { MobilePushTransport } from "./transports/mobile-push.transport";
import {
  NotificationPayload,
  NotificationTransport,
} from "./transports/notification-transport.interface";
import { SmsTransport } from "./transports/sms.transport";
import { WebPushTransport } from "./transports/web-push.transport";
import { WhatsAppTransport } from "./transports/whatsapp.transport";

export interface AlertRecipient {
  userId: number;
  email?: string;
  phone?: string;
  channels: string[];
}

export interface DispatchAlertInput {
  alert: {
    id: number;
    studentId: number;
    type: string;
    priority: string;
    message: string;
  };
  recipients: AlertRecipient[];
  senderId: number;
  title?: string;
}

@Injectable()
export class NotificationRouterService {
  private transports: Map<string, NotificationTransport[]>;

  constructor(
    private prisma: PrismaService,
    private inApp: InAppTransport,
    private email: EmailTransport,
    private sms: SmsTransport,
    private whatsapp: WhatsAppTransport,
    private webPush: WebPushTransport,
    private mobilePush: MobilePushTransport,
  ) {
    this.transports = new Map([
      ["IN_APP", [inApp]],
      ["EMAIL", [email]],
      ["SMS", [sms]],
      ["WHATSAPP", [whatsapp]],
      ["PUSH", [webPush, mobilePush]],
    ]);
  }

  async dispatch(input: DispatchAlertInput): Promise<void> {
    const title = input.title || "Notificación CBTIS 61";

    for (const recipient of input.recipients) {
      const recipientType = await this.inferRecipientType(recipient.userId);

      for (const channel of recipient.channels) {
        const transports = this.transports.get(channel);
        if (!transports || transports.length === 0) {
          continue;
        }

        for (const transport of transports) {
          const notification = await this.prisma.notification.create({
            data: {
              alertId: input.alert.id,
              senderId: input.senderId,
              recipientType,
              recipientId: recipient.userId,
              channel: transport.channel === "PUSH" ? channel : transport.channel,
              status: "PENDING",
              content: input.alert.message,
            },
          });

          const payload: NotificationPayload = {
            notificationId: notification.id,
            userId: recipient.userId,
            email: recipient.email,
            phone: recipient.phone,
            title,
            body: input.alert.message,
            data: {
              alertId: input.alert.id,
              studentId: input.alert.studentId,
              type: input.alert.type,
              priority: input.alert.priority,
            },
          };

          // Fire-and-forget to avoid blocking the HTTP request.
          transport.send(payload).catch((error) => {
            console.error(`Notification transport ${transport.channel} failed`, error);
          });
        }
      }
    }
  }

  private async inferRecipientType(userId: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role || "UNKNOWN";
  }
}
