export interface NotificationPayload {
  notificationId: number;
  userId: number;
  email?: string;
  phone?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface SendResult {
  success: boolean;
  channel: string;
  messageId?: string;
  error?: string;
}

export interface NotificationTransport {
  readonly channel: string;
  send(payload: NotificationPayload): Promise<SendResult>;
}

export const NOTIFICATION_CHANNELS = {
  IN_APP: "IN_APP",
  EMAIL: "EMAIL",
  SMS: "SMS",
  WHATSAPP: "WHATSAPP",
  PUSH: "PUSH",
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];
