import { NotificationStatus } from "@prisma/client";
import { PrismaService } from "../../prisma.service";

export interface NotificationStatusUpdate {
  status: NotificationStatus;
  metadata?: Record<string, unknown>;
}

export async function updateNotificationStatus(
  prisma: PrismaService,
  notificationId: number,
  update: NotificationStatusUpdate,
): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: update.status,
      sentAt: update.status === "SENT" ? new Date() : null,
      metadata: update.metadata ? (update.metadata as never) : undefined,
    },
  });
}

export function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const connectionErrorCodes = [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ENETUNREACH",
    "EAI_AGAIN",
    "ECONNRESET",
    "EPIPE",
  ];

  const code = (error as any).code as string | undefined;
  if (code && connectionErrorCodes.includes(code)) return true;

  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("connection refused") ||
    message.includes("getaddrinfo") ||
    message.includes("network is unreachable")
  );
}

export function buildSimulationResult(
  channel: string,
  reason: string,
  retryable = true,
) {
  return {
    success: true,
    channel,
    simulated: true,
    simulationReason: reason,
    retryable,
  };
}

export function buildFailureResult(
  channel: string,
  error: unknown,
): {
  success: false;
  channel: string;
  error: string;
} {
  return {
    success: false,
    channel,
    error: error instanceof Error ? error.message : "Unknown error",
  };
}
