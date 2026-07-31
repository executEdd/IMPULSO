import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";

export const DEFAULT_CHANNELS = ["IN_APP", "EMAIL", "PUSH", "SMS", "WHATSAPP"];

@Injectable()
export class NotificationPreferenceService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: number) {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    // Ensure all default channels are present.
    const existing = new Map(
      preferences.map((p: { channel: string; enabled: boolean }) => [
        p.channel,
        p.enabled,
      ]),
    );

    return DEFAULT_CHANNELS.map((channel) => ({
      channel,
      enabled: existing.has(channel) ? existing.get(channel) : true,
    }));
  }

  async update(userId: number, channel: string, enabled: boolean) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_channel: { userId, channel } },
      update: { enabled },
      create: { userId, channel, enabled },
    });
  }

  async isEnabled(userId: number, channel: string): Promise<boolean> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId_channel: { userId, channel } },
    });
    return preference?.enabled ?? true;
  }
}
