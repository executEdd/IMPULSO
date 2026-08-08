import { NotificationStatus } from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { PrismaService } from "../../prisma.service";
import { EmailTemplateService } from "../email-template.service";
import {
  NotificationPayload,
  NotificationTransport,
  SendResult,
} from "./notification-transport.interface";
import {
  buildFailureResult,
  buildSimulationResult,
  isConnectionError,
  updateNotificationStatus,
} from "./transport-utils";

@Injectable()
export class EmailTransport implements NotificationTransport {
  readonly channel = "EMAIL";
  private readonly logger = new Logger(EmailTransport.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private templateService: EmailTemplateService,
  ) {}

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>("SMTP_HOST");
    const port = this.config.get<number>("SMTP_PORT");
    const from = this.config.get<string>("EMAIL_FROM");

    if (!host || !port || !from) {
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

    if (!transporter) {
      this.logger.log(
        `[SIMULATED EMAIL] To: ${payload.email}\nSubject: ${payload.title}\n${payload.body}`,
      );

      await updateNotificationStatus(this.prisma, payload.notificationId, {
        status: NotificationStatus.SIMULATED,
        metadata: {
          simulated: true,
          reason: "SMTP not configured",
          retryable: true,
        },
      });

      return buildSimulationResult(this.channel, "SMTP not configured");
    }

    try {
      const html = this.templateService.render({
        title: payload.title,
        message: payload.body,
        preheader: payload.body,
        extraInformation: payload.data?.extraInformation as string,
        buttonText: payload.data?.buttonText as string,
        buttonUrl: payload.data?.buttonUrl as string,
      });

      const info = await transporter.sendMail({
        from,
        to: payload.email,
        subject: payload.title,
        text: payload.body,
        html,
      });

      await updateNotificationStatus(this.prisma, payload.notificationId, {
        status: NotificationStatus.SENT,
      });

      return {
        success: true,
        channel: this.channel,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${payload.email}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (isConnectionError(error)) {
        this.logger.warn(
          `Email connection failed for ${payload.email}. Marking as simulated.`,
        );

        await updateNotificationStatus(this.prisma, payload.notificationId, {
          status: NotificationStatus.SIMULATED,
          metadata: {
            simulated: true,
            reason: "SMTP connection failed",
            retryable: true,
          },
        });

        return buildSimulationResult(this.channel, "SMTP connection failed");
      }

      await updateNotificationStatus(this.prisma, payload.notificationId, {
        status: NotificationStatus.FAILED,
      });

      return buildFailureResult(this.channel, error);
    }
  }
}
