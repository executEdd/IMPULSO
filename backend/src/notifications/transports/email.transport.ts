import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { PrismaService } from "../../prisma.service";
import {
  NotificationPayload,
  NotificationTransport,
  SendResult,
} from "./notification-transport.interface";

@Injectable()
export class EmailTransport implements NotificationTransport {
  readonly channel = "EMAIL";
  private readonly logger = new Logger(EmailTransport.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>("SMTP_HOST");
    const port = this.config.get<number>("SMTP_PORT");
    const from = this.config.get<string>("EMAIL_FROM");

    if (!host || !port || !from) {
      this.logger.warn(
        "SMTP not configured. Email notifications will be simulated.",
      );
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      auth: {
        user: this.config.get<string>("SMTP_USER") || undefined,
        pass: this.config.get<string>("SMTP_PASS") || undefined,
      },
    });

    return this.transporter;
  }

  async send(payload: NotificationPayload): Promise<SendResult> {
    if (!payload.email) {
      return {
        success: false,
        channel: this.channel,
        error: "No email address available",
      };
    }

    const transporter = this.getTransporter();
    const from =
      this.config.get<string>("EMAIL_FROM") || "noreply@cbtis61.edu.mx";

    try {
      if (transporter) {
        const info = await transporter.sendMail({
          from,
          to: payload.email,
          subject: payload.title,
          text: payload.body,
        });

        await this.prisma.notification.update({
          where: { id: payload.notificationId },
          data: { status: "SENT", sentAt: new Date() },
        });

        return {
          success: true,
          channel: this.channel,
          messageId: info.messageId,
        };
      }

      // Simulated mode: log and keep as PENDING
      this.logger.log(
        `[SIMULATED EMAIL] To: ${payload.email}\nSubject: ${payload.title}\n${payload.body}`,
      );

      return {
        success: true,
        channel: this.channel,
        messageId: "simulated",
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${payload.email}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.prisma.notification.update({
        where: { id: payload.notificationId },
        data: { status: "FAILED" },
      });

      return {
        success: false,
        channel: this.channel,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
