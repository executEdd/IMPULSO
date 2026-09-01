import { NotificationStatus, Prisma } from "@prisma/client";
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
  alert?: {
    id: number;
    studentId: number;
    type: string;
    priority: string;
    message: string;
  };
  globalMessage?: string;
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

  async dispatch(
    input: DispatchAlertInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;
    const title = input.title || "Notificación CBTIS 61";

    for (const recipient of input.recipients) {
      const recipientType = await this.inferRecipientType(
        recipient.userId,
        client,
      );

      for (const channel of recipient.channels) {
        const transports = this.transports.get(channel);
        if (!transports || transports.length === 0) {
          continue;
        }

        for (const transport of transports) {
          const content = input.alert?.message || input.globalMessage || "";
          const notification = await client.notification.create({
            data: {
              alertId: input.alert?.id || null,
              senderId: input.senderId,
              recipientType,
              recipientId: recipient.userId,
              channel:
                transport.channel === "PUSH" ? channel : transport.channel,
              status: NotificationStatus.PENDING,
              content,
            },
          });

          const payload: NotificationPayload = {
            notificationId: notification.id,
            userId: recipient.userId,
            email: recipient.email,
            phone: recipient.phone,
            title,
            body: content,
            data: input.alert
              ? {
                  alertId: input.alert.id,
                  studentId: input.alert.studentId,
                  type: input.alert.type,
                  priority: input.alert.priority,
                }
              : {},
          };

          // Fire-and-forget to avoid blocking the HTTP request.
          transport.send(payload).catch((error) => {
            console.error(
              `Notification transport ${transport.channel} failed`,
              error,
            );
          });
        }
      }
    }
  }

  private async inferRecipientType(
    userId: number,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role || "UNKNOWN";
  }
}
