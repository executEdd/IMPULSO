import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";

export interface RegisterPushTokenInput {
  userId: number;
  token: string;
  platform: "WEB_PUSH" | "FCM_ANDROID" | "FCM_IOS";
  p256dh?: string;
  auth?: string;
  userAgent?: string;
}

@Injectable()
export class PushService {
  constructor(private prisma: PrismaService) {}

  async register(input: RegisterPushTokenInput) {
    if (!input.token || input.token.trim().length === 0) {
      throw new BadRequestException("Token is required");
    }

    if (input.platform === "WEB_PUSH" && (!input.p256dh || !input.auth)) {
      throw new BadRequestException(
        "p256dh and auth are required for web push subscriptions",
      );
    }

    return this.prisma.pushSubscription.upsert({
      where: {
        userId_token: {
          userId: input.userId,
          token: input.token,
        },
      },
      update: {
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      },
      create: {
        userId: input.userId,
        token: input.token,
        platform: input.platform,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      },
    });
  }

  async unregister(userId: number, token: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, token },
    });
  }

  async findByUser(userId: number) {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, platform: true, userAgent: true, createdAt: true },
    });
  }
}
